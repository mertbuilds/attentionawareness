import Foundation

/// What has to be true before a step of the wizard runs.
///
/// Find My is why this is a file of its own. Apple refuses a restore on an
/// iPhone that still has Find My on, so the start asks for it: Supervise
/// stays off until the iPhone says Find My is off. The job asks again before
/// the restore, because Find My can be turned back on in the meantime.
///
/// Nothing here touches the iPhone or the window, which is why it is a part
/// of the wizard the tests can run.
enum WizardGate {
    /// Whether Find My lets the run start. An iPhone that says Find My is on
    /// holds it; one that will not say goes through, and refuses the restore
    /// itself if it has to, in a sentence the job shows.
    static func checksPass(findMyOn: Bool?) -> Bool {
        findMyOn != true
    }

    // MARK: - The iPhone leaving the cable

    /// What the run does when a read of the cable no longer lists the iPhone
    /// it is about.
    enum LostPhone: Equatable {
        /// Nothing changes: no iPhone has been picked yet, the one picked is
        /// still there, or the job expects it to be away.
        case carryOn
        /// Back to Connect, with the run forgotten the way Start Over forgets
        /// it.
        case startOver
        /// The helper still has the iPhone. It is told to stop through the
        /// same cancel the Cancel button sends, and the run goes back to
        /// Connect once it has, so no helper is left running for a phone that
        /// is gone.
        case stopTheHelperFirst
    }

    /// Whether the iPhone the run is about leaving the cable takes the window
    /// back to Connect.
    ///
    /// It does at every step but one stretch: from the moment the restore
    /// starts until the iPhone has come back and answered. The run restarts
    /// the phone, so it leaves the cable on every run that works, and the job
    /// already waits for it and says what to do when it does not come back. A
    /// restore that stopped part way is left on its own screen as well, with
    /// its Try Again, because it may have reached the iPhone.
    ///
    /// `onCable` is every iPhone usbmuxd lists, read or not, so a phone that
    /// only failed one lockdown read is not taken for one that was unplugged.
    /// Another iPhone coming or going changes nothing.
    ///
    /// `job` only counts while `step` is the job screen. A job that was
    /// cancelled can write one last phase on its way out, after the run has
    /// already moved to another step, and that phase holds nothing there.
    static func lostPhone(
        picked: String?,
        onCable: [String],
        step: WizardStep,
        job: JobPhase?,
        helperRunning: Bool
    ) -> LostPhone {
        guard let picked, !onCable.contains(picked) else { return .carryOn }
        // The restore stretch is left out on purpose. Its restart takes the
        // phone off the cable on every run that works, and a restore that
        // stopped part way keeps its Try Again.
        if step == .job, let job, restoreHasThePhone(job) { return .carryOn }
        return helperRunning ? .stopTheHelperFirst : .startOver
    }

    /// The phases from the first byte of the restore to the iPhone saying
    /// what it is now, and a restore that stopped part way.
    private static func restoreHasThePhone(_ job: JobPhase) -> Bool {
        switch job {
        case .restoring, .finishing, .restarting, .awaitingLiveConfiguration, .applyingLiveConfiguration,
             .confirming, .phoneGone:
            return true
        case .failed(let failure):
            return failure.retry == .restore
        case .preparing, .waitingForFindMy, .done, .checkOnIPhone:
            return false
        }
    }

    // MARK: - The anonymous count

    /// Whether moving on from this phase of the job is the person saying the
    /// iPhone is supervised, which is the one moment the app sends its count.
    /// The Mac's own read after a restart is not reliable, so the person
    /// saying it is what ends a supervision. A run that failed or was walked
    /// away from confirms nothing.
    static func confirmsSupervision(_ phase: JobPhase) -> Bool {
        if case .checkOnIPhone = phase { return true }
        return false
    }

    /// How Find My is turned off, on the Ready screen while it is still on and
    /// in the hover help of both steps that ask for it. The one hour is Stolen
    /// Device Protection, which is a wait nobody can shorten.
    static let turnFindMyOff = """
        Settings > your name > Find My > Find My iPhone. A one-hour wait is Stolen Device \
        Protection and can't be skipped.
        """
}
