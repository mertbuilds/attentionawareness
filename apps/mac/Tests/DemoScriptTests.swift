import Foundation
import Testing

/// The demo's clock and its switches.
///
/// The demo exists so the window can be watched without a cable, and the part
/// of it worth testing is the timeline: the restore has to run in the time
/// somebody will sit through and move through its phases in the right order.
/// None of that touches an iPhone, a disk or a helper.
struct DemoScriptTests {
    private let restore = DemoScript()

    // MARK: - How long it takes

    @Test func theRestoreRunsInTheTimeSomebodyWillSitThrough() {
        #expect(restore.duration >= 5)
        #expect(restore.duration <= 15)
    }

    // MARK: - The phases

    @Test func theRestoreGoesFromStartingThroughTheFilesToThePhoneComingBack() {
        #expect(restore.beat(at: 0).stage == .starting)
        #expect(restore.beat(at: 1.4).stage == .starting)
        #expect(restore.beat(at: 1.6).stage == .transferring)
        #expect(restore.beat(at: 5.4).stage == .transferring)
        #expect(restore.beat(at: 5.6).stage == .finishing)
        #expect(restore.beat(at: 7.6).stage == .waitingForPhone)
        #expect(restore.beat(at: restore.duration).stage == .finished)
        #expect(restore.isOver(at: restore.duration))
        #expect(restore.isOver(at: 7.6) == false)
    }

    @Test func theProgressClimbsFromNothingToTheWholeJobAndNeverGoesBack() {
        var last = -1.0
        for tenth in stride(from: 0.0, through: restore.duration, by: 0.1) {
            let progress = restore.beat(at: tenth).progress
            #expect(progress >= last)
            last = progress
        }

        #expect(restore.beat(at: 0).progress == 0)
        #expect(restore.beat(at: 1.5).progress == 0)
        #expect(abs(restore.beat(at: 3.5).progress - 0.5) <= 0.01)
        #expect(abs(restore.beat(at: 5.5).progress - 1) <= 0.001)
    }

    @Test func theFileCountOnlyMovesWhileFilesDo() {
        #expect(restore.beat(at: 1).files == 0)
        #expect(restore.beat(at: 5.6).files == 2)
    }

    // MARK: - A restore that stops

    @Test func aFailingRestoreStopsPartWayWithTheFilesUnfinished() {
        let failing = DemoScript(outcome: .fails)
        let beat = failing.beat(at: failing.duration)

        #expect(beat.stage == .stopped)
        #expect(beat.progress > 0.2)
        #expect(beat.progress < 1)
        #expect(failing.isOver(at: failing.duration))
    }

    @Test func aCancelledRestoreStopsSoonerThanAFailingOne() {
        let cancelled = DemoScript(outcome: .cancelled)
        let failing = DemoScript(outcome: .fails)

        #expect(
            cancelled.beat(at: failing.duration).progress < failing.beat(at: failing.duration).progress
        )
    }

    @Test func aFailingRestoreEndsWithTheLinesAHelperLeavesBehind() {
        let failing = DemoScript(outcome: .fails)
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
        for tenth in stride(from: 0.0, through: restore.duration, by: 0.1) {
            let lines = restore.lines(at: tenth)
            #expect(lines.count >= count)
            count = lines.count
        }

        #expect(count > 5)
    }

    @Test func theRestoreIsTheFastMethodsOwn() {
        let first = restore.lines(at: 0).first ?? ""

        #expect(first.contains("restore --system --skip-apps --no-reboot"))
    }

    @Test func aStoppedRestoreSaysNothingItWouldHaveSaidLater() {
        let cancelled = DemoScript(outcome: .cancelled)

        #expect(cancelled.lines(at: cancelled.duration).contains { $0.contains("The helper finished.") } == false)
    }
}

/// The switches the demo bar writes to.
struct DemoConditionsTests {
    @Test func thePhonesSayHowManyAreOnTheCable() {
        #expect(DemoConditions.Phones.none.count == 0)
        #expect(DemoConditions.Phones.one.count == 1)
        #expect(DemoConditions.Phones.two.count == 2)
    }

    @Test func theIOSSwitchReachesBothSidesOfTheRule() {
        #expect(IOSSupport.refusal(iosVersion: DemoConditions.IOS.ios26.version) == nil)
        #expect(IOSSupport.refusal(iosVersion: DemoConditions.IOS.ios27.version) == .iosNotSupportedYet)
        #expect(IOSSupport.refusal(iosVersion: DemoConditions.IOS.unknown.version) == .iosVersionUnknown)
    }

    @Test func onlyAFailureOrACancellationStopsARestorePartWay() {
        #expect(DemoConditions.Outcome.succeeds.stopsPartWay == false)
        #expect(DemoConditions.Outcome.fails.stopsPartWay)
        #expect(DemoConditions.Outcome.cancelled.stopsPartWay)
    }

    @Test func aRestoreLeavesThePhoneSayingWhatTheRunAskedFor() {
        let before = DemoConditions()

        #expect(before.afterRestore(target: true).supervised)
        #expect(before.afterRestore(target: false).supervised == false)
    }

    @Test func installingTheProfileLeavesItOnThePhone() {
        #expect(DemoConditions().afterProfileInstall().profileInstalled)
    }

    @Test func nothingElseChangesWhenOneThingDoes() {
        var conditions = DemoConditions()
        conditions.findMyOn = true
        conditions.ios = .ios27

        let after = conditions.afterProfileInstall()

        #expect(after.findMyOn)
        #expect(after.ios == .ios27)
    }
}
