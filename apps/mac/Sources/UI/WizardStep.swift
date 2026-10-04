import Foundation

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
    /// The Profiles screen for a phone that is already supervised: what is
    /// installed now, and the builder to add another over the cable. It is
    /// reached from Connect rather than walked to, so it is left out of `steps`
    /// and has no next or previous of its own.
    case profiles

    /// The supervise run, in the order the window walks it. `next` and
    /// `previous` follow this list and nothing else, so no step can be skipped
    /// by accident. `.profiles` is not one of these: it is a standalone
    /// destination off Connect for a phone that is supervised already.
    static let steps: [WizardStep] = [.connect, .ready, .job, .restrictions, .done]

    /// The step after this one, or nil at the end of the run and for a step
    /// that is not part of it.
    var next: WizardStep? {
        guard let index = Self.steps.firstIndex(of: self), index + 1 < Self.steps.count else { return nil }
        return Self.steps[index + 1]
    }

    /// The step before this one, or nil at the start of the run and for a step
    /// that is not part of it.
    var previous: WizardStep? {
        guard let index = Self.steps.firstIndex(of: self), index > 0 else { return nil }
        return Self.steps[index - 1]
    }

    /// Whether stepping back from here changes nothing on the iPhone or in the
    /// backup. The job has the iPhone from the moment it starts, so it offers
    /// no way back at all. The Profiles screen is not a run, so stepping back
    /// from it only returns to Connect.
    var allowsBack: Bool {
        switch self {
        case .connect, .job, .done:
            return false
        case .ready, .restrictions, .profiles:
            return true
        }
    }

    /// The heading the screen carries. Title Case, like a window title.
    var title: String {
        switch self {
        case .connect:
            return "Connect iPhone to This Mac"
        case .ready:
            return "Ready to Supervise"
        case .job:
            return "Supervising iPhone"
        case .restrictions:
            return "Choose Restrictions"
        case .done:
            return "iPhone Is Supervised"
        case .profiles:
            return "Manage Restrictions"
        }
    }
}
