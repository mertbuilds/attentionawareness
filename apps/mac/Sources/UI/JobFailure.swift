import Foundation

/// What went wrong while the job had the iPhone, in the two sentences the
/// screen shows: what happened, and the one thing to do about it.
///
/// The layers underneath report a helper exit code, a lockdown number or a
/// sentence about a keybag, and none of that is what somebody needs at the
/// moment their phone is half way through. So every failure the job can meet
/// is turned into a headline and a fix here, and the words the layer used are
/// kept in `raw`, behind the "i", for the day they matter.
///
/// Nothing here touches the iPhone, the backup or the window, which is why it
/// is a part of the job the tests can run.
struct JobFailure: Equatable {
    /// Which piece of the job was running. The helper says the same thing
    /// whichever way the files were moving, so this is what tells the two
    /// apart.
    enum Piece: Equatable {
        case copying
        case preparing
        case restoring
    }

    /// Where Try Again picks the run up again: the earliest piece that is safe
    /// to run twice. A copy that stopped part way is worth nothing, so it is
    /// made again. A copy already on this Mac with the flag in it is sent
    /// again without another hour on the cable.
    enum Retry: Equatable {
        case copy
        case patch
        case restore
    }

    /// The headline, Title Case, which the screen shows in place of its own.
    let title: String
    /// The one thing to do about it.
    let fix: String
    /// What the layer underneath said, for the "i". Empty when it said nothing
    /// worth keeping.
    let raw: String
    let retry: Retry

    /// True for the one failure somebody answers by typing rather than by
    /// pressing again, which is the one the patch is run for a second time.
    var needsPassword: Bool { retry == .patch }

    /// Turn whatever a layer threw into the two sentences the screen shows.
    ///
    /// Nil for a stop somebody asked for: that is not a failure, and the run
    /// goes back to Ready without a word about it.
    ///
    /// `missingSpace` is how much room to free, already in the words a person
    /// says. It is handed in rather than read here, because how full this Mac
    /// is has nothing to do with what the helper threw.
    static func from(_ error: Error, in piece: Piece, missingSpace: String? = nil) -> JobFailure? {
        if error is CancellationError { return nil }
        if let backup = error as? BackupError, backup == .cancelled { return nil }
        // Turning encryption on is its own step before the copy, so its failure
        // is its own headline. The iPhone can refuse until it is unlocked and
        // the passcode is entered, which is the one thing to do about it.
        if let backup = error as? BackupError, case .encryptionFailed(let sentence) = backup {
            return JobFailure(
                title: "Couldn't Turn On Encryption",
                fix: "Unlock iPhone and try again.",
                raw: sentence,
                retry: .copy
            )
        }
        let raw = error.localizedDescription
        let said = raw.lowercased()
        if said.contains("backup password") {
            return JobFailure(
                title: "Wrong Backup Password",
                fix: "Enter the password you set for encrypted backups.",
                raw: raw,
                retry: .patch
            )
        }
        if said.contains("not enough free space") || said.contains("no space left") {
            return JobFailure(title: noSpace, fix: freeUp(missingSpace), raw: raw, retry: .copy)
        }
        switch piece {
        case .copying, .preparing:
            return JobFailure(title: "Copy Didn't Finish", fix: reconnect, raw: raw, retry: .copy)
        case .restoring:
            return JobFailure(title: "Restore Didn't Finish", fix: reconnect, raw: raw, retry: .restore)
        }
    }

    /// The one thing to do about a cable that let go, which is what nearly
    /// every transfer failure comes down to.
    private static let reconnect = "Reconnect iPhone, then try again."
    private static let noSpace = "Not Enough Space on This Mac"

    /// How much room to free, where the checks measured it. A run that could
    /// not read the volume says the same thing without a figure.
    private static func freeUp(_ missingSpace: String?) -> String {
        guard let missingSpace else { return "Free up space on this Mac, then try again." }
        return "Free up about \(missingSpace), then try again."
    }
}
