import Foundation

/// One backup folder on disk, and everything this tool reads out of it.
///
/// The app writes its own backups under Application Support, and a backup that
/// Finder wrote under MobileSync has the same shape, so both are loaded the
/// same way. An encrypted backup gives up nothing until `unlock` runs.
final class BackupFolder {
    static let supervisionDomain = "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles"
    static let supervisionRelativePath = "Library/ConfigurationProfiles/CloudConfigurationDetails.plist"
    static let manifestDatabaseName = "Manifest.db"
    static let manifestPlistName = "Manifest.plist"

    /// A backup folder that Finder wrote.
    static var mobileSyncRoot: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/MobileSync/Backup")
    }

    /// A backup folder that this app wrote. No Full Disk Access is needed here.
    static var applicationSupportRoot: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/attention awareness/Backups")
    }

    let url: URL
    let udid: String
    let deviceName: String
    let iosVersion: String
    /// When the backup was made, as Manifest.plist records it.
    let date: Date?
    let isEncrypted: Bool

    /// The keys of an encrypted backup, after `unlock`.
    private(set) var keys: BackupKeys?
    /// The name of the file in the backup that holds the cloud configuration.
    private(set) var fileID: String?
    /// The file size that Manifest.db records for that file.
    private(set) var recordedSize: Int?
    /// The flag itself. Nil when it is missing, or not readable yet.
    private(set) var isSupervised: Bool?
    /// Why the flag is not there, in one sentence for the window.
    private(set) var note: String?

    private let manifest: [String: Any]

    private init(url: URL, manifest: [String: Any]) {
        self.url = url
        self.manifest = manifest
        let lockdown = manifest["Lockdown"] as? [String: Any] ?? [:]
        self.udid = lockdown["UniqueDeviceID"] as? String ?? url.lastPathComponent
        self.deviceName = lockdown["DeviceName"] as? String ?? "unknown"
        self.iosVersion = lockdown["ProductVersion"] as? String ?? "unknown"
        self.date = manifest["Date"] as? Date
        self.isEncrypted = (manifest["IsEncrypted"] as? NSNumber)?.boolValue ?? false
    }

    /// Read a backup folder. An encrypted one stops after Manifest.plist,
    /// because everything else needs the password.
    static func load(at url: URL) throws -> BackupFolder {
        let plist = url.appendingPathComponent(manifestPlistName)
        guard
            let data = try? Data(contentsOf: plist),
            let manifest = try? PropertyListSerialization.propertyList(
                from: data,
                options: [],
                format: nil
            ) as? [String: Any]
        else {
            throw PatchError.unreadableManifest(url)
        }
        let backup = BackupFolder(url: url, manifest: manifest)
        if backup.isEncrypted {
            backup.note = "The backup is encrypted. Give the backup password to read the supervision flag."
            return backup
        }
        try backup.refresh()
        return backup
    }

    /// Unlock an encrypted backup, then read it again with its keys.
    func unlock(password: String) throws {
        guard isEncrypted else { return }
        keys = try BackupKeys.unlock(manifest: manifest, password: password)
        try refresh()
    }

    /// The supervision flag, read again from the files on disk. Nil while the
    /// backup is locked, holds no supervision row, or holds no flag.
    @discardableResult
    func supervisionState() throws -> Bool? {
        try refresh()
        return isSupervised
    }

    var manifestDatabaseURL: URL {
        url.appendingPathComponent(Self.manifestDatabaseName)
    }

    /// The file in the backup that holds the cloud configuration. A backup
    /// stores a file under the first two characters of its name.
    var contentURL: URL {
        get throws {
            guard let fileID else { throw PatchError.noSupervisionFile }
            return url.appendingPathComponent(String(fileID.prefix(2))).appendingPathComponent(fileID)
        }
    }

    var hasSupervisionRow: Bool {
        fileID != nil
    }

    /// True while the backup is encrypted and no password has come in yet.
    var isLocked: Bool {
        isEncrypted && keys == nil
    }

    /// The plain bytes of the supervision file, decrypted when the backup is.
    func readContent() throws -> Data {
        let raw = try Data(contentsOf: contentURL)
        guard let fileKey = keys?.file else { return raw }
        return BackupCrypto.stripPadding(try BackupCrypto.decrypt(raw, key: fileKey))
    }

    /// Write the supervision file back, encrypted again when the backup is.
    func writeContent(_ data: Data) throws {
        let target = try contentURL
        guard let fileKey = keys?.file else {
            try data.write(to: target, options: .atomic)
            return
        }
        let encrypted = try BackupCrypto.encrypt(BackupCrypto.addPadding(data), key: fileKey)
        try encrypted.write(to: target, options: .atomic)
    }

    /// The Files row of the supervision file. An encrypted Manifest.db is
    /// decrypted to a plain copy first, and that copy is deleted again.
    ///
    /// Both databases are put into rollback journal mode before they are read,
    /// because the one `idevicebackup2` writes is in WAL mode with no side
    /// files and no reader can open that. This app only ever opens a backup it
    /// is about to patch, its own or the one the reader pointed at, so the
    /// write that costs is one it is already allowed to make.
    func supervisionRow() throws -> ManifestDB.Row? {
        guard FileManager.default.fileExists(atPath: manifestDatabaseURL.path) else { return nil }
        guard let keys else {
            try ManifestDB.normaliseJournal(at: manifestDatabaseURL)
            return try ManifestDB.supervisionRow(in: manifestDatabaseURL)
        }
        let plain = try ManifestDB.decrypt(manifestDatabaseURL, key: keys.manifest, into: scratchDirectory)
        defer { ManifestDB.removePlainCopy(plain) }
        // A decrypted database carries the journal mode it was encrypted with,
        // so the plain copy walks into the same wall.
        try ManifestDB.normaliseJournal(at: plain)
        return try ManifestDB.supervisionRow(in: plain)
    }

    /// Where a plain copy of Manifest.db is written while it is read or
    /// changed. The retired Python tool put it beside the untouched copies, so it is on the
    /// same volume as the backup and is cleaned up with them.
    var scratchDirectory: URL {
        SupervisionPatch.pristineRoot(forBackupRoot: url.deletingLastPathComponent())
    }

    /// Read the row, the recorded size, the file key and the flag again.
    private func refresh() throws {
        fileID = nil
        recordedSize = nil
        isSupervised = nil
        note = nil
        guard let row = try supervisionRow() else {
            note = "The backup holds no supervision file row."
            return
        }
        fileID = row.fileID
        recordedSize = try MBFileBlob.readSize(row.blob)
        if var unlocked = keys {
            let (protectionClass, wrapped) = try MBFileBlob.readFileKey(row.blob)
            unlocked.file = try unlocked.keybag.unwrapForClass(protectionClass, wrapped: wrapped)
            keys = unlocked
        }
        let content = try contentURL
        guard FileManager.default.fileExists(atPath: content.path) else {
            note = "The supervision file is missing at \(content.path)."
            return
        }
        guard
            let plist = try? PropertyListSerialization.propertyList(
                from: try readContent(),
                options: [],
                format: nil
            )
        else {
            note = "The supervision file is not a readable plist."
            return
        }
        guard let dictionary = plist as? [String: Any] else {
            note = "The supervision file is not a plist dictionary."
            return
        }
        isSupervised = SupervisionPatch.boolean(dictionary["IsSupervised"])
    }
}

extension BackupFolder {
    /// Finder keeps dated copies of a backup beside the current folder.
    enum Kind {
        case current
        case archive
    }

    /// Tell a live backup folder from a dated copy beside it.
    var kind: Kind {
        let name = url.lastPathComponent
        let prefix = "\(udid)-"
        guard name.hasPrefix(prefix) else { return .current }
        let suffix = name.dropFirst(prefix.count).split(separator: "-", omittingEmptySubsequences: false)
        guard suffix.count == 2, suffix.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) }) else {
            return .current
        }
        return .archive
    }

    /// Every folder under `root` that holds a backup.
    static func folders(in root: URL) throws -> [URL] {
        guard FileManager.default.fileExists(atPath: root.path) else {
            throw PatchError.noBackupFolder(root)
        }
        guard
            let children = try? FileManager.default.contentsOfDirectory(
                at: root,
                includingPropertiesForKeys: [.isDirectoryKey]
            )
        else {
            throw PatchError.noAccessToBackupFolder(root)
        }
        return children
            .filter { child in
                var isDirectory: ObjCBool = false
                let exists = FileManager.default.fileExists(atPath: child.path, isDirectory: &isDirectory)
                guard exists, isDirectory.boolValue else { return false }
                return FileManager.default.fileExists(
                    atPath: child.appendingPathComponent(manifestPlistName).path
                )
            }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// Load every backup under `root`. Encrypted ones come back locked.
    static func loadAll(in root: URL) throws -> [BackupFolder] {
        try folders(in: root).compactMap { try? load(at: $0) }
    }
}
