import Foundation

/// `Status.plist`, the second source of truth about a running backup.
///
/// The phone writes this file into the backup folder and the helper checks it
/// before it calls a backup successful. It is the only thing that still moves
/// while the helper is quiet, so the engine reads it on a timer.
///
/// A finished backup on this Mac holds exactly these keys:
///
/// ```
/// BackupState   => "new"
/// Date          => 2026-09-11 14:56:50 +0000
/// IsFullBackup  => false
/// SnapshotState => "finished"
/// UUID          => "5A3C5468-1418-4607-9703-C57FB7DD324E"
/// Version       => "3.3"
/// ```
struct BackupStatus: Equatable {
    static let fileName = "Status.plist"
    /// The one value the helper itself tests for before it says the backup
    /// worked. Anything else means the phone is still writing.
    static let finishedSnapshot = "finished"

    let snapshotState: String?
    let backupState: String?
    let isFullBackup: Bool?
    let uuid: String?
    let date: Date?

    /// True once the phone says the snapshot is complete.
    var isFinished: Bool { snapshotState == Self.finishedSnapshot }

    /// One sentence for the log, so a quiet helper still shows movement.
    var sentence: String {
        guard let snapshotState else { return "The iPhone has not written a snapshot state yet." }
        if isFinished { return "The iPhone finished the snapshot." }
        return "The iPhone is writing the snapshot. It says \(snapshotState)."
    }

    /// Read the file inside a backup folder. Nil while the phone has not
    /// written it yet, which is how every backup starts.
    static func read(inBackupFolder folder: URL) -> BackupStatus? {
        read(at: folder.appendingPathComponent(fileName))
    }

    /// Read one `Status.plist` by path.
    static func read(at url: URL) -> BackupStatus? {
        guard
            let data = try? Data(contentsOf: url),
            let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil),
            let values = plist as? [String: Any]
        else {
            return nil
        }
        return BackupStatus(
            snapshotState: values["SnapshotState"] as? String,
            backupState: values["BackupState"] as? String,
            isFullBackup: (values["IsFullBackup"] as? NSNumber)?.boolValue,
            uuid: values["UUID"] as? String,
            date: values["Date"] as? Date
        )
    }
}
