import Foundation

/// Everything the backup layer reports to the person at the keyboard.
///
/// The sentences are the ones the window shows, so they say what went wrong
/// and what to do next, like the ones in `Device/Errors.swift`.
enum BackupError: LocalizedError, Equatable {
    /// The bundled helper is not in the app. A Debug build that never ran
    /// `scripts/vendor.sh` looks like this.
    case helperMissing(path: String)
    /// The helper is there but macOS refused to start it.
    case helperFailedToStart(path: String, reason: String)
    /// The folder handed to `restore` holds no backup.
    case noBackupFolder(path: String)
    /// The user pressed Cancel and the helper stopped.
    case cancelled
    /// The helper stopped with an error. The sentence is already written for
    /// the window by `BackupError.sentence(lastError:exitCode:)`.
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .helperMissing(let path):
            return """
                The backup helper is missing at \(path).
                Run scripts/vendor.sh, then build the app again.
                """
        case .helperFailedToStart(let path, let reason):
            return "The backup helper at \(path) did not start. macOS reported: \(reason)"
        case .noBackupFolder(let path):
            return "There is no backup at \(path)."
        case .cancelled:
            return "The backup was cancelled."
        case .failed(let sentence):
            return sentence
        }
    }

    /// Turn the last thing the helper said into one sentence.
    ///
    /// The helper reports its failures as free text, so the known ones are
    /// matched by what they say. Anything else keeps its own words, behind a
    /// sentence that says the helper stopped.
    static func sentence(lastError: String?, exitCode: Int32) -> String {
        let said = (lastError ?? "").lowercased()
        if let lockdown = lockdownSentence(said) { return lockdown }
        for rule in rules where rule.needles.contains(where: said.contains) {
            return rule.sentence
        }
        guard let lastError, !lastError.isEmpty else {
            return "The backup helper stopped with error \(exitCode)."
        }
        return "The backup helper stopped with error \(exitCode). It said: \(lastError)"
    }

    private static let noDevice = """
        No iPhone answered on the cable.
        Plug the phone in, unlock it, then try again.
        """
    private static let trustPending =
        "The iPhone has not trusted this Mac yet. Unlock the phone and tap Trust."
    private static let trustDenied =
        "The iPhone refused to trust this Mac. Unplug it, plug it back in and tap Trust."
    private static let findMyOn = """
        Find My iPhone is still on, so the iPhone refuses the restore.
        Open Settings, tap your name, tap Find My, and turn Find My iPhone off.
        """
    private static let wrongPassword = """
        Wrong backup password.
        This is the password of the encrypted backup. It is not the passcode of the iPhone.
        """

    /// `ERROR: Could not connect to lockdownd, error code -19`. This is the
    /// one failure the helper reports as a number, and the number is the
    /// difference between a phone that is waiting for a tap and a phone that
    /// said no. The values are `lockdownd_error_t`.
    private static func lockdownSentence(_ said: String) -> String? {
        guard let marker = said.range(of: "could not connect to lockdownd, error code ") else {
            return nil
        }
        let digits = said[marker.upperBound...].prefix { $0 == "-" || $0.isNumber }
        guard let code = Int(digits) else { return nil }
        switch code {
        case -17, -19, -20, -21:
            // Password protected, pairing dialog pending, no or wrong host id.
            return trustPending
        case -4, -18, -36:
            // Pairing failed, user denied pairing, pairing prohibited.
            return trustDenied
        case -37:
            return findMyOn
        default:
            return "The Mac could not talk to the iPhone. Lockdown reported error \(code)."
        }
    }

    private struct Rule {
        let needles: [String]
        let sentence: String
    }

    /// First match wins, so the narrow reasons come before the wide ones.
    private static let rules: [Rule] = [
        Rule(needles: ["no device found", "device not found"], sentence: noDevice),
        Rule(
            needles: ["pairing dialog response pending", "password protected", "invalid hostid", "missing hostid"],
            sentence: trustPending
        ),
        Rule(
            needles: ["user denied pairing", "pairing failed", "pairing prohibited"],
            sentence: trustDenied
        ),
        Rule(needles: ["find my", "fmip"], sentence: findMyOn),
        Rule(
            needles: ["a backup password is required"],
            sentence: "This backup is encrypted. Give the backup password, then try again."
        ),
        Rule(needles: ["password"], sentence: wrongPassword),
        Rule(
            needles: ["no space left", "not enough space", "enough free space", "disk full"],
            sentence: "There is not enough free space for this backup. Make room on the disk, then try again."
        ),
        Rule(
            needles: ["timeout while locking"],
            sentence: "The iPhone is busy with another sync. Close Finder, then try again."
        ),
        Rule(
            needles: ["could not start service"],
            sentence: "The iPhone did not start the backup service. Unlock the phone, then try again."
        ),
        Rule(
            needles: ["device refused to start"],
            sentence: "The iPhone refused to start the backup. Unlock the phone, then try again."
        ),
        Rule(
            needles: ["backup directory", "does not exist"],
            sentence: "The backup folder is missing. Make a new backup, then try again."
        ),
    ]
}
