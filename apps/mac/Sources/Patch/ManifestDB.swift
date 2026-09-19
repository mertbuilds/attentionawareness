import Foundation
import SQLite3

/// Manifest.db, the sqlite database that lists every file in a backup. One row
/// holds the cloud configuration file this tool patches. On an encrypted backup
/// the whole database is one AES-CBC file, so it is decrypted to a plain copy,
/// changed, and written back with the same key.
enum ManifestDB {
    /// The two columns of the Files row this tool needs.
    struct Row {
        let fileID: String
        let blob: Data
    }

    /// sqlite has to copy a bound value, because the buffer is gone after the call.
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    private static let selectSupervision = """
        SELECT fileID, file FROM Files WHERE domain = ? AND relativePath = ?
        """

    /// The supervision row of a plain database, or nil when it holds none.
    static func supervisionRow(in database: URL) throws -> Row? {
        // Read only, so a half written database is never made worse by a read.
        let handle = try open(
            database.absoluteString + "?mode=ro",
            flags: SQLITE_OPEN_READONLY | SQLITE_OPEN_URI,
            database: database
        )
        defer { sqlite3_close(handle) }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, selectSupervision, -1, &statement, nil) == SQLITE_OK else {
            throw failure(handle)
        }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, BackupFolder.supervisionDomain, -1, transient)
        sqlite3_bind_text(statement, 2, BackupFolder.supervisionRelativePath, -1, transient)
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
        guard let fileID = sqlite3_column_text(statement, 0) else { return nil }
        return Row(fileID: String(cString: fileID), blob: blob(statement, column: 1))
    }

    /// Put a plain Manifest.db into rollback journal mode, before anything
    /// reads it.
    ///
    /// `idevicebackup2` hands the database over in WAL mode and writes no
    /// `-wal` and no `-shm` beside it. sqlite cannot use a WAL database
    /// without a `-shm` file, and a read only connection is not allowed to
    /// make one, so every read fails with "unable to open database file"
    /// before it starts. Opening read write and asking for the rollback
    /// journal writes back whatever the WAL held and leaves the file in the
    /// shape a backup that Finder wrote already has, so the restore takes it
    /// as it is. Only the header moves, so the length stays where it was and
    /// an encrypted copy still holds a whole number of AES blocks.
    static func normaliseJournal(at database: URL) throws {
        let handle = try open(database.path, flags: SQLITE_OPEN_READWRITE, database: database)
        defer { sqlite3_close(handle) }
        try useRollbackJournal(on: handle)
    }

    /// Write the new file size into the Files row of a plain database.
    static func updateRecordedSize(in database: URL, fileID: String, size: Int) throws {
        let handle = try open(database.path, flags: SQLITE_OPEN_READWRITE, database: database)
        defer { sqlite3_close(handle) }
        // A WAL database keeps the newest rows beside the file. This one file
        // has to hold everything, because the encrypted copy is one file.
        try useRollbackJournal(on: handle)

        let updated = try recordedBlob(on: handle, fileID: fileID, size: size)

        var update: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "UPDATE Files SET file = ? WHERE fileID = ?", -1, &update, nil) == SQLITE_OK else {
            throw failure(handle)
        }
        defer { sqlite3_finalize(update) }
        _ = updated.withUnsafeBytes { bytes in
            sqlite3_bind_blob(update, 1, bytes.baseAddress, Int32(updated.count), transient)
        }
        sqlite3_bind_text(update, 2, fileID, -1, transient)
        guard sqlite3_step(update) == SQLITE_DONE else { throw failure(handle) }
    }

    /// Read the row back and return its blob with the new size written in.
    private static func recordedBlob(on handle: OpaquePointer?, fileID: String, size: Int) throws -> Data {
        var select: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "SELECT file FROM Files WHERE fileID = ?", -1, &select, nil) == SQLITE_OK else {
            throw failure(handle)
        }
        defer { sqlite3_finalize(select) }
        sqlite3_bind_text(select, 1, fileID, -1, transient)
        guard sqlite3_step(select) == SQLITE_ROW else { throw PatchError.supervisionRowVanished }
        return try MBFileBlob.writeSize(blob(select, column: 0), size: size)
    }

    /// Write the plain Manifest.db into `directory`, which is where the
    /// untouched copies live. The caller deletes it again.
    static func decrypt(_ database: URL, key: Data, into directory: URL) throws -> URL {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let plain = directory.appendingPathComponent("manifest-\(UUID().uuidString).db")
        do {
            try BackupCrypto.decryptFile(at: database, to: plain, key: key)
        } catch {
            removePlainCopy(plain)
            throw error
        }
        return plain
    }

    /// Put the plain copy back over Manifest.db, encrypted with the same key.
    static func encrypt(_ plain: URL, over database: URL, key: Data) throws {
        let size = (try FileManager.default.attributesOfItem(atPath: plain.path)[.size] as? Int) ?? 0
        guard size % 16 == 0 else { throw PatchError.manifestLengthNotAes(size) }
        let temporary = AtomicFile.temporaryURL(beside: database, prefix: "manifest")
        do {
            try BackupCrypto.encryptFile(at: plain, to: temporary, key: key)
            // One step, so a failure leaves the old Manifest.db in place.
            try AtomicFile.replace(temporary, onto: database)
        } catch {
            try? FileManager.default.removeItem(at: temporary)
            throw error
        }
    }

    /// Delete the plain copy, and any journal that sqlite left beside it.
    static func removePlainCopy(_ database: URL) {
        for suffix in ["", "-wal", "-shm", "-journal"] {
            let url = database.deletingLastPathComponent()
                .appendingPathComponent(database.lastPathComponent + suffix)
            try? FileManager.default.removeItem(at: url)
        }
    }

    // sqlite plumbing

    private static func open(_ name: String, flags: Int32, database: URL) throws -> OpaquePointer? {
        var handle: OpaquePointer?
        let status = sqlite3_open_v2(name, &handle, flags, nil)
        guard status == SQLITE_OK else {
            let error = failure(handle)
            sqlite3_close(handle)
            // macOS answers a folder it protects the same way a missing file
            // is answered, and the caller has already checked that the file is
            // there, so this is the Full Disk Access case.
            if status == SQLITE_CANTOPEN || status == SQLITE_PERM {
                throw PatchError.noAccessToBackupFolder(database.deletingLastPathComponent())
            }
            throw error
        }
        return handle
    }

    /// `PRAGMA journal_mode` answers with a row that names the mode the
    /// database ended in, and names the mode it kept when it could not change
    /// it, so that row is the only proof the change happened.
    private static func useRollbackJournal(on handle: OpaquePointer?) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "PRAGMA journal_mode=DELETE", -1, &statement, nil) == SQLITE_OK else {
            throw failure(handle)
        }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW, let mode = sqlite3_column_text(statement, 0) else {
            throw failure(handle)
        }
        let answer = String(cString: mode)
        guard answer.caseInsensitiveCompare("delete") == .orderedSame else {
            throw PatchError.databaseFailed("the journal mode stayed \(answer)")
        }
    }

    private static func blob(_ statement: OpaquePointer?, column: Int32) -> Data {
        guard let bytes = sqlite3_column_blob(statement, column) else { return Data() }
        return Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, column)))
    }

    private static func failure(_ handle: OpaquePointer?) -> PatchError {
        .databaseFailed(handle.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown error")
    }
}
