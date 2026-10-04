import CImobileDevice
import Foundation

/// USB reads and restart for the seed path. The engine injects these operations
/// in tests; no test needs to open a device.
enum SeedDevice {
    static func iosVersion(udid: String) throws -> String? {
        try LockdownSession(udid: udid).string(key: "ProductVersion")
    }

    /// Whether the iPhone is activated and past Setup Assistant, as one line
    /// for the log. A value the iPhone does not give reads "not given".
    static func setupState(udid: String) -> String {
        do {
            let session = try LockdownSession(udid: udid)
            let activation = session.string(key: "ActivationState") ?? "not given"
            let setupDone = session.bool(domain: "com.apple.purplebuddy", key: "SetupDone")
                .map { "\($0)" } ?? "not given"
            return "activation \(activation), setup done \(setupDone)"
        } catch {
            return "setup state not read: \(DeviceLog.text(error))"
        }
    }

    static func cloudConfiguration(udid: String) throws -> Data {
        Data(try MCInstall(udid: udid).cloudConfiguration(requireAcknowledgement: true).raw.utf8)
    }

    static func restart(udid: String) throws {
        let session = try LockdownSession(udid: udid)
        let service = try session.startService(DIAGNOSTICS_RELAY_SERVICE_NAME)
        defer { lockdownd_service_descriptor_free(service) }
        var client: diagnostics_relay_client_t?
        let connected = diagnostics_relay_client_new(session.deviceHandle, service, &client)
        guard connected == DIAGNOSTICS_RELAY_E_SUCCESS, let client else {
            throw DeviceError.serviceConnectionFailed(
                name: DIAGNOSTICS_RELAY_SERVICE_NAME, code: connected.rawValue
            )
        }
        defer { diagnostics_relay_client_free(client) }
        let status = diagnostics_relay_restart(client, DIAGNOSTICS_RELAY_ACTION_FLAG_WAIT_FOR_DISCONNECT)
        guard status == DIAGNOSTICS_RELAY_E_SUCCESS else {
            throw DeviceError.requestFailed(request: "Restart", code: status.rawValue)
        }
    }

    /// MCInstall returns either the configuration itself or an acknowledged
    /// response with no configuration. Anything else is refused rather than
    /// replacing policy the app could not read.
    static func configuration(from data: Data) throws -> [String: Any] {
        guard let dictionary = try PropertyListSerialization.propertyList(
            from: data, options: [], format: nil
        ) as? [String: Any] else {
            throw DeviceError.unexpectedResponse(request: "GetCloudConfiguration")
        }
        guard dictionary["Status"] != nil else { return dictionary }
        return try MCInstall.checkedCloudConfiguration(from: data)
    }
}
