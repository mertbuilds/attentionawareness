import CImobileDevice
import Foundation

/// How far the phone has got with trusting this Mac.
enum PairingState: String, Equatable {
    /// The handshake worked, so every lockdown value and service is available.
    case paired
    /// The phone is showing the Trust dialog, or it is locked with a passcode.
    case trustPending
    /// The user answered the Trust dialog with Don't Trust.
    case untrusted
}

/// One iPhone on the USB bus, as lockdown describes it. Every field except the
/// identifier is optional because a phone that has not trusted this Mac yet
/// answers almost nothing.
struct ConnectedDevice: Identifiable, Equatable {
    var id: String { udid }

    let udid: String
    let name: String?
    let productType: String?
    let marketingName: String?
    let iosVersion: String?
    let findMyOn: Bool?
    let backupEncrypted: Bool?
    let pairingState: PairingState

    /// The udids of the phones reachable over the cable. Devices that usbmuxd
    /// only sees over the network are skipped: backup and restore need USB.
    static func usbUdids() -> [String] {
        var list: UnsafeMutablePointer<idevice_info_t?>?
        var count: Int32 = 0
        guard idevice_get_device_list_extended(&list, &count) == IDEVICE_E_SUCCESS, let list else {
            return []
        }
        defer { idevice_device_list_extended_free(list) }

        var udids: [String] = []
        for index in 0..<Int(count) {
            guard let info = list[index]?.pointee,
                  info.conn_type == CONNECTION_USBMUXD,
                  let udid = info.udid
            else {
                continue
            }
            udids.append(String(cString: udid))
        }
        return udids
    }

    /// Opens the phone over USB and reads everything the wizard needs. A phone
    /// that has not been trusted yet still comes back, with the pairing state
    /// set and whatever few values lockdown hands out before trust.
    static func read(udid: String) throws -> ConnectedDevice {
        do {
            let session = try LockdownSession(udid: udid)
            return ConnectedDevice(
                udid: udid,
                name: session.string(key: "DeviceName"),
                productType: session.string(key: "ProductType"),
                marketingName: session.string(key: "MarketingName"),
                iosVersion: session.string(key: "ProductVersion"),
                findMyOn: session.bool(domain: "com.apple.fmip", key: "IsAssociated"),
                backupEncrypted: session.bool(domain: "com.apple.mobile.backup", key: "WillEncrypt"),
                pairingState: .paired
            )
        } catch DeviceError.trustPending {
            return readBeforeTrust(udid: udid, pairingState: .trustPending)
        } catch DeviceError.trustDenied {
            return readBeforeTrust(udid: udid, pairingState: .untrusted)
        }
    }

    /// Reads what an untrusted phone still answers. Nothing here is required:
    /// the point is to show the model and the iOS version next to the sentence
    /// that asks the user to tap Trust.
    private static func readBeforeTrust(udid: String, pairingState: PairingState) -> ConnectedDevice {
        let session = try? LockdownSession(udid: udid, handshake: false)
        return ConnectedDevice(
            udid: udid,
            name: session?.string(key: "DeviceName"),
            productType: session?.string(key: "ProductType"),
            marketingName: session?.string(key: "MarketingName"),
            iosVersion: session?.string(key: "ProductVersion"),
            findMyOn: nil,
            backupEncrypted: nil,
            pairingState: pairingState
        )
    }
}

/// An open lockdown connection to one phone. It owns the C handles and frees
/// them when it goes away, so callers never free anything themselves.
final class LockdownSession {
    /// The name the phone records for this app in its pairing record, and the
    /// name that shows up in the phone's own logs.
    static let label = "attentionawareness"

    private let device: idevice_t
    private let client: lockdownd_client_t

    /// Opens the phone over USB only. Network devices are ignored on purpose:
    /// the whole flow needs a cable anyway.
    ///
    /// - Parameter handshake: pass false to skip pairing. A session without a
    ///   handshake can read the few public lockdown values but cannot start
    ///   services.
    init(udid: String, handshake: Bool = true) throws {
        var device: idevice_t?
        guard idevice_new_with_options(&device, udid, IDEVICE_LOOKUP_USBMUX) == IDEVICE_E_SUCCESS,
              let device
        else {
            throw DeviceError.deviceUnavailable(udid: udid)
        }

        var client: lockdownd_client_t?
        let status = handshake
            ? lockdownd_client_new_with_handshake(device, &client, Self.label)
            : lockdownd_client_new(device, &client, Self.label)
        guard status == LOCKDOWN_E_SUCCESS, let client else {
            idevice_free(device)
            switch status {
            case LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING, LOCKDOWN_E_PASSWORD_PROTECTED:
                throw DeviceError.trustPending
            case LOCKDOWN_E_USER_DENIED_PAIRING:
                throw DeviceError.trustDenied
            default:
                throw DeviceError.lockdownFailed(code: status.rawValue)
            }
        }

        self.device = device
        self.client = client
    }

    deinit {
        lockdownd_client_free(client)
        idevice_free(device)
    }

    /// The device handle, for the service clients that need to open their own
    /// connection to the phone.
    var deviceHandle: idevice_t { device }

    /// Reads a string value. Pass nil as the domain for the root domain.
    func string(domain: String? = nil, key: String) -> String? {
        value(domain: domain, key: key, convert: Plist.string)
    }

    /// Reads a boolean value. Pass nil as the domain for the root domain.
    func bool(domain: String? = nil, key: String) -> Bool? {
        value(domain: domain, key: key, convert: Plist.bool)
    }

    /// Asks the phone to start a service and hands back its descriptor. The
    /// caller owns the descriptor and has to free it with
    /// `lockdownd_service_descriptor_free`.
    func startService(_ identifier: String) throws -> lockdownd_service_descriptor_t {
        var service: lockdownd_service_descriptor_t?
        let status = lockdownd_start_service(client, identifier, &service)
        guard status == LOCKDOWN_E_SUCCESS, let service else {
            throw DeviceError.serviceStartFailed(name: identifier, code: status.rawValue)
        }
        return service
    }

    /// Runs one `lockdownd_get_value` and frees the answer whatever happens.
    private func value<T>(domain: String?, key: String, convert: (plist_t?) -> T?) -> T? {
        var node: plist_t?
        guard lockdownd_get_value(client, domain, key, &node) == LOCKDOWN_E_SUCCESS, let node else {
            return nil
        }
        defer { plist_free(node) }
        return convert(node)
    }
}
