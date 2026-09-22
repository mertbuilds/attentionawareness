import Foundation
import Testing

/// The demo's clock and its switches.
///
/// The demo exists so the window can be watched without a cable, and the part
/// of it worth testing is the timeline: a transfer that takes an hour on a real
/// phone has to run in the time somebody will sit through, move through its
/// phases in the right order, and still hand the estimate readings at a rate
/// that makes the figure on screen the figure a real run would show. None of
/// that touches an iPhone, a disk or a helper.
struct DemoScriptTests {
    private let backup = DemoScript(kind: .backup)
    private let restore = DemoScript(kind: .restore)

    // MARK: - How long it takes

    @Test func aTransferRunsInTheTimeSomebodyWillSitThrough() {
        for script in [backup, restore] {
            #expect(script.duration >= 20)
            #expect(script.duration <= 30)
        }
    }

    @Test func theDemoSecondsStandForTheHourATransferReallyTakes() {
        let end = backup.beat(at: backup.duration)

        // A measured full backup takes about an hour, so the elapsed time the
        // window shows has to land there rather than on the twenty five
        // seconds the reader waited.
        #expect(end.elapsed > 50 * 60)
        #expect(end.elapsed < 65 * 60)
    }

    // MARK: - The phases

    @Test func aBackupGoesFromStartingThroughTheFilesToTheSnapshot() {
        #expect(backup.beat(at: 0).stage == .starting)
        #expect(backup.beat(at: 1.9).stage == .starting)
        #expect(backup.beat(at: 2.1).stage == .transferring)
        #expect(backup.beat(at: 19.9).stage == .transferring)
        #expect(backup.beat(at: 20.1).stage == .finishing)
        #expect(backup.beat(at: backup.duration).stage == .finished)
    }

    @Test func aRestoreAlsoWaitsForThePhoneToComeBack() {
        #expect(restore.beat(at: 18).stage == .finishing)
        #expect(restore.beat(at: 22).stage == .waitingForPhone)
        #expect(restore.beat(at: restore.duration).stage == .finished)
        #expect(restore.isOver(at: restore.duration))
        #expect(restore.isOver(at: 22) == false)
    }

    @Test func theProgressClimbsFromNothingToTheWholeJobAndNeverGoesBack() {
        var last = -1.0
        for tenth in stride(from: 0.0, through: backup.duration, by: 0.1) {
            let progress = backup.beat(at: tenth).progress
            #expect(progress >= last)
            last = progress
        }

        #expect(backup.beat(at: 0).progress == 0)
        #expect(backup.beat(at: 2).progress == 0)
        #expect(abs(backup.beat(at: 11).progress - 0.5) <= 0.01)
        #expect(abs(backup.beat(at: 20).progress - 1) <= 0.001)
    }

    @Test func theFileCountAndTheByteCounterOnlyMoveWhileFilesDo() {
        #expect(backup.beat(at: 1).files == 0)
        #expect(backup.beat(at: 1).bytes == nil)
        #expect(backup.beat(at: 11).files > backup.beat(at: 6).files)
        #expect(backup.beat(at: 11).bytes != nil)
        // Every file is across by the time the iPhone is closing the snapshot,
        // so there is no file to count bytes for.
        #expect(backup.beat(at: 22).bytes == nil)
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

    @Test func nothingIsSaidInTheFirstSecondsOfATransfer() {
        #expect(remaining(backup, at: 1) == nil)
        #expect(remaining(backup, at: 3) == nil)
    }

    @Test func onceItSettlesTheFigureIsTheOneARealRunWouldShow() {
        guard let left = remaining(backup, at: 5) else {
            Issue.record("a transfer five seconds in should say a figure")
            return
        }

        // Fifteen demo seconds of copying are left, and each of them stands
        // for a little over two minutes on the cable.
        #expect(abs(left - 15 * backup.pace) <= 60)
    }

    @Test func theFigureShrinksAsTheTransferGoesOn() {
        guard let early = remaining(backup, at: 6), let late = remaining(backup, at: 16) else {
            Issue.record("a transfer in flight should say a figure")
            return
        }

        #expect(late < early)
        #expect(abs(late - 4 * backup.pace) <= 60)
    }

    // MARK: - A transfer that stops

    @Test func aFailingTransferStopsPartWayWithTheFilesUnfinished() {
        let failing = DemoScript(kind: .backup, outcome: .fails)
        let beat = failing.beat(at: failing.duration)

        #expect(beat.stage == .stopped)
        #expect(beat.progress > 0.2)
        #expect(beat.progress < 1)
        #expect(failing.isOver(at: failing.duration))
    }

    @Test func aCancelledTransferStopsSoonerThanAFailingOne() {
        let cancelled = DemoScript(kind: .backup, outcome: .cancelled)
        let failing = DemoScript(kind: .backup, outcome: .fails)

        #expect(
            cancelled.beat(at: failing.duration).progress < failing.beat(at: failing.duration).progress
        )
    }

    @Test func aFailingTransferEndsWithTheLinesAHelperLeavesBehind() {
        let failing = DemoScript(kind: .backup, outcome: .fails)
        let lines = failing.lines(at: failing.duration)

        #expect(lines.contains { $0.contains("No device found") })
        // The sentence the window shows is written by the same rules a real
        // failure goes through, so it is the wording of the app rather than
        // the wording of the helper.
        #expect(DemoScript.failureSentence.contains("No iPhone answered on the cable."))
    }

    // MARK: - What the helper says

    @Test func theLinesOnlyEverGrow() {
        var count = 0
        for tenth in stride(from: 0.0, through: backup.duration, by: 0.1) {
            let lines = backup.lines(at: tenth)
            #expect(lines.count >= count)
            count = lines.count
        }

        #expect(count > 5)
    }

    @Test func aStoppedTransferSaysNothingItWouldHaveSaidLater() {
        let cancelled = DemoScript(kind: .backup, outcome: .cancelled)

        #expect(cancelled.lines(at: cancelled.duration).contains { $0.contains("69445 files") } == false)
    }
}

/// The switches the demo bar writes to.
struct DemoConditionsTests {
    @Test func thePhonesSayHowManyAreOnTheCable() {
        #expect(DemoConditions.Phones.none.count == 0)
        #expect(DemoConditions.Phones.one.count == 1)
        #expect(DemoConditions.Phones.two.count == 2)
    }

    @Test func onlyAFailureOrACancellationStopsATransferPartWay() {
        #expect(DemoConditions.Outcome.succeeds.stopsPartWay == false)
        #expect(DemoConditions.Outcome.fails.stopsPartWay)
        #expect(DemoConditions.Outcome.cancelled.stopsPartWay)
    }

    @Test func aRestoreLeavesThePhoneSayingWhatTheRunAskedFor() {
        let before = DemoConditions()

        #expect(before.afterRestore(target: true).supervised)
        // The run made a backup on the way, so this Mac is holding one now.
        #expect(before.afterRestore(target: true).holdingBackup)
    }

    @Test func installingTheProfileLeavesItOnThePhone() {
        #expect(DemoConditions().afterProfileInstall().profileInstalled)
    }

    @Test func nothingElseChangesWhenOneThingDoes() {
        var conditions = DemoConditions()
        conditions.findMyOn = true
        conditions.backupsEncrypted = true

        let after = conditions.afterProfileInstall()

        #expect(after.findMyOn)
        #expect(after.backupsEncrypted)
    }
}
