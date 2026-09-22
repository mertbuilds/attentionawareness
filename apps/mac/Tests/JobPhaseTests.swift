import Foundation
import Testing

/// The one line the job screen shows, phase by phase.
///
/// The whole of that screen is a bar and a sentence, so the sentence is worth
/// a table of its own: which words each phase carries, which of them let the
/// bar say how far along it is, and which of them carry a figure for how much
/// longer. None of it reads an iPhone or builds a view.
struct JobPhaseTests {
    // MARK: - The line under the bar

    @Test func everyPhaseThatRunsSaysWhatIsHappening() {
        let lines: [(JobPhase, String)] = [
            (.copying, "Copying iPhone to this Mac"),
            (.preparing, "Preparing"),
            (.waitingForFindMy, "Waiting for Find My iPhone to be turned off"),
            (.restoring, "Restoring iPhone"),
            (.finishing, "Finishing on iPhone"),
            (.restarting, "iPhone is restarting"),
            (.confirming, "iPhone is restarting"),
        ]

        for (phase, line) in lines {
            #expect(phase.line == line)
        }
    }

    @Test func aPhaseThatCameToAnEndSaysNothingUnderABar() {
        for phase in ended {
            #expect(phase.line == nil)
        }
    }

    // MARK: - The bar

    @Test func onlyTheTwoTransfersSayHowFarAlongTheyAre() {
        #expect(JobPhase.copying.isDeterminate)
        #expect(JobPhase.restoring.isDeterminate)

        for phase in [JobPhase.preparing, .waitingForFindMy, .finishing, .restarting, .confirming] {
            #expect(phase.isDeterminate == false, "\(phase) has nothing to measure")
        }
        for phase in ended {
            #expect(phase.isDeterminate == false)
        }
    }

    @Test func theBarIsOnScreenForEveryPhaseThatRunsAndNoOther() {
        for phase in running {
            #expect(phase.isRunning, "\(phase) should still be working")
        }
        for phase in ended {
            #expect(phase.isRunning == false, "\(phase) should be over")
        }
    }

    // MARK: - The figure

    @Test func onlyTheCopyingCarriesAFigureForHowMuchLonger() {
        #expect(JobPhase.copying.showsEstimate)

        for phase in running where phase != .copying {
            #expect(phase.showsEstimate == false, "\(phase) is not this Mac's work to measure")
        }
    }

    // MARK: - The three ends

    @Test func aPhoneThatNeverSaidItAsksForALookAtTheSettingsScreen() {
        #expect(JobPhase.checkOnIPhone.headline == "Check on iPhone")
        #expect(
            JobPhase.checkOnIPhone.body == "Look for 'This iPhone is supervised' at the top of Settings."
        )
        // The "i" holds the same words until a film of them goes in behind it.
        #expect(JobPhase.checkOnIPhone.note == JobPhase.checkOnIPhone.body)
    }

    @Test func aPhoneThatNeverCameBackSaysSoAndWhatToDo() {
        #expect(JobPhase.phoneGone.headline == "iPhone Didn't Reconnect")
        #expect(JobPhase.phoneGone.body == "Unlock iPhone and keep the cable in.")
        #expect(JobPhase.phoneGone.note == nil)
    }

    @Test func aFailureIsItsOwnTwoSentencesWithTheLayersWordsBehindIt() {
        let failure = JobFailure(
            title: "Copy Didn't Finish",
            fix: "Reconnect iPhone, then try again.",
            raw: "ERROR: No device found, is it plugged in?",
            retry: .copy
        )
        let phase = JobPhase.failed(failure)

        #expect(phase.headline == failure.title)
        #expect(phase.body == failure.fix)
        #expect(phase.note == failure.raw)
    }

    @Test func aFailureThatLeftNoWordsBehindShowsNoButtonForThem() {
        let quiet = JobFailure(title: "Copy Didn't Finish", fix: "Try again.", raw: "", retry: .copy)

        #expect(JobPhase.failed(quiet).note == nil)
    }

    @Test func aPhaseStillRunningCarriesNoHeadlineOfItsOwn() {
        for phase in running {
            #expect(phase.headline == nil, "\(phase) keeps the screen's title")
            #expect(phase.body == nil)
        }
        // The job ends on `done` and the wizard moves on by itself, so that
        // phase says nothing either.
        #expect(JobPhase.done.headline == nil)
        #expect(JobPhase.done.body == nil)
    }

    // MARK: - The two halves of the enum

    private let running: [JobPhase] = [
        .copying, .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .confirming,
    ]

    private let ended: [JobPhase] = [
        .done,
        .checkOnIPhone,
        .phoneGone,
        .failed(JobFailure(title: "Copy Didn't Finish", fix: "Try again.", raw: "", retry: .copy)),
    ]
}
