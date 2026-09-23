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
    /// Turning backup encryption on before the copy, which the iPhone does
    /// when it did not already encrypt its backups. It takes seconds, and the
    /// iPhone may ask for its passcode to confirm.
    case encrypting
    /// The copy is opening the backup service on the iPhone, before any bytes
    /// move. The iPhone asks to trust this Mac and for its passcode, so the
    /// person is sent to look at the phone until the transfer begins.
    case connecting
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
        case .encrypting, .connecting, .copying, .preparing, .waitingForFindMy, .restoring,
             .finishing, .restarting, .confirming:
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
        case .encrypting, .connecting, .preparing, .waitingForFindMy, .finishing, .restarting,
             .confirming, .done, .checkOnIPhone, .phoneGone, .failed:
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
        // Encrypting and connecting send the person to their phone, so they
        // carry a headline and a body in place of a line the way the ended
        // phases do.
        case .encrypting, .connecting, .done, .checkOnIPhone, .phoneGone, .failed:
            return nil
        }
    }

    /// The heading this phase carries in place of the screen's own, or nil
    /// where the screen keeps its title and its bar.
    var headline: String? {
        switch self {
        case .encrypting, .connecting, .checkOnIPhone:
            return "Check iPhone"
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
        case .encrypting:
            return "Enter the passcode on iPhone to turn on encryption. The prompt can take a few seconds to appear. Keep the cable connected."
        case .connecting:
            return "If iPhone asks, tap Trust This Computer and enter the passcode. Keep it unlocked and the cable connected."
        case .checkOnIPhone(let reportedSupervised):
            let look =
                "Unlock iPhone and look at the top of Settings. It should say 'This iPhone is supervised.' Then continue to install the restrictions."
            return reportedSupervised ? "iPhone reports it's supervised. " + look : look
        case .phoneGone:
            return "Unlock iPhone and keep the cable in."
        case .failed(let failure):
            return failure.fix
        case .copying, .preparing, .waitingForFindMy, .restoring, .finishing,
             .restarting, .confirming, .done:
            return nil
        }
    }

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
        case .encrypting, .connecting, .copying, .preparing, .waitingForFindMy, .restoring,
             .finishing, .restarting, .confirming, .done, .phoneGone:
            return nil
        }
    }
}

/// What the copy line adds after "Copying iPhone to this Mac": a time for how
/// much longer the copy has, from the first second.
///
/// Three sources, in the order they earn a figure. Once the live estimate has
/// read a rate off the copy itself, that is the truth and it is used. Before
/// then the line still says a time: the rate this Mac wrote down last run
/// divided into the size this copy is expected to be, the same maths the Ready
/// screen shows. A first-ever run has no rate to divide by, so it says the
/// range a copy of any size lands in rather than a number it hasn't earned. A
/// copy whose progress has stalled says nothing, and the phase line stands on
/// its own.
///
/// Nothing here touches the iPhone, the disk or the window, which is why it is
/// the part of the copy line the tests can run.
enum JobEstimateLine {
    /// What a first run says, with no rate to divide by. It mirrors the Ready
    /// screen's first-run line, without the number the copy hasn't earned yet.
    static let firstRun = "Usually 30 to 90 minutes"

    /// The words for the copy line, or nil where the copy has nothing to say
    /// and the phase line stands alone.
    ///
    /// - `live` is the estimate read off the copy in flight.
    /// - `rememberedRate` is what this Mac last measured, in bytes per second.
    /// - `expectedBytes` is the size this copy is expected to be, which is the
    ///   size the Ready screen shows.
    static func text(
        live: TransferEstimate.Reading,
        rememberedRate: Double?,
        expectedBytes: Int64?
    ) -> String? {
        switch live {
        case .about(let seconds):
            return remaining(seconds)
        case .tooEarly:
            guard let rememberedRate, rememberedRate > 0,
                  let expectedBytes, expectedBytes > 0
            else { return firstRun }
            return remaining(Double(expectedBytes) / rememberedRate)
        case .working:
            return nil
        }
    }

    /// The one wording the seeded figure and the live one share, so a run reads
    /// the same from the first second as it does once the rate has settled. It
    /// reuses `TransferEstimate`'s own rounding rather than inventing a second.
    private static func remaining(_ seconds: TimeInterval) -> String {
        "About \(TransferEstimate.duration(seconds)) remaining"
    }
}
