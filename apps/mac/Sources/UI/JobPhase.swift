import Foundation

/// Where the one long job has got to.
///
/// Copying the iPhone onto this Mac, writing the flag into the copy and
/// sending it all back are three pieces of work to the app and one wait to
/// the person watching. So they are one screen: one bar, and one line under it
/// saying which piece is running. This is that line, and the three ends the
/// job can come to.
///
/// Nothing here touches the iPhone, the backup or the window, which is why it
/// is a part of the job the tests can run.
enum JobPhase: Equatable {
    case copying
    /// The flag going into the copy on this Mac, which takes seconds.
    case preparing
    /// The iPhone refuses a restore while Find My is on, so the job holds here
    /// until the iPhone says it is off. The copying ran while somebody was
    /// turning it off, which is why this wait costs nothing but itself.
    case waitingForFindMy
    case restoring
    /// Every file is across and the iPhone is the one working. This Mac can
    /// see none of that, so the bar stops claiming a figure.
    case finishing
    /// The restore rebooted the iPhone and it is not back on the cable yet.
    case restarting
    /// The iPhone is back and is being asked what it is now.
    case confirming
    /// It said what the run asked for.
    case done
    /// It never said it, so somebody is asked to look at the iPhone itself.
    case checkOnIPhone
    /// It never came back on the cable.
    case phoneGone
    case failed(JobFailure)

    /// True while the job is still working, which is when the bar is on screen
    /// and Cancel is the only button.
    var isRunning: Bool {
        switch self {
        case .copying, .preparing, .waitingForFindMy, .restoring, .finishing, .restarting, .confirming:
            return true
        case .done, .checkOnIPhone, .phoneGone, .failed:
            return false
        }
    }

    /// True where the bar can honestly say how far along it is. Everywhere
    /// else the work belongs to the iPhone or to the reboot, and a bar that
    /// guessed at either would be making it up.
    var isDeterminate: Bool {
        switch self {
        case .copying, .restoring:
            return true
        case .preparing, .waitingForFindMy, .finishing, .restarting, .confirming,
             .done, .checkOnIPhone, .phoneGone, .failed:
            return false
        }
    }

    /// True where a figure for how much longer is worth showing. The copying
    /// is the only piece of the job this Mac measures on its own.
    var showsEstimate: Bool { self == .copying }

    /// The one line under the bar, or nil where the screen says something else
    /// instead. The words are about the work.
    var line: String? {
        switch self {
        case .copying:
            return "Copying iPhone to this Mac"
        case .preparing:
            return "Preparing"
        case .waitingForFindMy:
            return "Waiting for Find My iPhone to be turned off"
        case .restoring:
            return "Restoring iPhone"
        case .finishing:
            return "Finishing on iPhone"
        case .restarting, .confirming:
            return "iPhone is restarting"
        case .done, .checkOnIPhone, .phoneGone, .failed:
            return nil
        }
    }

    /// The heading this phase carries in place of the screen's own, or nil
    /// where the screen keeps its title and its bar.
    var headline: String? {
        switch self {
        case .checkOnIPhone:
            return "Check on iPhone"
        case .phoneGone:
            return "iPhone Didn't Reconnect"
        case .failed(let failure):
            return failure.title
        case .copying, .preparing, .waitingForFindMy, .restoring, .finishing,
             .restarting, .confirming, .done:
            return nil
        }
    }

    /// The sentence under that heading.
    var body: String? {
        switch self {
        case .checkOnIPhone:
            return "Look for 'This iPhone is supervised' at the top of Settings."
        case .phoneGone:
            return "Unlock iPhone and keep the cable in."
        case .failed(let failure):
            return failure.fix
        case .copying, .preparing, .waitingForFindMy, .restoring, .finishing,
             .restarting, .confirming, .done:
            return nil
        }
    }

    /// What the "i" beside that sentence holds: the same words again where a
    /// film of them is coming, and the layer's own words where a failure left
    /// some. Nil takes the button off the screen.
    var note: String? {
        switch self {
        case .checkOnIPhone:
            return body
        case .failed(let failure):
            return failure.raw.isEmpty ? nil : failure.raw
        case .copying, .preparing, .waitingForFindMy, .restoring, .finishing,
             .restarting, .confirming, .done, .phoneGone:
            return nil
        }
    }

    /// The picture that "i" shows, by name. Only the one question a picture
    /// settles has one: what the top of Settings looks like once the run is
    /// over. A failure has nothing to show.
    var noteImage: String? {
        switch self {
        case .checkOnIPhone:
            return InfoImage.checking
        case .copying, .preparing, .waitingForFindMy, .restoring, .finishing,
             .restarting, .confirming, .done, .phoneGone, .failed:
            return nil
        }
    }
}
