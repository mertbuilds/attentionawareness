import Foundation

/// The words of the last screen: what the run set up, the one thing left to
/// do, and the two things somebody can do next.
///
/// Supervision is the title of that screen, so nothing here repeats it. The
/// result line is worked out from the profile the person built: how many apps
/// it hides and how many websites it blocks.
///
/// Nothing here reaches an iPhone or a window, so the tests read every line of
/// it.
enum DoneCopy {
    /// What the profile took away, in the person's own numbers. Both counts
    /// where it hides apps and blocks sites, one clause where it does only one,
    /// and a plain line where a stripped-down profile does neither.
    static func result(apps: Int, sites: Int) -> String {
        switch (apps, sites) {
        case (0, 0):
            return "Your restrictions are on."
        case (_, 0):
            return "\(count(apps, "app")) \(verb(apps)) blocked."
        case (0, _):
            return "\(count(sites, "website")) \(verb(sites)) blocked."
        default:
            return "\(count(apps, "app")) and \(count(sites, "website")) are blocked."
        }
    }

    /// The title of the last screen after a run that took supervision off,
    /// which only the debug `--debug-unsupervise` flag starts.
    static let unsupervisedTitle = "iPhone Is No Longer Supervised"

    /// The one practical thing left to do.
    static let disconnect = "You can disconnect iPhone."

    /// The heading over the two things somebody can do after the run.
    static let next = "Next"

    /// The first of them: the same blocks on the computer.
    static let browserExtension = "Block the same feeds on your computer"
    static let getBrowserExtension = "Get the Browser Extension"

    /// The second: the app costs nothing, and there are two ways to give
    /// something back.
    static let support = "The app is free. If it helps you, you can support the work."
    static let supportThisProject = "Support This Project"
    static let share = "Share"

    /// Where to look on the iPhone for what the run set up, in one line. The
    /// smoke harness draws the info popover from it, picture and words both.
    static var note: String {
        "Settings shows 'This iPhone is supervised' at the top."
    }

    /// A number and the thing it counts, in whole words, because the copy
    /// never abbreviates a unit.
    private static func count(_ value: Int, _ unit: String) -> String {
        "\(value) \(unit)\(value == 1 ? "" : "s")"
    }

    private static func verb(_ value: Int) -> String {
        value == 1 ? "is" : "are"
    }
}
