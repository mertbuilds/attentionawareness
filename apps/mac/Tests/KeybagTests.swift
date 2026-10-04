import Foundation
import Testing

/// The keybag parser against a blob built record by record, in the shape iOS
/// writes it.
struct KeybagTests {
    private let classKeys = [
        BackupFixture.fileClass: Data(repeating: 0x31, count: 32),
        BackupFixture.manifestClass: Data(repeating: 0x42, count: 32),
    ]

    @Test func theHeaderStopsAtTheFirstClassKey() throws {
        let keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))

        #expect(keybag.attributes["UUID"] == Data(repeating: 0x55, count: 16))
        #expect(keybag.number("VERS") == 4)
        #expect(keybag.number("ITER") == BackupFixture.rounds)
        #expect(keybag.number("DPIC") == BackupFixture.rounds)
        #expect(keybag.attributes["SALT"]?.count == 20)
        #expect(keybag.attributes["DPSL"]?.count == 20)
        // The header holds `WRAP` too. The class keys must not overwrite it.
        #expect(keybag.number("WRAP") == 0)
    }

    @Test func everyClassKeyIsReadWhole() throws {
        let keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))

        #expect(Set(keybag.classKeys.keys) == Set(classKeys.keys))
        for protectionClass in classKeys.keys {
            let entry = try #require(keybag.classKeys[protectionClass])
            #expect(entry.protectionClass == protectionClass)
            #expect(entry.wrap == Keybag.wrapPasscode)
            #expect(entry.wrappedKey?.count == 40)
            #expect(entry.key == nil)
        }
    }

    @Test func unlockUnwrapsEveryPasscodeWrappedKey() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        try keybag.unlock(password: BackupFixture.password)

        for (protectionClass, key) in classKeys {
            #expect(keybag.classKeys[protectionClass]?.key == key)
        }

        // A file key wrapped with a class key comes back out of the keybag.
        let fileKey = Data(repeating: 0x5a, count: 32)
        let wrapped = try BackupFixture.wrapKey(classKeys[BackupFixture.fileClass]!, fileKey)
        #expect(try keybag.unwrapForClass(BackupFixture.fileClass, wrapped: wrapped) == fileKey)
    }

    @Test func theWrongPasswordStopsTheUnlock() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        let error = try #require(throws: PatchError.self) {
            try keybag.unlock(password: BackupFixture.otherPassword)
        }
        guard case .wrongPassword = error else {
            Issue.record("expected the wrong password, got \(error)")
            return
        }
    }

    @Test func anEmptyPasswordIsTheWrongPassword() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        let error = try #require(throws: PatchError.self) {
            try keybag.unlock(password: "")
        }
        guard case .wrongPassword = error else {
            Issue.record("expected the wrong password, got \(error)")
            return
        }
    }

    @Test func aKeybagWithoutTheSecondStageIsRefused() throws {
        // An older keybag carries no `DPSL` and no `DPIC`, so the password
        // cannot be turned into keys at all.
        var blob = Data()
        blob += BackupFixture.record("VERS", UInt32(3))
        blob += BackupFixture.record("UUID", Data(repeating: 0x55, count: 16))
        blob += BackupFixture.record("SALT", Data(repeating: 0x53, count: 20))
        blob += BackupFixture.record("ITER", UInt32(BackupFixture.rounds))

        var keybag = Keybag(blob: blob)
        let error = try #require(throws: PatchError.self) {
            try keybag.unlock(password: BackupFixture.password)
        }
        guard case .oldKeybag = error else {
            Issue.record("expected an old keybag, got \(error)")
            return
        }
    }

    @Test func aClassThatIsNotInTheKeybagIsNamed() throws {
        var keybag = Keybag(blob: try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys))
        try keybag.unlock(password: BackupFixture.password)
        let error = try #require(throws: PatchError.self) {
            try keybag.unwrapForClass(11, wrapped: Data(repeating: 0, count: 40))
        }
        guard case .noClassKey(let protectionClass) = error else {
            Issue.record("expected a missing class key, got \(error)")
            return
        }
        #expect(protectionClass == 11)
    }

    @Test func backupKeysUnwrapTheManifestKey() throws {
        let manifestKey = Data(repeating: 0x6b, count: 32)
        var manifest = try BackupFixture.manifestDictionary(udid: BackupFixture.udid, encrypted: true)
        manifest["BackupKeyBag"] = try BackupFixture.keybag(password: BackupFixture.password, classKeys: classKeys)
        manifest["ManifestKey"] = BackupFixture.littleEndian(UInt32(BackupFixture.manifestClass))
            + (try BackupFixture.wrapKey(classKeys[BackupFixture.manifestClass]!, manifestKey))

        let keys = try BackupKeys.unlock(manifest: manifest, password: BackupFixture.password)
        #expect(keys.manifest == manifestKey)
        #expect(keys.file == nil)
    }

    @Test func aBackupWithoutAKeybagIsRefused() throws {
        let manifest = try BackupFixture.manifestDictionary(udid: BackupFixture.udid, encrypted: true)
        let error = try #require(throws: PatchError.self) {
            try BackupKeys.unlock(manifest: manifest, password: BackupFixture.password)
        }
        guard case .noKeybag = error else {
            Issue.record("expected a missing keybag, got \(error)")
            return
        }
    }
}
