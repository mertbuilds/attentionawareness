import Foundation

/// The backup this Mac holds while a run is going on, and taking it off the
/// disk again afterwards.
///
/// The app writes one folder per iPhone under Application Support. A measured
/// iPhone 16e backup is 63 GB across 69,445 files, which is a whole copy of
/// somebody's phone, so it lives exactly as long as the run that needs it: the
/// run makes it, restores it and then takes it away. Nothing here keeps a
/// list, because nothing reuses a backup and there is nothing for a person to
/// choose between.
enum BackupStore {
    /// How a folder leaves the disk. The tests put their own in.
    typealias Remove = (URL) throws -> Void

    /// Gone, not in the Trash. The Trash would keep all 63 GB of the phone
    /// until somebody emptied it, which is the opposite of what the delete is
    /// for. By the time this runs, everything the folder held is back on the
    /// iPhone, so the copy is redundant rather than precious.
    static let removePermanently: Remove = { url in
        try FileManager.default.removeItem(at: url)
    }

    // MARK: - Deleting

    /// Take everything this Mac holds for one iPhone off the disk for good:
    /// the backup folder itself and every untouched copy the patch saved
    /// beside it.
    ///
    /// It works from the UDID rather than from a folder somebody read first,
    /// because the folder is not always readable: a run that stopped part way
    /// through leaves one with no Manifest.plist in it, and that folder is
    /// rubbish of exactly the same size.
    ///
    /// Nothing outside `root` is ever touched. The backup has to be a direct
    /// child of it, named by the UDID and nothing else, and a saved copy a
    /// direct child of the pristine folder inside it.
    ///
    /// It answers whether there was anything there to take.
    @discardableResult
    static func delete(
        udid: String,
        root: URL = BackupFolder.applicationSupportRoot,
        remove: Remove = removePermanently
    ) throws -> Bool {
        let folder = try backupFolder(of: udid, in: root)
        var tookSomething = false
        if FileManager.default.fileExists(atPath: folder.path) {
            try delete(folder, with: remove)
            tookSomething = true
        }
        let directory = SupervisionPatch.pristineRoot(forBackupRoot: root)
        for copy in pristineCopies(of: udid, in: root) {
            guard isSameFolder(copy.deletingLastPathComponent(), directory) else {
                throw BackupStoreError.outsideBackupsFolder(copy, root: root)
            }
            try delete(copy, with: remove)
            tookSomething = true
        }
        return tookSomething
    }

    /// The folder one iPhone's backup goes in, once the name has been checked.
    ///
    /// A UDID names one folder directly inside the backups folder and nothing
    /// else, so anything holding a separator, either of the two names that mean
    /// somewhere else, or the name of the pristine folder is refused before a
    /// path is ever built from it.
    private static func backupFolder(of udid: String, in root: URL) throws -> URL {
        let folder = root.appendingPathComponent(udid)
        guard !udid.isEmpty,
              !udid.contains("/"),
              udid != ".",
              udid != "..",
              udid != SupervisionPatch.pristineDirectoryName,
              isSameFolder(folder.deletingLastPathComponent(), root)
        else {
            throw BackupStoreError.outsideBackupsFolder(folder, root: root)
        }
        return folder
    }

    private static func delete(_ url: URL, with remove: Remove) throws {
        do {
            try remove(url)
        } catch {
            throw BackupStoreError.removeFailed(url, error)
        }
    }

    // MARK: - The untouched copies

    /// The copies saved for one iPhone, oldest first.
    ///
    /// `SupervisionPatch.savePristine` writes one folder per patch, named
    /// `<udid>-<yyyyMMdd>-<HHmmss>`, so one phone can have several of them.
    private static func pristineCopies(of udid: String, in root: URL) -> [URL] {
        let directory = SupervisionPatch.pristineRoot(forBackupRoot: root)
        let children = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isDirectoryKey]
        )) ?? []
        return children
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .filter { child in
                Self.udid(ofPristineCopy: child.lastPathComponent) == udid
                    && (try? child.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true
            }
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

    /// Add up what a folder takes on disk. `fileAllocatedSize` is the room the
    /// file holds rather than the length of its contents, which is the number
    /// Finder shows; `fileSize` stands in where the file system gives no
    /// allocated size. A file that cannot be read is skipped and the walk goes
    /// on, because one unreadable file must not lose the whole figure.
    ///
    /// This walks every file in the folder, which for a 63 GB backup is 69,445
    /// of them and takes seconds, so it belongs on a background task. Nil means
    /// the walk was cancelled, because half a number is worse than no number.
    static func size(of folder: URL, isCancelled: () -> Bool = { Task.isCancelled }) -> UInt64? {
        if isCancelled() { return nil }
        // Hidden files are part of the backup, so nothing is skipped here.
        let enumerator = FileManager.default.enumerator(
            at: folder,
            includingPropertiesForKeys: Array(sizeKeys),
            options: [],
            errorHandler: { _, _ in true }
        )
        var total: UInt64 = 0
        var seen = 0
        while let file = enumerator?.nextObject() as? URL {
            seen += 1
            // Asking after every file would put the question seventy thousand
            // times. Every few hundred stops soon enough for a person.
            if seen % 512 == 0, isCancelled() { return nil }
            guard let values = try? file.resourceValues(forKeys: sizeKeys),
                  values.isRegularFile == true
            else { continue }
            total += UInt64(max(0, values.fileAllocatedSize ?? values.fileSize ?? 0))
        }
        return total
    }

    // MARK: - Where two paths are the same folder

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
    /// The folder is not one of the backups. Nothing outside the backups
    /// folder is ever deleted, whatever asks for it.
    case outsideBackupsFolder(URL, root: URL)
    /// macOS refused to take the folder off the disk.
    case removeFailed(URL, Error)

    var errorDescription: String? {
        switch self {
        case .outsideBackupsFolder(let url, let root):
            return """
                The folder at \(url.path) is not one of the backups in \(root.path).
                Nothing was deleted.
                """
        case .removeFailed(let url, let error):
            return """
                The backup at \(url.path) could not be deleted, so it is still on this Mac. \
                macOS reported: \(error.localizedDescription)
                """
        }
    }
}
