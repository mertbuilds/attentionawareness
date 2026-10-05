import Foundation

/// The copy of iPhone that versions 0.4.0 to 0.4.2 kept on the Mac.
///
/// The full copy method wrote one folder per iPhone, and its untouched copies,
/// under `Backups` in the app's own Application Support folder, and took them
/// away when the run finished or when the next run started. That method is
/// gone, so a copy left by a run that never finished is moved to the Trash at
/// launch, and the two transfer rates the method wrote to the defaults are
/// removed. On iOS 27 that method erased iPhone, and the copy it kept is a
/// normal encrypted backup that Finder can still restore, so it goes to the
/// Trash and the person decides when to empty it. The fast
/// method writes its seed under the temporary folder, never under `Backups`.
/// This file and its one call can be removed in a later version, once the
/// copies of 0.4.0 to 0.4.2 have updated.
enum OldBackupCopy {
    /// What a call did, for the tests. The launch ignores it.
    enum Outcome: Equatable {
        case trashed
        case nothingThere
        case refused
        case failed
    }

    /// The defaults the full copy wrote: bytes per second of its last backup
    /// and of its last restore.
    static let defaultsKeys = ["transferRate.backup", "transferRate.restore"]

    /// The app's own folder under Application Support.
    static var appFolder: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/attention awareness")
    }

    static let folderName = "Backups"

    /// The folder the full copy wrote in, built the way the old
    /// `BackupFolder.applicationSupportRoot` built it.
    static var folder: URL {
        appFolder.appendingPathComponent(folderName)
    }

    /// Move the old copy to the Trash and remove the old defaults. The
    /// defaults go at once; the folder can hold tens of GB, so it moves on a
    /// background task and the window does not wait for it.
    static func removeAtLaunch() {
        removeDefaults()
        Task.detached(priority: .utility) {
            _ = trashFolder()
        }
    }

    static func removeDefaults(from defaults: UserDefaults = .standard) {
        for key in defaultsKeys {
            defaults.removeObject(forKey: key)
        }
    }

    /// Move `folder` to the Trash, but only when it is the `Backups` folder
    /// directly inside `appFolder`, neither of the two is a symbolic link and
    /// the resolved path still says so. A link inside the folder moves as a
    /// link; what it points at is never touched. When the move fails, the
    /// folder stays where it is; it is never deleted instead.
    ///
    /// Nothing there is not an error. A refusal or a failure is one line in
    /// the log with no path, because the folders inside are named by UDIDs.
    static func trashFolder(
        _ folder: URL = folder,
        appFolder: URL = appFolder,
        moveToTrash: (URL) throws -> Void = { try FileManager.default.trashItem(at: $0, resultingItemURL: nil) }
    ) -> Outcome {
        guard let folderIsLink = isLink(folder) else { return .nothingThere }
        guard folder.lastPathComponent == folderName,
              !folderIsLink,
              isLink(appFolder) == false,
              normalised(folder) == normalised(appFolder.appendingPathComponent(folderName))
        else {
            DeviceLog.logger.notice("old backup copy: refused, not the app's own Backups folder")
            return .refused
        }
        do {
            try moveToTrash(folder)
            DeviceLog.logger.notice("old backup copy: moved to the Trash")
            return .trashed
        } catch {
            let error = error as NSError
            DeviceLog.logger.notice(
                "old backup copy: not moved to the Trash, \(error.domain, privacy: .public) \(error.code, privacy: .public)"
            )
            return .failed
        }
    }

    /// True for a symbolic link, false for anything else that is there, nil
    /// for nothing there. It reads the item itself, never what a link names.
    private static func isLink(_ url: URL) -> Bool? {
        guard let values = try? url.resourceValues(forKeys: [.isSymbolicLinkKey]) else { return nil }
        return values.isSymbolicLink == true
    }

    /// The same folder on disk, whatever the path looks like. A temporary
    /// folder is reached through /var on one line and /private/var on the
    /// next, so the prefix is folded after links are resolved.
    private static func normalised(_ url: URL) -> String {
        let path = url.resolvingSymlinksInPath().standardizedFileURL.path
        return path.hasPrefix("/private/") ? String(path.dropFirst("/private".count)) : path
    }
}
