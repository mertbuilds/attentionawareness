import Foundation
import Testing

/// Manifest.db in the shape `idevicebackup2` hands it over: WAL mode, with no
/// `-wal` and no `-shm` file beside it. sqlite cannot open such a file read
/// only, so every read of the database has to put it back into rollback
/// journal mode first.
final class JournalModeTests {
    /// Byte 18 of the sqlite header. 2 means WAL, 1 means a rollback journal.
    private static let walHeaderByte: UInt8 = 2
    private static let rollbackHeaderByte: UInt8 = 1

    private let root: URL

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("supervise-journal-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: root)
    }

    // Plain backups

    @Test func aWriteAheadLogManifestIsReadAnyway() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        try BackupFixture.makeWriteAheadLog(at: database)
        #expect(try BackupFixture.journalModeByte(at: database) == Self.walHeaderByte)
        #expect(FileManager.default.fileExists(atPath: database.path + "-shm") == false)

        let backup = try BackupFolder.load(at: directory)
        #expect(backup.hasSupervisionRow)
        #expect(backup.isSupervised == false)
        #expect(backup.note == nil)
        #expect(try BackupFixture.journalModeByte(at: database) == Self.rollbackHeaderByte)
    }

    @Test func aWriteAheadLogManifestIsPatched() throws {
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
        let newRecordedSize = try #require(plan.newRecordedSize)

        let patch = SupervisionPatch(backup: backup)
        let pristine = try patch.apply(plan)
        #expect(try patch.verify() == newRecordedSize)
        #expect(try backup.supervisionState() == true)
        #expect(FileManager.default.fileExists(
            atPath: pristine.appendingPathComponent(BackupFolder.manifestDatabaseName).path
        ))
    }

    /// The conversion moves the header and nothing else, which is what lets an
    /// encrypted copy of the same bytes still hold a whole number of AES
    /// blocks.
    @Test func theConversionKeepsTheLength() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        try BackupFixture.makeWriteAheadLog(at: database)
        let before = try Data(contentsOf: database)

        try ManifestDB.normaliseJournal(at: database)

        let after = try Data(contentsOf: database)
        #expect(after.count == before.count)
        #expect(after != before)
        #expect(try BackupFixture.journalModeByte(at: database) == Self.rollbackHeaderByte)
    }

    /// A database that is already in rollback journal mode is left as it is.
    @Test func aRollbackJournalManifestIsUntouched() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        let before = try Data(contentsOf: database)

        try ManifestDB.normaliseJournal(at: database)

        #expect(try Data(contentsOf: database) == before)
    }

    @Test func aManifestThatIsNotADatabaseIsRefused() throws {
        let directory = try BackupFixture.makeBackup(in: root)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        try Data("not a database".utf8).write(to: database)

        let error = try #require(throws: PatchError.self) {
            try ManifestDB.normaliseJournal(at: database)
        }
        guard case .databaseFailed = error else {
            Issue.record("expected a database failure, got \(error)")
            return
        }
    }

    // Encrypted backups, whose plain copy carries the same journal mode

    @Test func anEncryptedWriteAheadLogManifestIsReadAnyway() throws {
        let directory = try BackupFixture.makeEncryptedBackup(in: root, writeAheadLog: true)
        let backup = try BackupFolder.load(at: directory)
        try backup.unlock(password: BackupFixture.password)

        #expect(backup.hasSupervisionRow)
        #expect(backup.isSupervised == false)
        // The database on disk stays encrypted; only the plain copy is put
        // into rollback journal mode, and that copy is deleted again.
        #expect(try BackupFixture.journalModeByte(at: backup.manifestDatabaseURL) != Self.walHeaderByte)
    }

    @Test func anEncryptedWriteAheadLogManifestIsWrittenAgain() throws {
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
        let newRecordedSize = try #require(plan.newRecordedSize)

        let patch = SupervisionPatch(backup: backup)
        try patch.apply(plan)
        #expect(try patch.verify() == newRecordedSize)
        #expect(try backup.supervisionState() == true)
        // The rewritten database is encrypted again, so it still has to be a
        // whole number of AES blocks.
        #expect(try Data(contentsOf: backup.manifestDatabaseURL).count % 16 == 0)
    }
}
