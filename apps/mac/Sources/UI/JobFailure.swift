import Foundation

/// What went wrong while the job had the iPhone, in the two sentences the
/// screen shows: what happened, and the one thing to do about it.
///
/// The layers underneath report a helper exit code or a lockdown number, and
/// none of that is what somebody needs at the moment their phone is half way
/// through. So every failure the job can meet
/// is turned into a headline and a fix here, and the words the layer used are
/// kept in `raw`, behind the "i", for the day they matter.
///
/// Nothing here touches the iPhone, the backup or the window, which is why it
/// is a part of the job the tests can run.
struct JobFailure: Equatable {
    /// Which piece of the job was running: reading the iPhone and writing the
    /// seed, or sending it and restarting.
    enum Piece: Equatable {
        case preparing
        case restoring
    }

    /// Where Try Again picks the run up again. Both read the iPhone again
    /// first. `.restore` is a failure that may have reached the iPhone, so
    /// unplugging keeps its screen and its Try Again. A restore on iOS 27 or
    /// later that still owes its live step gets that step alone from either.
    enum Retry: Equatable {
        case start
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

    /// Turn whatever a layer threw into the two sentences the screen shows.
    ///
    /// Nil for a stop somebody asked for: that is not a failure, and the run
    /// goes back to Ready without a word about it.
    static func from(_ error: Error, in piece: Piece) -> JobFailure? {
        if let seed = error as? SeedRunError {
            let raw = seed.localizedDescription
            switch seed {
            case .refused:
                return JobFailure(title: "Can't Supervise This iPhone", fix: raw, raw: raw, retry: .start)
            case .restartFailed, .cancelled(restoreApplied: true):
                return JobFailure(title: "Restart Needed", fix: "Reconnect and unlock iPhone, then try again to restart it.", raw: raw, retry: .restore)
            case .cancelled(restoreApplied: false):
                return JobFailure(title: "Restore Stopped", fix: "Check iPhone before trying the restore again.", raw: raw, retry: .restore)
            case .liveConfigurationNotTaken(let lastReason):
                // Try Again sends the setting again and nothing else: no
                // restore and no restart. The "i" holds what the last attempt
                // failed with.
                return JobFailure(title: "iPhone Didn't Take the Setting", fix: settingNotTaken, raw: lastReason ?? "", retry: .restore)
            case .alreadyRunning, .noAppliedRestore:
                return JobFailure(title: "Couldn't Finish Supervision", fix: raw, raw: raw, retry: .restore)
            }
        }
        if error is CancellationError { return nil }
        if let backup = error as? BackupError, backup == .cancelled { return nil }
        let raw = error.localizedDescription
        switch piece {
        case .preparing:
            return JobFailure(title: "Couldn't Read iPhone", fix: reconnect, raw: raw, retry: .start)
        case .restoring:
            return JobFailure(title: "Restore Didn't Finish", fix: reconnect, raw: raw, retry: .restore)
        }
    }

    /// A run that takes supervision off, which only the debug
    /// `--debug-unsupervise` flag starts, where iPhone still says it is
    /// supervised after the restart.
    static let stillSupervised = JobFailure(
        title: "iPhone Is Still Supervised",
        fix: "Check Settings on iPhone. Try Again sends the change again.",
        raw: "",
        retry: .restore
    )

    /// What to do when iPhone restarted on iOS 27 or later and the setting
    /// sent live did not hold.
    private static let settingNotTaken =
        "iPhone restarted, but it did not take the supervision setting. Keep iPhone on the Restore Completed screen, unlocked and on the cable, then try again."

    /// The one thing to do about a cable that let go, which is what nearly
    /// every failure comes down to.
    private static let reconnect = "Reconnect iPhone, then try again."
}
