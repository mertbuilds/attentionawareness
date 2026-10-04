import Foundation

/// Whether the person at the keyboard already has a copy of the iPhone that
/// has nothing to do with the app.
///
/// The backup the app makes is scaffolding. It goes up for one run and comes
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
    // MARK: - What the reader is told before every run

    /// What the checks say before a run of either method can start. The app
    /// takes its own copy away at the end of the run, and the fast method
    /// makes none, so the way back is the reader's own backup and nothing
    /// else.
    static let notice = """
        Back up your iPhone first, with Finder or iCloud. The app does not erase your iPhone, \
        but things can go wrong. If they do, your backup is the way back. We are not \
        responsible for lost data.
        """

    /// The tick the reader gives before Supervise turns on.
    static let confirmation = "I backed up my iPhone"

    // MARK: - What the two places say

    /// What the iPhone says about its own iCloud backups. It comes from the
    /// same lockdown domain as the encryption flag, and it needs no more than
    /// a phone that has trusted this Mac.
    enum Cloud: Equatable {
        /// The iPhone would not say, which is how a phone that has not been
        /// trusted yet reads.
        case unknown
        /// iCloud does not back the iPhone up.
        case off
        /// It does, and this is when it last finished one. The date is nil for
        /// a phone that names none, which is a phone that has never managed a
        /// backup at all.
        case on(Date?)
    }

    /// What Finder's backup folder on this Mac says about the same iPhone.
    enum Finder: Equatable {
        /// The app has not looked yet for this iPhone, so the folder may hold
        /// anything. It is never taken for an empty one.
        case notLooked
        /// macOS would not let the app look. There is no prompt for that
        /// permission, so this is the answer until the reader turns on Full
        /// Disk Access in System Settings, which the checks send them to.
        case refused
        /// The folder was read and holds no finished backup of the iPhone,
        /// archived or not.
        case nothingHere
        /// It holds one, made when it says, and this is the newest of them.
        /// The date is nil when none of them will say when it was written.
        case made(Date?)
    }

    // MARK: - Asking for Full Disk Access

    /// How far the reader has got with Full Disk Access in this launch of the
    /// app. It only matters while Finder's folder is refused.
    ///
    /// macOS has no prompt for this permission and no callback when it is
    /// granted. All an app can do is open the list in System Settings and
    /// look again when it is back in front. A running app may still be
    /// refused after the switch is on, because macOS can wait for the app to
    /// open again before the switch counts for it, which is the third case.
    enum Access: Equatable {
        /// The app has not sent the reader to System Settings in this launch.
        case notAsked
        /// It has, and the app has not been back in front since.
        case askedInSettings
        /// The reader came back from System Settings and the folder still
        /// would not open, so the app has to be quit and opened again.
        case needsReopen
    }

    /// Where the reader stands once the app is back in front and has looked
    /// at Finder's folder again.
    ///
    /// Only a reader who was sent to System Settings can be told to reopen
    /// the app: anybody else still gets the plain ask. A folder that opens
    /// settles the whole question, so the next refusal, if one ever comes,
    /// starts again from the ask.
    static func access(_ access: Access, afterReturningTo answer: Finder) -> Access {
        guard answer == .refused else { return .notAsked }
        return access == .askedInSettings ? .needsReopen : access
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
    /// everything the iPhone has gained since.
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

    private static func count(_ value: Int, _ unit: String) -> String {
        "\(value) \(unit)\(value == 1 ? "" : "s")"
    }

    // MARK: - The line the checks show

    /// The one line the checks show about the reader's own backups, and the
    /// longer how-to that sits behind it in the hover help.
    struct Row: Equatable {
        /// How the line reads at a glance.
        enum Standing: Equatable {
            /// There is a backup of the reader's own and it is recent.
            case covered
            /// There is one and it is old, or there is none at all. Either way
            /// something is worth doing first. It is never a wall: the checks
            /// let the run go on whatever this says.
            case thin
            /// iCloud names no date this Mac can use, and Finder either has a
            /// backup that names no date or one that has not come yet, or has
            /// not been looked at yet. Nothing can be claimed in either
            /// direction.
            case unknown
            /// Finder's folder is out of reach and nothing else says the
            /// reader is covered. The line asks for Full Disk Access rather
            /// than for a backup, because with it the app can answer the
            /// question itself.
            case needsAccess
        }

        /// What a button beside the line does.
        enum Action: Hashable {
            /// Open the Full Disk Access list in System Settings.
            case openFullDiskAccess
            /// Quit the app and open it again, which is when macOS can apply
            /// a switch turned on while the app was running.
            case reopen
        }

        let standing: Standing
        /// The whole of what the row says on screen.
        let line: String
        /// What the hover help says, which is where every how-to lives.
        let help: String
        /// The buttons beside the line, in the order they are drawn. Empty for
        /// a row that only says what is known.
        var actions: [Action] = []

        /// Whether the row shows a tick.
        var ok: Bool { standing == .covered }
    }

    /// The line and the how-to of a row that asks for a backup first. Both
    /// places are named, because either one is a way back and the reader
    /// picks.
    private static let backUpFirst = "Back up iPhone first, in iCloud or Finder."
    private static let howToBackUp = """
        On iPhone: Settings > your name > iCloud > iCloud Backup > Back Up Now. \
        In Finder: pick iPhone in the sidebar, then click Back Up Now.
        """

    /// The line and the how-to when nobody can say how old the reader's way
    /// back is: Finder's backup names no date or one that has not come yet,
    /// or Finder's folder has not been looked at yet.
    private static let couldNotCheck = "Couldn't check for a backup of iPhone."
    private static let howToBeChecked = "\(backUpFirst) \(howToBackUp)"

    /// The lines and the how-tos of a row whose Finder folder is out of
    /// reach. macOS has no prompt for Full Disk Access, so the row asks for it
    /// in words and its button opens the list where the switch is. After a
    /// trip there that did not take, it asks for the reopen macOS can wait
    /// for instead. Both still say what to do without a backup at all.
    private static let allowAccess = "Allow Full Disk Access to check for a backup."
    private static let howToAllowAccess = """
        Finder keeps its backups in a folder macOS protects. Turn on attention awareness in \
        System Settings > Privacy & Security > Full Disk Access. No backup yet? \(backUpFirst)
        """
    private static let reopenForAccess = "Quit and reopen the app to check for a backup."
    private static let howToReopen = """
        macOS can wait until the app opens again before Full Disk Access counts. If attention \
        awareness isn't on in System Settings > Privacy & Security > Full Disk Access yet, turn \
        it on first. No backup yet? \(backUpFirst)
        """

    /// The row that asks for Full Disk Access, in the words the trip to System
    /// Settings has got to. The reopen keeps the way back to System Settings
    /// beside it, for a reader whose switch is not on yet.
    private static func askForAccess(_ access: Access) -> Row {
        if access == .needsReopen {
            return Row(
                standing: .needsAccess,
                line: reopenForAccess,
                help: howToReopen,
                actions: [.reopen, .openFullDiskAccess]
            )
        }
        return Row(
            standing: .needsAccess,
            line: allowAccess,
            help: howToAllowAccess,
            actions: [.openFullDiskAccess]
        )
    }

    /// Where one backup of the reader's own lives, in the words each place is
    /// named by on screen.
    private enum Place {
        case finder
        case cloud

        /// Which of the two the tick is about, said in the hover help.
        var hasOne: String {
            switch self {
            case .finder: return "Finder has one on this Mac."
            case .cloud: return "iCloud has one."
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
    ///
    /// `access` is how far the reader has got with Full Disk Access, which
    /// only changes the words of a row whose Finder folder was refused.
    static func row(
        cloud: Cloud,
        finder: Finder,
        access: Access = .notAsked,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> Row {
        let onThisMac = believableDate(of: finder, now: now).map { Own(place: .finder, date: $0) }
        let inTheCloud = believableDate(of: cloud, now: now).map { Own(place: .cloud, date: $0) }
        // A refused folder is the one gap the reader can close from here, and
        // closing it lets the app answer for itself. So every row short of a
        // tick asks for Full Disk Access first, and a recent backup somewhere
        // else needs nothing from it.
        let blocked = finder == .refused ? askForAccess(access) : nil

        let best: Own
        switch (onThisMac, inTheCloud) {
        case (.some(let here), .some(let there)):
            best = here.date >= there.date ? here : there
        case (.some(let here), nil):
            best = here
        case (nil, .some(let there)):
            best = there
        case (nil, nil):
            return blocked ?? withoutADate(finder: finder)
        }

        guard isRecent(best.date, now: now) else {
            return blocked ?? Row(standing: .thin, line: backUpFirst, help: howToBackUp)
        }
        return Row(
            standing: .covered,
            line: "iPhone was backed up \(age(of: best.date, now: now, calendar: calendar))",
            help: """
                \(best.place.hasOne) That backup is yours. The copy the app makes is deleted \
                when the run is confirmed.
                """
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
    /// A folder on this Mac that will not date itself is still a copy of the
    /// phone, so nobody can say how old it is, which is a different thing
    /// from having nothing at all. A folder not looked at yet is not called
    /// empty either.
    private static func withoutADate(finder: Finder) -> Row {
        // Finder's folder was read and holds nothing for this iPhone, and
        // iCloud is off, names no backup, names one this Mac cannot believe
        // or would not say. As far as anything here can tell there is no way
        // back, and making one is the thing to do.
        if finder == .nothingHere {
            return Row(standing: .thin, line: backUpFirst, help: howToBackUp)
        }
        return Row(standing: .unknown, line: couldNotCheck, help: howToBeChecked)
    }

    // MARK: - Finder's own backups, which macOS protects

    /// Finder's newest backup of one iPhone on this Mac, when there is one
    /// and when macOS lets the app look at all.
    ///
    /// Finder keeps the live backup in a folder named after the iPhone, and
    /// every backup the reader archived beside it, named after the iPhone and
    /// the moment it was archived (see `BackupFolder.isArchive`). An archive
    /// is a whole backup of the same iPhone, so it is a way back too.
    ///
    /// This is the only thing in this file that touches the disk, and it reads
    /// one small plist a backup. `Status.plist` is written when a backup
    /// finishes and holds both the date and whether it finished; the other two
    /// plists in a backup folder answer as well and are hundreds of times the
    /// size.
    ///
    /// A backup that did not finish is answered as nothing rather than as a
    /// way back, because under-claiming is the safe direction to be wrong in.
    static func finderBackup(
        of udid: String,
        in root: URL = BackupFolder.mobileSyncRoot
    ) -> Finder {
        // A UDID names folders directly inside that folder and nothing else,
        // so a name that could climb out of it is refused before a path is
        // ever built from it.
        guard !udid.isEmpty, !udid.contains("/"), udid != ".", udid != ".." else { return .nothingHere }
        let names: [String]
        do {
            // The folder itself is the thing macOS protects, so reading it is
            // also how the app finds out whether it is allowed to look.
            names = try FileManager.default.contentsOfDirectory(atPath: root.path)
        } catch let refusal as CocoaError where refusal.code == .fileReadNoPermission {
            return .refused
        } catch {
            // Anything else is a Mac that Finder has never backed an iPhone up
            // on, which is a folder that is simply not there.
            return .nothingHere
        }
        let backups = names
            .filter { $0 == udid || BackupFolder.isArchive(named: $0, of: udid) }
            .map { finishedBackup(at: root.appendingPathComponent($0)) }
        return newest(of: backups)
    }

    /// The newest of several backups of one iPhone: the latest date there is,
    /// then a finished backup that names no date, then nothing.
    private static func newest(of backups: [Finder]) -> Finder {
        let dates = backups.compactMap { backup -> Date? in
            guard case .made(.some(let date)) = backup else { return nil }
            return date
        }
        if let latest = dates.max() { return .made(latest) }
        return backups.contains(.made(nil)) ? .made(nil) : .nothingHere
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
