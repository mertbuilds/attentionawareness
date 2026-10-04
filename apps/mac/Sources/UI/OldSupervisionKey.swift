import Foundation
import Security

/// The supervision key that versions before 0.4.0 kept in the login Keychain.
///
/// The app is free now and reads no key, so the item is taken away at launch.
/// This file and its one call can be removed in a later version, once the
/// copies of 0.3.0 that wrote the item have updated.
enum OldSupervisionKey {
    static let service = "com.attentionawareness.mac.license"

    /// Every generic password under the old service: the saved key and the
    /// list of spends. The login Keychain deletes one match for each call
    /// unless it is asked for all of them.
    static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitAll,
        ]
    }

    /// Take the old items away. Nothing there, or a Keychain that refuses, is
    /// not an error anybody needs to hear about.
    static func remove(delete: (CFDictionary) -> OSStatus = SecItemDelete) {
        _ = delete(query as CFDictionary)
    }
}
