import Foundation

/// What a patch will change, worked out before anything is written.
struct PatchPlan {
    enum Format: String {
        case binary
        case xml
    }

    /// The new bytes of the supervision file, padding included.
    let newBytes: Data
    let format: Format
    /// The size Manifest.db records right now.
    let oldSize: Int
    /// How many newlines were added to keep an XML file the size it was.
    let padding: Int
    /// The size Manifest.db has to record after the patch, or nil when the
    /// file keeps the size it had and the database stays untouched.
    let newRecordedSize: Int?
    /// One line per change, for the window.
    let changes: [String]

    /// Nothing to do: the flags already say what they should say.
    var isEmpty: Bool {
        changes.isEmpty
    }
}

/// The patch itself: what it will change, applying it, checking it afterwards,
/// and the untouched copy that puts the backup back.
///
/// The supervision flag lives in one plist inside the backup. Setting it needs
/// three things to stay in step: the bytes of the file, the size Manifest.db
/// records for it, and, on an encrypted backup, the key each of them is written
/// with. An XML file is padded with newlines so the size never moves, which
/// leaves Manifest.db untouched; a binary file changes size, so the recorded
/// size is written again.
struct SupervisionPatch {
    /// The folder that holds the untouched copies, beside the backups themselves.
    static let pristineDirectoryName = "attentionawareness-pristine"
    static let pristineMetadataName = "pristine.json"

    let backup: BackupFolder

    init(backup: BackupFolder) {
        self.backup = backup
    }

    static func pristineRoot(forBackupRoot root: URL) -> URL {
        root.appendingPathComponent(pristineDirectoryName)
    }

    // Planning

    /// Work out the new file bytes without writing anything. The backup is left
    /// saying it is supervised.
    static func plan(backup: BackupFolder) throws -> PatchPlan {
        guard let recordedSize = backup.recordedSize else { throw PatchError.noSupervisionFile }
        return try plan(original: try backup.readContent(), recordedSize: recordedSize)
    }

    static func plan(original: Data, recordedSize: Int) throws -> PatchPlan {
        let isBinary = original.starts(with: Array("bplist00".utf8))
        guard
            var content = try PropertyListSerialization.propertyList(
                from: original,
                options: [],
                format: nil
            ) as? [String: Any]
        else {
            throw PatchError.notAPlistDictionary
        }

        var changes: [String] = []
        if boolean(content["IsSupervised"]) != true {
            changes.append("IsSupervised: \(label(content["IsSupervised"])) -> true")
            content["IsSupervised"] = true
        }
        if boolean(content["CloudConfigurationUIComplete"]) == false {
            changes.append("CloudConfigurationUIComplete: false -> true")
            content["CloudConfigurationUIComplete"] = true
        }

        var newBytes = try PropertyListSerialization.data(
            fromPropertyList: content,
            format: isBinary ? .binary : .xml,
            options: 0
        )
        var padding = 0
        if !isBinary, newBytes.count < recordedSize {
            // Whitespace after the root element stays valid XML, so the file
            // keeps the byte size that Manifest.db records and the database
            // stays untouched.
            padding = recordedSize - newBytes.count
            newBytes.append(Data(repeating: 0x0a, count: padding))
        }
        return PatchPlan(
            newBytes: newBytes,
            format: isBinary ? .binary : .xml,
            oldSize: recordedSize,
            padding: padding,
            newRecordedSize: newBytes.count == recordedSize ? nil : newBytes.count,
            changes: changes
        )
    }

    // Applying

    /// Save the untouched copy, record the new size when the file changed size,
    /// then write the file.
    ///
    /// The retired Python tool saved the copy in the command and applied the patch after it.
    /// Here one call does both, so no caller can write over a backup that has
    /// no untouched copy yet. The folder that holds the copy comes back.
    @discardableResult
    func apply(_ plan: PatchPlan) throws -> URL {
        let pristine = try savePristine()
        if let size = plan.newRecordedSize {
            try rewriteManifestDatabase(size: size)
        }
        try backup.writeContent(plan.newBytes)
        return pristine
    }

    /// Re-read the patched backup. Return the byte size that both sides agree on.
    @discardableResult
    func verify() throws -> Int {
        let plain = try backup.readContent()
        guard
            let content = try? PropertyListSerialization.propertyList(
                from: plain,
                options: [],
                format: nil
            ) as? [String: Any],
            Self.boolean(content["IsSupervised"]) == true
        else {
            throw PatchError.verificationFlag(true)
        }
        guard let row = try backup.supervisionRow() else { throw PatchError.verificationRowMissing }
        let recorded = try MBFileBlob.readSize(row.blob)
        guard recorded == plain.count else {
            throw PatchError.verificationSize(actual: plain.count, recorded: recorded)
        }
        return plain.count
    }

    /// Record the new file size. An encrypted Manifest.db is written again with
    /// its key, and the plain copy is deleted either way.
    private func rewriteManifestDatabase(size: Int) throws {
        guard let fileID = backup.fileID else { throw PatchError.noSupervisionFile }
        guard let keys = backup.keys else {
            try ManifestDB.updateRecordedSize(in: backup.manifestDatabaseURL, fileID: fileID, size: size)
            return
        }
        let plain = try ManifestDB.decrypt(
            backup.manifestDatabaseURL,
            key: keys.manifest,
            into: backup.scratchDirectory
        )
        defer { ManifestDB.removePlainCopy(plain) }
        try ManifestDB.updateRecordedSize(in: plain, fileID: fileID, size: size)
        try ManifestDB.encrypt(plain, over: backup.manifestDatabaseURL, key: keys.manifest)
    }

    // The untouched copy

    /// Copy the untouched supervision file and Manifest.db aside. The keys of
    /// an encrypted backup are not copied: both files go over as they lie, so
    /// putting them back needs no password.
    @discardableResult
    func savePristine() throws -> URL {
        guard let fileID = backup.fileID else { throw PatchError.noSupervisionFile }
        let stamp = Self.stamp(Date())
        let directory = Self.pristineRoot(forBackupRoot: backup.url.deletingLastPathComponent())
            .appendingPathComponent("\(backup.udid)-\(stamp)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try AtomicFile.copy(try backup.contentURL, onto: directory.appendingPathComponent(fileID))
        try AtomicFile.copy(
            backup.manifestDatabaseURL,
            onto: directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        )
        // The names are the ones the retired Python tool wrote, so a copy it
        // saved can still be put back.
        let metadata: [String: Any] = [
            "udid": backup.udid,
            "backup_path": backup.url.path,
            "file_id": fileID,
            "content_relative_path": "\(fileID.prefix(2))/\(fileID)",
            "saved_at": stamp,
        ]
        var json = try JSONSerialization.data(
            withJSONObject: metadata,
            options: [.prettyPrinted, .sortedKeys]
        )
        json.append(0x0a)
        try json.write(to: directory.appendingPathComponent(Self.pristineMetadataName), options: .atomic)
        return directory
    }

    /// The newest untouched copy of this backup.
    static func latestPristine(forBackupRoot root: URL, udid: String) throws -> URL {
        let directory = pristineRoot(forBackupRoot: root)
        let prefix = "\(udid)-"
        let children = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isDirectoryKey]
        )) ?? []
        let names = children
            .map(\.lastPathComponent)
            .filter { $0.hasPrefix(prefix) }
            .sorted()
        guard let newest = names.last else {
            throw PatchError.noPristineCopy(udid: udid, root: directory)
        }
        return directory.appendingPathComponent(newest)
    }

    /// Put the untouched files back. The folder they came from comes back.
    @discardableResult
    func restorePristine() throws -> URL {
        let directory = try Self.latestPristine(
            forBackupRoot: backup.url.deletingLastPathComponent(),
            udid: backup.udid
        )
        let metadataURL = directory.appendingPathComponent(Self.pristineMetadataName)
        guard
            let data = try? Data(contentsOf: metadataURL),
            let metadata = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let fileID = metadata["file_id"] as? String,
            let relativePath = metadata["content_relative_path"] as? String
        else {
            throw PatchError.unreadablePristineMetadata(directory)
        }
        try AtomicFile.copy(
            directory.appendingPathComponent(fileID),
            onto: backup.url.appendingPathComponent(relativePath)
        )
        let savedDatabase = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        if FileManager.default.fileExists(atPath: savedDatabase.path) {
            try AtomicFile.copy(savedDatabase, onto: backup.manifestDatabaseURL)
        }
        return directory
    }

    // Reading plist values

    /// A plist boolean, and nothing else. An integer is not a boolean here,
    /// which is what the Python `is True` comparison says too.
    static func boolean(_ value: Any?) -> Bool? {
        guard let value, CFGetTypeID(value as CFTypeRef) == CFBooleanGetTypeID() else { return nil }
        return (value as? NSNumber)?.boolValue
    }

    /// How a flag is named in the list of changes.
    static func label(_ value: Any?) -> String {
        switch boolean(value) {
        case true: return "true"
        case false: return "false"
        case nil:
            guard let value else { return "missing" }
            return String(describing: value)
        }
    }

    private static func stamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter.string(from: date)
    }
}
