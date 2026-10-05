import Foundation
import Testing

/// The one line the job screen shows, phase by phase.
///
/// The whole of that screen is a bar and a sentence, so the sentence is worth
/// a table of its own: which words each phase carries, which of them let the
/// bar say how far along it is, and which of them play the cost story under
/// it. None of it reads
/// an iPhone or builds a view.
struct JobPhaseTests {
    // MARK: - The line under the bar

    @Test func everyPhaseThatRunsSaysWhatIsHappening() {
        let lines: [(JobPhase, String)] = [
            (.preparing, "Preparing"),
            (.waitingForFindMy, "Waiting for Find My iPhone to be turned off"),
            (.restoring, "Restoring iPhone"),
            (.finishing, "Finishing on iPhone"),
            (.restarting, "iPhone is restarting"),
            (.awaitingLiveConfiguration, "Waiting for iPhone to restart"),
            (.applyingLiveConfiguration, "Sending the supervision setting to iPhone"),
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

    // MARK: - The bar

    @Test func onlyTheRestoreSaysHowFarAlongItIs() {
        #expect(JobPhase.restoring.isDeterminate)

        for phase in running where phase != .restoring {
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
        // A run that waits for Find My before the restore and loses the
        // phone for a while during the restart. The story is on from the
        // first phase to the last, so it is never started over from its first
        // slide.
        let job: [JobPhase] = [
            .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .phoneGone, .restarting,
            .confirming,
        ]

        for phase in job {
            #expect(phase.playsStory, "\(phase) would stop the story half way")
        }
    }

    @Test func aJobOnIOS27NeverTakesTheStoryOffTheScreenEither() {
        // The restore restarts iPhone itself, the phone is lost for a while,
        // and the setting is sent live once it is back.
        let job: [JobPhase] = [
            .preparing, .restoring, .finishing, .awaitingLiveConfiguration, .phoneGone,
            .awaitingLiveConfiguration, .applyingLiveConfiguration, .confirming,
        ]

        for phase in job {
            #expect(phase.playsStory, "\(phase) would stop the story half way")
        }
    }

    @Test func theEndsTheJobComesToStopTheStory() {
        let ends: [JobPhase] = [
            .done,
            .checkOnIPhone(reportedSupervised: true),
            .failed(JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)),
        ]

        for phase in ends {
            #expect(phase.playsStory == false, "\(phase) is over")
        }
    }

    @Test func anEndWaitsForTheStoryToLeaveTheScreen() {
        let ends: [JobPhase] = [
            .done,
            .checkOnIPhone(reportedSupervised: true),
            .failed(JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)),
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
            #expect(JobPhase.onScreen(phase, story: .restoring) == phase)
            #expect(JobPhase.onScreen(phase, story: nil) == phase)
        }
        // Off the job screen there is nothing to draw, story or not.
        #expect(JobPhase.onScreen(nil, story: .confirming) == nil)
    }

    // MARK: - The ends

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
        // The restore makes the iPhone forget this Mac, so the wait says
        // from the start that it will ask for Trust again.
        #expect(
            JobPhase.restartHint(pairing: nil)
                == "When it is back, unlock it with your passcode. It then asks to trust this Mac again: tap Trust."
        )
        #expect(JobPhase.restartHint(pairing: .locked) == "Unlock iPhone.")
        #expect(JobPhase.restartHint(pairing: .trustPending) == "Tap Trust on iPhone.")
        #expect(
            JobPhase.restartHint(pairing: .untrusted)
                == "iPhone did not trust this Mac. Unplug iPhone, plug it in again, then tap Trust."
        )
        #expect(JobPhase.restartHint(pairing: .paired) == "Keep iPhone unlocked and connected.")
    }

    /// The Mac gave up on this connection: the wait says so at once, rather
    /// than "Tap Trust" until it runs out.
    @Test func theRestartWaitAsksForAReplugWhenTheMacGaveUp() {
        #expect(DeviceError.trustUnseen.pairingState == .needsReplug)
        #expect(DeviceError.pairRecordRejected.pairingState == .needsReplug)
        #expect(
            JobPhase.restartHint(pairing: .needsReplug)
                == "Unplug iPhone, plug it in again, then tap Trust."
        )
    }

    // MARK: - The Restore Completed screen

    /// On iOS 27 or later the restore restarts iPhone itself and the setting
    /// is sent live once it is back. The wait says what to do, in the order
    /// it happens, and the Restore Completed screen only where it shows.
    @Test func theWaitOnIOS27SaysWhatToDoOnTheRestoreCompletedScreen() {
        #expect(
            JobPhase.awaitingLiveConfiguration.restoreCompletedSteps
                == "iPhone restarts by itself. When it is back, press the Home button or swipe up, then enter the passcode. If iPhone asks, tap Trust and enter the passcode. If iPhone shows Restore Completed, stay on it and do not tap Continue. This window says when to continue."
        )
        #expect(
            JobPhase.applyingLiveConfiguration.restoreCompletedSteps
                == "Keep iPhone unlocked. If it shows Restore Completed, do not tap Continue yet. This window says when to continue."
        )
    }

    @Test func noOtherPhaseTalksAboutTheRestoreCompletedScreen() {
        for phase in running + ended
        where phase != .awaitingLiveConfiguration && phase != .applyingLiveConfiguration {
            #expect(phase.restoreCompletedSteps == nil, "\(phase) is not on that screen")
        }
    }

    @Test func continueOnIPhoneIsSaidOnlyOnceTheSettingWentThrough() {
        let said = "If iPhone shows Restore Completed, tap Continue now."
        for phase in [JobPhase.confirming, .checkOnIPhone(reportedSupervised: true), .checkOnIPhone(reportedSupervised: false)] {
            #expect(JobPhase.restoreCompletedLine(for: phase, owed: false, applied: true) == said)
            // A run on iOS 26 or earlier never sends the setting live.
            #expect(JobPhase.restoreCompletedLine(for: phase, owed: false, applied: false) == nil)
        }
        for phase in [JobPhase.awaitingLiveConfiguration, .applyingLiveConfiguration, .phoneGone] {
            #expect(JobPhase.restoreCompletedLine(for: phase, owed: true, applied: false) != said)
        }
    }

    @Test func aPhoneThatDidNotComeBackOnIOS27IsStillNotToBeContinued() {
        #expect(
            JobPhase.restoreCompletedLine(for: .phoneGone, owed: true, applied: false)
                == "If iPhone shows Restore Completed, stay on it and do not tap Continue."
        )
        #expect(JobPhase.restoreCompletedLine(for: .phoneGone, owed: false, applied: false) == nil)
    }

    @Test func theLastScreenOfARunOnIOS27SaysTheApplePasswordMayBeAsked() {
        #expect(JobPhase.appleAccountPassword == "iPhone may ask for your Apple account password once.")
    }

    @Test func aFailureIsItsOwnTwoSentencesWithTheLayersWordsBehindIt() {
        let failure = JobFailure(
            title: "Restore Didn't Finish",
            fix: "Reconnect iPhone, then try again.",
            raw: "ERROR: No device found, is it plugged in?",
            retry: .restore
        )
        let phase = JobPhase.failed(failure)

        #expect(phase.headline == failure.title)
        #expect(phase.body == failure.fix)
        #expect(phase.note == failure.raw)
    }

    @Test func aFailureThatLeftNoWordsBehindShowsNoButtonForThem() {
        let quiet = JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)

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
        .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .awaitingLiveConfiguration,
        .applyingLiveConfiguration, .confirming,
    ]

    private let ended: [JobPhase] = [
        .done,
        .checkOnIPhone(reportedSupervised: false),
        .phoneGone,
        .failed(JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)),
    ]
}
