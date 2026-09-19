import Foundation

/// One backup folder on disk, as a list of them is shown and managed.
///
/// `BackupFolder` reads a backup to patch it, which opens Manifest.db and the
/// supervision file. This is the other half: what a person needs to see before
/// deciding that a folder can go. It comes out of Manifest.plist and the
/// folder name alone, so a backup whose Manifest.db is broken, or whose
/// password nobody remembers, is still listed with everything that could be
/// read and nothing where a field could not. An unreadable 63 GB folder is
/// exactly the one a person needs to delete.
struct StoredBackup: Identifiable, Equatable, Sendable {
    /// The folder itself, always a direct child of the backups folder.
    let url: URL
    /// The folder name, which is the UDID of the iPhone the backup came from.
    /// The name is what the folder is found and deleted by, so it is taken
    /// from the disk rather than from Manifest.plist.
    let udid: String
    /// Nil when Manifest.plist could not be read.
    let deviceName: String?
    /// The model identifier Manifest.plist records, so `iPhone17,5`.
    let productType: String?
    let iosVersion: String?
    /// When the backup was made, as Manifest.plist records it. This is not the
    /// date on the folder, which moves whenever anything inside it is touched.
    let date: Date?
    /// False when Manifest.plist could not be read, because an unread backup
    /// gives no password prompt either.
    let isEncrypted: Bool
    /// What Status.plist last said the iPhone got to, so `finished` on a whole
    /// backup. Nil when the folder holds no readable Status.plist.
    let snapshotState: String?
    /// Nil until `BackupStore.measure` walks the folder.
    var sizeInBytes: Int64?
    /// The newest untouched copy saved for this UDID, which is the one a
    /// restore puts back. Nil when no copy was ever saved.
    let pristineURL: URL?
    /// Every saved copy for this UDID together, which is what deleting the
    /// backup with `includingPristineCopy` frees. Nil until measured, and nil
    /// when there is no copy.
    var pristineSizeInBytes: Int64?

    var id: URL { url }

    /// True when the iPhone finished writing the snapshot, which is the only
    /// kind of backup worth patching and restoring. A folder the phone stopped
    /// part way through holds files that Manifest.db does not know about, and
    /// putting that back on a phone would take things off it.
    var isFinished: Bool { snapshotState == BackupStatus.finishedSnapshot }
}

/// The backups the app keeps on this Mac: listing them, measuring them and
/// taking them off the disk again.
///
/// The app writes one folder per phone under Application Support and never
/// prunes it. A measured iPhone 16e backup is 63 GB across 69,445 files, so
/// three phones put well over 100 GB on the disk. This is the type behind the
/// list that takes them back off.
enum BackupStore {
    /// How a folder leaves the disk. The tests put their own in.
    typealias Trash = (URL) throws -> Void

    /// The Trash, not an unlink: a mistake is recoverable, and the move is
    /// instant inside one volume where unlinking 69,445 files is not.
    static let moveToTrash: Trash = { url in
        var resultingURL: NSURL?
        try FileManager.default.trashItem(at: url, resultingItemURL: &resultingURL)
    }

    // MARK: - Listing

    /// Every backup under `root`, newest first.
    ///
    /// A folder with no Manifest.plist is not a backup and is left out, and so
    /// is the folder that holds the untouched copies. Everything else is
    /// listed, whether or not its metadata could be read.
    static func list(root: URL = BackupFolder.applicationSupportRoot) throws -> [StoredBackup] {
        let folders: [URL]
        do {
            folders = try BackupFolder.folders(in: root)
        } catch PatchError.noBackupFolder(_) {
            // No folder yet means no backups yet. The app makes the folder
            // when it makes the first backup, so this is not a problem to
            // report to anybody.
            return []
        }
        let copies = pristineCopies(in: root)
        return folders
            .filter { $0.lastPathComponent != SupervisionPatch.pristineDirectoryName }
            .map { folder in
                read(folder: folder, pristineCopy: copies[folder.lastPathComponent]?.last)
            }
            .sorted(by: newestFirst)
    }

    /// Read one folder. Every field that Manifest.plist does not give comes
    /// back nil rather than keeping the folder out of the list.
    ///
    /// Status.plist is read beside it, because Manifest.plist is no word on
    /// whether this folder is whole: a backup that stopped part way leaves the
    /// Manifest.plist the last finished one wrote, and only Status.plist says
    /// how far the iPhone got this time.
    private static func read(folder: URL, pristineCopy: URL?) -> StoredBackup {
        let manifest = manifest(in: folder)
        let lockdown = manifest?["Lockdown"] as? [String: Any]
        return StoredBackup(
            url: folder,
            udid: folder.lastPathComponent,
            deviceName: lockdown?["DeviceName"] as? String,
            productType: lockdown?["ProductType"] as? String,
            iosVersion: lockdown?["ProductVersion"] as? String,
            date: manifest?["Date"] as? Date,
            isEncrypted: (manifest?["IsEncrypted"] as? NSNumber)?.boolValue ?? false,
            snapshotState: BackupStatus.read(inBackupFolder: folder)?.snapshotState,
            sizeInBytes: nil,
            pristineURL: pristineCopy,
            pristineSizeInBytes: nil
        )
    }

    /// Manifest.plist, when it is there and readable. It carries the device
    /// name, the model, the iOS version, the date and the encryption flag, so
    /// the 2.7 MB Info.plist beside it is never opened.
    private static func manifest(in folder: URL) -> [String: Any]? {
        let url = folder.appendingPathComponent(BackupFolder.manifestPlistName)
        guard let data = try? Data(contentsOf: url) else { return nil }
        let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil)
        return plist as? [String: Any]
    }

    /// The newest backup first. One with no readable date goes last, and the
    /// UDID settles a tie so the order never moves between two listings.
    private static func newestFirst(_ left: StoredBackup, _ right: StoredBackup) -> Bool {
        switch (left.date, right.date) {
        case let (leftDate?, rightDate?):
            return leftDate == rightDate ? left.udid < right.udid : leftDate > rightDate
        case (_?, nil):
            return true
        case (nil, _?):
            return false
        case (nil, nil):
            return left.udid < right.udid
        }
    }

    // MARK: - The untouched copies

    /// The saved copies under the pristine folder, grouped by UDID and oldest
    /// first, so the last one of a group is the newest.
    ///
    /// `SupervisionPatch.savePristine` writes one folder per patch, named
    /// `<udid>-<yyyyMMdd>-<HHmmss>`, so one phone can have several.
    private static func pristineCopies(in root: URL) -> [String: [URL]] {
        let directory = SupervisionPatch.pristineRoot(forBackupRoot: root)
        let children = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isDirectoryKey]
        )) ?? []
        var copies: [String: [URL]] = [:]
        for child in children.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            guard let udid = udid(ofPristineCopy: child.lastPathComponent),
                  (try? child.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true
            else { continue }
            copies[udid, default: []].append(child)
        }
        return copies
    }

    /// The UDID a saved copy belongs to. A UDID holds a dash of its own, so
    /// the two stamp parts come off the end rather than the UDID off the
    /// front. Anything else in that folder is not a saved copy.
    private static func udid(ofPristineCopy name: String) -> String? {
        let parts = name.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count >= 3,
              parts.suffix(2).allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) })
        else { return nil }
        return parts.dropLast(2).joined(separator: "-")
    }

    // MARK: - Measuring

    private static let sizeKeys: Set<URLResourceKey> = [
        .isRegularFileKey,
        .fileAllocatedSizeKey,
        .fileSizeKey,
    ]

    /// Fill in the sizes of the backup and of every untouched copy saved for
    /// it. Both numbers come back on a copy of the backup; nothing is written.
    ///
    /// This walks every file in the folder, which for a 63 GB backup is 69,445
    /// of them and takes seconds, so it belongs on a background task. Use
    /// `measured(_:)` from the window rather than this.
    ///
    /// A cancelled walk gives back the backup it was handed, sizes still nil,
    /// because half a number is worse than no number.
    static func measure(
        _ backup: StoredBackup,
        isCancelled: () -> Bool = { Task.isCancelled }
    ) -> StoredBackup {
        guard let folderSize = directorySize(at: backup.url, isCancelled: isCancelled) else {
            return backup
        }
        let copies = pristineCopies(in: backup.url.deletingLastPathComponent())[backup.udid] ?? []
        var pristineSize: Int64 = 0
        for copy in copies {
            guard let size = directorySize(at: copy, isCancelled: isCancelled) else { return backup }
            pristineSize += size
        }
        var measured = backup
        measured.sizeInBytes = folderSize
        measured.pristineSizeInBytes = copies.isEmpty ? nil : pristineSize
        return measured
    }

    /// The same measurement off the main thread, so the window keeps drawing
    /// while a 63 GB folder is counted. Cancelling the calling task stops the
    /// walk.
    static func measured(_ backup: StoredBackup) async -> StoredBackup {
        let task = Task.detached(priority: .utility) { measure(backup) }
        return await withTaskCancellationHandler {
            await task.value
        } onCancel: {
            task.cancel()
        }
    }

    /// What the measured backups take together, the saved copies included.
    /// A backup that has not been measured yet counts as nothing, so the
    /// number only grows as the measurements come in.
    static func totalSize(of backups: [StoredBackup]) -> Int64 {
        backups.reduce(into: 0) { total, backup in
            total += backup.sizeInBytes ?? 0
            total += backup.pristineSizeInBytes ?? 0
        }
    }

    /// Add up what a folder takes on disk. `fileAllocatedSize` is the room the
    /// file holds rather than the length of its contents, which is the number
    /// Finder shows; `fileSize` stands in where the file system gives no
    /// allocated size. A file that cannot be read is skipped and the walk goes
    /// on, because one unreadable file must not lose the whole figure.
    ///
    /// Nil means the walk was cancelled.
    private static func directorySize(at url: URL, isCancelled: () -> Bool) -> Int64? {
        if isCancelled() { return nil }
        // Hidden files are part of the backup, so nothing is skipped here.
        let enumerator = FileManager.default.enumerator(
            at: url,
            includingPropertiesForKeys: Array(sizeKeys),
            options: [],
            errorHandler: { _, _ in true }
        )
        var total: Int64 = 0
        var seen = 0
        while let file = enumerator?.nextObject() as? URL {
            seen += 1
            // Asking after every file would put the question seventy thousand
            // times. Every few hundred stops soon enough for a person.
            if seen % 512 == 0, isCancelled() { return nil }
            guard let values = try? file.resourceValues(forKeys: sizeKeys),
                  values.isRegularFile == true
            else { continue }
            total += Int64(values.fileAllocatedSize ?? values.fileSize ?? 0)
        }
        return total
    }

    // MARK: - Deleting

    /// Move a backup to the Trash.
    ///
    /// The untouched copy is the only way back to the backup as the iPhone
    /// made it, so it is never taken as a side effect of anything: the caller
    /// asks for it by name with `includingPristineCopy`, and then every copy
    /// saved for that phone goes, because a copy of a backup that is gone can
    /// no longer be put back over anything.
    ///
    /// Nothing outside `root` is ever touched. The backup has to be a direct
    /// child of it and a saved copy a direct child of the pristine folder
    /// inside it, whatever the caller hands in.
    static func delete(
        _ backup: StoredBackup,
        includingPristineCopy: Bool,
        root: URL = BackupFolder.applicationSupportRoot,
        trash: Trash = moveToTrash
    ) throws {
        try checkIsBackupFolder(backup.url, in: root)
        try moveToTrash(backup.url, with: trash)
        guard includingPristineCopy else { return }
        let directory = SupervisionPatch.pristineRoot(forBackupRoot: root)
        for copy in pristineCopies(in: root)[backup.udid] ?? [] {
            guard isSameFolder(copy.deletingLastPathComponent(), directory) else {
                throw BackupStoreError.outsideBackupsFolder(copy, root: root)
            }
            try moveToTrash(copy, with: trash)
        }
    }

    private static func moveToTrash(_ url: URL, with trash: Trash) throws {
        do {
            try trash(url)
        } catch {
            throw BackupStoreError.trashFailed(url, error)
        }
    }

    /// Refuse anything that is not a backup sitting directly in `root`.
    private static func checkIsBackupFolder(_ url: URL, in root: URL) throws {
        guard isSameFolder(url.deletingLastPathComponent(), root),
              url.lastPathComponent != SupervisionPatch.pristineDirectoryName
        else {
            throw BackupStoreError.outsideBackupsFolder(url, root: root)
        }
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory)
        let manifest = url.appendingPathComponent(BackupFolder.manifestPlistName)
        guard exists, isDirectory.boolValue, FileManager.default.fileExists(atPath: manifest.path) else {
            throw BackupStoreError.notABackupFolder(url)
        }
    }

    /// The same folder on disk, whatever the two paths look like. A temporary
    /// folder is reached through /var on one line and /private/var on the
    /// next, and a path that ends in a slash names the folder a path without
    /// one names.
    private static func isSameFolder(_ left: URL, _ right: URL) -> Bool {
        normalised(left) == normalised(right)
    }

    /// A path that does not change with what happens to exist.
    /// `resolvingSymlinksInPath` drops a leading /private only while the file
    /// is still there, so it answers one way before a delete and another way
    /// after it. Folding the prefix by hand afterwards keeps the answer steady.
    private static func normalised(_ url: URL) -> String {
        let path = url.resolvingSymlinksInPath().standardizedFileURL.path
        return path.hasPrefix("/private/") ? String(path.dropFirst("/private".count)) : path
    }
}

/// What can stop a backup from being deleted.
enum BackupStoreError: LocalizedError {
    /// The folder holds no Manifest.plist, or is not a folder at all.
    case notABackupFolder(URL)
    /// The folder is not one of the backups. Nothing outside the backups
    /// folder is ever deleted, whatever asks for it.
    case outsideBackupsFolder(URL, root: URL)
    /// macOS refused to move the folder to the Trash.
    case trashFailed(URL, Error)

    var errorDescription: String? {
        switch self {
        case .notABackupFolder(let url):
            return "There is no backup at \(url.path), so nothing was deleted."
        case .outsideBackupsFolder(let url, let root):
            return """
                The folder at \(url.path) is not one of the backups in \(root.path).
                Nothing was deleted.
                """
        case .trashFailed(let url, let error):
            return """
                The folder at \(url.path) could not be moved to the Trash. \
                macOS reported: \(error.localizedDescription)
                """
        }
    }
}
