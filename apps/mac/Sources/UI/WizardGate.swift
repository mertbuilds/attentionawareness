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
    /// check that could not be read blocks nothing either, so the only ways
    /// through this are a disk that answered and answered too small, and a
    /// password that is needed and not typed yet.
    static func checksPass(diskSpacePasses: Bool?, needsPassword: Bool, hasPassword: Bool) -> Bool {
        if diskSpacePasses == false { return false }
        if needsPassword, !hasPassword { return false }
        return true
    }

    /// Whether the restore can send the backup to the iPhone.
    enum Restore: Equatable {
        /// The phone says Find My is off, or it will not say at all. A phone
        /// that will not say goes through on purpose: refusing on a value
        /// nobody can read would leave a reader with no way forward, and a
        /// phone that does refuse the restore says so itself, in a sentence
        /// the step shows.
        case allowed
        /// The phone says Find My is on, so the restore would be refused.
        case blockedByFindMy
    }

    /// The restore waits only while the iPhone itself says Find My is on.
    static func restore(findMyOn: Bool?) -> Restore {
        findMyOn == true ? .blockedByFindMy : .allowed
    }

    /// How Find My is turned off, in the words of both steps that ask for it.
    /// The one hour is Stolen Device Protection, which is the reason the backup
    /// no longer waits for any of this.
    static let turnFindMyOff = """
        Open Settings, tap your name, tap Find My, and turn Find My iPhone off. \
        If the phone starts a one hour wait, that is Stolen Device Protection. \
        The hour cannot be skipped. When it ends, confirm on the phone to finish.
        """
}
