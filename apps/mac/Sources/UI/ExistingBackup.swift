import Foundation

/// The backup this Mac already holds for the iPhone a run is about.
///
/// Copying a full iPhone takes about an hour, and the wizard only ever learnt
/// about a backup by making one, so the same phone was asked for that hour
/// again every time. This is the other way in: it reads a listing that is
/// already in hand and says whether the folder for one phone can be used
/// instead, and in what words. It touches no disk and no iPhone, which is why
/// it is the part of the Back up step the tests can run.
enum ExistingBackup {
    /// What this Mac holds for one iPhone.
    enum Offer: Equatable {
        /// Nothing for this phone, which is how every phone starts. The step
        /// is then the one it has always been.
        case nothing
        /// A whole backup, which the step offers instead of making another.
        case usable(StoredBackup)
        /// A folder that cannot be restored. It is never offered, and the step
        /// says why in one sentence rather than leaving a folder of that size
        /// unexplained.
        case unusable(StoredBackup, Reason)
    }

    /// Why a folder on this Mac is no use to this run.
    enum Reason: Equatable {
        /// Status.plist does not say the snapshot finished, so the iPhone
        /// stopped part way through writing the folder.
        case unfinished
        /// Manifest.plist gives no date, so nothing can be said about when the
        /// phone in the folder was the phone on the cable.
        case undated

        /// The one sentence the step shows.
        var sentence: String {
            switch self {
            case .unfinished:
                return """
                    This Mac holds a folder for this iPhone that the iPhone never finished writing, \
                    so it cannot be used.
                    """
            case .undated:
                return """
                    This Mac holds a folder for this iPhone that does not say when it was made, \
                    so it cannot be used.
                    """
            }
        }
    }

    /// What a listing holds for one iPhone.
    ///
    /// One folder is named after one phone, so at most one row can match. A
    /// backup is only offered when the phone finished writing it and it still
    /// says when it was made: the step states the age before anything is
    /// restored, and a folder that cannot say is a folder nobody can weigh.
    static func offer(for udid: String?, in backups: [StoredBackup]) -> Offer {
        guard let udid, let backup = backups.first(where: { $0.udid == udid }) else { return .nothing }
        guard backup.isFinished else { return .unusable(backup, .unfinished) }
        guard backup.date != nil else { return .unusable(backup, .undated) }
        return .usable(backup)
    }

    /// How long ago a backup was made, in the plainest words that stay true:
    /// the time of day while it is today or yesterday, whole days for the two
    /// months after that, and whole months once a count of days says little.
    ///
    /// The words go inside a sentence, so they start in lower case.
    static func age(of date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        let days = daysAgo(date, now: now, calendar: calendar)
        switch days {
        case 0:
            return "made today at \(time(date, calendar: calendar))"
        case 1:
            return "made yesterday at \(time(date, calendar: calendar))"
        case ..<60:
            return "made \(days) days ago"
        default:
            return "made \(days / 30) months ago"
        }
    }

    /// True once the backup is from a day before today.
    ///
    /// It is still offered: how old is too old is the reader's call, and all
    /// the step does is say the age and what using it costs.
    static func isStale(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> Bool {
        daysAgo(date, now: now, calendar: calendar) >= 1
    }

    /// What a backup from another day costs, in one sentence. The restore puts
    /// the whole phone back, so everything the phone has picked up since goes.
    static let stalenessSentence = """
        Restoring it puts the iPhone back to how it was then, so anything it has picked up since is lost.
        """

    /// Whole days between the two, counted by the calendar rather than by the
    /// hours, so a backup made last night is a day old this morning. A clock
    /// that has moved backwards reads as today rather than as a negative
    /// number of days.
    private static func daysAgo(_ date: Date, now: Date, calendar: Calendar) -> Int {
        let made = calendar.startOfDay(for: date)
        let today = calendar.startOfDay(for: now)
        return max(0, calendar.dateComponents([.day], from: made, to: today).day ?? 0)
    }

    /// The time of day the way this Mac writes it, so 09:14 where the system
    /// is set to English.
    private static func time(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = calendar.locale ?? .current
        formatter.timeZone = calendar.timeZone
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
