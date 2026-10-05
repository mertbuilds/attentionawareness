import Foundation

/// Where the one long job has got to.
///
/// Reading the iPhone, sending the small seed, the restart and the wait for
/// the iPhone to come back are several pieces of work to the app and one wait
/// to the person watching. So they are one screen: one bar, and one line under
/// it saying which piece is running. This is that line, and the ends the job
/// can come to.
///
/// Nothing here touches the iPhone, the backup or the window, which is why it
/// is a part of the job the tests can run.
enum JobPhase: Equatable {
    /// Reading the iPhone and writing the small seed on this Mac, which takes
    /// seconds.
    case preparing
    /// The iPhone refuses a restore while Find My is on, so the job holds here
    /// until the iPhone says it is off. The job only starts once Find My reads
    /// off, so this is reached only when it was turned back on since, or when
    /// the iPhone would not say before.
    case waitingForFindMy
    case restoring
    /// Every file is across and the iPhone is the one working. This Mac can
    /// see none of that, so the bar stops claiming a figure.
    case finishing
    /// The iPhone was restarted and is not back on the cable yet.
    case restarting
    /// On iOS 27 or later the restore restarted iPhone itself, and the job
    /// waits for it to come back and pair again. Some runs come back on the
    /// Restore Completed screen and some do not.
    case awaitingLiveConfiguration
    /// The iPhone is back, and the supervision setting is being sent to it
    /// live.
    case applyingLiveConfiguration
    /// The iPhone is back and is being asked what it is now.
    case confirming
    /// It said what the run asked for.
    case done
    /// The confirm-supervision gate, always shown before the restrictions are
    /// installed. `reportedSupervised` is what the Mac's read said, which tunes
    /// the wording but never skips the step.
    case checkOnIPhone(reportedSupervised: Bool)
    /// It never came back on the cable.
    case phoneGone
    case failed(JobFailure)

    /// True while the job is still working, which is when the bar is on screen
    /// and Cancel is the only button.
    var isRunning: Bool {
        switch self {
        case .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .awaitingLiveConfiguration,
             .applyingLiveConfiguration, .confirming:
            return true
        case .done, .checkOnIPhone, .phoneGone, .failed:
            return false
        }
    }

    /// True from the start of the job to its end, which is when the job screen
    /// plays the cost story under the bar. It is one story for the whole job,
    /// so every phase on the way plays it, the wait for a phone that has not
    /// come back included, and a change of phase never takes it off the
    /// screen or starts it over. Only the ends the job comes to stop it.
    var playsStory: Bool {
        switch self {
        case .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .awaitingLiveConfiguration,
             .applyingLiveConfiguration, .confirming, .phoneGone:
            return true
        case .done, .checkOnIPhone, .failed:
            return false
        }
    }

    /// The phase the job screen draws. `story` is the phase the cost story is
    /// playing under, or nil while the story is off the screen. An end the job
    /// comes to with the story on screen waits behind that phase until the
    /// story has faded out, so the end never shows up over it.
    static func onScreen(_ job: JobPhase?, story: JobPhase?) -> JobPhase? {
        guard let job, let story, !job.playsStory else { return job }
        return story
    }

    /// True where the bar can honestly say how far along it is: the restore,
    /// whose helper prints its progress. Everywhere else the work belongs to
    /// the iPhone or to the restart, and a bar that guessed at either would be
    /// making it up.
    var isDeterminate: Bool {
        switch self {
        case .restoring:
            return true
        case .preparing, .waitingForFindMy, .finishing, .restarting, .awaitingLiveConfiguration,
             .applyingLiveConfiguration, .confirming, .done, .checkOnIPhone, .phoneGone, .failed:
            return false
        }
    }

    /// The one line under the bar, or nil where the screen says something else
    /// instead. The words are about the work.
    var line: String? {
        switch self {
        case .preparing:
            return "Preparing"
        case .waitingForFindMy:
            return "Waiting for Find My iPhone to be turned off"
        case .restoring:
            return "Restoring iPhone"
        case .finishing:
            return "Finishing on iPhone"
        case .restarting:
            return "iPhone is restarting"
        case .awaitingLiveConfiguration:
            return "Waiting for iPhone to restart"
        case .applyingLiveConfiguration:
            return "Sending the supervision setting to iPhone"
        case .confirming:
            return "Checking iPhone"
        case .done, .checkOnIPhone, .phoneGone, .failed:
            return nil
        }
    }

    /// The heading this phase carries in place of the screen's own, or nil
    /// where the screen keeps its title and its bar.
    var headline: String? {
        switch self {
        case .checkOnIPhone:
            return "Check iPhone"
        case .phoneGone:
            return "iPhone Didn't Reconnect"
        case .failed(let failure):
            return failure.title
        case .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .awaitingLiveConfiguration,
             .applyingLiveConfiguration, .confirming, .done:
            return nil
        }
    }

    /// The sentence under that heading.
    var body: String? {
        switch self {
        case .checkOnIPhone(let reportedSupervised):
            let look =
                "Unlock iPhone and look at the top of Settings. It should say 'This iPhone is supervised.' Then continue to install the restrictions. Keep iPhone connected."
            return reportedSupervised ? "iPhone reports it's supervised. " + look : look
        case .phoneGone:
            return "Unlock iPhone with your passcode. If it asks, tap Trust. Still nothing? Unplug iPhone and plug it in again."
        case .failed(let failure):
            return failure.fix
        case .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .awaitingLiveConfiguration,
             .applyingLiveConfiguration, .confirming, .done:
            return nil
        }
    }

    /// What the restart wait asks of the person, under its line. A restarted
    /// iPhone answers nothing until its passcode is entered, so the wait says
    /// so from the start and names the one thing missing once the iPhone is
    /// back on the cable. `pairing` is nil while the iPhone is away. The
    /// restore makes the iPhone forget this Mac, so after the restart the
    /// iPhone always asks to trust it again, and the wait says so.
    static func restartHint(pairing: PairingState?) -> String {
        switch pairing {
        case .locked:
            return "Unlock iPhone."
        case .trustPending:
            return "Tap Trust on iPhone."
        case .untrusted:
            return "iPhone did not trust this Mac. Unplug iPhone, plug it in again, then tap Trust."
        case .needsReplug:
            return "Unplug iPhone, plug it in again, then tap Trust."
        case .paired:
            return "Keep iPhone unlocked and connected."
        case nil:
            return "When it is back, unlock it with your passcode. It then asks to trust this Mac again: tap Trust."
        }
    }

    /// What a run on iOS 27 or later asks of the person while it waits for
    /// the iPhone and sends the setting, under the line. The restore there
    /// restarts iPhone itself. It comes back on a screen that asks for the
    /// Home button or a swipe up, then the passcode, and in some runs it then
    /// shows the Restore Completed screen, where the setting has to arrive
    /// before anybody taps Continue.
    var restoreCompletedSteps: String? {
        switch self {
        case .awaitingLiveConfiguration:
            return "iPhone restarts by itself. When it is back, press the Home button or swipe up, then enter the passcode. If iPhone asks, tap Trust and enter the passcode. If iPhone shows Restore Completed, stay on it and do not tap Continue. This window says when to continue."
        case .applyingLiveConfiguration:
            return "Keep iPhone unlocked. If it shows Restore Completed, do not tap Continue yet. This window says when to continue."
        case .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .confirming, .done,
             .checkOnIPhone, .phoneGone, .failed:
            return nil
        }
    }

    /// What the job says about the Continue button of the Restore Completed
    /// screen outside those two phases, or nil where it says nothing. `owed`
    /// is a restore whose setting has not been sent live yet, and `applied`
    /// is one whose setting went through.
    static func restoreCompletedLine(for phase: JobPhase, owed: Bool, applied: Bool) -> String? {
        switch phase {
        case .phoneGone:
            return owed ? stayOnRestoreCompleted : nil
        case .confirming, .checkOnIPhone:
            return applied ? continueOnIPhone : nil
        case .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .awaitingLiveConfiguration,
             .applyingLiveConfiguration, .done, .failed:
            return nil
        }
    }

    static let stayOnRestoreCompleted = "If iPhone shows Restore Completed, stay on it and do not tap Continue."
    static let continueOnIPhone = "If iPhone shows Restore Completed, tap Continue now."
    /// What the last screen says after a run on iOS 27 or later, in both
    /// directions: Settings asked for the password once after every such run
    /// on a device, and the account stayed.
    static let appleAccountPassword = "iPhone may ask for your Apple account password once."

    /// What the "i" beside that sentence holds: the same words again on the
    /// confirm screen, and the layer's own words where a failure left some. The
    /// confirm screen shows its picture inline rather than behind an "i", so
    /// the job screen drops the button there. Nil takes it off everywhere else.
    var note: String? {
        switch self {
        case .checkOnIPhone:
            return body
        case .failed(let failure):
            return failure.raw.isEmpty ? nil : failure.raw
        case .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .awaitingLiveConfiguration,
             .applyingLiveConfiguration, .confirming, .done, .phoneGone:
            return nil
        }
    }
}
