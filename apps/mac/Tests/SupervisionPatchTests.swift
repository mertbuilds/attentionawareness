import XCTest

/// The patch against a synthetic plain backup, in both directions.
final class SupervisionPatchTests: XCTestCase {
    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("supervise-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    // Reading

    func testLoadReadsTheSupervisionRow() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)

        XCTAssertEqual(backup.udid, BackupFixture.udid)
        XCTAssertEqual(backup.deviceName, "Test iPhone")
        XCTAssertEqual(backup.iosVersion, "26.6.1")
        XCTAssertFalse(backup.isEncrypted)
        XCTAssertTrue(backup.hasSupervisionRow)
        XCTAssertEqual(backup.isSupervised, false)
        XCTAssertEqual(backup.kind, .current)
        XCTAssertNil(backup.note)

        let original = try Data(contentsOf: try backup.contentURL)
        XCTAssertEqual(backup.recordedSize, original.count)
    }

    func testAFolderThatIsNotABackupIsRefused() {
        XCTAssertThrowsError(try BackupFolder.load(at: root.appendingPathComponent("nowhere")))
    }

    func testDiscoveryFindsBackupFoldersAndNamesTheArchiveCopy() throws {
        try BackupFixture.makeBackup(in: root)
        try BackupFixture.makeBackup(in: root, folder: BackupFixture.archiveFolder)

        let folders = try BackupFolder.folders(in: root).map(\.lastPathComponent)
        XCTAssertEqual(folders, [BackupFixture.udid, BackupFixture.archiveFolder])

        let kinds = try BackupFolder.loadAll(in: root)
            .reduce(into: [String: BackupFolder.Kind]()) { $0[$1.url.lastPathComponent] = $1.kind }
        XCTAssertEqual(kinds[BackupFixture.udid], .current)
        XCTAssertEqual(kinds[BackupFixture.archiveFolder], .archive)
    }

    func testAMissingRootIsRefused() {
        XCTAssertThrowsError(try BackupFolder.folders(in: root.appendingPathComponent("nowhere")))
    }

    // The normal case: an XML file keeps its size and Manifest.db is untouched

    func testPatchKeepsTheSizeAndLeavesTheManifestAlone() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let original = try Data(contentsOf: try backup.contentURL)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let plan = try SupervisionPatch.plan(backup: backup, target: true)
        XCTAssertEqual(plan.format, .xml)
        XCTAssertGreaterThan(plan.padding, 0)
        XCTAssertNil(plan.newRecordedSize)
        XCTAssertEqual(plan.newBytes.count, backup.recordedSize)
        XCTAssertEqual(plan.changes.count, 2)

        let patch = SupervisionPatch(backup: backup)
        let pristine = try patch.apply(plan)
        XCTAssertEqual(try patch.verify(target: true), backup.recordedSize)

        let patched = try PropertyListSerialization.propertyList(
            from: try backup.readContent(),
            options: [],
            format: nil
        ) as? [String: Any]
        XCTAssertEqual(SupervisionPatch.boolean(patched?["IsSupervised"]), true)
        XCTAssertEqual(SupervisionPatch.boolean(patched?["CloudConfigurationUIComplete"]), true)
        XCTAssertEqual(SupervisionPatch.boolean(patched?["AllowPairing"]), true)
        XCTAssertEqual(try backup.supervisionState(), true)
        XCTAssertEqual(try Data(contentsOf: backup.manifestDatabaseURL), manifestBefore)

        XCTAssertEqual(try Data(contentsOf: pristine.appendingPathComponent(BackupFixture.fileID)), original)
        XCTAssertTrue(FileManager.default.fileExists(
            atPath: pristine.appendingPathComponent(BackupFolder.manifestDatabaseName).path
        ))
        XCTAssertTrue(FileManager.default.fileExists(
            atPath: pristine.appendingPathComponent(SupervisionPatch.pristineMetadataName).path
        ))
    }

    func testRestorePutsBackTheExactBytes() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let original = try Data(contentsOf: try backup.contentURL)
        let manifestBefore = try Data(contentsOf: backup.manifestDatabaseURL)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(try SupervisionPatch.plan(backup: backup, target: true))
        XCTAssertNotEqual(try Data(contentsOf: try backup.contentURL), original)

        try patch.restorePristine()
        XCTAssertEqual(try Data(contentsOf: try backup.contentURL), original)
        XCTAssertEqual(try Data(contentsOf: backup.manifestDatabaseURL), manifestBefore)
        XCTAssertEqual(try backup.supervisionState(), false)
    }

    func testRestoreWithoutASavedCopyIsRefused() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        XCTAssertThrowsError(try SupervisionPatch(backup: backup).restorePristine())
    }

    func testASupervisedBackupNeedsNoChange() throws {
        var content = BackupFixture.baseContent
        content["IsSupervised"] = true
        content["CloudConfigurationUIComplete"] = true
        let data = try PropertyListSerialization.data(fromPropertyList: content, format: .xml, options: 0)

        let plan = try SupervisionPatch.plan(original: data, recordedSize: data.count, target: true)
        XCTAssertTrue(plan.isEmpty)
        XCTAssertNil(plan.newRecordedSize)
        XCTAssertEqual(plan.newBytes, data)
    }

    // A file that changes size, so the recorded size is written again

    func testABinaryPatchUpdatesTheRecordedSize() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        let directory = try BackupFixture.makeBackup(in: root, content: content, format: .binary)
        let backup = try BackupFolder.load(at: directory)
        XCTAssertNil(backup.isSupervised)

        let plan = try SupervisionPatch.plan(backup: backup, target: true)
        XCTAssertEqual(plan.format, .binary)
        XCTAssertEqual(plan.padding, 0)
        XCTAssertEqual(plan.changes.first, "IsSupervised: missing -> true")
        let newRecordedSize = try XCTUnwrap(plan.newRecordedSize)
        XCTAssertGreaterThan(newRecordedSize, try XCTUnwrap(backup.recordedSize))

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        XCTAssertEqual(try patch.verify(target: true), newRecordedSize)

        let row = try XCTUnwrap(try backup.supervisionRow())
        XCTAssertEqual(try MBFileBlob.readSize(row.blob), newRecordedSize)
        XCTAssertEqual(try backup.supervisionState(), true)
    }

    func testRestorePutsBackTheFileAndTheRecordedSize() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        let directory = try BackupFixture.makeBackup(in: root, content: content, format: .binary)
        let backup = try BackupFolder.load(at: directory)
        let original = try Data(contentsOf: try backup.contentURL)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(try SupervisionPatch.plan(backup: backup, target: true))
        try patch.restorePristine()

        XCTAssertEqual(try Data(contentsOf: try backup.contentURL), original)
        let row = try XCTUnwrap(try backup.supervisionRow())
        XCTAssertEqual(try MBFileBlob.readSize(row.blob), original.count)
    }

    // The other direction

    func testUnsuperviseSetsTheFlagBack() throws {
        var content = BackupFixture.baseContent
        content["IsSupervised"] = true
        content["CloudConfigurationUIComplete"] = true
        let directory = try BackupFixture.makeBackup(in: root, content: content)
        let backup = try BackupFolder.load(at: directory)
        XCTAssertEqual(backup.isSupervised, true)

        let plan = try SupervisionPatch.plan(backup: backup, target: false)
        XCTAssertEqual(plan.changes, ["IsSupervised: true -> false"])
        // `<false/>` is one byte longer than `<true/>`, so this one does move
        // the recorded size.
        let newRecordedSize = try XCTUnwrap(plan.newRecordedSize)
        XCTAssertEqual(newRecordedSize, try XCTUnwrap(backup.recordedSize) + 1)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        XCTAssertEqual(try patch.verify(target: false), newRecordedSize)
        XCTAssertEqual(try backup.supervisionState(), false)

        let patched = try PropertyListSerialization.propertyList(
            from: try backup.readContent(),
            options: [],
            format: nil
        ) as? [String: Any]
        // Supervising sets this flag; taking supervision off leaves it alone.
        XCTAssertEqual(SupervisionPatch.boolean(patched?["CloudConfigurationUIComplete"]), true)
    }

    func testVerificationCatchesASizeThatDoesNotMatch() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        let patch = SupervisionPatch(backup: backup)
        try patch.apply(try SupervisionPatch.plan(backup: backup, target: true))

        // Append a byte behind the tool's back. The file and Manifest.db no
        // longer agree, which is what verification is there to find.
        var content = try Data(contentsOf: try backup.contentURL)
        content.append(0x0a)
        try content.write(to: try backup.contentURL)
        XCTAssertThrowsError(try patch.verify(target: true)) { error in
            guard case PatchError.verificationSize = error else {
                return XCTFail("expected a size mismatch, got \(error)")
            }
        }
    }

    func testVerificationCatchesAFlagThatDidNotMove() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let backup = try BackupFolder.load(at: directory)
        XCTAssertThrowsError(try SupervisionPatch(backup: backup).verify(target: true)) { error in
            guard case PatchError.verificationFlag = error else {
                return XCTFail("expected a flag mismatch, got \(error)")
            }
        }
    }

    func testAnIntegerIsNotABoolean() throws {
        // The Python compares with `is True`, so a plist integer is never the
        // flag. `ConfigurationSource` is an integer in every real file.
        XCTAssertNil(SupervisionPatch.boolean(BackupFixture.baseContent["ConfigurationSource"]))
        XCTAssertEqual(SupervisionPatch.boolean(BackupFixture.baseContent["AllowPairing"]), true)
        XCTAssertNil(SupervisionPatch.boolean(nil))
        XCTAssertEqual(SupervisionPatch.label(nil), "missing")
    }
}
