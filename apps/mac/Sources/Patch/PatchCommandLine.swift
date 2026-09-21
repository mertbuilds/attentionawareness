import Foundation

/// The hidden `--patch <backup folder>` command line path.
///
/// It loads a backup folder, plans the change, applies it and checks it, and
/// prints every step, which is how the patch layer is checked against a real
/// backup from a terminal:
///
/// ```sh
/// "attention awareness.app/Contents/MacOS/attention awareness" \
///   --patch ~/Library/Application\ Support/attention\ awareness/Backups/<udid>
/// ```
///
/// The backup password, when the backup is encrypted, comes from the
/// `BACKUP_PASSWORD` environment variable, so it stays out of the shell history
/// and out of `ps`. Nothing is sent to an iPhone.
enum PatchCommandLine {
    static let flag = "--patch"

    static let usage = """
        usage: attention awareness --patch <backup folder>
        The backup password, if the backup is encrypted, comes from BACKUP_PASSWORD.
        """

    /// Patch the backup and exit. Comes back only when the arguments are about
    /// something else.
    static func runIfAsked(_ arguments: [String] = CommandLine.arguments) {
        guard let index = arguments.firstIndex(of: flag) else { return }
        guard arguments.count > index + 1 else {
            print(usage)
            exit(2)
        }
        // stdout is a pipe as often as it is a terminal, and a pipe holds every
        // line back until the buffer fills.
        setvbuf(stdout, nil, _IOLBF, 0)
        exit(run(at: URL(fileURLWithPath: arguments[index + 1])))
    }

    private static func run(at url: URL) -> Int32 {
        do {
            let backup = try BackupFolder.load(at: url)
            print("\(backup.deviceName), iOS \(backup.iosVersion), \(backup.isEncrypted ? "encrypted" : "plain")")
            if backup.isEncrypted {
                guard let password = ProcessInfo.processInfo.environment["BACKUP_PASSWORD"] else {
                    print("This backup is encrypted. Put its password in BACKUP_PASSWORD.")
                    return 1
                }
                print("Deriving the backup keys, up to ten seconds")
                try backup.unlock(password: password)
            }
            print("IsSupervised before: \(SupervisionPatch.label(backup.isSupervised))")

            let plan = try SupervisionPatch.plan(backup: backup)
            guard !plan.isEmpty else {
                print("Nothing to change. The backup already says true.")
                return 0
            }
            for change in plan.changes {
                print("  \(change)")
            }

            let patch = SupervisionPatch(backup: backup)
            let pristine = try patch.apply(plan)
            print("The untouched copy is at \(pristine.path)")
            let size = try patch.verify()
            print("IsSupervised after: \(SupervisionPatch.label(try backup.supervisionState())), \(size) bytes")
            return 0
        } catch {
            print(error.localizedDescription)
            return 1
        }
    }
}
