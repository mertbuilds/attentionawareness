#if DEBUG
import Foundation

/// `--debug-fast-any-ios` (Debug builds only) lets the fast method run on a
/// version the app refuses: one newer than the newest it runs on, and an
/// iPhone that gives no version, for a test on a test iPhone. Use an iPhone
/// whose data can be lost: no such version is tested (`IOSSupport`).
/// An iPhone whose version does not read takes the old mode
/// (`SeedMode.restored`), which sends system files, and system files lost
/// data on iOS 27.2.
/// Connect skips the manual guide for such an iPhone and offers Continue. It
/// combines with `--debug-unsupervise`.
/// `WizardModel.allowsFastOnAnyIOS` is the one value it sets.
enum DebugFastAnyIOS {
    static let flag = "--debug-fast-any-ios"
    /// What the window shows over every step while the flag is on.
    static let label = "Debug: Fast is allowed on every iOS version. It can lose data."

    static var isOn: Bool { CommandLine.arguments.contains(flag) }

    /// Say once at launch that the flag is on, in Terminal and in the log.
    static func announceIfAsked() {
        guard isOn else { return }
        let line = "debug-fast-any-ios: this launch lets Fast run on every iOS version and on an unknown version"
        print(line)
        DeviceLog.logger.notice("\(line, privacy: .public)")
    }
}
#endif
