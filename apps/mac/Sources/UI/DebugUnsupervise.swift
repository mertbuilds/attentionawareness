#if DEBUG
import Foundation

/// `--debug-unsupervise` (Debug builds only) turns the run round. It is the
/// usual run, backup first, then the chosen method, the restore and the
/// restart, but the flag it writes takes supervision off. That is for
/// testing the supervise run many times on one iPhone without erasing it:
/// a launch with the flag takes supervision off, the next one without it
/// puts it back. `WizardModel.supervises` is the one value it sets.
enum DebugUnsupervise {
    static let flag = "--debug-unsupervise"
    /// What the window shows over every step while the flag is on.
    static let label = "Debug: this run removes supervision from iPhone."

    static var isOn: Bool { CommandLine.arguments.contains(flag) }

    /// Say once at launch that the flag is on, in Terminal and in the log.
    static func announceIfAsked() {
        guard isOn else { return }
        let line = "debug-unsupervise: this launch takes supervision off iPhone instead of putting it on"
        print(line)
        DeviceLog.logger.notice("\(line, privacy: .public)")
    }
}
#endif
