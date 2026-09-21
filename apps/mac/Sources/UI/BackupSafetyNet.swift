import Foundation

/// Whether the person at the keyboard already has a copy of this iPhone that
/// has nothing to do with this app.
///
/// The backup this app makes is scaffolding. It goes up for one run and comes
/// down the moment the run is confirmed, so it is gone by the time anyone
/// would want it back. That is the right shape for a tool that promises to
/// leave nothing behind, and it means the real way back has to be the reader's
/// own. This is where the checks find out whether they have one.
///
/// Two places are asked. The iPhone says whether it backs itself up to iCloud
/// and when it last finished one, which costs nothing and needs no permission.
/// Finder keeps its own backups on this Mac, in a folder macOS protects, so
/// that one can only be read once the reader has granted Full Disk Access. A
/// backup on this Mac is the better answer of the two, because it is right
/// here rather than somewhere only Apple can reach.
///
/// Nothing here blocks a run. It tells the reader what they have and leaves
/// the decision to them, because somebody who knows what they are doing is
/// allowed to go on.
///
/// Nothing but `finderBackup` touches the disk, and nothing touches the
/// iPhone, which is why this is a part of the wizard the tests can run.
enum BackupSafetyNet {
    // MARK: - What the two places say

    /// What the iPhone says about its own iCloud backups. It comes from the
    /// same lockdown domain as the encryption flag, and it needs no more than
    /// a phone that has trusted this Mac.
    enum Cloud: Equatable {
        /// The iPhone would not say, which is how a phone that has not been
        /// trusted yet reads.
        case unknown
        /// iCloud does not back this iPhone up.
        case off
        /// It does, and this is when it last finished one. The date is nil for
        /// a phone that names none, which is a phone that has never managed a
        /// backup at all.
        case on(Date?)
    }

    /// What Finder's backup folder on this Mac says about the same iPhone.
    enum Finder: Equatable {
        /// macOS would not let the app look. There is no way to ask for that
        /// permission, so this is the answer until the reader grants Full Disk
        /// Access by hand and opens the app again.
        case refused
        /// The folder was read and holds no finished backup of this iPhone.
        case nothingHere
        /// It holds one, made when it says. The date is nil when the folder is
        /// there but will not say when it was written.
        case made(Date?)
    }

    // MARK: - Apple's own zero

    /// The date lockdown means by `LastCloudBackupDate`.
    ///
    /// That value counts seconds from 1 January 2001 rather than from the Unix
    /// epoch the rest of the world counts from, and Foundation's reference
    /// date is that same zero, so the conversion is the initialiser and
    /// nothing else. It is written down here because the two epochs are
    /// thirty one years apart: read from the wrong one, a backup made last
    /// week reads as one made in 1995, and the checks would tell somebody
    /// their phone has never been backed up.
    static func date(appleSeconds: UInt64) -> Date {
        Date(timeIntervalSinceReferenceDate: Double(appleSeconds))
    }

    // MARK: - Recent or old

    /// How long a backup stays recent enough to count as a way back. Seven
    /// days.
    ///
    /// iCloud backs an iPhone up every night it is locked, on power and on
    /// Wi-Fi, so a phone in ordinary use has one from last night. Several days
    /// with none is not a schedule, it is something already broken: iCloud
    /// full, Wi-Fi off, or a phone nobody plugs in overnight. Seven days is
    /// also the unit a person reasons in, and it is long enough to survive a
    /// weekend away from the charger without crying wolf.
    ///
    /// Being wrong is not symmetrical either way, which is why the line is
    /// drawn strictly rather than generously. Calling a good backup old costs
    /// the reader a glance at Settings. Calling a stale one recent costs them
    /// everything the phone has gained since.
    static let staysRecent: TimeInterval = 7 * 24 * 60 * 60

    /// How far ahead of this Mac an iPhone may be before its date stops being
    /// worth believing. One day.
    ///
    /// Two clocks are never exactly together, and a phone a few minutes ahead
    /// is ordinary. A phone a day ahead is not: one of the two clocks is
    /// wrong, and an age worked out from it would be a lie in whichever
    /// direction the wrong clock leans.
    static let clockTolerance: TimeInterval = 24 * 60 * 60

    /// True while a date is one this Mac can work an age out from.
    static func isBelievable(_ date: Date, now: Date) -> Bool {
        date.timeIntervalSince(now) <= clockTolerance
    }

    /// True while a backup made then is still a way back.
    static func isRecent(_ date: Date, now: Date) -> Bool {
        now.timeIntervalSince(date) <= staysRecent
    }

    // MARK: - Saying it the way a person would

    /// How long ago something was, in the words a person uses. Whole days from
    /// midnight to midnight, because that is what yesterday means.
    static func age(of date: Date, now: Date, calendar: Calendar = .current) -> String {
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: date),
            to: calendar.startOfDay(for: now)
        ).day ?? 0
        switch days {
        // A phone a few hours ahead of this Mac lands here, and today is the
        // honest word for it.
        case ..<1: return "today"
        case 1: return "yesterday"
        case 2..<14: return "\(days) days ago"
        case 14..<60: return "\(count(days / 7, "week")) ago"
        case 60..<365: return "\(count(days / 30, "month")) ago"
        default: return "\(count(days / 365, "year")) ago"
        }
    }

    /// A date the way a person writes one, so 10 September 2026 rather than a
    /// count of seconds.
    static func day(_ date: Date, calendar: Calendar = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = calendar.locale ?? .current
        formatter.timeZone = calendar.timeZone
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private static func count(_ value: Int, _ unit: String) -> String {
        "\(value) \(unit)\(value == 1 ? "" : "s")"
    }

    // MARK: - The line the checks show

    /// The one line the checks show about the reader's own backups.
    struct Row: Equatable {
        /// How the line reads at a glance.
        enum Standing: Equatable {
            /// There is a backup of the reader's own and it is recent.
            case covered
            /// There is one and it is old, or there is none at all. Either way
            /// something is worth doing first. It is never a wall: the checks
            /// let the run go on whatever this says.
            case thin
            /// Neither place would answer, so nothing can be claimed in either
            /// direction.
            case unknown
        }

        let standing: Standing
        let title: String
        let detail: String
    }

    /// Where one backup of the reader's own lives, in the words each place is
    /// named by on screen.
    private enum Place {
        case finder
        case cloud

        /// The start of the sentence that says when it was made.
        var backedItUp: String {
            switch self {
            case .finder: return "Finder backed this iPhone up on this Mac"
            case .cloud: return "iCloud backed this iPhone up"
            }
        }

        /// The same fact said second, after the other place has been named.
        var alsoHasOne: String {
            switch self {
            case .finder: return "Finder has one on this Mac from"
            case .cloud: return "iCloud has one from"
            }
        }

        /// How the reader makes a fresh one.
        var howToMakeOne: String {
            switch self {
            case .finder:
                return "Open Finder, pick the iPhone in the sidebar, then click Back Up Now."
            case .cloud:
                return """
                    Open Settings on the iPhone, tap your name, tap iCloud, tap iCloud Backup, \
                    then tap Back Up Now.
                    """
            }
        }
    }

    /// One backup of the reader's own: where it is and when it was made.
    private struct Own {
        let place: Place
        let date: Date
    }

    /// What the checks say about the reader's own way back.
    ///
    /// The newer of the two backups is the one the line is about, because it
    /// is the one they would actually reach for. A tie goes to Finder: that
    /// copy is on this Mac, where they can put it back themselves.
    static func row(
        cloud: Cloud,
        finder: Finder,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> Row {
        let onThisMac = believableDate(of: finder, now: now).map { Own(place: .finder, date: $0) }
        let inTheCloud = believableDate(of: cloud, now: now).map { Own(place: .cloud, date: $0) }

        let best: Own
        let other: Own?
        switch (onThisMac, inTheCloud) {
        case (.some(let here), .some(let there)):
            let theOneOnThisMacIsNewer = here.date >= there.date
            best = theOneOnThisMacIsNewer ? here : there
            other = theOneOnThisMacIsNewer ? there : here
        case (.some(let here), nil):
            best = here
            other = nil
        case (nil, .some(let there)):
            best = there
            other = nil
        case (nil, nil):
            return withoutADate(cloud: cloud, finder: finder)
        }

        let when = age(of: best.date, now: now, calendar: calendar)
        guard isRecent(best.date, now: now) else {
            return Row(
                standing: .thin,
                title: "\(best.place.backedItUp) \(when)",
                detail: """
                    That was \(day(best.date, calendar: calendar)). Make a fresh one before you go \
                    on, so the way back is your own. \(best.place.howToMakeOne) You can go on \
                    without it.
                    """
            )
        }
        return Row(
            standing: .covered,
            title: "\(best.place.backedItUp) \(when)",
            detail: [
                "That backup is yours, and this app neither reads it nor writes to it.",
                other.map { "\($0.place.alsoHasOne) \(age(of: $0.date, now: now, calendar: calendar))." },
                """
                The copy this app makes is its own, and it is deleted as soon as the run is \
                confirmed.
                """,
            ]
            .compactMap { $0 }
            .joined(separator: " ")
        )
    }

    /// The date a place names, once a date that has not come yet has been
    /// thrown away. A wrong clock on either end produces one of those, and an
    /// age worked out from it would be worse than no age at all.
    private static func believableDate(of cloud: Cloud, now: Date) -> Date? {
        guard case .on(.some(let date)) = cloud, isBelievable(date, now: now) else { return nil }
        return date
    }

    private static func believableDate(of finder: Finder, now: Date) -> Date? {
        guard case .made(.some(let date)) = finder, isBelievable(date, now: now) else { return nil }
        return date
    }

    /// The line when neither place named a date this Mac can use.
    ///
    /// That is not always the same as having nothing. A folder on this Mac
    /// that will not date itself is not an age, but it is still a copy of the
    /// phone, so it is said first and the iPhone's answer is only reached when
    /// there is no folder to talk about.
    private static func withoutADate(cloud: Cloud, finder: Finder) -> Row {
        if case .made = finder {
            return Row(
                standing: .unknown,
                title: "Finder has a backup of this iPhone on this Mac, but it does not say when it was made",
                detail: """
                    Open Finder and pick the iPhone in the sidebar to read the date of the last \
                    backup. Make a fresh one if it is not recent. You can go on without it.
                    """
            )
        }
        switch cloud {
        case .off:
            return Row(
                standing: .thin,
                title: "iCloud does not back this iPhone up",
                detail: """
                    Make a backup of your own before you go on, so the way back is nothing to do \
                    with this app. Open Settings on the iPhone, tap your name, tap iCloud, tap \
                    iCloud Backup, turn it on, then tap Back Up Now. Finder can make one on this \
                    Mac instead. You can go on without it.
                    """
            )
        case .on(.some):
            // The date is there and it has not come yet, which only a wrong
            // clock produces.
            return Row(
                standing: .unknown,
                title: "iCloud names a backup date that has not come yet",
                detail: """
                    The clock on the iPhone or on this Mac is wrong, so how old the backup is \
                    cannot be worked out. Check it on the iPhone in Settings, your name, iCloud, \
                    iCloud Backup. You can go on without it.
                    """
            )
        case .on(nil):
            return Row(
                standing: .unknown,
                title: "iCloud backs this iPhone up, but the iPhone did not say when the last one was",
                detail: """
                    Check it on the iPhone in Settings, your name, iCloud, iCloud Backup, and make \
                    a fresh one if the last one is not recent. You can go on without it.
                    """
            )
        case .unknown:
            return Row(
                standing: .unknown,
                title: "Whether this iPhone has a backup of its own could not be read",
                detail: """
                    Unlock the iPhone and keep the cable in. Make a backup of your own before you \
                    go on, in iCloud or in Finder, so the way back is nothing to do with this app.
                    """
            )
        }
    }

    // MARK: - Finder's own backups, which macOS protects

    /// Finder's backup of one iPhone on this Mac, when there is one and when
    /// macOS lets the app look at all.
    ///
    /// This is the only thing in this file that touches the disk, and it reads
    /// one small plist. `Status.plist` is written when a backup finishes and
    /// holds both the date and whether it finished; the other two plists in a
    /// backup folder answer as well and are hundreds of times the size.
    ///
    /// A backup that did not finish is answered as nothing rather than as a
    /// way back, because under-claiming is the safe direction to be wrong in.
    static func finderBackup(
        of udid: String,
        in root: URL = BackupFolder.mobileSyncRoot
    ) -> Finder {
        // A UDID names one folder directly inside that folder and nothing
        // else, so a name that could climb out of it is refused before a path
        // is ever built from it.
        guard !udid.isEmpty, !udid.contains("/"), udid != ".", udid != ".." else { return .nothingHere }
        do {
            // The folder itself is the thing macOS protects, so reading it is
            // also how the app finds out whether it is allowed to look.
            guard try FileManager.default.contentsOfDirectory(atPath: root.path).contains(udid) else {
                return .nothingHere
            }
        } catch let refusal as CocoaError where refusal.code == .fileReadNoPermission {
            return .refused
        } catch {
            // Anything else is a Mac that Finder has never backed an iPhone up
            // on, which is a folder that is simply not there.
            return .nothingHere
        }
        return finishedBackup(at: root.appendingPathComponent(udid))
    }

    /// What one backup folder says about itself.
    private static func finishedBackup(at folder: URL) -> Finder {
        guard let status = plist(at: folder.appendingPathComponent("Status.plist")),
              status["SnapshotState"] as? String == "finished"
        else {
            return .nothingHere
        }
        return .made(status["Date"] as? Date)
    }

    private static func plist(at url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? PropertyListSerialization.propertyList(from: data, options: [], format: nil)
            as? [String: Any]
    }
}
