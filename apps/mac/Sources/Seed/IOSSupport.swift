import Foundation

/// Which iPhones the app supervises, from the iOS version they report.
///
/// iOS 27 and earlier run the fast method. iOS 28 and later get no run, and
/// neither does an iPhone whose version cannot be read: the app has not been
/// tested there. Those iPhones are sent to the manual guide.
///
/// Apple's deployment guide says that on iOS 27 a restore does not bring
/// supervision or management back. So we expect iOS 27 to take the cloud
/// configuration only live, and a run there owes one more step: the same
/// configuration sent live after the restore restarted iPhone
/// (`needsLiveConfiguration`). No run of ours tests this alone.
///
/// Device results, 2026-10-05, one iPhone SE (2nd generation) on iOS 27.2,
/// this app's Debug build. The set `SeedMode.live` sends (no system files,
/// remove, no setup file, the restore restarts iPhone) kept all data, in a
/// run that supervised and in a run that took supervision off. Each other
/// run changed one setting:
/// - No remove, supervise: photos, apps and the Apple account kept.
/// - Setup file in the seed, unsupervise: all data kept.
/// - System files, unsupervise: the Apple account was signed out and the
///   photos were gone. Apps and Safari tabs stayed.
/// So system files (`RestoreSystemFiles` true) is what loses data on iOS 27.
/// Remove and the setup file do not lose data. Who restarts iPhone was not
/// tested alone: both runs with system files lost data, one with each way of
/// restarting. An earlier run that day with system files, no remove and the
/// setup file lost data too.
///
/// Not tested: other iPhone models, iOS 27.0.x, and iOS 26 on a device after
/// this change, whose code path is untouched.
///
/// Nothing here touches the iPhone, a backup or the window, which is why the
/// tests can run it.
enum IOSSupport {
    /// Why an iPhone gets no run.
    enum Refusal: Equatable {
        /// A version newer than the newest one the app runs on.
        case iosNotSupportedYet
        /// The iPhone gave no version, or one that does not read as one.
        case iosVersionUnknown

        /// One line for a failure or a check: why the app does not run.
        var message: String {
            switch self {
            case .iosNotSupportedYet:
                return "This app cannot supervise iOS \(IOSSupport.firstUnsupportedMajorVersion) or later yet."
            case .iosVersionUnknown:
                return "This app could not read the iOS version of this iPhone."
            }
        }

        /// The title of the screen that shows in place of the run.
        var title: String {
            switch self {
            case .iosNotSupportedYet:
                return "iOS \(IOSSupport.firstUnsupportedMajorVersion) Is Not Supported Yet"
            case .iosVersionUnknown:
                return "Couldn't Read the iOS Version"
            }
        }

        /// What that screen says, ending on the manual way the guide shows
        /// and the profile builder that saves making the profile by hand.
        var guide: String {
            let manual = "You can still supervise it by hand with Apple Configurator. "
                + "That way erases iPhone, so back up first. "
                + "You do not need to make the profile in Configurator. "
                + "The profile builder on the site makes it for you, for free."
            switch self {
            case .iosNotSupportedYet:
                return "This app cannot supervise an iPhone on iOS \(IOSSupport.firstUnsupportedMajorVersion) yet. "
                    + manual
            case .iosVersionUnknown:
                return "This app could not read the iOS version of this iPhone, so it does not supervise it. "
                    + "This app has not been tested on iOS \(IOSSupport.firstUnsupportedMajorVersion) or later, so it needs the version before it runs. "
                    + "To read it again, unplug iPhone and plug it back in. "
                    + manual
            }
        }
    }

    /// The newest major version of iOS the app runs on. There is no oldest
    /// one: every version that reads as 27 or earlier is let through.
    static let newestSupportedMajorVersion = 27

    static var firstUnsupportedMajorVersion: Int { newestSupportedMajorVersion + 1 }

    /// The first major version of iOS that we expect to take the cloud
    /// configuration only live. Apple's deployment guide says a restore there
    /// does not bring supervision or management back.
    static let firstLiveConfigurationMajorVersion = 27

    /// Nil when the app runs on the version the iPhone reports, such as
    /// `26.2.1`, and why not otherwise. A version that is missing or does not
    /// read is never taken for an earlier one.
    static func refusal(iosVersion: String?) -> Refusal? {
        guard let major = majorVersion(of: iosVersion) else { return .iosVersionUnknown }
        return major <= newestSupportedMajorVersion ? nil : .iosNotSupportedYet
    }

    /// The refusal a run is held to. `allowsAnyIOS` is the debug
    /// `--debug-fast-any-ios` flag (`DebugFastAnyIOS`), always false in Release:
    /// with it nothing is refused.
    static func refusal(iosVersion: String?, allowsAnyIOS: Bool) -> Refusal? {
        allowsAnyIOS ? nil : refusal(iosVersion: iosVersion)
    }

    /// Whether a run on this version has to send the configuration live after
    /// the restore: iOS 27 and later. A version that does not read needs none.
    static func needsLiveConfiguration(iosVersion: String?) -> Bool {
        guard let major = majorVersion(of: iosVersion) else { return false }
        return major >= firstLiveConfigurationMajorVersion
    }

    /// The first number of a version, compared as a number. Every part has
    /// to be digits and nothing else, and no iPhone runs a version 0, so
    /// anything short of that is no version at all.
    static func majorVersion(of version: String?) -> Int? {
        guard let version else { return nil }
        let parts = version.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.allSatisfy({ part in !part.isEmpty && part.allSatisfy { $0.isASCII && $0.isNumber } }),
              let major = Int(parts[0]),
              major > 0
        else {
            return nil
        }
        return major
    }
}

/// The two ways a seed run goes. The iOS version decides, and the seed, the
/// restore options and who restarts iPhone all follow this one value.
enum SeedMode: Equatable {
    /// iOS 26 and earlier. The seed holds the configuration and the setup
    /// state, the restore sends system files and does not restart iPhone, and
    /// the app restarts it.
    case restored
    /// iOS 27 and later. The seed holds the supervision domain alone, the
    /// restore sends no system files, removes the items it does not restore
    /// and restarts iPhone itself, and the configuration is sent live after.
    ///
    /// Why: on iOS 27.2 a restore with system files lost data in our device
    /// runs on 2026-10-05, and this option set and this seed kept all data
    /// there with this app. The results are at `IOSSupport`.
    case live

    init(iosVersion: String?) {
        self = IOSSupport.needsLiveConfiguration(iosVersion: iosVersion) ? .live : .restored
    }

    /// What a run in this mode sends.
    var settings: SeedSettings {
        switch self {
        case .restored:
            SeedSettings(systemFiles: true, remove: false, setupFile: true, reboot: false)
        case .live:
            SeedSettings(systemFiles: false, remove: true, setupFile: false, reboot: true)
        }
    }
}

/// What one seed run sends: the three restore and seed settings the two
/// modes differ in, and who restarts iPhone.
struct SeedSettings: Equatable {
    /// The restore sends system files (`--system`).
    var systemFiles: Bool
    /// The restore removes the items it does not restore (`--remove`).
    var remove: Bool
    /// The seed holds the setup records and the setup file.
    var setupFile: Bool
    /// The restore restarts iPhone itself.
    var reboot: Bool

    /// The values of this run, for the log.
    var logText: String {
        func word(_ value: Bool) -> String { value ? "yes" : "no" }
        return "system files \(word(systemFiles)), remove \(word(remove)), "
            + "setup file \(word(setupFile)), reboot \(word(reboot))"
    }
}
