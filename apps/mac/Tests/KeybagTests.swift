import XCTest

/// The keybag parser against a blob built record by record, in the shape iOS
/// writes it.
final class KeybagTests: XCTestCase {
    private let classKeys = [
        BackupFixture.fileClass: Data(repeating: 0x31, count: 32),
        BackupFixture.manifestClass: Data(repeating: 0x42, count: 32),
    ]

    func testTheHeaderStopsAtTheFirstClassKey() throws {
        let keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))

        XCTAssertEqual(keybag.attributes["UUID"], Data(repeating: 0x55, count: 16))
        XCTAssertEqual(keybag.number("VERS"), 4)
        XCTAssertEqual(keybag.number("ITER"), BackupFixture.rounds)
        XCTAssertEqual(keybag.number("DPIC"), BackupFixture.rounds)
        XCTAssertEqual(keybag.attributes["SALT"]?.count, 20)
        XCTAssertEqual(keybag.attributes["DPSL"]?.count, 20)
        // The header holds `WRAP` too. The class keys must not overwrite it.
        XCTAssertEqual(keybag.number("WRAP"), 0)
    }

    func testEveryClassKeyIsReadWhole() throws {
        let keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))

        XCTAssertEqual(Set(keybag.classKeys.keys), Set(classKeys.keys))
        for protectionClass in classKeys.keys {
            let entry = try XCTUnwrap(keybag.classKeys[protectionClass])
            XCTAssertEqual(entry.protectionClass, protectionClass)
            XCTAssertEqual(entry.wrap, Keybag.wrapPasscode)
            XCTAssertEqual(entry.wrappedKey?.count, 40)
            XCTAssertNil(entry.key)
        }
    }

    func testUnlockUnwrapsEveryPasscodeWrappedKey() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        try keybag.unlock(password: BackupFixture.password)

        for (protectionClass, key) in classKeys {
            XCTAssertEqual(keybag.classKeys[protectionClass]?.key, key)
        }

        // A file key wrapped with a class key comes back out of the keybag.
        let fileKey = Data(repeating: 0x5a, count: 32)
        let wrapped = try BackupFixture.wrapKey(classKeys[BackupFixture.fileClass]!, fileKey)
        XCTAssertEqual(try keybag.unwrapForClass(BackupFixture.fileClass, wrapped: wrapped), fileKey)
    }

    func testTheWrongPasswordStopsTheUnlock() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        XCTAssertThrowsError(try keybag.unlock(password: BackupFixture.otherPassword)) { error in
            guard case PatchError.wrongPassword = error else {
                return XCTFail("expected the wrong password, got \(error)")
            }
        }
    }

    func testAnEmptyPasswordIsTheWrongPassword() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        XCTAssertThrowsError(try keybag.unlock(password: "")) { error in
            guard case PatchError.wrongPassword = error else {
                return XCTFail("expected the wrong password, got \(error)")
            }
        }
    }

    func testAKeybagWithoutTheSecondStageIsRefused() throws {
        // An older keybag carries no `DPSL` and no `DPIC`, so the password
        // cannot be turned into keys at all.
        var blob = Data()
        blob += BackupFixture.record("VERS", UInt32(3))
        blob += BackupFixture.record("UUID", Data(repeating: 0x55, count: 16))
        blob += BackupFixture.record("SALT", Data(repeating: 0x53, count: 20))
        blob += BackupFixture.record("ITER", UInt32(BackupFixture.rounds))

        var keybag = Keybag(blob: blob)
        XCTAssertThrowsError(try keybag.unlock(password: BackupFixture.password)) { error in
            guard case PatchError.oldKeybag = error else {
                return XCTFail("expected an old keybag, got \(error)")
            }
        }
    }

    func testAClassThatIsNotInTheKeybagIsNamed() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        try keybag.unlock(password: BackupFixture.password)
        XCTAssertThrowsError(try keybag.unwrapForClass(11, wrapped: Data(repeating: 0, count: 40))) { error in
            guard case PatchError.noClassKey(let protectionClass) = error else {
                return XCTFail("expected a missing class key, got \(error)")
            }
            XCTAssertEqual(protectionClass, 11)
        }
    }

    func testBackupKeysUnwrapTheManifestKey() throws {
        let manifestKey = Data(repeating: 0x6b, count: 32)
        var manifest = try BackupFixture.manifestDictionary(udid: BackupFixture.udid, encrypted: true)
        manifest["BackupKeyBag"] = try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys)
        manifest["ManifestKey"] = BackupFixture.littleEndian(UInt32(BackupFixture.manifestClass))
            + (try BackupFixture.wrapKey(classKeys[BackupFixture.manifestClass]!, manifestKey))

        let keys = try BackupKeys.unlock(manifest: manifest, password: BackupFixture.password)
        XCTAssertEqual(keys.manifest, manifestKey)
        XCTAssertNil(keys.file)
    }

    func testABackupWithoutAKeybagIsRefused() throws {
        let manifest = try BackupFixture.manifestDictionary(udid: BackupFixture.udid, encrypted: true)
        XCTAssertThrowsError(try BackupKeys.unlock(manifest: manifest, password: BackupFixture.password)) { error in
            guard case PatchError.noKeybag = error else {
                return XCTFail("expected a missing keybag, got \(error)")
            }
        }
    }
}
