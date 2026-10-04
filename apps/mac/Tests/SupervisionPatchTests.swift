import Foundation
import Testing

/// The patch against a synthetic plain backup.
final class SupervisionPatchTests {
    private let root: URL

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("supervise-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: root)
    }

    // Reading

    @Test func loadReadsTheSupervisionRow() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)

        #expect(backup.udid == BackupFixture.udid)
        #expect(backup.deviceName == "Test iPhone")
        #expect(backup.iosVersion == "26.6.1")
        #expect(backup.isEncrypted == false)
        #expect(backup.hasSupervisionRow)
        #expect(backup.isSupervised == false)
        #expect(backup.kind == .current)
        #expect(backup.note == nil)

        let original = try Data(contentsOf: try backup.contentURL)
        #expect(backup.recordedSize == original.count)
    }

    @Test func aFolderThatIsNotABackupIsRefused() {
        #expect(throws: (any Error).self) {
            try BackupFolder.load(at: root.appendingPathComponent("nowhere"))
        }
    }

    @Test func discoveryFindsBackupFoldersAndNamesTheArchiveCopy() throws {
        try BackupFixture.makeBackup(in: root)
        try BackupFixture.makeBackup(in: root, folder: BackupFixture.archiveFolder)

        let folders = try BackupFolder.folders(in: root).map(\.lastPathComponent)
        #expect(folders == [BackupFixture.udid, BackupFixture.archiveFolder])

        let kinds = try BackupFolder.loadAll(in: root)
            .reduce(into: [String: BackupFolder.Kind]()) { $0[$1.url.lastPathComponent] = $1.kind }
        #expect(kinds[BackupFixture.udid] == .current)
        #expect(kinds[BackupFixture.archiveFolder] == .archive)
    }

    @Test func aMissingRootIsRefused() {
        #expect(throws: (any Error).self) {
            try BackupFolder.folders(in: root.appendingPathComponent("nowhere"))
        }
    }

    // The normal case: an XML file keeps its size and Manifest.db is untouched

    @Test func patchKeepsTheSizeAndLeavesTheManifestAlone() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let original = try Data(contentsOf: try backup.contentURL)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let plan = try SupervisionPatch.plan(backup: backup)
        #expect(plan.format == .xml)
        #expect(plan.padding > 0)
        #expect(plan.newRecordedSize == nil)
        #expect(plan.newBytes.count == backup.recordedSize)
        #expect(plan.changes.count == 2)

        let patch = SupervisionPatch(backup: backup)
        let pristine = try patch.apply(plan)
        #expect(try patch.verify() == backup.recordedSize)

        let patched = try PropertyListSerialization.propertyList(
            from: try backup.readContent(),
            options: [],
            format: nil
        ) as? [String: Any]
        #expect(SupervisionPatch.boolean(patched?["IsSupervised"]) == true)
        #expect(SupervisionPatch.boolean(patched?["CloudConfigurationUIComplete"]) == true)
        #expect(SupervisionPatch.boolean(patched?["AllowPairing"]) == true)
        #expect(try backup.supervisionState() == true)
        #expect(try Data(contentsOf: backup.manifestDatabaseURL) == manifestBefore)

        #expect(try Data(contentsOf: pristine.appendingPathComponent(BackupFixture.fileID)) == original)
        #expect(FileManager.default.fileExists(
            atPath: pristine.appendingPathComponent(BackupFolder.manifestDatabaseName).path
        ))
        #expect(FileManager.default.fileExists(
            atPath: pristine.appendingPathComponent(SupervisionPatch.pristineMetadataName).path
        ))
    }

    @Test func restorePutsBackTheExactBytes() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let original = try Data(contentsOf: try backup.contentURL)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(try SupervisionPatch.plan(backup: backup))
        #expect(try Data(contentsOf: try backup.contentURL) != original)

        try patch.restorePristine()
        #expect(try Data(contentsOf: try backup.contentURL) == original)
        #expect(try Data(contentsOf: backup.manifestDatabaseURL) == manifestBefore)
        #expect(try backup.supervisionState() == false)
    }

    @Test func restoreWithoutASavedCopyIsRefused() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        #expect(throws: (any Error).self) {
            try SupervisionPatch(backup: backup).restorePristine()
        }
    }

    @Test func aSupervisedBackupNeedsNoChange() throws {
        var content = BackupFixture.baseContent
        content["IsSupervised"] = true
        content["CloudConfigurationUIComplete"] = true
        let data = try PropertyListSerialization.data(fromPropertyList: content, format: .xml, options: 0)

        let plan = try SupervisionPatch.plan(original: data, recordedSize: data.count)
        #expect(plan.isEmpty)
        #expect(plan.newRecordedSize == nil)
        #expect(plan.newBytes == data)
    }

    // A file that changes size, so the recorded size is written again

    @Test func aBinaryPatchUpdatesTheRecordedSize() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        let directory = try BackupFixture.makeBackup(in: root, content: content, format: .binary)
        let backup = try BackupFolder.load(at: directory)
        #expect(backup.isSupervised == nil)

        let plan = try SupervisionPatch.plan(backup: backup)
        #expect(plan.format == .binary)
        #expect(plan.padding == 0)
        #expect(plan.changes.first == "IsSupervised: missing -> true")
        let newRecordedSize = try #require(plan.newRecordedSize)
        #expect(newRecordedSize > (try #require(backup.recordedSize)))

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        #expect(try patch.verify() == newRecordedSize)

        let row = try #require(try backup.supervisionRow())
        #expect(try MBFileBlob.readSize(row.blob) == newRecordedSize)
        #expect(try backup.supervisionState() == true)
    }

    @Test func restorePutsBackTheFileAndTheRecordedSize() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        let directory = try BackupFixture.makeBackup(in: root, content: content, format: .binary)
        let backup = try BackupFolder.load(at: directory)
        let original = try Data(contentsOf: try backup.contentURL)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(try SupervisionPatch.plan(backup: backup))
        try patch.restorePristine()

        #expect(try Data(contentsOf: try backup.contentURL) == original)
        let row = try #require(try backup.supervisionRow())
        #expect(try MBFileBlob.readSize(row.blob) == original.count)
    }

    @Test func verificationCatchesASizeThatDoesNotMatch() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let patch = SupervisionPatch(backup: backup)
        try patch.apply(try SupervisionPatch.plan(backup: backup))

        // Append a byte behind the tool's back. The file and Manifest.db no
        // longer agree, which is what verification is there to find.
        var content = try Data(contentsOf: try backup.contentURL)
        content.append(0x0a)
        try content.write(to: try backup.contentURL)
        let error = try #require(throws: PatchError.self) {
            try patch.verify()
        }
        guard case .verificationSize = error else {
            Issue.record("expected a size mismatch, got \(error)")
            return
        }
    }

    @Test func verificationCatchesAFlagThatDidNotMove() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let error = try #require(throws: PatchError.self) {
            try SupervisionPatch(backup: backup).verify()
        }
        guard case .verificationFlag = error else {
            Issue.record("expected a flag mismatch, got \(error)")
            return
        }
    }

    @Test func anIntegerIsNotABoolean() throws {
        // The retired Python tool compared with `is True`, so a plist integer is never the
        // flag. `ConfigurationSource` is an integer in every real file.
        #expect(SupervisionPatch.boolean(BackupFixture.baseContent["ConfigurationSource"]) == nil)
        #expect(SupervisionPatch.boolean(BackupFixture.baseContent["AllowPairing"]) == true)
        #expect(SupervisionPatch.boolean(nil) == nil)
        #expect(SupervisionPatch.label(nil) == "missing")
    }
}
