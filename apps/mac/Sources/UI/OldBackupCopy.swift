import Foundation

/// The copy of iPhone that versions 0.4.0 to 0.4.2 kept on the Mac.
///
/// The full copy method wrote one folder per iPhone, and its untouched copies,
/// under `Backups` in the app's own Application Support folder, and took them
/// away when the run finished or when the next run started. That method is
/// gone, so a copy left by a run that never finished is taken away at launch,
/// with the two transfer rates the method wrote to the defaults. The fast
/// method writes its seed under the temporary folder, never under `Backups`.
/// This file and its one call can be removed in a later version, once the
/// copies of 0.4.0 to 0.4.2 have updated.
enum OldBackupCopy {
    /// What a call did, for the tests. The launch ignores it.
    enum Outcome: Equatable {
        case removed
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

    /// Take the old copy and the old defaults away. The defaults go at once;
    /// the folder can hold tens of GB, so it goes on a background task and the
    /// window does not wait for it.
    static func removeAtLaunch() {
        removeDefaults()
        Task.detached(priority: .utility) {
            _ = removeFolder()
        }
    }

    static func removeDefaults(from defaults: UserDefaults = .standard) {
        for key in defaultsKeys {
            defaults.removeObject(forKey: key)
        }
    }

    /// Delete `folder` for good, but only when it is the `Backups` folder
    /// directly inside `appFolder`, neither of the two is a symbolic link and
    /// the resolved path still says so. A link inside the folder is removed as
    /// a link; what it points at is never touched.
    ///
    /// Nothing there is not an error. A refusal or a failure is one line in
    /// the log with no path, because the folders inside are named by UDIDs.
    static func removeFolder(
        _ folder: URL = folder,
        appFolder: URL = appFolder,
        fileManager: FileManager = .default
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
            try fileManager.removeItem(at: folder)
            DeviceLog.logger.notice("old backup copy: removed")
            return .removed
        } catch {
            let error = error as NSError
            DeviceLog.logger.notice(
                "old backup copy: not removed, \(error.domain, privacy: .public) \(error.code, privacy: .public)"
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
