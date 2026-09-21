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
    case ready
    /// The copy, the patch and the restore, which are one piece of work for
    /// the person waiting on them and so one screen.
    case job
    case restrictions
    case done

    /// The steps one direction shows. Unsupervising installs no profile, so it
    /// is four screens rather than five.
    static func steps(for direction: WizardDirection) -> [WizardStep] {
        allCases.filter { $0.belongs(to: direction) }
    }

    /// False for a step the direction leaves out.
    func belongs(to direction: WizardDirection) -> Bool {
        self != .restrictions || direction == .supervise
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

    /// Whether stepping back from here changes nothing on the iPhone or in the
    /// backup. The job has the phone from the moment it starts, so it offers
    /// no way back at all.
    var allowsBack: Bool {
        switch self {
        case .connect, .job, .done:
            return false
        case .ready, .restrictions:
            return true
        }
    }

    /// The heading the screen carries. Title Case, like a window title, and it
    /// says which way the run is going wherever the two ways differ.
    func title(for direction: WizardDirection) -> String {
        switch self {
        case .connect:
            return "Connect iPhone to This Mac"
        case .ready:
            return direction == .supervise ? "Ready to Supervise" : "Ready to Unsupervise"
        case .job:
            return direction == .supervise ? "Supervising iPhone" : "Unsupervising iPhone"
        case .restrictions:
            return "Choose Restrictions"
        case .done:
            return direction == .supervise ? "iPhone Is Supervised" : "iPhone Is No Longer Supervised"
        }
    }
}
