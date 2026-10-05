import Foundation

/// Which iPhones the app supervises, from the iOS version they report.
///
/// iOS 26 and earlier run the fast method. iOS 27 and later get no run in a
/// Release build, and neither does an iPhone whose version cannot be read: on
/// an iPhone SE with iOS 27.2 our earlier run (the restore with system files
/// and `--no-reboot`, then our own restart) finished with no error and the
/// iPhone came back erased and not supervised. Those iPhones are sent to the
/// manual guide.
///
/// iOS 27 takes the cloud configuration only live, so a run there owes one
/// more step: the same configuration sent live while iPhone is on the Restore
/// Completed screen (`needsLiveConfiguration`). On 2026-10-05 this app ran the
/// step on that iPhone SE with iOS 27.2: the restore restarted iPhone itself,
/// the setting was acknowledged and read back, and iPhone still came back
/// erased. That restore sent system files, so `--no-reboot` was not the cause
/// of the erase: a restore with system files erases there with or without
/// it. Another tool supervised that same iPhone and kept its data with a
/// restore that sends no system files and removes the items it does not
/// restore, from a seed that holds the supervision domain alone. `SeedMode`
/// now sends the same. With this app that is not yet confirmed to keep the
/// data. Only the debug `--debug-fast-ios27` flag reaches the step, until a
/// run of this app on a device confirms it.
///
/// Nothing here touches the iPhone, a backup or the window, which is why the
/// tests can run it.
enum IOSSupport {
    /// Why an iPhone gets no run.
    enum Refusal: Equatable {
        /// iOS 27 or later.
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
                    + "On iOS \(IOSSupport.firstUnsupportedMajorVersion), a run can erase iPhone. "
                    + "To read it again, unplug iPhone and plug it back in. "
                    + manual
            }
        }
    }

    /// The newest major version of iOS the app runs on. There is no oldest
    /// one: every version that reads as 26 or earlier is let through.
    static let newestSupportedMajorVersion = 26

    static var firstUnsupportedMajorVersion: Int { newestSupportedMajorVersion + 1 }

    /// Nil when the app runs on the version the iPhone reports, such as
    /// `26.2.1`, and why not otherwise. A version that is missing or does not
    /// read is never taken for an earlier one.
    static func refusal(iosVersion: String?) -> Refusal? {
        guard let major = majorVersion(of: iosVersion) else { return .iosVersionUnknown }
        return major <= newestSupportedMajorVersion ? nil : .iosNotSupportedYet
    }

    /// The refusal a run is held to. `allowsAnyIOS` is the debug
    /// `--debug-fast-ios27` flag (`DebugFastIOS27`), always false in Release:
    /// with it nothing is refused.
    static func refusal(iosVersion: String?, allowsAnyIOS: Bool) -> Refusal? {
        allowsAnyIOS ? nil : refusal(iosVersion: iosVersion)
    }

    /// Whether a run on this version has to send the configuration live after
    /// the restore: iOS 27 and later. A version that does not read needs none.
    static func needsLiveConfiguration(iosVersion: String?) -> Bool {
        guard let major = majorVersion(of: iosVersion) else { return false }
        return major > newestSupportedMajorVersion
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
    /// Why: on iOS 27.2 a restore with system files erased iPhone in our
    /// device test on 2026-10-05. This option set and this seed are the ones
    /// confirmed to keep the data on that iPhone with another tool. With this
    /// app that is not yet confirmed.
    case live

    init(iosVersion: String?) {
        self = IOSSupport.needsLiveConfiguration(iosVersion: iosVersion) ? .live : .restored
    }

    /// The restore options this mode sends, for the log.
    var restoreOptionsLogText: String {
        switch self {
        case .restored: "system files, no remove, no reboot"
        case .live: "no system files, remove, reboot"
        }
    }
}
