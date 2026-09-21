import XCTest

/// Manifest.db in the shape `idevicebackup2` hands it over: WAL mode, with no
/// `-wal` and no `-shm` file beside it. sqlite cannot open such a file read
/// only, so every read of the database has to put it back into rollback
/// journal mode first.
final class JournalModeTests: XCTestCase {
    /// Byte 18 of the sqlite header. 2 means WAL, 1 means a rollback journal.
    private static let walHeaderByte: UInt8 = 2
    private static let rollbackHeaderByte: UInt8 = 1

    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("supervise-journal-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    // Plain backups

    func testAWriteAheadLogManifestIsReadAnyway() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        try BackupFixture.makeWriteAheadLog(at: database)
        XCTAssertEqual(try BackupFixture.journalModeByte(at: database), Self.walHeaderByte)
        XCTAssertFalse(FileManager.default.fileExists(atPath: database.path + "-shm"))

        let backup = try BackupFolder.load(at: directory)
        XCTAssertTrue(backup.hasSupervisionRow)
        XCTAssertEqual(backup.isSupervised, false)
        XCTAssertNil(backup.note)
        XCTAssertEqual(try BackupFixture.journalModeByte(at: database), Self.rollbackHeaderByte)
    }

    func testAWriteAheadLogManifestIsPatched() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        // A binary file changes size, so this one writes the database as well
        // as reading it.
        let directory = try BackupFixture.makeBackup(in: root, content: content, format: .binary)
        try BackupFixture.makeWriteAheadLog(
            at: directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        )

        let backup = try BackupFolder.load(at: directory)
        let plan = try SupervisionPatch.plan(backup: backup)
        let newRecordedSize = try XCTUnwrap(plan.newRecordedSize)

        let patch = SupervisionPatch(backup: backup)
        let pristine = try patch.apply(plan)
        XCTAssertEqual(try patch.verify(), newRecordedSize)
        XCTAssertEqual(try backup.supervisionState(), true)
        XCTAssertTrue(FileManager.default.fileExists(
            atPath: pristine.appendingPathComponent(BackupFolder.manifestDatabaseName).path
        ))
    }

    /// The conversion moves the header and nothing else, which is what lets an
    /// encrypted copy of the same bytes still hold a whole number of AES
    /// blocks.
    func testTheConversionKeepsTheLength() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        try BackupFixture.makeWriteAheadLog(at: database)
        let before = try Data(contentsOf: database)

        try ManifestDB.normaliseJournal(at: database)

        let after = try Data(contentsOf: database)
        XCTAssertEqual(after.count, before.count)
        XCTAssertNotEqual(after, before)
        XCTAssertEqual(try BackupFixture.journalModeByte(at: database), Self.rollbackHeaderByte)
    }

    /// A database that is already in rollback journal mode is left as it is.
    func testARollbackJournalManifestIsUntouched() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        let before = try Data(contentsOf: database)

        try ManifestDB.normaliseJournal(at: database)

        XCTAssertEqual(try Data(contentsOf: database), before)
    }

    func testAManifestThatIsNotADatabaseIsRefused() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        try Data("not a database".utf8).write(to: database)

        XCTAssertThrowsError(try ManifestDB.normaliseJournal(at: database)) { error in
            guard case PatchError.databaseFailed = error else {
                return XCTFail("expected a database failure, got \(error)")
            }
        }
    }

    // Encrypted backups, whose plain copy carries the same journal mode

    func testAnEncryptedWriteAheadLogManifestIsReadAnyway() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root, writeAheadLog: true)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)

        XCTAssertTrue(backup.hasSupervisionRow)
        XCTAssertEqual(backup.isSupervised, false)
        // The database on disk stays encrypted; only the plain copy is put
        // into rollback journal mode, and that copy is deleted again.
        XCTAssertNotEqual(try BackupFixture.journalModeByte(at: backup.manifestDatabaseURL), Self.walHeaderByte)
    }

    func testAnEncryptedWriteAheadLogManifestIsWrittenAgain() throws {
        var content = BackupFixture.baseContent
        content.removeValue(forKey: "IsSupervised")
        let directory = try BackupFixture.makeEncryptedBackup(
            in: root,
            content: content,
            format: .binary,
            writeAheadLog: true
        )
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)

        let plan = try SupervisionPatch.plan(backup: backup)
        let newRecordedSize = try XCTUnwrap(plan.newRecordedSize)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        XCTAssertEqual(try patch.verify(), newRecordedSize)
        XCTAssertEqual(try backup.supervisionState(), true)
        // The rewritten database is encrypted again, so it still has to be a
        // whole number of AES blocks.
        XCTAssertEqual(try Data(contentsOf: backup.manifestDatabaseURL).count % 16, 0)
    }
}
