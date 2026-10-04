import Foundation
import Testing

/// The encrypted path end to end, against a synthetic encrypted backup: the
/// keybag unlocks, Manifest.db is decrypted and written again, and the file is
/// re-encrypted with the key it already had.
final class EncryptedBackupTests {
    private let root: URL

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("supervise-encrypted-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: root)
    }

    @Test func aLockedBackupSaysSoAndReadsNothing() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)

        #expect(backup.isEncrypted)
        #expect(backup.isLocked)
        #expect(backup.isSupervised == nil)
        #expect(backup.hasSupervisionRow == false)
        #expect(backup.note == "The backup is encrypted. Give the backup password to read the supervision flag.")
    }

    @Test func theWrongPasswordIsNamed() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let error = try #require(throws: PatchError.self) {
            try backup.unlock(password: BackupFixture.otherPassword)
        }
        guard case .wrongPassword = error else {
            Issue.record("expected the wrong password, got \(error)")
            return
        }
        #expect(error.errorDescription?.hasPrefix("Wrong backup password.") == true)
    }

    @Test func unlockReadsTheFlagThroughTheEncryptedManifest() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)

        #expect(backup.isLocked == false)
        #expect(backup.hasSupervisionRow)
        #expect(backup.isSupervised == false)
        #expect(backup.note == nil)
        // The recorded size is the size of the plain file, not of the padded
        // and encrypted one that sits on disk.
        let onDisk = try Data(contentsOf: try backup.contentURL)
        #expect(onDisk.count % 16 == 0)
        #expect(backup.recordedSize == (try backup.readContent().count))
        #expect((try #require(backup.recordedSize)) < onDisk.count)
    }

    @Test func anEncryptedPatchRoundTrips() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)
        let original = try Data(contentsOf: try backup.contentURL)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let plan = try SupervisionPatch.plan(backup: backup)
        #expect(plan.format == .xml)
        #expect(plan.padding > 0)
        #expect(plan.newRecordedSize == nil)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        #expect(try patch.verify() == backup.recordedSize)
        #expect(try backup.supervisionState() == true)
        // The file on disk stays encrypted and stays a whole number of blocks.
        let patched = try Data(contentsOf: try backup.contentURL)
        #expect(patched.count % 16 == 0)
        #expect(patched != original)
        #expect(try Data(contentsOf: backup.manifestDatabaseURL) == manifestBefore)

        try patch.restorePristine()
        #expect(try Data(contentsOf: try backup.contentURL) == original)
        #expect(try backup.supervisionState() == false)
    }

    @Test func anEncryptedManifestIsWrittenAgainWhenTheSizeMoves() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        let directory = try BackupFixture.makeEncryptedBackup(in: root, content: content, format: .binary)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let plan = try SupervisionPatch.plan(backup: backup)
        let newRecordedSize = try #require(plan.newRecordedSize)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        #expect(try patch.verify() == newRecordedSize)

        let manifestAfter = try Data(contentsOf: backup.manifestDatabaseURL)
        #expect(manifestAfter != manifestBefore)
        #expect(manifestAfter.count % 16 == 0)
        // The plain copy of Manifest.db is deleted again, password or not.
        let scratch = try FileManager.default.contentsOfDirectory(
            at: backup.scratchDirectory,
            includingPropertiesForKeys: nil
        )
        #expect(scratch.allSatisfy { !$0.lastPathComponent.hasPrefix("manifest-") })

        try patch.restorePristine()
        #expect(try Data(contentsOf: backup.manifestDatabaseURL) == manifestBefore)
        // This fixture starts with no flag at all, so the untouched copy has none either.
        #expect(try backup.supervisionState() == nil)
    }
}
