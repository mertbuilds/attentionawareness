import CImobileDevice
import Foundation
import os

/// What the device layer writes to the Mac's log: the outcome of every read,
/// with lockdown's error codes and never the udid or the iPhone's name.
/// `log show --info --predicate 'subsystem == "com.attentionawareness.mac"'`
/// reads a run back.
enum DeviceLog {
    static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.attentionawareness.mac",
        category: "device"
    )

    /// An error as the log carries it: its kind and its codes, never a udid
    /// or a sentence from the iPhone.
    static func text(_ error: Error) -> String {
        guard let error = error as? DeviceError else { return String(describing: type(of: error)) }
        switch error {
        case .eventSubscriptionFailed(let code): return "eventSubscriptionFailed \(code)"
        case .deviceUnavailable: return "deviceUnavailable"
        case .trustPending: return "trustPending"
        case .locked: return "locked"
        case .trustDenied: return "trustDenied"
        case .lockdownFailed(let code): return "lockdownFailed \(code)"
        case .serviceStartFailed(let name, let code): return "serviceStartFailed \(name) \(code)"
        case .serviceConnectionFailed(let name, let code): return "serviceConnectionFailed \(name) \(code)"
        case .requestFailed(let request, let code): return "requestFailed \(request) \(code)"
        case .unexpectedResponse(let request): return "unexpectedResponse \(request)"
        case .requestRefused(let request, _): return "requestRefused \(request)"
        case .profileRejected: return "profileRejected"
        case .pairRecordRejected: return "pairRecordRejected"
        }
    }
}

/// Opening a trusted lockdown session, and pairing again when the iPhone has
/// forgotten this Mac.
///
/// The fast method's restore resets the iPhone's pairing records, so after
/// the restart the iPhone refuses the Mac's record with InvalidHostID. On a
/// record that exists, `lockdownd_client_new_with_handshake` never pairs: it
/// only pairs when the Mac has no record at all. And macOS pairs again only
/// when the iPhone is plugged in, which right after a restart is while it is
/// still locked, so it gives up. Nothing sent Pair again until the cable was
/// pulled. Here the Mac sends it itself: the iPhone asks for the passcode or
/// shows Trust, and once the person taps it the next Pair goes through and
/// libimobiledevice saves the new record where every later handshake reads it.
enum Pairing {
    /// Runs `handshake`, and on InvalidHostID sends `pair` and runs the
    /// handshake once more when the iPhone said yes. Throws the state the
    /// iPhone is in otherwise.
    ///
    /// Each Pair makes a new pair record, and what a Pair every two seconds
    /// does to a Trust dialog already on screen is not known, so `throttle`
    /// spaces them out per iPhone. In between, the handshake still runs: it
    /// goes through as soon as anything on this Mac has saved a record the
    /// iPhone accepts.
    static func open(
        udid: String,
        throttle: PairThrottle = .shared,
        now: Date = Date(),
        handshake: () -> lockdownd_error_t,
        pair: () -> lockdownd_error_t
    ) throws {
        var status = handshake()
        if status == LOCKDOWN_E_SUCCESS {
            throttle.forget(udid)
        } else if status == LOCKDOWN_E_INVALID_HOST_ID {
            if let held = throttle.reserve(udid, at: now) {
                DeviceLog.logger.debug("pair skipped, last answer \(name(held), privacy: .public)")
                status = held
            } else {
                DeviceLog.logger.debug("pair sent")
                let paired = pair()
                throttle.record(udid, answer: paired, at: now)
                DeviceLog.logger.notice(
                    "pair after InvalidHostID: \(name(paired), privacy: .public) (\(paired.rawValue, privacy: .public))"
                )
                if paired == LOCKDOWN_E_SUCCESS {
                    status = handshake()
                    // The iPhone said yes, so InvalidHostID now means the
                    // record was not saved or not read back. That is no wait
                    // for the person, and "Tap Trust" would never end.
                    if status == LOCKDOWN_E_INVALID_HOST_ID {
                        DeviceLog.logger.error("pair succeeded but the record was not accepted")
                        throw DeviceError.pairRecordRejected
                    }
                    if status == LOCKDOWN_E_SUCCESS { throttle.forget(udid) }
                } else {
                    status = paired
                }
            }
        }
        guard status == LOCKDOWN_E_SUCCESS else {
            DeviceLog.logger.error(
                "handshake: \(name(status), privacy: .public) (\(status.rawValue, privacy: .public))"
            )
            throw error(for: status)
        }
    }

    /// What a failed lockdown call means for the person at the Mac.
    static func error(for status: lockdownd_error_t) -> DeviceError {
        switch status {
        case LOCKDOWN_E_PASSWORD_PROTECTED:
            return .locked
        // The Trust dialog is up, or the iPhone does not know this Mac and
        // has not been asked yet, or the record is half written. Each one is
        // a wait for the person, and the next read asks again.
        case LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING,
             LOCKDOWN_E_INVALID_HOST_ID,
             LOCKDOWN_E_INVALID_CONF,
             LOCKDOWN_E_MUX_ERROR,
             LOCKDOWN_E_SSL_ERROR,
             LOCKDOWN_E_NO_RUNNING_SESSION:
            return .trustPending
        case LOCKDOWN_E_USER_DENIED_PAIRING:
            return .trustDenied
        default:
            return .lockdownFailed(code: status.rawValue)
        }
    }

    /// The name of the codes a run is likely to meet, for the log.
    static func name(_ status: lockdownd_error_t) -> String {
        switch status {
        case LOCKDOWN_E_SUCCESS: return "success"
        case LOCKDOWN_E_INVALID_CONF: return "InvalidConf"
        case LOCKDOWN_E_SSL_ERROR: return "SSLError"
        case LOCKDOWN_E_RECEIVE_TIMEOUT: return "ReceiveTimeout"
        case LOCKDOWN_E_MUX_ERROR: return "MuxError"
        case LOCKDOWN_E_NO_RUNNING_SESSION: return "NoRunningSession"
        case LOCKDOWN_E_PASSWORD_PROTECTED: return "PasswordProtected"
        case LOCKDOWN_E_USER_DENIED_PAIRING: return "UserDeniedPairing"
        case LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING: return "PairingDialogResponsePending"
        case LOCKDOWN_E_INVALID_HOST_ID: return "InvalidHostID"
        default: return "lockdown error"
        }
    }
}

extension DeviceError {
    /// How far the iPhone is with trusting this Mac, for the errors that are
    /// a wait for the person rather than a failure.
    var pairingState: PairingState? {
        switch self {
        case .trustPending: return .trustPending
        case .locked: return .locked
        case .trustDenied: return .untrusted
        default: return nil
        }
    }
}

/// When each iPhone was last sent Pair and what it answered, so a Pair is
/// not sent again too soon. Reads run on several threads, so a Pair is
/// reserved before it is sent and a second read meanwhile sends none.
final class PairThrottle: @unchecked Sendable {
    static let shared = PairThrottle()

    /// How long an answer stands before the next Pair. A locked iPhone shows
    /// nothing, so it is asked again soon; a Trust dialog on screen is left
    /// alone longer.
    static func interval(after answer: lockdownd_error_t) -> TimeInterval {
        switch answer {
        case LOCKDOWN_E_PASSWORD_PROTECTED: return 2
        case LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING, LOCKDOWN_E_USER_DENIED_PAIRING: return 5
        default: return 0
        }
    }

    private struct Attempt {
        var at: Date
        var answer: lockdownd_error_t?
    }

    private let lock = NSLock()
    private var attempts: [String: Attempt] = [:]

    /// Nil when a Pair may be sent now, and marks it as out. Otherwise the
    /// answer the read reports instead: the last one, or InvalidHostID while
    /// a Pair is still out.
    func reserve(_ udid: String, at now: Date) -> lockdownd_error_t? {
        lock.withLock {
            if let last = attempts[udid] {
                guard let answer = last.answer else { return LOCKDOWN_E_INVALID_HOST_ID }
                if now.timeIntervalSince(last.at) < Self.interval(after: answer) { return answer }
            }
            attempts[udid] = Attempt(at: now, answer: nil)
            return nil
        }
    }

    func record(_ udid: String, answer: lockdownd_error_t, at now: Date) {
        lock.withLock { attempts[udid] = Attempt(at: now, answer: answer) }
    }

    func forget(_ udid: String) {
        lock.withLock { _ = attempts.removeValue(forKey: udid) }
    }
}
