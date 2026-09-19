import XCTest

/// What this Mac already holds for the iPhone a run is about: whether the
/// folder can be used instead of another hour on the cable, and the words the
/// Back up step says about its age.
///
/// The decision is made on a listing rather than on a disk, so most of this
/// hands `ExistingBackup` rows of its own. The three that do read a folder
/// check that the listing carries what `Status.plist` says, because that file
/// is the only word on whether a folder holds a whole backup.
final class ExistingBackupTests: XCTestCase {
    private var root: URL!

    private static let udid = "00008140-0006284A3CA2801C"
    private static let otherUDID = "00008140-000B2C3D4E5F6071"
    private static let made = Date(timeIntervalSince1970: 1_789_793_040)

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .resolvingSymlinksInPath()
            .appendingPathComponent("existing-backup-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    // MARK: - What the listing says about a folder

    func testAFolderTheIPhoneFinishedWritingIsListedAsFinished() throws {
        try makeBackup(udid: Self.udid, snapshotState: BackupStatus.finishedSnapshot)

        let backup = try XCTUnwrap(BackupStore.list(root: root).first)

        XCTAssertEqual(backup.snapshotState, "finished")
        XCTAssertTrue(backup.isFinished)
    }

    func testAFolderTheIPhoneWasStillWritingIsNotListedAsFinished() throws {
        try makeBackup(udid: Self.udid, snapshotState: "uploading")

        let backup = try XCTUnwrap(BackupStore.list(root: root).first)

        XCTAssertEqual(backup.snapshotState, "uploading")
        XCTAssertFalse(backup.isFinished)
    }

    func testAFolderWithNoStatusPlistIsNotListedAsFinished() throws {
        try makeBackup(udid: Self.udid, snapshotState: nil)

        let backup = try XCTUnwrap(BackupStore.list(root: root).first)

        XCTAssertNil(backup.snapshotState)
        XCTAssertFalse(backup.isFinished)
    }

    func testAFolderThatWasNeverFinishedIsStillListed() throws {
        try makeBackup(udid: Self.udid, snapshotState: "uploading")

        // A 63 GB folder nobody can use is exactly the one a person needs to
        // find and delete, so the listing keeps it.
        XCTAssertEqual(try BackupStore.list(root: root).map(\.udid), [Self.udid])
    }

    // MARK: - What is offered

    func testNothingIsOfferedBeforeAPhoneIsPicked() {
        XCTAssertEqual(ExistingBackup.offer(for: nil, in: [row()]), .nothing)
    }

    func testNothingIsOfferedForAPhoneThisMacHoldsNoFolderFor() {
        XCTAssertEqual(ExistingBackup.offer(for: Self.udid, in: []), .nothing)
    }

    func testOnlyTheFolderOfThePhoneThisRunIsAboutIsOffered() {
        let other = row(udid: Self.otherUDID)

        XCTAssertEqual(ExistingBackup.offer(for: Self.udid, in: [other]), .nothing)
        XCTAssertEqual(ExistingBackup.offer(for: Self.otherUDID, in: [row(), other]), .usable(other))
    }

    func testAFinishedBackupIsOffered() {
        let backup = row()

        XCTAssertEqual(ExistingBackup.offer(for: Self.udid, in: [backup]), .usable(backup))
    }

    func testAFolderTheIPhoneNeverFinishedIsNotOfferedAndSaysWhy() {
        let backup = row(snapshotState: "uploading")

        XCTAssertEqual(ExistingBackup.offer(for: Self.udid, in: [backup]), .unusable(backup, .unfinished))
        XCTAssertEqual(
            ExistingBackup.Reason.unfinished.sentence,
            "This Mac holds a folder for this iPhone that the iPhone never finished writing, so it cannot be used."
        )
    }

    func testAFolderWithNoStatusPlistIsNotOffered() {
        let backup = row(snapshotState: nil)

        XCTAssertEqual(ExistingBackup.offer(for: Self.udid, in: [backup]), .unusable(backup, .unfinished))
    }

    func testAFolderThatDoesNotSayWhenItWasMadeIsNotOfferedAndSaysWhy() {
        let backup = row(date: nil)

        XCTAssertEqual(ExistingBackup.offer(for: Self.udid, in: [backup]), .unusable(backup, .undated))
        XCTAssertEqual(
            ExistingBackup.Reason.undated.sentence,
            "This Mac holds a folder for this iPhone that does not say when it was made, so it cannot be used."
        )
    }

    func testAFolderOnTheDiskIsOfferedOnlyOnceTheIPhoneHasFinishedIt() throws {
        try makeBackup(udid: Self.udid, snapshotState: "uploading")
        let stillWriting = try BackupStore.list(root: root)

        XCTAssertEqual(
            ExistingBackup.offer(for: Self.udid, in: stillWriting),
            .unusable(try XCTUnwrap(stillWriting.first), .unfinished)
        )

        try writeStatus(BackupStatus.finishedSnapshot, in: root.appendingPathComponent(Self.udid))
        let finished = try BackupStore.list(root: root)

        XCTAssertEqual(
            ExistingBackup.offer(for: Self.udid, in: finished),
            .usable(try XCTUnwrap(finished.first))
        )
    }

    // MARK: - How old it is

    func testABackupFromTodayIsGivenByTheTimeOfDay() {
        XCTAssertEqual(age(of: moment(day: 19, hour: 9, minute: 14), now: moment(day: 19, hour: 23, minute: 30)),
                       "made today at 09:14")
    }

    func testABackupFromYesterdayIsGivenByTheTimeOfDay() {
        // Fifteen hours, and still yesterday: the day is what a person counts
        // in, not the hours.
        XCTAssertEqual(age(of: moment(day: 18, hour: 9, minute: 14), now: moment(day: 19, hour: 0, minute: 10)),
                       "made yesterday at 09:14")
    }

    func testABackupFromThisMonthIsGivenInWholeDays() {
        XCTAssertEqual(age(of: moment(day: 16, hour: 9, minute: 14), now: moment(day: 19, hour: 9, minute: 0)),
                       "made 3 days ago")
    }

    func testDaysRunOutAtTwoMonths() {
        let now = moment(day: 19, hour: 9, minute: 0)

        XCTAssertEqual(age(of: daysBefore(59, now), now: now), "made 59 days ago")
        XCTAssertEqual(age(of: daysBefore(60, now), now: now), "made 2 months ago")
        XCTAssertEqual(age(of: daysBefore(400, now), now: now), "made 13 months ago")
    }

    func testAClockThatHasMovedBackwardsReadsAsToday() {
        XCTAssertEqual(age(of: moment(day: 20, hour: 9, minute: 0), now: moment(day: 19, hour: 9, minute: 0)),
                       "made today at 09:00")
    }

    // MARK: - Whether it is old enough to say so

    func testABackupFromTodayIsNotStale() {
        XCTAssertFalse(isStale(moment(day: 19, hour: 9, minute: 14), now: moment(day: 19, hour: 23, minute: 30)))
    }

    func testABackupFromAnyDayBeforeTodayIsStale() {
        XCTAssertTrue(isStale(moment(day: 18, hour: 9, minute: 14), now: moment(day: 19, hour: 0, minute: 10)))
        XCTAssertTrue(isStale(moment(day: 16, hour: 9, minute: 14), now: moment(day: 19, hour: 9, minute: 0)))
    }

    // MARK: - Fixtures

    /// A backup folder, with the `Status.plist` the iPhone writes beside it
    /// while it works and once it has stopped. No file at all is how a folder
    /// the phone never wrote to reads.
    @discardableResult
    private func makeBackup(udid: String, snapshotState: String?) throws -> URL {
        let folder = try BackupFixture.makeBackup(in: root, udid: udid)
        if let snapshotState {
            try writeStatus(snapshotState, in: folder)
        }
        return folder
    }

    private func writeStatus(_ snapshotState: String, in folder: URL) throws {
        try PropertyListSerialization
            .data(
                fromPropertyList: [
                    "BackupState": "new",
                    "Date": Self.made,
                    "IsFullBackup": false,
                    "SnapshotState": snapshotState,
                    "UUID": "BD5A6FE3-A84F-4CAD-BCEE-6F13A1B6358F",
                    "Version": "3.3",
                ],
                format: .binary,
                options: 0
            )
            .write(to: folder.appendingPathComponent(BackupStatus.fileName))
    }

    /// One row as the listing hands it over.
    private func row(
        udid: String = ExistingBackupTests.udid,
        date: Date? = ExistingBackupTests.made,
        snapshotState: String? = BackupStatus.finishedSnapshot
    ) -> StoredBackup {
        StoredBackup(
            url: root.appendingPathComponent(udid),
            udid: udid,
            deviceName: "Test iPhone",
            productType: "iPhone17,5",
            iosVersion: "26.6.1",
            date: date,
            isEncrypted: false,
            snapshotState: snapshotState,
            sizeInBytes: 72_882_442_752,
            pristineURL: nil,
            pristineSizeInBytes: nil
        )
    }

    /// A calendar that answers the same way on every Mac, so the words do not
    /// move with the machine the tests run on.
    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_GB")
        calendar.timeZone = TimeZone(identifier: "Europe/Istanbul") ?? calendar.timeZone
        return calendar
    }()

    private func age(of date: Date, now: Date) -> String {
        ExistingBackup.age(of: date, now: now, calendar: Self.calendar)
    }

    private func isStale(_ date: Date, now: Date) -> Bool {
        ExistingBackup.isStale(date, now: now, calendar: Self.calendar)
    }

    /// A moment in September 2026, in the calendar above.
    private func moment(day: Int, hour: Int, minute: Int) -> Date {
        var components = DateComponents()
        components.year = 2026
        components.month = 9
        components.day = day
        components.hour = hour
        components.minute = minute
        return Self.calendar.date(from: components) ?? .distantPast
    }

    private func daysBefore(_ count: Int, _ now: Date) -> Date {
        Self.calendar.date(byAdding: .day, value: -count, to: now) ?? .distantPast
    }
}
