import Foundation

/// What has to be true before a step of the wizard runs.
///
/// Find My is why this is a file of its own. Apple refuses to put a backup
/// back on an iPhone that still has Find My on, and that is the whole of it:
/// the backup copies either way. Turning Find My off can start a one hour
/// Stolen Device Protection wait, and a full backup takes about an hour as
/// well, so the two used to be waited out one after the other. The checks name
/// Find My as work to do and let the backup start, and the restore is where it
/// is finally asked for, which lets both hours run at the same time.
///
/// Nothing here touches the iPhone, the backup or the window, which is why it
/// is a part of the wizard the tests can run.
enum WizardGate {
    /// Whether the checks let the run move on to the backup.
    ///
    /// Find My is left out on purpose: the copying does not care about it. A
    /// check that could not be read blocks nothing either. The copy is always
    /// encrypted, so a password is always required: the only ways through this
    /// are a disk that answered and answered too small, and a password that has
    /// not been typed yet.
    static func checksPass(diskSpacePasses: Bool?, hasPassword: Bool) -> Bool {
        if diskSpacePasses == false { return false }
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
    /// says Find My is on.
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

    /// How Find My is turned off, in the hover help of both steps that ask for
    /// it. The one hour is Stolen Device Protection, which is the reason the
    /// copying no longer waits for any of this.
    static let turnFindMyOff = """
        Settings > your name > Find My > Find My iPhone. A one-hour wait is Stolen Device \
        Protection and can't be skipped.
        """
}
