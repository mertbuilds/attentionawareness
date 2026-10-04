import Foundation

/// The body of the last screen: a line for what the run set up, and the one
/// closing sentence the whole thing is for.
///
/// Supervision is confirmed on the screen before this one, so nothing here
/// repeats it. What it does say is worked out from the profile the person
/// built: how many apps it hides and how many websites it blocks.
///
/// Nothing here reaches an iPhone or a window, so the tests read every line of
/// it.
enum DoneCopy {
    /// The two plain lines the screen opens with: what the profile took away,
    /// and the one practical thing left to do. The extension line, the share
    /// line and the closing line are the view's, because each carries a link or
    /// a weight a plain string can't.
    static func lines(apps: Int, sites: Int) -> [String] {
        [
            blocked(apps: apps, sites: sites),
            "You can disconnect iPhone.",
        ]
    }

    /// What the profile took away, in the person's own numbers. Both counts
    /// where it hides apps and blocks sites, one clause where it does only one,
    /// and a plain reassurance where a stripped-down profile does neither.
    private static func blocked(apps: Int, sites: Int) -> String {
        switch (apps, sites) {
        case (0, 0):
            return "Your restrictions are on."
        case (_, 0):
            return "You blocked \(count(apps, "app"))."
        case (0, _):
            return "You blocked \(count(sites, "website"))."
        default:
            return "You blocked \(count(apps, "app")) and \(count(sites, "website"))."
        }
    }

    /// The last line of the body, the one the whole run is for. The view gives
    /// it the weight the practical lines above it don't carry.
    static let closing = "Your future self will thank you."

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
}
