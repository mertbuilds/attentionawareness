import Foundation
import Testing

/// The one line the job screen shows, phase by phase.
///
/// The whole of that screen is a bar and a sentence, so the sentence is worth
/// a table of its own: which words each phase carries, which of them let the
/// bar say how far along it is, which of them carry a figure for how much
/// longer, and which of them play the cost story under it. None of it reads
/// an iPhone or builds a view.
struct JobPhaseTests {
    // MARK: - The line under the bar

    @Test func everyPhaseThatRunsSaysWhatIsHappening() {
        // Encrypting and connecting are the running phases that speak through
        // a headline and a body instead of this line; each has a test of its
        // own below.
        let lines: [(JobPhase, String)] = [
            (.copying, "Copying iPhone to this Mac"),
            (.preparing, "Preparing"),
            (.waitingForFindMy, "Waiting for Find My iPhone to be turned off"),
            (.restoring, "Restoring iPhone"),
            (.finishing, "Finishing on iPhone"),
            (.restarting, "iPhone is restarting"),
            (.confirming, "Checking iPhone"),
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

    @Test func turningOnEncryptionSendsThePersonToTheirPhone() {
        #expect(JobPhase.encrypting.headline == "Check iPhone")
        #expect(
            JobPhase.encrypting.body
                == "Enter the passcode on iPhone to turn on encryption. The prompt can take a few seconds to appear. Keep iPhone connected."
        )
        // The headline and the body carry the message, so the plain line
        // steps aside the way it does on the phases that came to an end.
        #expect(JobPhase.encrypting.line == nil)
        #expect(JobPhase.encrypting.note == nil)
        // It is still working, under a bar that cannot say how far along it is.
        #expect(JobPhase.encrypting.isRunning)
        #expect(JobPhase.encrypting.isDeterminate == false)
    }

    @Test func openingTheBackupServiceSendsThePersonToTheirPhone() {
        #expect(JobPhase.connecting.headline == "Check iPhone")
        #expect(
            JobPhase.connecting.body
                == "If iPhone asks, tap Trust This Computer and enter the passcode. Keep iPhone unlocked and connected."
        )
        // The headline and the body carry the message, so the plain line
        // steps aside the way it does on the phases that came to an end.
        #expect(JobPhase.connecting.line == nil)
        #expect(JobPhase.connecting.note == nil)
        // It is still working, under a bar that cannot say how far along it is,
        // and carries no figure for how much longer.
        #expect(JobPhase.connecting.isRunning)
        #expect(JobPhase.connecting.isDeterminate == false)
        #expect(JobPhase.connecting.showsEstimate == false)
    }

    // MARK: - The bar

    @Test func onlyTheTwoTransfersSayHowFarAlongTheyAre() {
        #expect(JobPhase.copying.isDeterminate)
        #expect(JobPhase.restoring.isDeterminate)

        for phase in [JobPhase.encrypting, .connecting, .preparing, .waitingForFindMy, .finishing, .restarting, .confirming] {
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

    // MARK: - The cost story

    @Test func theStoryPlaysThroughEveryPhaseThatRuns() {
        for phase in running {
            #expect(phase.playsStory, "\(phase) is part of the job")
        }
    }

    @Test func theStoryPlaysOnWhileThePhoneIsWaitedFor() {
        // The job is still reading the cable, and goes back to the restart
        // the moment the phone is there.
        #expect(JobPhase.phoneGone.playsStory)
    }

    @Test func aWholeJobNeverTakesTheStoryOffTheScreen() {
        // A run that turns encryption on, waits for Find My before the
        // restore and loses the phone for a while during the reboot. The
        // story is on from the first phase to the last, so it is never
        // started over from its first slide.
        let job: [JobPhase] = [
            .copying, .encrypting, .connecting, .copying, .preparing, .waitingForFindMy, .restoring,
            .finishing, .restarting, .phoneGone, .restarting, .confirming,
        ]

        for phase in job {
            #expect(phase.playsStory, "\(phase) would stop the story half way")
        }
    }

    @Test func theEndsTheJobComesToStopTheStory() {
        let ends: [JobPhase] = [
            .done,
            .checkOnIPhone(reportedSupervised: true),
            .failed(JobFailure(title: "Copy Didn't Finish", fix: "Try again.", raw: "", retry: .copy)),
        ]

        for phase in ends {
            #expect(phase.playsStory == false, "\(phase) is over")
        }
    }

    @Test func anEndWaitsForTheStoryToLeaveTheScreen() {
        let ends: [JobPhase] = [
            .done,
            .checkOnIPhone(reportedSupervised: true),
            .failed(JobFailure(title: "Copy Didn't Finish", fix: "Try again.", raw: "", retry: .copy)),
        ]

        for end in ends {
            // While the story fades out, the screen stays on the phase it was
            // playing under, so the end never shows up over it.
            #expect(JobPhase.onScreen(end, story: .confirming) == .confirming, "\(end) came on over the story")
            // Once it has gone, or where it never came on, the end shows at once.
            #expect(JobPhase.onScreen(end, story: nil) == end)
        }
    }

    @Test func aPhaseThatRunsIsDrawnAtOnceUnderTheStory() {
        for phase in running + [.phoneGone] {
            #expect(JobPhase.onScreen(phase, story: .copying) == phase)
            #expect(JobPhase.onScreen(phase, story: nil) == phase)
        }
        // Off the job screen there is nothing to draw, story or not.
        #expect(JobPhase.onScreen(nil, story: .confirming) == nil)
    }

    // MARK: - The figure

    @Test func onlyTheCopyingCarriesAFigureForHowMuchLonger() {
        #expect(JobPhase.copying.showsEstimate)

        for phase in running where phase != .copying {
            #expect(phase.showsEstimate == false, "\(phase) is not this Mac's work to measure")
        }
    }

    // MARK: - The three ends

    @Test func theConfirmSupervisionGateAsksForALookBeforeTheRestrictions() {
        let look =
            "Unlock iPhone and look at the top of Settings. It should say 'This iPhone is supervised.' Then continue to install the restrictions. Keep iPhone connected."
        // The gate always carries the same headline, and the plain look when
        // the Mac's read did not come back supervised.
        #expect(JobPhase.checkOnIPhone(reportedSupervised: false).headline == "Check iPhone")
        #expect(JobPhase.checkOnIPhone(reportedSupervised: false).body == look)
        // A read that did come back supervised prepends one reassuring line but
        // still asks for the look.
        #expect(
            JobPhase.checkOnIPhone(reportedSupervised: true).body
                == "iPhone reports it's supervised. " + look
        )
        // The "i" holds the same words until a film of them goes in behind it.
        #expect(
            JobPhase.checkOnIPhone(reportedSupervised: false).note
                == JobPhase.checkOnIPhone(reportedSupervised: false).body
        )
    }

    @Test func aPhoneThatNeverCameBackSaysSoAndWhatToDo() {
        #expect(JobPhase.phoneGone.headline == "iPhone Didn't Reconnect")
        #expect(
            JobPhase.phoneGone.body
                == "Unlock iPhone with your passcode. If it asks, tap Trust. Still nothing? Unplug iPhone and plug it in again."
        )
        #expect(JobPhase.phoneGone.note == nil)
    }

    @Test func theRestartWaitNamesTheOneThingMissing() {
        #expect(
            JobPhase.restartHint(pairing: nil)
                == "When it is back, unlock it with your passcode. If it asks, tap Trust."
        )
        #expect(JobPhase.restartHint(pairing: .locked) == "Unlock iPhone.")
        #expect(JobPhase.restartHint(pairing: .trustPending) == "Tap Trust on iPhone.")
        #expect(JobPhase.restartHint(pairing: .untrusted) == "Tap Trust on iPhone.")
        #expect(JobPhase.restartHint(pairing: .paired) == "Keep iPhone unlocked and connected.")
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
        // Encrypting and connecting are the running phases that carry their own
        // headline, so they stand apart here and are each checked in their own
        // test.
        for phase in running where phase != .encrypting && phase != .connecting {
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
        .encrypting, .connecting, .copying, .preparing, .waitingForFindMy, .restoring, .finishing,
        .restarting, .confirming,
    ]

    private let ended: [JobPhase] = [
        .done,
        .checkOnIPhone(reportedSupervised: false),
        .phoneGone,
        .failed(JobFailure(title: "Copy Didn't Finish", fix: "Try again.", raw: "", retry: .copy)),
    ]
}
