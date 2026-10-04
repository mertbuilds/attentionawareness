import Foundation

/// The hidden hardware-check flag follows the backup CLI's run-loop pattern.
enum SeedCommandLine {
    @MainActor
    static func runIfAsked(_ arguments: [String] = CommandLine.arguments) {
        guard let index = arguments.firstIndex(of: "--seed") else { return }
        guard arguments.count == index + 2, !arguments[index + 1].isEmpty else {
            print("Usage: attention awareness --seed <udid>")
            exit(2)
        }
        setvbuf(stdout, nil, _IOLBF, 0)
        let backup = BackupEngine()
        let engine = SeedEngine(backupEngine: backup)
        let state = RunState()
        let phases = engine.$phase.sink { print(String(describing: $0)) }
        let transfers = backup.$phase.sink { print($0.summary) }
        signal(SIGINT, { _ in })
        let interrupts = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
        interrupts.setEventHandler { Task { @MainActor in engine.cancel() } }
        interrupts.resume()
        Task { @MainActor in
            do {
                try await engine.supervise(udid: arguments[index + 1])
                print("Restart requested. Keep iPhone connected and check supervision after it returns.")
                state.code = 0
            } catch {
                print(error.localizedDescription)
                if engine.restoreApplied { print("The configuration was already restored; do not repeat the restore just to restart.") }
            }
            state.finished = true
        }
        while !state.finished {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
        }
        for line in backup.log.suffix(20) { print("  \(line)") }
        interrupts.cancel()
        phases.cancel()
        transfers.cancel()
        exit(state.code)
    }

    @MainActor
    private final class RunState {
        var finished = false
        var code: Int32 = 1
    }
}
