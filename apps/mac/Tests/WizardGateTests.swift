import Foundation
import Testing

/// What each step demands before it runs.
///
/// Find My is the whole reason this is a type of its own: it has to be off
/// before the run starts. These are the rules that say so, the ones that say
/// what unplugging the iPhone does, and the one moment the count is sent, and
/// none of them reads an iPhone.
struct WizardGateTests {
    // MARK: - The checks

    @Test func anIPhoneThatSaysFindMyIsOffLetsTheRunStart() {
        #expect(WizardGate.checksPass(findMyOn: false))
    }

    @Test func anIPhoneThatSaysFindMyIsOnStopsTheRun() {
        // The restore would be refused, so the run does not start.
        #expect(WizardGate.checksPass(findMyOn: true) == false)
    }

    @Test func anIPhoneThatWillNotSayAboutFindMyIsNotHeldBack() {
        // The iPhone refuses the restore itself if it turns out to be on.
        #expect(WizardGate.checksPass(findMyOn: nil))
    }

    // MARK: - The iPhone leaving the cable

    private static let udid = "00008140-000000000000001A"
    private static let otherUdid = "00008140-000B2C3D4E5F6071"

    @Test(arguments: [WizardStep.ready, .restrictions, .done, .profiles])
    func unpluggingThePickedIPhoneOffTheJobScreenGoesBackToConnect(_ step: WizardStep) {
        // These steps hold no job, the key field on the checks included.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: step,
                job: nil,
                helperRunning: false
            ) == .startOver
        )
    }

    @Test(arguments: [
        JobPhase.preparing,
        .waitingForFindMy,
        .checkOnIPhone(reportedSupervised: true),
        .done,
        .failed(JobFailure(title: "Couldn't Read iPhone", fix: "Try again.", raw: "", retry: .start)),
    ])
    func unpluggingThePickedIPhoneWhileNothingHasItGoesBackToConnect(_ job: JobPhase) {
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [Self.otherUdid],
                step: .job,
                job: job,
                helperRunning: false
            ) == .startOver
        )
    }

    @Test(arguments: [JobPhase.preparing, .waitingForFindMy])
    func unpluggingThePickedIPhoneWhileTheHelperRunsStopsTheHelperFirst(_ job: JobPhase) {
        // Dropping the job under a running helper would leave it running with
        // nobody listening, so it is cancelled the way Cancel cancels it.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: .job,
                job: job,
                helperRunning: true
            ) == .stopTheHelperFirst
        )
    }

    @Test(arguments: [JobPhase.preparing, .waitingForFindMy])
    func unpluggingThePickedIPhoneOnceTheHelperHasStoppedGoesBackToConnect(_ job: JobPhase) {
        // Once the helper has stopped there is nothing left to wait for.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: .job,
                job: job,
                helperRunning: false
            ) == .startOver
        )
    }

    @Test(arguments: [
        JobPhase.restoring,
        .finishing,
        .restarting,
        .awaitingLiveConfiguration,
        .applyingLiveConfiguration,
        .confirming,
        .phoneGone,
        .failed(JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)),
    ])
    func theRestartTakingThePhoneOffTheCableIsNotAnUnplug(_ job: JobPhase) {
        // The run takes the phone off the cable on every run that works, and
        // a restore that stopped part way keeps its Try Again, because it may
        // have reached the iPhone.
        for helperRunning in [true, false] {
            #expect(
                WizardGate.lostPhone(
                    picked: Self.udid,
                    onCable: [],
                    step: .job,
                    job: job,
                    helperRunning: helperRunning
                ) == .carryOn,
                "helper running: \(helperRunning)"
            )
        }
    }

    @Test(arguments: [
        JobPhase.restarting, .awaitingLiveConfiguration, .applyingLiveConfiguration, .confirming, .phoneGone,
    ])
    func aRestorePhaseLeftBehindOnTheChecksHoldsNothing(_ job: JobPhase) {
        // Cancel during the restart lands on Ready, and the cancelled job can
        // still write the phase it woke up to. Off the job screen that phase
        // is no reason to keep a run whose iPhone has gone.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: .ready,
                job: job,
                helperRunning: false
            ) == .startOver
        )
    }

    @Test(arguments: [
        nil,
        JobPhase.restoring,
        .waitingForFindMy,
        .checkOnIPhone(reportedSupervised: false),
    ])
    func unpluggingAnotherIPhoneChangesNothing(_ job: JobPhase?) {
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [Self.udid],
                step: job == nil ? .ready : .job,
                job: job,
                helperRunning: job == .restoring
            ) == .carryOn
        )
    }

    @Test func nothingIsForgottenBeforeAnIPhoneIsPicked() {
        // Connect is where a phone is chosen, so there is no run to forget.
        #expect(
            WizardGate.lostPhone(
                picked: nil,
                onCable: [],
                step: .connect,
                job: nil,
                helperRunning: false
            ) == .carryOn
        )
    }

    // MARK: - The anonymous count

    @Test func pressingItsSupervisedSaysTheSupervisionFinished() {
        // A cable pulled during the restart leaves a phone this Mac never saw
        // come back supervised, so the person saying it is has to be enough.
        #expect(WizardGate.confirmsSupervision(.checkOnIPhone(reportedSupervised: false)))
        #expect(WizardGate.confirmsSupervision(.checkOnIPhone(reportedSupervised: true)))
    }

    @Test func aRunThatDidNotGetToTheEndConfirmsNothing() {
        let failed = JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)

        #expect(WizardGate.confirmsSupervision(.failed(failed)) == false)
        #expect(WizardGate.confirmsSupervision(.phoneGone) == false)
        #expect(WizardGate.confirmsSupervision(.restarting) == false)
        #expect(WizardGate.confirmsSupervision(.confirming) == false)
    }
}
