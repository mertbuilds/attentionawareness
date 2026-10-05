#if DEBUG
import Foundation

/// What the demo pretends is true about the world.
///
/// The wizard reads two things it cannot be given in a demo: the iPhones on
/// the cable and how a restore ends. Every one of those answers comes from
/// here, so the reader can put the window into a state a real run only
/// reaches by luck: no phone on the cable, two of them, a phone that is
/// already supervised, one on iOS 27, a restore that fails.
///
/// Nothing here reads an iPhone, a disk or a network, which is why it is the
/// part of the demo the tests can run.
struct DemoConditions: Equatable {
    /// How many iPhones the demo says are on the cable.
    enum Phones: String, CaseIterable, Identifiable {
        case none
        case one
        case two

        var id: String { rawValue }

        var count: Int {
            switch self {
            case .none: return 0
            case .one: return 1
            case .two: return 2
            }
        }

        /// The word the demo bar puts on the button.
        var title: String {
            switch self {
            case .none: return "None"
            case .one: return "One"
            case .two: return "Two"
            }
        }
    }

    /// What the iPhone says about its own iCloud backups, which is the first
    /// thing the checks tell the reader about: the way back they have that is
    /// nothing to do with this app.
    enum CloudBackups: String, CaseIterable, Identifiable {
        case recent
        case old
        case off

        var id: String { rawValue }

        var title: String {
            switch self {
            case .recent: return "Recent"
            case .old: return "Old"
            case .off: return "Off"
            }
        }
    }

    /// What Finder's own backup folder on this Mac says about the same iPhone.
    /// The last two are the refusal a reader cannot be prompted out of: macOS
    /// offers no way to ask for Full Disk Access, so the checks ask in words
    /// and open the list in System Settings, and a switch turned on while the
    /// app runs may only count once the app is opened again.
    enum FinderBackups: String, CaseIterable, Identifiable {
        case onThisMac
        case nothingHere
        /// Refused, before any trip to System Settings.
        case noAccess
        /// Still refused after a trip to System Settings, which is the state
        /// that asks for the app to be reopened.
        case needsReopen

        var id: String { rawValue }

        var title: String {
            switch self {
            case .onThisMac: return "On this Mac"
            case .nothingHere: return "None"
            case .noAccess: return "No access"
            case .needsReopen: return "Reopen"
            }
        }
    }

    /// The iOS version the demo iPhone says it runs. iOS 27 and a version
    /// that does not read put the manual guide on Connect in place of
    /// Continue.
    enum IOS: String, CaseIterable, Identifiable {
        case ios26
        case ios27
        case unknown

        var id: String { rawValue }

        var title: String {
            switch self {
            case .ios26: return "26"
            case .ios27: return "27"
            case .unknown: return "Unread"
            }
        }

        /// What the iPhone reports, or nil for one that reports nothing.
        var version: String? {
            switch self {
            case .ios26: return "26.6.2"
            case .ios27: return "27.2"
            case .unknown: return nil
            }
        }
    }

    /// How the next restore or profile install ends. It is the one condition
    /// that is about what the demo does rather than about what it says is
    /// there, and it is here so the error wording can be read without a phone
    /// going wrong.
    enum Outcome: String, CaseIterable, Identifiable {
        case succeeds
        case fails
        case cancelled

        var id: String { rawValue }

        var title: String {
            switch self {
            case .succeeds: return "Succeeds"
            case .fails: return "Fails"
            case .cancelled: return "Cancelled"
            }
        }

        /// True for an outcome that stops a restore part way through.
        var stopsPartWay: Bool { self != .succeeds }
    }

    var phones: Phones = .one
    var ios: IOS = .ios26
    var findMyOn = false
    var cloudBackups: CloudBackups = .recent
    var finderBackups: FinderBackups = .nothingHere
    var supervised = false
    /// A profile of ours is already on the phone, which is what the Profile
    /// step asks about before it offers to install another.
    var profileInstalled = false
    /// The next job runs for minutes rather than seconds, so the cost story
    /// under the bar can be watched from its first slide to its last.
    var longJob = false
    var outcome: Outcome = .succeeds

    /// The world as it is once a restore has gone through: the phone says what
    /// the run asked it to say.
    func afterRestore(target: Bool) -> DemoConditions {
        var next = self
        next.supervised = target
        return next
    }

    /// The world as it is once a profile has been installed.
    func afterProfileInstall() -> DemoConditions {
        var next = self
        next.profileInstalled = true
        return next
    }
}
#endif
