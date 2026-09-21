import XCTest

/// The one line the job screen shows, phase by phase.
///
/// The whole of that screen is a bar and a sentence, so the sentence is worth
/// a table of its own: which words each phase carries, which of them let the
/// bar say how far along it is, and which of them carry a figure for how much
/// longer. None of it reads an iPhone or builds a view.
final class JobPhaseTests: XCTestCase {
    // MARK: - The line under the bar

    func testEveryPhaseThatRunsSaysWhatIsHappening() {
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
            XCTAssertEqual(phase.line, line)
        }
    }

    func testAPhaseThatCameToAnEndSaysNothingUnderABar() {
        for phase in ended {
            XCTAssertNil(phase.line)
        }
    }

    // MARK: - The bar

    func testOnlyTheTwoTransfersSayHowFarAlongTheyAre() {
        XCTAssertTrue(JobPhase.copying.isDeterminate)
        XCTAssertTrue(JobPhase.restoring.isDeterminate)

        for phase in [JobPhase.preparing, .waitingForFindMy, .finishing, .restarting, .confirming] {
            XCTAssertFalse(phase.isDeterminate, "\(phase) has nothing to measure")
        }
        for phase in ended {
            XCTAssertFalse(phase.isDeterminate)
        }
    }

    func testTheBarIsOnScreenForEveryPhaseThatRunsAndNoOther() {
        for phase in running {
            XCTAssertTrue(phase.isRunning, "\(phase) should still be working")
        }
        for phase in ended {
            XCTAssertFalse(phase.isRunning, "\(phase) should be over")
        }
    }

    // MARK: - The figure

    func testOnlyTheCopyingCarriesAFigureForHowMuchLonger() {
        XCTAssertTrue(JobPhase.copying.showsEstimate)

        for phase in running where phase != .copying {
            XCTAssertFalse(phase.showsEstimate, "\(phase) is not this Mac's work to measure")
        }
    }

    // MARK: - The three ends

    func testAPhoneThatNeverSaidItAsksForALookAtTheSettingsScreen() {
        XCTAssertEqual(JobPhase.checkOnIPhone.headline, "Check on iPhone")
        XCTAssertEqual(
            JobPhase.checkOnIPhone.body,
            "Look for 'This iPhone is supervised' at the top of Settings."
        )
        // The "i" holds the same words until a film of them goes in behind it.
        XCTAssertEqual(
            JobPhase.checkOnIPhone.note,
            JobPhase.checkOnIPhone.body
        )
    }

    func testAPhoneThatNeverCameBackSaysSoAndWhatToDo() {
        XCTAssertEqual(JobPhase.phoneGone.headline, "iPhone Didn't Reconnect")
        XCTAssertEqual(
            JobPhase.phoneGone.body,
            "Unlock iPhone and keep the cable in."
        )
        XCTAssertNil(JobPhase.phoneGone.note)
    }

    func testAFailureIsItsOwnTwoSentencesWithTheLayersWordsBehindIt() {
        let failure = JobFailure(
            title: "Copy Didn't Finish",
            fix: "Reconnect iPhone, then try again.",
            raw: "ERROR: No device found, is it plugged in?",
            retry: .copy
        )
        let phase = JobPhase.failed(failure)

        XCTAssertEqual(phase.headline, failure.title)
        XCTAssertEqual(phase.body, failure.fix)
        XCTAssertEqual(phase.note, failure.raw)
    }

    func testAFailureThatLeftNoWordsBehindShowsNoButtonForThem() {
        let quiet = JobFailure(title: "Copy Didn't Finish", fix: "Try again.", raw: "", retry: .copy)

        XCTAssertNil(JobPhase.failed(quiet).note)
    }

    func testAPhaseStillRunningCarriesNoHeadlineOfItsOwn() {
        for phase in running {
            XCTAssertNil(phase.headline, "\(phase) keeps the screen's title")
            XCTAssertNil(phase.body)
        }
        // The job ends on `done` and the wizard moves on by itself, so that
        // phase says nothing either.
        XCTAssertNil(JobPhase.done.headline)
        XCTAssertNil(JobPhase.done.body)
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
