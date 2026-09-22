import Foundation
import Testing

/// Whether the reader already has a backup of their own, and the one line the
/// checks say about it.
///
/// The app deletes its own backup as soon as the run is confirmed, so the way
/// back has to be theirs. These are the rules that work out whether they have
/// one, how old it is and how to say so, and none of them reads an iPhone. The
/// clock is handed in everywhere, so the answers do not change with the day
/// the suite runs on.
final class BackupSafetyNetTests {
    /// A clock that never moves, so an age is the same figure every run.
    private static let now = Date(timeIntervalSinceReferenceDate: 811_641_600)

    /// One calendar for every reading, so a machine in another country reads
    /// the same dates as this one.
    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US_POSIX")
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return calendar
    }()

    private static let day: TimeInterval = 24 * 60 * 60

    private static let someUdid = "00008101-00052854210A001E"
    private static let otherUdid = "00008140-000B2C3D4E5F6071"

    /// The two lines a row shows when it has no tick, written out here rather
    /// than read off the thing under test, so the wording is pinned.
    private static let backUpFirst = "Back up iPhone first, in iCloud or Finder."
    private static let couldNotCheck = "Couldn't check for a backup of iPhone."

    /// The temporary folder the Finder fixtures live in, on the tests that
    /// make one.
    private var base: URL!

    private static func daysAgo(_ days: Double) -> Date {
        now.addingTimeInterval(-days * day)
    }

    // MARK: - Apple's own zero

    @Test func theLastBackupDateIsCountedFromTheFirstOfJanuary2001() {
        // What a real iPhone answered on 20 September 2026, which is
        // 10 September 2026 at 23:32 UTC and not a day in 1995.
        #expect(
            BackupSafetyNet.date(appleSeconds: 810_775_920) == Date(timeIntervalSince1970: 1_789_083_120)
        )
    }

    @Test func zeroSecondsIsAppleOwnZeroRatherThanTheUnixOne() {
        #expect(
            BackupSafetyNet.date(appleSeconds: 0) == Date(timeIntervalSince1970: 978_307_200)
        )
    }

    // MARK: - Recent or old

    @Test func aBackupFromLastNightIsRecent() {
        #expect(BackupSafetyNet.isRecent(Self.daysAgo(1), now: Self.now))
    }

    @Test func aBackupIsStillRecentOnTheSeventhDay() {
        #expect(BackupSafetyNet.isRecent(Self.daysAgo(7), now: Self.now))
    }

    @Test func aBackupIsOldOnceItIsOverAWeekBehind() {
        #expect(BackupSafetyNet.isRecent(Self.daysAgo(7.5), now: Self.now) == false)
        #expect(BackupSafetyNet.isRecent(Self.daysAgo(30), now: Self.now) == false)
    }

    @Test func aPhoneAFewMinutesAheadOfThisMacIsStillBelieved() {
        // Two clocks are never exactly together, and a few minutes of drift
        // must not turn into a warning about a wrong clock.
        #expect(
            BackupSafetyNet.isBelievable(Self.now.addingTimeInterval(5 * 60), now: Self.now)
        )
    }

    @Test func aPhoneADayAndMoreAheadIsNotBelieved() {
        #expect(
            BackupSafetyNet.isBelievable(Self.now.addingTimeInterval(2 * Self.day), now: Self.now) == false
        )
    }

    // MARK: - The age in words

    @Test func anAgeIsSaidTheWayAPersonSaysIt() {
        let readings: [(days: Double, said: String)] = [
            (0, "today"),
            (1, "yesterday"),
            (3, "3 days ago"),
            (13, "13 days ago"),
            (14, "2 weeks ago"),
            (35, "5 weeks ago"),
            (90, "3 months ago"),
            (400, "1 year ago"),
            (800, "2 years ago"),
        ]
        for reading in readings {
            #expect(
                BackupSafetyNet.age(
                    of: Self.daysAgo(reading.days),
                    now: Self.now,
                    calendar: Self.calendar
                ) == reading.said,
                "\(reading.days) days back"
            )
        }
    }

    @Test func yesterdayIsCountedFromMidnightRatherThanFromTheHour() throws {
        // An hour old and yesterday are both true of a backup made late last
        // night. The word a person means is the one the calendar day gives.
        var lateLastNight = DateComponents()
        lateLastNight.year = 2026
        lateLastNight.month = 9
        lateLastNight.day = 20
        lateLastNight.hour = 23
        let date = try #require(Self.calendar.date(from: lateLastNight))

        #expect(
            BackupSafetyNet.age(of: date, now: Self.now, calendar: Self.calendar) == "yesterday"
        )
    }

    @Test func aPhoneAheadOfThisMacReadsAsToday() {
        // A wrong clock can put the date on tomorrow. Tomorrow is not a word
        // for how old something is, so it reads as today.
        #expect(
            BackupSafetyNet.age(
                of: Self.now.addingTimeInterval(26 * 60 * 60),
                now: Self.now,
                calendar: Self.calendar
            ) == "today"
        )
    }

    // MARK: - The line, from iCloud alone

    @Test func aRecentICloudBackupSaysTheyAreCovered() {
        let row = Self.row(cloud: .on(Self.daysAgo(1)))

        #expect(row.ok)
        #expect(row.standing == .covered)
        #expect(row.line == "iPhone was backed up yesterday")
        #expect(row.help.contains("iCloud has one."), "\(row.help)")
        #expect(row.help.contains("That backup is yours."), "\(row.help)")
    }

    @Test func anOldICloudBackupAsksForAFreshOneFirst() {
        let row = Self.row(cloud: .on(Self.daysAgo(11)))

        #expect(row.ok == false)
        #expect(row.standing == .thin)
        #expect(row.line == Self.backUpFirst)
        #expect(row.help.contains("iCloud Backup > Back Up Now"), "\(row.help)")
    }

    @Test func iCloudBackupsThatAreOffAskForOneAndSayWhereToMakeIt() {
        let row = Self.row(cloud: .off)

        #expect(row.standing == .thin)
        #expect(row.line == Self.backUpFirst)
        #expect(row.help.contains("iCloud Backup > Back Up Now"), "\(row.help)")
        #expect(row.help.contains("click Back Up Now"), "\(row.help)")
    }

    @Test func aPhoneThatNamesNoDateAtAllIsNotCalledCovered() {
        // The key is absent until an iPhone has finished its first backup, and
        // a phone that has never managed one must not read as a way back.
        let row = Self.row(cloud: .on(nil))

        #expect(row.standing == .unknown)
        #expect(row.line == Self.couldNotCheck)
    }

    @Test func aDateThatHasNotComeYetIsCalledAWrongClockRatherThanARecentBackup() {
        // A wrong clock on either end produces one of these, and an age worked
        // out from it would say a backup is fresh when nobody knows that.
        let row = Self.row(cloud: .on(Self.now.addingTimeInterval(9 * Self.day)))

        #expect(row.standing == .unknown)
        #expect(row.line == Self.couldNotCheck)
    }

    @Test func aPhoneThatWouldNotAnswerIsSaidToBeUnreadRatherThanEmpty() {
        let row = Self.row(cloud: .unknown)

        #expect(row.standing == .unknown)
        #expect(row.line == Self.couldNotCheck)
        // The hover help is the only place Full Disk Access is ever named.
        #expect(row.help.contains("Full Disk Access"), "\(row.help)")
    }

    // MARK: - The line, once Finder is in it as well

    @Test func aBackupOnThisMacIsTheOneNamedWhenItIsTheNewer() {
        let row = Self.row(cloud: .on(Self.daysAgo(5)), finder: .made(Self.daysAgo(1)))

        #expect(row.standing == .covered)
        #expect(row.line == "iPhone was backed up yesterday")
        #expect(row.help.contains("Finder has one on this Mac."), "\(row.help)")
    }

    @Test func theNewerOfTheTwoIsTheOneTheLineIsAbout() {
        let row = Self.row(cloud: .on(Self.daysAgo(1)), finder: .made(Self.daysAgo(6)))

        #expect(row.standing == .covered)
        #expect(row.line == "iPhone was backed up yesterday")
        #expect(row.help.contains("iCloud has one."), "\(row.help)")
    }

    @Test func aTieGoesToTheCopyOnThisMac() {
        // Both are the same age, and the one on this Mac is the one the reader
        // can put back themselves.
        let row = Self.row(cloud: .on(Self.daysAgo(2)), finder: .made(Self.daysAgo(2)))

        #expect(row.line == "iPhone was backed up 2 days ago")
        #expect(row.help.contains("Finder has one on this Mac."), "\(row.help)")
    }

    @Test func anOldBackupOnThisMacAsksForAFreshOneToo() {
        let row = Self.row(cloud: .off, finder: .made(Self.daysAgo(40)))

        #expect(row.standing == .thin)
        #expect(row.line == Self.backUpFirst)
        #expect(row.help.contains("click Back Up Now"), "\(row.help)")
    }

    @Test func aFolderOnThisMacThatWillNotDateItselfCannotBeChecked() {
        let row = Self.row(cloud: .off, finder: .made(nil))

        #expect(row.standing == .unknown)
        #expect(row.line == Self.couldNotCheck)
    }

    @Test func finderRescuesAPhoneThatWouldNotAnswerAtAll() {
        // This is the whole of what Full Disk Access buys: an answer when the
        // iPhone gives none.
        let row = Self.row(cloud: .unknown, finder: .made(Self.daysAgo(2)))

        #expect(row.standing == .covered)
        #expect(row.line == "iPhone was backed up 2 days ago")
        #expect(row.help.contains("Finder has one on this Mac."), "\(row.help)")
    }

    @Test func aRefusedFolderChangesNothingTheLineSays() {
        // The refusal is said by the button beside the row, which opens the
        // list. The row itself only ever says what is known, so it reads the
        // same as a Mac that was read and held nothing.
        #expect(
            Self.row(cloud: .on(Self.daysAgo(11)), finder: .refused)
                == Self.row(cloud: .on(Self.daysAgo(11)), finder: .nothingHere)
        )
        #expect(
            Self.row(cloud: .off, finder: .refused) == Self.row(cloud: .off, finder: .nothingHere)
        )
    }

    @Test func everyRowWithoutATickAsksForABackup() {
        // A row with no tick is a thing to do, and the thing to do is always
        // the same one. It is the line when the line has room for it, and the
        // hover help when the line is spent saying nothing could be read.
        let endings: [BackupSafetyNet.Row] = [
            Self.row(cloud: .on(Self.daysAgo(11))),
            Self.row(cloud: .off),
            Self.row(cloud: .on(nil)),
            Self.row(cloud: .unknown, finder: .made(nil)),
            Self.row(cloud: .on(Self.now.addingTimeInterval(9 * Self.day))),
        ]
        for ending in endings {
            #expect(ending.ok == false, "\(ending.line)")
            #expect("\(ending.line) \(ending.help)".contains("Back up iPhone first"), "\(ending.line)")
        }
    }

    @Test func everyLineIsOneShortSentence() {
        let lines = [
            Self.row(cloud: .on(Self.daysAgo(1))),
            Self.row(cloud: .on(Self.daysAgo(11))),
            Self.row(cloud: .off),
            Self.row(cloud: .unknown),
            Self.row(cloud: .unknown, finder: .made(Self.daysAgo(2))),
        ]
        .map(\.line)
        for line in lines {
            #expect(line.contains("\n") == false, "\(line)")
            #expect(line.count <= 60, "\(line)")
        }
    }

    // MARK: - Finder's own folder on disk

    @Test func aFinishedBackupFolderIsFoundWithTheDateItWroteDown() throws {
        let root = try makeBackupRoot()
        let made = Date(timeIntervalSince1970: 1_789_300_000)
        try write(udid: Self.someUdid, in: root, state: "finished", date: made)

        #expect(BackupSafetyNet.finderBackup(of: Self.someUdid, in: root) == .made(made))
    }

    @Test func aBackupOfAnotherIPhoneIsNotThisIPhoneBackup() throws {
        let root = try makeBackupRoot()
        try write(udid: Self.someUdid, in: root, state: "finished", date: Date())

        #expect(BackupSafetyNet.finderBackup(of: Self.otherUdid, in: root) == .nothingHere)
    }

    @Test func aBackupThatNeverFinishedIsNotAWayBack() throws {
        // Under-claiming is the safe direction: half a backup restores nothing.
        let root = try makeBackupRoot()
        try write(udid: Self.someUdid, in: root, state: "new", date: Date())

        #expect(BackupSafetyNet.finderBackup(of: Self.someUdid, in: root) == .nothingHere)
    }

    @Test func aMacThatFinderHasNeverBackedAnIPhoneUpOnHoldsNothing() {
        let missing = FileManager.default.temporaryDirectory
            .appendingPathComponent("no-such-folder-\(UUID().uuidString)")

        #expect(BackupSafetyNet.finderBackup(of: Self.someUdid, in: missing) == .nothingHere)
    }

    @Test func aFolderMacOSWillNotOpenReadsAsRefusedRatherThanAsEmpty() throws {
        // macOS answers a protected folder by refusing to open it, which is
        // the only signal an app gets: there is no way to ask for Full Disk
        // Access and no callback when it is granted.
        let root = try makeBackupRoot()
        try FileManager.default.setAttributes([.posixPermissions: 0], ofItemAtPath: root.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: root.path) }

        #expect(BackupSafetyNet.finderBackup(of: Self.someUdid, in: root) == .refused)
    }

    @Test func aNameThatCouldClimbOutOfTheBackupsFolderIsRefusedBeforeAPathIsBuilt() throws {
        let root = try makeBackupRoot()

        #expect(BackupSafetyNet.finderBackup(of: "..", in: root) == .nothingHere)
        #expect(BackupSafetyNet.finderBackup(of: "../../etc", in: root) == .nothingHere)
        #expect(BackupSafetyNet.finderBackup(of: "", in: root) == .nothingHere)
    }

    // MARK: - Fixtures

    deinit {
        guard let base else { return }
        try? FileManager.default.setAttributes(
            [.posixPermissions: 0o755],
            ofItemAtPath: base.appendingPathComponent("Backup").path
        )
        try? FileManager.default.removeItem(at: base)
    }

    /// One line of the checks, read against the fixed clock and calendar.
    private static func row(
        cloud: BackupSafetyNet.Cloud,
        finder: BackupSafetyNet.Finder = .nothingHere
    ) -> BackupSafetyNet.Row {
        BackupSafetyNet.row(cloud: cloud, finder: finder, now: now, calendar: calendar)
    }

    /// An empty stand-in for the folder Finder writes its backups into.
    private func makeBackupRoot() throws -> URL {
        base = FileManager.default.temporaryDirectory
            .resolvingSymlinksInPath()
            .appendingPathComponent("safety-net-tests-\(UUID().uuidString)")
        let root = base.appendingPathComponent("Backup")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    /// One backup folder with the small plist a backup writes when it stops,
    /// which is the only file the look ever opens.
    private func write(udid: String, in root: URL, state: String, date: Date) throws {
        let folder = root.appendingPathComponent(udid)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let status: [String: Any] = [
            "Version": "3.3",
            "IsFullBackup": false,
            "SnapshotState": state,
            "BackupState": "new",
            "Date": date,
        ]
        let data = try PropertyListSerialization.data(
            fromPropertyList: status,
            format: .binary,
            options: 0
        )
        try data.write(to: folder.appendingPathComponent("Status.plist"))
    }
}
