import Foundation

/// What has to be true before a step of the wizard runs.
///
/// Find My is why this is a file of its own. Apple refuses to put a backup
/// back on an iPhone that still has Find My on, though the backup copies
/// either way. The run used to start the copy with Find My still on and ask
/// for it only at the restore, so the one hour Stolen Device Protection can
/// add ran alongside the hour of copying. People came back to a job that had
/// stopped after the copy to wait for it, and got stuck there. So the start
/// asks for it now: Supervise stays off until the iPhone says Find My is off.
/// The restore asks again, because Find My can be turned back on while the
/// copy runs, and Apple would refuse the restore just the same.
///
/// Nothing here touches the iPhone, the backup or the window, which is why it
/// is a part of the wizard the tests can run.
enum WizardGate {
    /// Whether the checks let the run move on to the backup.
    ///
    /// Find My has to read off, because the restore at the end of the run is
    /// refused while it is on, and a run that copies for an hour and then
    /// waits for it is where people got stuck. An iPhone that will not say
    /// goes through, for the same reason the restore lets it through, and the
    /// restore still holds if it turns out to be on. A check that could not be
    /// read blocks nothing either. The copy is always encrypted, so a password
    /// is always required. The only ways through this are a disk that
    /// answered and answered too small, an iPhone that says Find My is on and
    /// a password that has not been typed yet.
    static func checksPass(
        diskSpacePasses: Bool?,
        findMyOn: Bool?,
        hasPassword: Bool
    ) -> Bool {
        if diskSpacePasses == false || findMyOn == true { return false }
        return hasPassword
    }

    /// Whether the patch has left a result behind: a flag it wrote, or a copy
    /// that already said what the run asks for.
    ///
    /// The job patches the copy on the way in rather than on a screen of
    /// its own, so this is what it waits for before it offers the button,
    /// and what keeps a second arrival on that step from patching the same
    /// copy again.
    static func patched(changes: [String], alreadyCorrect: Bool, running: Bool) -> Bool {
        guard !running else { return false }
        return !changes.isEmpty || alreadyCorrect
    }

    /// Whether the restore can send the backup to the iPhone.
    enum Restore: Equatable {
        /// The copy carries the flag the run asked for, and the iPhone says
        /// Find My is off or will not say at all. A phone that will not say
        /// goes through on purpose: refusing on a value nobody can read would
        /// leave a reader with no way forward, and a phone that does refuse
        /// the restore says so itself, in a sentence the step shows.
        case allowed
        /// The iPhone says Find My is on, so the restore would be refused.
        case blockedByFindMy
        /// The patch has not written the flag yet, so the copy on this Mac is
        /// the iPhone as it already is and sending it back would change
        /// nothing.
        case notPatchedYet
    }

    /// The restore waits for the patch, and then only while the iPhone itself
    /// says Find My is on. The start already asked for it to be off, so this
    /// only holds a run where it was turned back on, or where the iPhone
    /// would not say before the copy.
    static func restore(findMyOn: Bool?, patched: Bool) -> Restore {
        guard patched else { return .notPatchedYet }
        return findMyOn == true ? .blockedByFindMy : .allowed
    }

    /// The password the restore hands the engine, from whether the copy on this
    /// Mac is really encrypted.
    ///
    /// An encrypted copy needs it, but an unencrypted one must never be given
    /// one: the iPhone answers a restore-with-password over a backup that
    /// carries no keybag with an error that reads as a wrong backup password. So
    /// a copy where encryption did not take still goes back, without a password.
    static func restorePassword(secret: String?, backupEncrypted: Bool) -> String? {
        backupEncrypted ? secret : nil
    }

    /// Whether the backup has done everything it was made for, which is the
    /// one moment it can be taken off this Mac.
    ///
    /// Everything short of this keeps it, because it is the only way back: an
    /// install that failed, a profile the iPhone lists with the wrong settings,
    /// a restore that never finished, a phone that never came back to say what
    /// it is now, and a run somebody walked away from.
    static func backupCanGo(
        restoreFinished: Bool,
        supervisedAfterwards: Bool?,
        profileConfirmed: Bool
    ) -> Bool {
        guard restoreFinished, supervisedAfterwards == true else { return false }
        return profileConfirmed
    }

    // MARK: - The iPhone leaving the cable

    /// What the run does when a read of the cable no longer lists the iPhone
    /// it is about.
    enum LostPhone: Equatable {
        /// Nothing changes: no iPhone has been picked yet, the one picked is
        /// still there, the job expects it to be away, or the last screen
        /// names a backup folder that would not go.
        case carryOn
        /// Back to Connect, with the run forgotten the way Start Over forgets
        /// it.
        case startOver
        /// The helper still has the iPhone. It is told to stop through the
        /// same cancel the Cancel button sends, and the run goes back to
        /// Connect once it has, so no helper is left running for a phone that
        /// is gone and no half-made copy is taken for a whole one.
        case stopTheHelperFirst
    }

    /// Whether the iPhone the run is about leaving the cable takes the window
    /// back to Connect.
    ///
    /// It does at every step, with two things left out. The first is the
    /// stretch from the moment the restore starts sending the copy back until
    /// the iPhone has come back and answered. The restore reboots the phone, so it leaves the cable on
    /// every run that works, and the job already waits for it and says what
    /// to do when it does not come back. A restore that stopped part way is
    /// left on its own screen as well. The copy on this Mac may be the only
    /// thing that can put that phone right, Try Again sends it straight back,
    /// and a new run from Connect would clear it before copying again. The
    /// second is the last screen while it names a backup folder that would
    /// not go (`leftoverShown`): it is the one place the folder is named, and
    /// the person may want to take it off this Mac themselves.
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
        helperRunning: Bool,
        leftoverShown: Bool
    ) -> LostPhone {
        guard let picked, !onCable.contains(picked) else { return .carryOn }
        // The restore stretch is left out on purpose. Its reboot takes the
        // phone off the cable on every run that works, and a restore that
        // stopped part way keeps its copy and its Try Again.
        if step == .job, let job, restoreHasThePhone(job) { return .carryOn }
        if step == .done, leftoverShown { return .carryOn }
        return helperRunning ? .stopTheHelperFirst : .startOver
    }

    /// The phases from the first byte of the restore to the iPhone saying
    /// what it is now, and a restore that stopped part way.
    private static func restoreHasThePhone(_ job: JobPhase) -> Bool {
        switch job {
        case .restoring, .finishing, .restarting, .confirming, .phoneGone:
            return true
        case .failed(let failure):
            return failure.retry == .restore
        case .encrypting, .connecting, .copying, .preparing, .waitingForFindMy, .done, .checkOnIPhone:
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
