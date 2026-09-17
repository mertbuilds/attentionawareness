import Foundation

/// Every problem the patch layer reports to the person at the keyboard.
///
/// The sentences come from the Python tool in `cli/`, so the app and the
/// command line say the same thing about the same backup. The few that name a
/// command line flag, a terminal window or a Finder step are rewritten for the
/// app, because the app makes the backup itself.
enum PatchError: LocalizedError {
    /// The folder holds no readable `Manifest.plist`, so it is not a backup.
    case unreadableManifest(URL)
    /// macOS refused the folder. A MobileSync backup needs Full Disk Access.
    case noAccessToBackupFolder(URL)
    /// The folder that should hold the backups is not there.
    case noBackupFolder(URL)
    /// An encrypted file has a length that is not a whole number of AES blocks.
    case blockLengthNotAes
    /// The keybag of this backup misses the records that unlock it.
    case oldKeybag
    /// A wrapped key did not come back out, which means the password is wrong.
    case wrongPassword
    /// The backup says it is encrypted but carries no keybag.
    case noKeybag
    /// The keybag holds no key for the protection class a file asks for.
    case noClassKey(Int)
    /// Manifest.db holds no row for the cloud configuration file.
    case noSupervisionFile
    /// The row is there but the file it points at is not.
    case supervisionFileMissing(URL)
    /// The cloud configuration file is not a plist dictionary.
    case notAPlistDictionary
    /// The `MBFile` blob in Manifest.db carries no `Size`.
    case noRecordedSize
    /// The `MBFile` blob of an encrypted backup carries no wrapped key.
    case noEncryptionKey
    /// The row was read once and is gone on the second read.
    case supervisionRowVanished
    /// The rewritten Manifest.db cannot be encrypted at this length.
    case manifestLengthNotAes(Int)
    /// CommonCrypto refused. The number is its own status code.
    case cryptoFailed(Int32)
    /// sqlite refused. The text is its own message.
    case databaseFailed(String)
    /// There is no untouched copy to put back.
    case noPristineCopy(udid: String, root: URL)
    /// The untouched copy is there but its `pristine.json` is unreadable.
    case unreadablePristineMetadata(URL)
    /// After the patch the flag in the file is not the one that was asked for.
    case verificationFlag(Bool)
    /// After the patch Manifest.db no longer holds the row.
    case verificationRowMissing
    /// After the patch the file size and the recorded size disagree.
    case verificationSize(actual: Int, recorded: Int)

    var errorDescription: String? {
        switch self {
        case .unreadableManifest(let url):
            return "There is no readable Manifest.plist in \(url.path), so this folder is not a backup."
        case .noAccessToBackupFolder(let url):
            return """
                macOS blocked access to the backup folder at \(url.path).
                Open System Settings, then Privacy & Security, then Full Disk Access.
                Turn the switch on for attention awareness, then try again.
                """
        case .noBackupFolder(let url):
            return "There is no backup folder at \(url.path)."
        case .blockLengthNotAes:
            return "An encrypted file in this backup has a length that AES cannot hold."
        case .oldKeybag:
            return """
                This backup holds an older keybag that this tool cannot open.
                Make a new backup, then try again.
                """
        case .wrongPassword:
            return """
                Wrong backup password.
                This is the password of the encrypted backup. It is not the passcode of the iPhone.
                """
        case .noKeybag:
            return """
                This encrypted backup holds no keybag, so this tool cannot open it.
                Make a new backup, then try again.
                """
        case .noClassKey(let protectionClass):
            return "The keybag of this backup holds no key for protection class \(protectionClass)."
        case .noSupervisionFile:
            return """
                This backup holds no supervision file.
                Make a full backup of the iPhone, then try again.
                """
        case .supervisionFileMissing(let url):
            return """
                The supervision file is missing at \(url.path).
                The backup is incomplete. Make a new backup.
                """
        case .notAPlistDictionary:
            return "The supervision file is not a plist dictionary."
        case .noRecordedSize:
            return "Manifest.db holds no Size value for the supervision file."
        case .noEncryptionKey:
            return "Manifest.db holds no encryption key for the supervision file."
        case .supervisionRowVanished:
            return "The supervision row vanished from Manifest.db."
        case .manifestLengthNotAes(let size):
            return """
                The rewritten Manifest.db holds \(size) bytes, a length that AES cannot hold.
                Nothing was written. Make a new backup, then try again.
                """
        case .cryptoFailed(let status):
            return "The backup could not be encrypted or decrypted. CommonCrypto reported error \(status)."
        case .databaseFailed(let message):
            return "Manifest.db could not be read or written. sqlite reported: \(message)"
        case .noPristineCopy(let udid, let root):
            return "There is no saved copy for UDID \(udid) in \(root.path)."
        case .unreadablePristineMetadata(let url):
            return "The saved copy at \(url.path) holds no readable pristine.json."
        case .verificationFlag(let target):
            return """
                Verification failed. IsSupervised is not \(target ? "true" : "false").
                Put the saved copy back.
                """
        case .verificationRowMissing:
            return "Verification failed. Manifest.db lost the supervision row."
        case .verificationSize(let actual, let recorded):
            return """
                Verification failed. The file is \(actual) bytes but Manifest.db records \
                \(recorded) bytes. Put the saved copy back.
                """
        }
    }
}
