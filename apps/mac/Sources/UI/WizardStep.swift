import Foundation

/// Which way a run is going. Both ways walk the same steps: the patch writes
/// the opposite flag, and only the supervise direction ends with a profile.
enum WizardDirection: String, Equatable {
    case supervise
    case unsupervise

    /// What `IsSupervised` has to say in the backup once the patch is done.
    var target: Bool { self == .supervise }
}

/// One screen of the wizard.
///
/// The order is fixed and `next` and `previous` are the only way through it,
/// so no step can be skipped by accident and the window always knows where it
/// is. Nothing here touches the iPhone, the backup or the window, which is why
/// it is the part of the wizard the tests can run.
enum WizardStep: String, CaseIterable, Equatable {
    case connect
    case checks
    case backUp
    case patch
    case restore
    case profile
    case done

    /// The steps one direction shows. Unsupervising installs no profile, so it
    /// is six steps rather than seven.
    static func steps(for direction: WizardDirection) -> [WizardStep] {
        allCases.filter { $0.belongs(to: direction) }
    }

    /// False for a step the direction leaves out.
    func belongs(to direction: WizardDirection) -> Bool {
        self != .profile || direction == .supervise
    }

    /// The step after this one, or nil at the end of the run.
    func next(in direction: WizardDirection) -> WizardStep? {
        let steps = Self.steps(for: direction)
        guard let index = steps.firstIndex(of: self), index + 1 < steps.count else { return nil }
        return steps[index + 1]
    }

    /// The step before this one, or nil at the start of the run.
    func previous(in direction: WizardDirection) -> WizardStep? {
        let steps = Self.steps(for: direction)
        guard let index = steps.firstIndex(of: self), index > 0 else { return nil }
        return steps[index - 1]
    }

    /// The small indicator over the title, as "2 of 7".
    func position(in direction: WizardDirection) -> String {
        let steps = Self.steps(for: direction)
        guard let index = steps.firstIndex(of: self) else { return "" }
        return "\(index + 1) of \(steps.count)"
    }

    /// Whether stepping back from here changes nothing on the iPhone or in the
    /// backup. A step that is running something hides the button anyway.
    var allowsBack: Bool {
        switch self {
        case .connect, .done:
            return false
        case .checks, .backUp, .patch, .restore, .profile:
            return true
        }
    }

    var title: String {
        switch self {
        case .connect: return "Connect"
        case .checks: return "Checks"
        case .backUp: return "Copy"
        case .patch: return "Patch"
        case .restore: return "Restore"
        case .profile: return "Profile"
        case .done: return "Done"
        }
    }
}
