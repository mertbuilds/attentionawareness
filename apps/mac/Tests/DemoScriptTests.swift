import XCTest

/// The demo's clock and its switches.
///
/// The demo exists so the window can be watched without a cable, and the part
/// of it worth testing is the timeline: a transfer that takes an hour on a real
/// phone has to run in the time somebody will sit through, move through its
/// phases in the right order, and still hand the estimate readings at a rate
/// that makes the figure on screen the figure a real run would show. None of
/// that touches an iPhone, a disk or a helper.
final class DemoScriptTests: XCTestCase {
    private let backup = DemoScript(kind: .backup)
    private let restore = DemoScript(kind: .restore)

    // MARK: - How long it takes

    func testATransferRunsInTheTimeSomebodyWillSitThrough() {
        for script in [backup, restore] {
            XCTAssertGreaterThanOrEqual(script.duration, 20)
            XCTAssertLessThanOrEqual(script.duration, 30)
        }
    }

    func testTheDemoSecondsStandForTheHourATransferReallyTakes() {
        let end = backup.beat(at: backup.duration)

        // A measured full backup takes about an hour, so the elapsed time the
        // window shows has to land there rather than on the twenty five
        // seconds the reader waited.
        XCTAssertGreaterThan(end.elapsed, 50 * 60)
        XCTAssertLessThan(end.elapsed, 65 * 60)
    }

    // MARK: - The phases

    func testABackupGoesFromStartingThroughTheFilesToTheSnapshot() {
        XCTAssertEqual(backup.beat(at: 0).stage, .starting)
        XCTAssertEqual(backup.beat(at: 1.9).stage, .starting)
        XCTAssertEqual(backup.beat(at: 2.1).stage, .transferring)
        XCTAssertEqual(backup.beat(at: 19.9).stage, .transferring)
        XCTAssertEqual(backup.beat(at: 20.1).stage, .finishing)
        XCTAssertEqual(backup.beat(at: backup.duration).stage, .finished)
    }

    func testARestoreAlsoWaitsForThePhoneToComeBack() {
        XCTAssertEqual(restore.beat(at: 18).stage, .finishing)
        XCTAssertEqual(restore.beat(at: 22).stage, .waitingForPhone)
        XCTAssertEqual(restore.beat(at: restore.duration).stage, .finished)
        XCTAssertTrue(restore.isOver(at: restore.duration))
        XCTAssertFalse(restore.isOver(at: 22))
    }

    func testTheProgressClimbsFromNothingToTheWholeJobAndNeverGoesBack() {
        var last = -1.0
        for tenth in stride(from: 0.0, through: backup.duration, by: 0.1) {
            let progress = backup.beat(at: tenth).progress
            XCTAssertGreaterThanOrEqual(progress, last)
            last = progress
        }

        XCTAssertEqual(backup.beat(at: 0).progress, 0)
        XCTAssertEqual(backup.beat(at: 2).progress, 0)
        XCTAssertEqual(backup.beat(at: 11).progress, 0.5, accuracy: 0.01)
        XCTAssertEqual(backup.beat(at: 20).progress, 1, accuracy: 0.001)
    }

    func testTheFileCountAndTheByteCounterOnlyMoveWhileFilesDo() {
        XCTAssertEqual(backup.beat(at: 1).files, 0)
        XCTAssertNil(backup.beat(at: 1).bytes)
        XCTAssertGreaterThan(backup.beat(at: 11).files, backup.beat(at: 6).files)
        XCTAssertNotNil(backup.beat(at: 11).bytes)
        // Every file is across by the time the iPhone is closing the snapshot,
        // so there is no file to count bytes for.
        XCTAssertNil(backup.beat(at: 22).bytes)
    }

    // MARK: - What the estimate makes of it

    /// How much longer the estimate says the transfer has, from the readings
    /// this beat would have handed it. Nil while it refuses to say.
    private func remaining(_ script: DemoScript, at seconds: TimeInterval) -> TimeInterval? {
        let now = Date()
        let reading = script.beat(at: seconds).estimate(at: now).reading(at: now)
        guard case .about(let left) = reading else { return nil }
        return left
    }

    func testNothingIsSaidInTheFirstSecondsOfATransfer() {
        XCTAssertNil(remaining(backup, at: 1))
        XCTAssertNil(remaining(backup, at: 3))
    }

    func testOnceItSettlesTheFigureIsTheOneARealRunWouldShow() {
        guard let left = remaining(backup, at: 5) else {
            return XCTFail("a transfer five seconds in should say a figure")
        }

        // Fifteen demo seconds of copying are left, and each of them stands
        // for a little over two minutes on the cable.
        XCTAssertEqual(left, 15 * backup.pace, accuracy: 60)
    }

    func testTheFigureShrinksAsTheTransferGoesOn() {
        guard let early = remaining(backup, at: 6), let late = remaining(backup, at: 16) else {
            return XCTFail("a transfer in flight should say a figure")
        }

        XCTAssertLessThan(late, early)
        XCTAssertEqual(late, 4 * backup.pace, accuracy: 60)
    }

    // MARK: - A transfer that stops

    func testAFailingTransferStopsPartWayWithTheFilesUnfinished() {
        let failing = DemoScript(kind: .backup, outcome: .fails)
        let beat = failing.beat(at: failing.duration)

        XCTAssertEqual(beat.stage, .stopped)
        XCTAssertGreaterThan(beat.progress, 0.2)
        XCTAssertLessThan(beat.progress, 1)
        XCTAssertTrue(failing.isOver(at: failing.duration))
    }

    func testACancelledTransferStopsSoonerThanAFailingOne() {
        let cancelled = DemoScript(kind: .backup, outcome: .cancelled)
        let failing = DemoScript(kind: .backup, outcome: .fails)

        XCTAssertLessThan(
            cancelled.beat(at: failing.duration).progress,
            failing.beat(at: failing.duration).progress
        )
    }

    func testAFailingTransferEndsWithTheLinesAHelperLeavesBehind() {
        let failing = DemoScript(kind: .backup, outcome: .fails)
        let lines = failing.lines(at: failing.duration)

        XCTAssertTrue(lines.contains { $0.contains("No device found") })
        // The sentence the window shows is written by the same rules a real
        // failure goes through, so it is the wording of the app rather than
        // the wording of the helper.
        XCTAssertTrue(DemoScript.failureSentence.contains("No iPhone answered on the cable."))
    }

    // MARK: - What the helper says

    func testTheLinesOnlyEverGrow() {
        var count = 0
        for tenth in stride(from: 0.0, through: backup.duration, by: 0.1) {
            let lines = backup.lines(at: tenth)
            XCTAssertGreaterThanOrEqual(lines.count, count)
            count = lines.count
        }

        XCTAssertGreaterThan(count, 5)
    }

    func testAStoppedTransferSaysNothingItWouldHaveSaidLater() {
        let cancelled = DemoScript(kind: .backup, outcome: .cancelled)

        XCTAssertFalse(cancelled.lines(at: cancelled.duration).contains { $0.contains("69445 files") })
    }
}

/// The switches the demo bar writes to.
final class DemoConditionsTests: XCTestCase {
    func testThePhonesSayHowManyAreOnTheCable() {
        XCTAssertEqual(DemoConditions.Phones.none.count, 0)
        XCTAssertEqual(DemoConditions.Phones.one.count, 1)
        XCTAssertEqual(DemoConditions.Phones.two.count, 2)
    }

    func testOnlyAFailureOrACancellationStopsATransferPartWay() {
        XCTAssertFalse(DemoConditions.Outcome.succeeds.stopsPartWay)
        XCTAssertTrue(DemoConditions.Outcome.fails.stopsPartWay)
        XCTAssertTrue(DemoConditions.Outcome.cancelled.stopsPartWay)
    }

    func testARestoreLeavesThePhoneSayingWhatTheRunAskedFor() {
        let before = DemoConditions()

        XCTAssertTrue(before.afterRestore(target: true).supervised)
        // The run made a backup on the way, so this Mac is holding one now.
        XCTAssertTrue(before.afterRestore(target: true).holdingBackup)
    }

    func testInstallingTheProfileLeavesItOnThePhone() {
        XCTAssertTrue(DemoConditions().afterProfileInstall().profileInstalled)
    }

    func testNothingElseChangesWhenOneThingDoes() {
        var conditions = DemoConditions()
        conditions.findMyOn = true
        conditions.backupsEncrypted = true

        let after = conditions.afterProfileInstall()

        XCTAssertTrue(after.findMyOn)
        XCTAssertTrue(after.backupsEncrypted)
    }
}
