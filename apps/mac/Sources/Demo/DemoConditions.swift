import Foundation

/// What the demo pretends is true about the world.
///
/// The wizard reads three things it cannot be given in a demo: the iPhones on
/// the cable, what this Mac already holds for them, and how a transfer ends.
/// Every one of those answers comes from here, so the reader can put the
/// window into a state a real run only reaches by luck: no phone on the cable,
/// two of them, a phone that is already supervised, a folder that cannot be
/// used, a transfer that fails.
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

    /// What this Mac already holds for the iPhone the run is about, which is
    /// the whole of what the Back up step offers.
    enum Holding: String, CaseIterable, Identifiable {
        /// Nothing, so the step is the hour on the cable it has always been.
        case nothing
        /// A whole backup, which the step offers instead of another hour.
        case whole
        /// A folder the iPhone never finished writing, which cannot be used.
        case unfinished

        var id: String { rawValue }

        var title: String {
            switch self {
            case .nothing: return "None"
            case .whole: return "Whole"
            case .unfinished: return "Unfinished"
            }
        }

        /// True while the folder is one a run can be built on. An unfinished
        /// folder is listed and explained, never offered.
        var isUsable: Bool { self == .whole }
    }

    /// How the next transfer or profile install ends. It is the one condition
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

        /// True for an outcome that stops a transfer part way through.
        var stopsPartWay: Bool { self != .succeeds }
    }

    var phones: Phones = .one
    var findMyOn = false
    /// The iPhone encrypts what it backs up, which is what makes the wizard
    /// ask for a backup password.
    var backupsEncrypted = false
    var supervised = false
    /// A profile of ours is already on the phone, which is what the Profile
    /// step asks about before it offers to install another.
    var profileInstalled = false
    var holding: Holding = .nothing
    var outcome: Outcome = .succeeds

    /// The world as it is once a restore has gone through: the phone says what
    /// the run asked it to say, and this Mac is holding the backup the run
    /// made.
    func afterRestore(target: Bool) -> DemoConditions {
        var next = self
        next.supervised = target
        next.holding = .whole
        return next
    }

    /// The world as it is once a profile has been installed.
    func afterProfileInstall() -> DemoConditions {
        var next = self
        next.profileInstalled = true
        return next
    }
}
