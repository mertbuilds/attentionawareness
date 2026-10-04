import Foundation
import Security
import Testing

/// The one delete that takes the key of a paid version out of the Keychain.
/// The tests hand in the delete, so no Keychain is touched.
struct OldSupervisionKeyTests {
    @Test func itAsksForEveryItemUnderTheOldServiceAndNothingElse() throws {
        var asked: [[String: Any]] = []
        OldSupervisionKey.remove { query in
            asked.append(query as? [String: Any] ?? [:])
            return errSecSuccess
        }
        let query = try #require(asked.first)
        #expect(asked.count == 1)
        #expect(Set(query.keys) == [kSecClass as String, kSecAttrService as String, kSecMatchLimit as String])
        #expect(query[kSecClass as String] as? String == kSecClassGenericPassword as String)
        #expect(query[kSecAttrService as String] as? String == "com.attentionawareness.mac.license")
        #expect(query[kSecMatchLimit as String] as? String == kSecMatchLimitAll as String)
    }

    @Test(arguments: [errSecItemNotFound, errSecAuthFailed])
    func aKeychainThatHasNothingOrRefusesIsIgnored(_ status: OSStatus) {
        OldSupervisionKey.remove { _ in status }
    }
}
