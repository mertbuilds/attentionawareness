import XCTest

/// The encrypted path end to end, against a synthetic encrypted backup: the
/// keybag unlocks, Manifest.db is decrypted and written again, and the file is
/// re-encrypted with the key it already had.
final class EncryptedBackupTests: XCTestCase {
    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("supervise-encrypted-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    func testALockedBackupSaysSoAndReadsNothing() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)

        XCTAssertTrue(backup.isEncrypted)
        XCTAssertTrue(backup.isLocked)
        XCTAssertNil(backup.isSupervised)
        XCTAssertFalse(backup.hasSupervisionRow)
        XCTAssertEqual(backup.note, "The backup is encrypted. Give the backup password to read the supervision flag.")
    }

    func testTheWrongPasswordIsNamed() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        XCTAssertThrowsError(try backup.unlock(password: BackupFixture.otherPassword)) { error in
            guard case PatchError.wrongPassword = error else {
                return XCTFail("expected the wrong password, got \(error)")
            }
            XCTAssertEqual(
                (error as? PatchError)?.errorDescription?.hasPrefix("Wrong backup password."),
                true
            )
        }
    }

    func testUnlockReadsTheFlagThroughTheEncryptedManifest() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)

        XCTAssertFalse(backup.isLocked)
        XCTAssertTrue(backup.hasSupervisionRow)
        XCTAssertEqual(backup.isSupervised, false)
        XCTAssertNil(backup.note)
        // The recorded size is the size of the plain file, not of the padded
        // and encrypted one that sits on disk.
        let onDisk = try Data(contentsOf: try backup.contentURL)
        XCTAssertEqual(onDisk.count % 16, 0)
        XCTAssertEqual(backup.recordedSize, try backup.readContent().count)
        XCTAssertLessThan(try XCTUnwrap(backup.recordedSize), onDisk.count)
    }

    func testAnEncryptedPatchRoundTrips() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)
        let original = try Data(contentsOf: try backup.contentURL)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let plan = try SupervisionPatch.plan(backup: backup, target: true)
        XCTAssertEqual(plan.format, .xml)
        XCTAssertGreaterThan(plan.padding, 0)
        XCTAssertNil(plan.newRecordedSize)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        XCTAssertEqual(try patch.verify(target: true), backup.recordedSize)
        XCTAssertEqual(try backup.supervisionState(), true)
        // The file on disk stays encrypted and stays a whole number of blocks.
        let patched = try Data(contentsOf: try backup.contentURL)
        XCTAssertEqual(patched.count % 16, 0)
        XCTAssertNotEqual(patched, original)
        XCTAssertEqual(try Data(contentsOf: backup.manifestDatabaseURL), manifestBefore)

        try patch.restorePristine()
        XCTAssertEqual(try Data(contentsOf: try backup.contentURL), original)
        XCTAssertEqual(try backup.supervisionState(), false)
    }

    func testAnEncryptedManifestIsWrittenAgainWhenTheSizeMoves() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        let directory = try BackupFixture.makeEncryptedBackup(in: root, content: content, format: .binary)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let plan = try SupervisionPatch.plan(backup: backup, target: true)
        let newRecordedSize = try XCTUnwrap(plan.newRecordedSize)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        XCTAssertEqual(try patch.verify(target: true), newRecordedSize)

        let manifestAfter = try Data(contentsOf: backup.manifestDatabaseURL)
        XCTAssertNotEqual(manifestAfter, manifestBefore)
        XCTAssertEqual(manifestAfter.count % 16, 0)
        // The plain copy of Manifest.db is deleted again, password or not.
        let scratch = try FileManager.default.contentsOfDirectory(
            at: backup.scratchDirectory,
            includingPropertiesForKeys: nil
        )
        XCTAssertTrue(scratch.allSatisfy { !$0.lastPathComponent.hasPrefix("manifest-") })

        try patch.restorePristine()
        XCTAssertEqual(try Data(contentsOf: backup.manifestDatabaseURL), manifestBefore)
        // This fixture starts with no flag at all, so the untouched copy has none either.
        XCTAssertNil(try backup.supervisionState())
    }
}
