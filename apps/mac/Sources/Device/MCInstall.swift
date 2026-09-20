import CImobileDevice
import Foundation

/// What the phone says about its own supervision. The app only reports this,
/// it never guesses: an unsupervised phone answers with no cloud configuration
/// at all, which reads here as not supervised.
struct CloudConfiguration: Equatable {
    let isSupervised: Bool
    let organizationName: String?
    /// The whole answer as an XML property list, so the app can show exactly
    /// what the phone said without picking it apart key by key.
    let raw: String
}

/// Client for `com.apple.mobile.MCInstall`, the service Apple Configurator uses
/// to read supervision state and to push configuration profiles over the cable.
/// Messages are plain property lists with a `RequestType` key.
final class MCInstall {
    static let serviceIdentifier = "com.apple.mobile.MCInstall"

    /// The lockdown session stays alive for as long as the service client does:
    /// the connection is made through its device handle.
    private let session: LockdownSession
    private let service: lockdownd_service_descriptor_t
    private let client: property_list_service_client_t

    /// Opens the phone, starts MCInstall and connects to it.
    init(udid: String) throws {
        let session = try LockdownSession(udid: udid)
        let service = try session.startService(Self.serviceIdentifier)

        var client: property_list_service_client_t?
        let status = property_list_service_client_new(session.deviceHandle, service, &client)
        guard status == PROPERTY_LIST_SERVICE_E_SUCCESS, let client else {
            lockdownd_service_descriptor_free(service)
            throw DeviceError.serviceConnectionFailed(
                name: Self.serviceIdentifier,
                code: status.rawValue
            )
        }

        self.session = session
        self.service = service
        self.client = client
    }

    deinit {
        property_list_service_client_free(client)
        lockdownd_service_descriptor_free(service)
    }

    /// Reads the cloud configuration, which is where supervision lives.
    func cloudConfiguration() throws -> CloudConfiguration {
        let request = plist_new_dict()
        plist_dict_set_item(request, "RequestType", plist_new_string("GetCloudConfiguration"))

        let response = try send(request, named: "GetCloudConfiguration", timeout: 15_000)
        defer { plist_free(response) }

        // A phone that has no cloud configuration still acknowledges, it just
        // leaves the dictionary out. Only an explicit error is a failure.
        if let status = Plist.string(Plist.item(response, "Status")), status != "Acknowledged" {
            throw DeviceError.requestRefused(
                request: "GetCloudConfiguration",
                reason: Self.errorText(response)
            )
        }
        guard let raw = Plist.xml(response) else {
            throw DeviceError.unexpectedResponse(request: "GetCloudConfiguration")
        }
        let configuration = Plist.item(response, "CloudConfiguration")
        return CloudConfiguration(
            isSupervised: Plist.bool(Plist.item(configuration, "IsSupervised")) ?? false,
            organizationName: Plist.string(Plist.item(configuration, "OrganizationName")),
            raw: Plist.xml(configuration) ?? raw
        )
    }

    /// Reads the configuration profiles the phone has installed, in the order
    /// it lists them.
    func profileList() throws -> [InstalledProfile] {
        let request = plist_new_dict()
        plist_dict_set_item(request, "RequestType", plist_new_string("GetProfileList"))

        let response = try send(request, named: "GetProfileList", timeout: 15_000)
        defer { plist_free(response) }

        // A phone with no profiles on it still acknowledges, it just leaves the
        // lists out. Only an explicit error is a failure.
        if let status = Plist.string(Plist.item(response, "Status")), status != "Acknowledged" {
            throw DeviceError.requestRefused(
                request: "GetProfileList",
                reason: Self.errorText(response)
            )
        }
        let manifest = Plist.item(response, "ProfileManifest")
        let metadata = Plist.item(response, "ProfileMetadata")
        return Plist.strings(Plist.item(response, "OrderedIdentifiers")).map { identifier in
            let listed = Plist.item(manifest, identifier)
            let payload = Plist.item(metadata, identifier)
            return InstalledProfile(
                id: identifier,
                displayName: Plist.string(Plist.item(payload, "PayloadDisplayName")) ?? identifier,
                organization: Plist.string(Plist.item(payload, "PayloadOrganization")),
                description: Plist.string(Plist.item(listed, "Description")),
                isActive: Plist.bool(Plist.item(listed, "IsActive")) ?? false,
                removalDisallowed: Plist.bool(Plist.item(payload, "PayloadRemovalDisallowed")) ?? false,
                uuid: Plist.string(Plist.item(payload, "PayloadUUID"))
            )
        }
    }

    /// Installs one configuration profile. The bytes are the `.mobileconfig`
    /// file exactly as it was signed.
    func installProfile(_ data: Data) throws {
        let request = plist_new_dict()
        plist_dict_set_item(request, "RequestType", plist_new_string("InstallProfile"))
        let payload = data.withUnsafeBytes { buffer in
            plist_new_data(buffer.baseAddress?.assumingMemoryBound(to: CChar.self), UInt64(data.count))
        }
        plist_dict_set_item(request, "Payload", payload)

        // The phone can take a while here, and on an unsupervised phone it
        // waits for the user to approve the profile in Settings.
        let response = try send(request, named: "InstallProfile", timeout: 60_000)
        defer { plist_free(response) }

        guard Plist.string(Plist.item(response, "Status")) == "Acknowledged" else {
            throw DeviceError.profileRejected(reason: Self.errorText(response))
        }
    }

    /// Sends one request and waits for the answer. Takes ownership of the
    /// request node and hands back an answer the caller has to free.
    private func send(_ request: plist_t?, named name: String, timeout: UInt32) throws -> plist_t {
        defer { plist_free(request) }

        let sent = property_list_service_send_xml_plist(client, request)
        guard sent == PROPERTY_LIST_SERVICE_E_SUCCESS else {
            throw DeviceError.requestFailed(request: name, code: sent.rawValue)
        }

        var response: plist_t?
        let received = property_list_service_receive_plist_with_timeout(client, &response, timeout)
        guard received == PROPERTY_LIST_SERVICE_E_SUCCESS, let response else {
            throw DeviceError.requestFailed(request: name, code: received.rawValue)
        }
        return response
    }

    /// Pulls a readable sentence out of the `ErrorChain` the phone sends back
    /// when it refuses something.
    private static func errorText(_ response: plist_t) -> String {
        let fallback = "It did not say why."
        guard let chain = Plist.item(response, "ErrorChain"),
              plist_get_node_type(chain) == PLIST_ARRAY,
              plist_array_get_size(chain) > 0,
              let first = plist_array_get_item(chain, 0)
        else {
            return fallback
        }
        return Plist.string(Plist.item(first, "LocalizedDescription"))
            ?? Plist.string(Plist.item(first, "USEnglishDescription"))
            ?? Plist.xml(chain)
            ?? fallback
    }
}
