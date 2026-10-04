import Foundation
import Security

/// One supervision paid for by a key that Polar has not counted yet.
struct PendingSpend: Codable, Hashable, Sendable {
    let key: String
    /// The UDID of the iPhone the key was spent on.
    let deviceID: String
    /// False from the moment the run starts, true once the iPhone has read as
    /// supervised or the person has said it is. A due spend is owed whatever
    /// Polar answers, so it holds its key: the key checks as used up on this
    /// Mac until Polar has counted it or refused it for good.
    var due = false
}

extension PendingSpend {
    /// A list written before a spend could be due reads with every spend still
    /// waiting, rather than as a list this app did not write.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        key = try container.decode(String.self, forKey: .key)
        deviceID = try container.decode(String.self, forKey: .deviceID)
        due = try container.decodeIfPresent(Bool.self, forKey: .due) ?? false
    }

    /// The same key on the same iPhone, waiting or due.
    func isSameSpend(as other: PendingSpend) -> Bool {
        key == other.key && deviceID == other.deviceID
    }
}

/// Where the store keeps its bytes, one item per account name. The app keeps
/// them in the Keychain; the tests keep them in a dictionary.
protocol LicenseStorage {
    /// What is stored under `account`, or nil when nothing is.
    func data(for account: String) throws -> Data?
    /// Store `data` under `account`, replacing whatever was there.
    func set(_ data: Data, for account: String) throws
    /// Take whatever is stored under `account` away. Nothing there is not an
    /// error.
    func remove(_ account: String) throws
}

/// The keys the app is holding on to between launches.
///
/// Two things are kept. The key the reader pasted and has not used yet, so the
/// field is filled in again next time. And every spend Polar has not counted:
/// one is written down when a run starts and made due once the supervision
/// went through, and the app may be quit or offline before Polar says so. A
/// spend stays here until Polar has either counted it or refused it for good.
///
/// Both hold key material, so both go in the Keychain rather than in the
/// defaults.
struct PendingSpendStore {
    private static let savedKeyAccount = "saved-key"
    private static let pendingAccount = "pending-spends"

    let storage: any LicenseStorage

    init(storage: any LicenseStorage = KeychainStorage()) {
        self.storage = storage
    }

    // MARK: - The key waiting to be used

    /// The key the reader pasted last. Nil when there is none, and also when
    /// the Keychain cannot be read, because it only ever fills a field in.
    var savedKey: String? {
        guard let data = try? storage.data(for: Self.savedKeyAccount) else { return nil }
        let key = String(decoding: data, as: UTF8.self)
        return key.isEmpty ? nil : key
    }

    /// Keep a key for the next launch. A key that is only spaces is no key,
    /// so it clears the saved one instead.
    func save(key: String) throws {
        let key = LicenseClient.cleaned(key)
        guard !key.isEmpty else {
            try clearSavedKey()
            return
        }
        try storage.set(Data(key.utf8), for: Self.savedKeyAccount)
    }

    func clearSavedKey() throws {
        try storage.remove(Self.savedKeyAccount)
    }

    // MARK: - Spends Polar has not counted yet

    /// Every spend still owed, oldest first.
    func allPending() throws -> [PendingSpend] {
        guard let data = try storage.data(for: Self.pendingAccount) else { return [] }
        do {
            return try JSONDecoder().decode([PendingSpend].self, from: data)
        } catch {
            throw LicenseStoreError.unreadable
        }
    }

    /// The spends still owed for one iPhone, oldest first.
    func pending(for deviceID: String) throws -> [PendingSpend] {
        try allPending().filter { $0.deviceID == deviceID }
    }

    /// Write down a spend before asking Polar, so it survives a quit. The same
    /// key on the same iPhone is one spend, however often it is added, and one
    /// that is already due stays due.
    @discardableResult
    func addPending(key: String, deviceID: String) throws -> PendingSpend {
        let spend = PendingSpend(key: LicenseClient.cleaned(key), deviceID: deviceID)
        var all = try allPending()
        if let existing = all.first(where: { $0.isSameSpend(as: spend) }) {
            return existing
        }
        all.append(spend)
        try write(all)
        return spend
    }

    /// Write down that a spend's supervision went through, before Polar is
    /// asked to count it, so the key stays held across a quit and an offline
    /// Mac. A spend that is no longer here was settled already and stays gone.
    func markDue(_ spend: PendingSpend) throws {
        var all = try allPending()
        guard let index = all.firstIndex(where: { $0.isSameSpend(as: spend) }), !all[index].due else {
            return
        }
        all[index].due = true
        try write(all)
    }

    /// Forget a spend Polar has counted or refused for good, waiting or due.
    func remove(_ spend: PendingSpend) throws {
        var all = try allPending()
        all.removeAll { $0.isSameSpend(as: spend) }
        try write(all)
    }

    private func write(_ all: [PendingSpend]) throws {
        if all.isEmpty {
            try storage.remove(Self.pendingAccount)
        } else {
            try storage.set(JSONEncoder().encode(all), for: Self.pendingAccount)
        }
    }
}

/// What can stop the store from reading or writing a key.
enum LicenseStoreError: LocalizedError, Equatable {
    /// The Keychain refused. The status is the Security framework's own.
    case keychain(OSStatus)
    /// The list of pending spends is there but is not one this app wrote.
    case unreadable

    var errorDescription: String? {
        switch self {
        case .keychain(let status):
            let reason = SecCopyErrorMessageString(status, nil) as String? ?? "error \(status)"
            return "The Keychain refused the supervision key. macOS reported: \(reason)"
        case .unreadable:
            return "The supervision keys this Mac is holding could not be read."
        }
    }
}

/// Generic passwords in the login Keychain, one per account, under the app's
/// own service name.
///
/// The file based login Keychain rather than the data protection one, which
/// wants a keychain access group entitlement this app does not carry. An
/// item it writes is readable by the same signed app without a prompt, and a
/// Developer ID update keeps the same signature requirement, so it stays
/// readable across updates.
struct KeychainStorage: LicenseStorage {
    static let defaultService = "com.attentionawareness.mac.license"

    let service: String

    init(service: String = KeychainStorage.defaultService) {
        self.service = service
    }

    func data(for account: String) throws -> Data? {
        var query = itemQuery(for: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        switch status {
        case errSecSuccess:
            return result as? Data
        case errSecItemNotFound:
            return nil
        default:
            throw LicenseStoreError.keychain(status)
        }
    }

    func set(_ data: Data, for account: String) throws {
        let query = itemQuery(for: account)
        var status = SecItemUpdate(
            query as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else {
            throw LicenseStoreError.keychain(status)
        }
    }

    func remove(_ account: String) throws {
        let status = SecItemDelete(itemQuery(for: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw LicenseStoreError.keychain(status)
        }
    }

    private func itemQuery(for account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
