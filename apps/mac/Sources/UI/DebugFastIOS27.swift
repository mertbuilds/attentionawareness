#if DEBUG
import Foundation

/// `--debug-fast-ios27` (Debug builds only) lets the fast method run on iOS
/// 27 and later, and on an iPhone that gives no version, for a test on an
/// empty test iPhone. There the run is not yet confirmed to keep the data.
/// Connect skips the manual guide for such an iPhone and offers Continue. It
/// combines with `--debug-unsupervise`.
/// `WizardModel.allowsFastOnAnyIOS` is the one value it sets.
enum DebugFastIOS27 {
    static let flag = "--debug-fast-ios27"
    /// What the window shows over every step while the flag is on.
    static let label = "Debug: Fast is allowed on iOS 27. It can erase iPhone."

    static var isOn: Bool { CommandLine.arguments.contains(flag) }

    /// Say once at launch that the flag is on, in Terminal and in the log.
    static func announceIfAsked() {
        guard isOn else { return }
        let line = "debug-fast-ios27: this launch lets Fast run on iOS 27 and later and on an unknown version"
        print(line)
        DeviceLog.logger.notice("\(line, privacy: .public)")
    }
}
#endif
