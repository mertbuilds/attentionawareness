import Combine
import Foundation

/// The hidden `--backup` and `--restore` command line paths.
///
/// They run the engine without the window and print every phase change, which
/// is how the backup layer is checked against a real iPhone from a terminal:
///
/// ```sh
/// "attention awareness.app/Contents/MacOS/attention awareness" --backup <udid> /tmp/aa-backup-test
/// ```
///
/// Ctrl+C cancels the run the same way the Cancel button does. The backup
/// password, when one is needed, comes from the `BACKUP_PASSWORD` environment
/// variable, so it stays out of the shell history and out of `ps`.
enum BackupCommandLine {
    enum Kind: String {
        case backup = "--backup"
        case restore = "--restore"
    }

    struct Request {
        let kind: Kind
        let udid: String
        let root: URL

        /// The backup folder itself, which is the udid folder under the root.
        var folder: URL { root.appendingPathComponent(udid) }
    }

    static let usage = """
        usage: attention awareness --backup <udid> <backup root>
               attention awareness --restore <udid> <backup root>
        The backup password, if the iPhone encrypts its backups, comes from BACKUP_PASSWORD.
        """

    /// Run the backup or the restore and exit. Comes back only when the
    /// arguments are about something else.
    @MainActor
    static func runIfAsked(_ arguments: [String] = CommandLine.arguments) {
        guard let index = arguments.firstIndex(where: { Kind(rawValue: $0) != nil }) else { return }
        guard let kind = Kind(rawValue: arguments[index]), arguments.count > index + 2 else {
            print(usage)
            exit(2)
        }
        // stdout is a pipe as often as it is a terminal, and a pipe holds
        // every line back until the buffer fills.
        setvbuf(stdout, nil, _IOLBF, 0)
        let request = Request(
            kind: kind,
            udid: arguments[index + 1],
            root: URL(fileURLWithPath: arguments[index + 2])
        )
        exit(run(request))
    }

    @MainActor
    private static func run(_ request: Request) -> Int32 {
        let engine = BackupEngine()
        let state = RunState()
        let phases = engine.$phase.sink { phase in
            let line = phase.summary
            guard line != state.lastLine else { return }
            state.lastLine = line
            print(line)
        }
        let interrupts = interruptSource(cancelling: engine)
        let password = ProcessInfo.processInfo.environment["BACKUP_PASSWORD"]

        Task { @MainActor in
            do {
                switch request.kind {
                case .backup:
                    let folder = try await engine.backup(
                        udid: request.udid,
                        into: request.root,
                        password: password
                    )
                    print("The backup is at \(folder.path)")
                case .restore:
                    try await engine.restore(
                        udid: request.udid,
                        from: request.folder,
                        password: password
                    )
                }
                state.code = 0
            } catch {
                print(error.localizedDescription)
                state.code = 1
            }
            state.finished = true
        }

        // The engine runs on the main actor, so the main run loop has to keep
        // turning for it to get anywhere.
        while !state.finished {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
        }

        for line in engine.log.suffix(20) {
            print("  \(line)")
        }
        interrupts.cancel()
        phases.cancel()
        return state.code
    }

    /// Ctrl+C asks the engine to cancel instead of ending this process, so the
    /// helper gets the chance to tell the iPhone to stop.
    ///
    /// The handler is a real handler and not `SIG_IGN` on purpose: a handled
    /// signal goes back to its default after `exec`, an ignored one stays
    /// ignored, and an iPhone helper that ignores SIGINT can never be
    /// cancelled.
    @MainActor
    private static func interruptSource(cancelling engine: BackupEngine) -> DispatchSourceSignal {
        signal(SIGINT, { _ in })
        let source = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
        source.setEventHandler {
            Task { @MainActor in engine.cancel() }
        }
        source.resume()
        return source
    }

    /// What the run loop waits for.
    @MainActor
    private final class RunState {
        var finished = false
        var code: Int32 = 1
        var lastLine: String?
    }
}
