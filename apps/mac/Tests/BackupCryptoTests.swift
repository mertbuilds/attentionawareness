import CommonCrypto
import XCTest

/// The CommonCrypto wrappers against published test vectors, so a wrong call
/// into the C API shows up here and not on somebody's backup.
final class BackupCryptoTests: XCTestCase {
    func testKeyUnwrapMatchesTheRfc3394Vector() throws {
        // RFC 3394, section 4.6: a 256 bit key wrapped with a 256 bit KEK.
        let wrappingKey = Self.bytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")
        let wrapped = Self.bytes("28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43BFB988B9B7A02DD21")
        let expected = Self.bytes("00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F")

        XCTAssertEqual(BackupCrypto.unwrapKey(wrappingKey: wrappingKey, wrapped: wrapped), expected)
    }

    func testTheWrongWrappingKeyUnwrapsNothing() {
        var wrappingKey = Self.bytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")
        wrappingKey[0] ^= 0xff
        let wrapped = Self.bytes("28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43BFB988B9B7A02DD21")

        XCTAssertNil(BackupCrypto.unwrapKey(wrappingKey: wrappingKey, wrapped: wrapped))
    }

    func testAKeyWrappedByTheFixtureComesBackOut() throws {
        let wrappingKey = Data(repeating: 0x11, count: 32)
        let key = Data(repeating: 0x22, count: 32)
        let wrapped = try BackupFixture.wrapKey(wrappingKey, key)

        XCTAssertEqual(wrapped.count, 40)
        XCTAssertEqual(BackupCrypto.unwrapKey(wrappingKey: wrappingKey, wrapped: wrapped), key)
    }

    func testAesCbcMatchesTheNistVector() throws {
        // NIST SP 800-38A, F.2.5 and F.2.6: CBC-AES256.
        let key = Self.bytes("603DEB1015CA71BE2B73AEF0857D77811F352C073B6108D72D9810A30914DFF4")
        let iv = Self.bytes("000102030405060708090A0B0C0D0E0F")
        let plain = Self.bytes(
            "6BC1BEE22E409F96E93D7E117393172A"
                + "AE2D8A571E03AC9C9EB76FAC45AF8E51"
                + "30C81C46A35CE411E5FBC1191A0A52EF"
                + "F69F2445DF4F9B17AD2B417BE66C3710"
        )
        let cipher = Self.bytes(
            "F58C4C04D6E5F1BA779EABFB5F7BFBD6"
                + "9CFC4E967EDB808D679F777BC6702C7D"
                + "39F23369A9D9BACFA530E26304231461"
                + "B2EB05E2C39BE9FCDA6C19078C6A9D1B"
        )

        XCTAssertEqual(try BackupCrypto.encrypt(plain, key: key, iv: iv), cipher)
        XCTAssertEqual(try BackupCrypto.decrypt(cipher, key: key, iv: iv), plain)
    }

    func testALengthThatIsNotAWholeBlockIsRefused() {
        XCTAssertThrowsError(try BackupCrypto.decrypt(Data(repeating: 0, count: 17), key: Data(repeating: 1, count: 32))) { error in
            guard case PatchError.blockLengthNotAes = error else {
                return XCTFail("expected a block length refusal, got \(error)")
            }
        }
    }

    func testPbkdf2MatchesTheRfc6070Vector() throws {
        // RFC 6070, the SHA-1 case the keybag runs second.
        let sha1 = try BackupCrypto.derivedKey(
            password: Data("password".utf8),
            salt: Data("salt".utf8),
            rounds: 4096,
            hash: CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1),
            length: 20
        )
        XCTAssertEqual(sha1, Self.bytes("4B007901B765489ABEAD49D926F721D065A429C1"))

        // The same inputs through SHA-256, the pass the keybag runs first.
        let sha256 = try BackupCrypto.derivedKey(
            password: Data("password".utf8),
            salt: Data("salt".utf8),
            rounds: 4096,
            hash: CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256)
        )
        XCTAssertEqual(sha256, Self.bytes("C5E478D59288C841AA530DB6845C4C8D962893A001CE4E11A4963873AA98134A"))
    }

    func testPaddingGoesOnAndComesOff() {
        for length in [0, 1, 15, 16, 17, 209] {
            let data = Data(repeating: 0x41, count: length)
            let padded = BackupCrypto.addPadding(data)
            XCTAssertEqual(padded.count % 16, 0)
            XCTAssertGreaterThan(padded.count, data.count)
            XCTAssertEqual(BackupCrypto.stripPadding(padded), data)
        }
    }

    func testTheStreamingFileCryptMatchesTheOneShot() throws {
        let key = Data(repeating: 0x7f, count: 32)
        // Larger than one chunk, so `CCCryptorUpdate` runs more than once.
        var plain = Data()
        while plain.count < 3 * (1 << 20) + 32 {
            plain.append(contentsOf: [UInt8](repeating: UInt8(plain.count % 251), count: 1024))
        }
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("supervise-stream-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let source = directory.appendingPathComponent("plain")
        let encrypted = directory.appendingPathComponent("encrypted")
        let decrypted = directory.appendingPathComponent("decrypted")
        try plain.write(to: source)
        try BackupCrypto.encryptFile(at: source, to: encrypted, key: key)
        try BackupCrypto.decryptFile(at: encrypted, to: decrypted, key: key)

        XCTAssertEqual(try Data(contentsOf: encrypted), try BackupCrypto.encrypt(plain, key: key))
        XCTAssertEqual(try Data(contentsOf: decrypted), plain)
    }

    private static func bytes(_ hex: String) -> Data {
        var data = Data()
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            data.append(UInt8(hex[index ..< next], radix: 16)!)
            index = next
        }
        return data
    }
}
