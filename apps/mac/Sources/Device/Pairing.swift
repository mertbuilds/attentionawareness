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
        case .requestNotBuilt(let request, _): return "requestNotBuilt \(request)"
        case .profileRejected: return "profileRejected"
        case .pairRecordRejected: return "pairRecordRejected"
        case .trustUnseen: return "trustUnseen"
        }
    }
}

/// Opening a trusted lockdown session, and pairing again when the iPhone has
/// forgotten this Mac.
///
/// The fast method's restore resets the iPhone's pairing records, so after
/// the restart the iPhone refuses the Mac's record with InvalidHostID. On a
/// record that exists, `lockdownd_client_new_with_handshake` never pairs, and
/// macOS pairs again only when the iPhone is plugged in, which right after a
/// restart is while it is still locked. So the Mac sends Pair itself, the
/// way usbmuxd's preflight does:
///
/// - Pair while the iPhone is locked, every 2 seconds. A locked iPhone shows
///   nothing and answers PasswordProtected.
/// - The first Pair after the unlock shows Trust. From then on no Pair is
///   sent on a timer: a second Pair while the person types the passcode
///   cancels it, and the iPhone answers UserDeniedPairing until the cable is
///   pulled. The Mac waits for the iPhone's `request_pair` notification on
///   the insecure notification proxy, which comes once Trust is tapped and
///   the passcode entered, and sends Pair once more.
/// - UserDeniedPairing is final until the iPhone leaves the cable.
///
/// The handshake still runs on every read, so a record that anything on this
/// Mac saved, macOS's usbmuxd included, is used at once.
enum Pairing {
    /// Runs `handshake`, and on InvalidHostID sends `pair` when `trust` says
    /// it is time. `observe` starts the watch for the iPhone's notifications;
    /// it returns nil when the iPhone would not start the proxy.
    static func open(
        udid: String,
        trust: TrustWatch = .shared,
        now: Date = Date(),
        handshake: () -> lockdownd_error_t,
        pair: () -> lockdownd_error_t,
        observe: () -> AnyObject? = { nil }
    ) throws {
        var status = handshake()
        if status == LOCKDOWN_E_SUCCESS {
            trust.forget(udid)
            return
        }
        if status == LOCKDOWN_E_INVALID_HOST_ID {
            trust.startObserving(udid, at: now, with: observe)
            switch trust.next(udid, at: now) {
            case .hold(let answer):
                DeviceLog.logger.debug("pair held, last answer \(name(answer), privacy: .public)")
                status = answer
            case .stuck:
                DeviceLog.logger.error("Trust was shown and no answer came that the Mac can hear")
                throw DeviceError.trustUnseen
            case .rejected:
                throw DeviceError.pairRecordRejected
            case .pair(let reason):
                let paired = pair()
                trust.record(udid, answer: paired, at: now)
                DeviceLog.logger.notice(
                    "pair (\(reason, privacy: .public)): \(name(paired), privacy: .public) (\(paired.rawValue, privacy: .public))"
                )
                if paired == LOCKDOWN_E_SUCCESS {
                    status = handshake()
                    // The iPhone said yes, so InvalidHostID now means the
                    // record was not saved or not read back. That is no wait
                    // for the person, and "Tap Trust" would never end.
                    if status == LOCKDOWN_E_INVALID_HOST_ID {
                        DeviceLog.logger.error("pair succeeded but the record was not accepted")
                        trust.rejected(udid)
                        throw DeviceError.pairRecordRejected
                    }
                    if status == LOCKDOWN_E_SUCCESS { trust.forget(udid) }
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
        // a wait for the person, and the next read asks again. MuxError is
        // not one of them: it is the connection dropping, which is what an
        // iPhone that restarts answers on its way down, with no Trust on it.
        case LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING,
             LOCKDOWN_E_INVALID_HOST_ID,
             LOCKDOWN_E_INVALID_CONF,
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
        case .trustUnseen, .pairRecordRejected: return .needsReplug
        default: return nil
        }
    }
}

/// Where each iPhone that has forgotten this Mac is with trusting it again,
/// and the watch on its notifications. Reads run on several threads and the
/// notifications arrive on the library's own, so everything goes through one
/// lock, and a Pair is reserved before it is sent so no two go out.
final class TrustWatch: @unchecked Sendable {
    static let shared = TrustWatch()

    /// How long a locked iPhone, or one that failed a Pair for another
    /// reason, is left before the next Pair.
    static let retryInterval: TimeInterval = 2
    /// How long Trust may sit on screen with no answer heard before the read
    /// asks for a replug. A `request_pair` that comes later still pairs.
    static let unheardLimit: TimeInterval = 120
    /// How long after a failed start the proxy is tried again.
    static let observeRetryInterval: TimeInterval = 5

    static let requestPair = "com.apple.mobile.lockdown.request_pair"
    static let requestHostBUID = "com.apple.mobile.lockdown.request_host_buid"

    enum Decision: Equatable {
        case pair(String)
        case hold(lockdownd_error_t)
        case stuck
        case rejected
    }

    private enum Stage {
        /// The last Pair failed with this answer at this time and may go
        /// again after `retryInterval`.
        case retry(at: Date, answer: lockdownd_error_t)
        /// A Pair is out.
        case pairOut
        /// Trust is on screen since this time.
        case dialog(since: Date)
        /// The iPhone posted `request_pair`: Trust was tapped.
        case trustTapped
        case denied
        /// Pair went through and the record was still refused. Only a replug
        /// starts over.
        case rejected
    }

    private struct Entry {
        var stage: Stage?
        var observer: AnyObject?
        var lastObserveTry: Date?
    }

    private let lock = NSLock()
    private var entries: [String: Entry] = [:]
    /// Called when a notification changes what the next read should do.
    var onChange: (@Sendable () -> Void)?

    func next(_ udid: String, at now: Date) -> Decision {
        lock.withLock {
            var entry = entries[udid] ?? Entry()
            let decision: Decision
            switch entry.stage {
            case nil:
                decision = .pair("first")
            case .retry(let at, let answer):
                decision = now.timeIntervalSince(at) >= Self.retryInterval ? .pair("again") : .hold(answer)
            case .pairOut:
                decision = .hold(LOCKDOWN_E_INVALID_HOST_ID)
            case .dialog(let since):
                decision = now.timeIntervalSince(since) >= Self.unheardLimit
                    ? .stuck
                    : .hold(LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING)
            case .trustTapped:
                decision = .pair("request_pair")
            case .denied:
                decision = .hold(LOCKDOWN_E_USER_DENIED_PAIRING)
            case .rejected:
                decision = .rejected
            }
            if case .pair = decision { entry.stage = .pairOut }
            entries[udid] = entry
            return decision
        }
    }

    func record(_ udid: String, answer: lockdownd_error_t, at now: Date) {
        lock.withLock {
            var entry = entries[udid] ?? Entry()
            switch answer {
            case LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING:
                if case .dialog = entry.stage {} else { entry.stage = .dialog(since: now) }
            case LOCKDOWN_E_USER_DENIED_PAIRING:
                entry.stage = .denied
            case LOCKDOWN_E_SUCCESS:
                entry.stage = .dialog(since: now)
            default:
                entry.stage = .retry(at: now, answer: answer)
            }
            entries[udid] = entry
        }
    }

    /// Pair went through and the handshake still refused the record.
    func rejected(_ udid: String) {
        lock.withLock {
            var entry = entries[udid] ?? Entry()
            entry.stage = .rejected
            entries[udid] = entry
        }
    }

    /// Starts the watch on the iPhone's notifications once per connection,
    /// and again a few seconds after a start that failed.
    func startObserving(_ udid: String, at now: Date, with make: () -> AnyObject?) {
        let due = lock.withLock {
            var entry = entries[udid] ?? Entry()
            if entry.observer != nil { return false }
            if let last = entry.lastObserveTry, now.timeIntervalSince(last) < Self.observeRetryInterval { return false }
            entry.lastObserveTry = now
            entries[udid] = entry
            return true
        }
        guard due else { return }
        let observer = make()
        DeviceLog.logger.notice("notification watch \(observer == nil ? "not started" : "started", privacy: .public)")
        guard let observer else { return }
        let extra: AnyObject? = lock.withLock {
            guard var entry = entries[udid], entry.observer == nil else { return observer }
            entry.observer = observer
            entries[udid] = entry
            return nil
        }
        release(extra)
    }

    /// A notification from the iPhone. An empty name means the watch `by`
    /// lost its connection; a newer watch is left alone.
    func notified(_ udid: String, name: String, by observer: ObjectIdentifier? = nil) {
        DeviceLog.logger.notice("notification: \(name.isEmpty ? "watch ended" : name, privacy: .public)")
        let changed: Bool = lock.withLock {
            guard var entry = entries[udid] else { return false }
            if name.isEmpty {
                guard let current = entry.observer, ObjectIdentifier(current) == observer else { return false }
                // Dropped on another thread: the watch is still running this
                // callback, and freeing it here would wait on itself.
                entry.observer = nil
                entries[udid] = entry
                release(current)
                return false
            }
            guard name == Self.requestPair else { return false }
            switch entry.stage {
            case .dialog, .retry: break
            default: return false
            }
            entry.stage = .trustTapped
            entries[udid] = entry
            return true
        }
        if changed { onChange?() }
    }

    /// The iPhone is paired or left the cable: its state and its watch go.
    func forget(_ udid: String) {
        let observer = lock.withLock { entries.removeValue(forKey: udid)?.observer }
        release(observer)
    }

    /// Forgets every iPhone that is not in `udids`.
    func keep(only udids: [String]) {
        let observers: [AnyObject] = lock.withLock {
            let gone = entries.keys.filter { !udids.contains($0) }
            return gone.compactMap { entries.removeValue(forKey: $0)?.observer }
        }
        observers.forEach(release)
    }

    var isObserving: [String: Bool] {
        lock.withLock { entries.mapValues { $0.observer != nil } }
    }

    /// Lets go of a watch away from every lock and every thread that may be
    /// inside its callback: freeing one waits for its thread to stop.
    private func release(_ observer: AnyObject?) {
        guard let observer else { return }
        let box = ObserverBox(observer)
        DispatchQueue.global(qos: .utility).async { box.drop() }
    }
}

private final class ObserverBox: @unchecked Sendable {
    private var observer: AnyObject?
    init(_ observer: AnyObject) { self.observer = observer }
    func drop() { observer = nil }
}
