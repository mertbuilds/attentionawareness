import Foundation

/// The body of the last screen, in one or two short sentences.
///
/// Three answers decide all of it: which way the run went, whether the iPhone
/// came back saying what was asked of it, and whether Find My is still off.
/// Everything else that screen knows is already in its title, so there is
/// nothing here about the copy, the restore or the profile.
///
/// Nothing here reaches an iPhone or a window, so the tests read every line of
/// it.
enum DoneCopy {
    /// The body, top to bottom.
    ///
    /// Both directions read the same. The title says which way the run went,
    /// and a body that said it again would be the screen saying one thing
    /// twice.
    static func lines(direction: WizardDirection, findMyOff: Bool, matched: Bool) -> [String] {
        var lines = [
            matched
                ? "You can disconnect iPhone."
                : "iPhone didn't report the change. Check the top of Settings.",
        ]
        // The run asked for Find My to be turned off so the iPhone would take
        // the copy back, and nothing turns it on again. A phone that already
        // says it is on is left alone, and so is one that will not say.
        if findMyOff {
            lines.append("Turn Find My iPhone back on in Settings.")
        }
        return lines
    }

    /// What the "i" beside the title holds: where to look on the iPhone for
    /// the thing the title claims. It is the slot the film goes in.
    static func note(direction: WizardDirection) -> String {
        direction == .supervise
            ? "Settings shows 'This iPhone is supervised' at the top."
            : "That line is gone from the top of Settings."
    }
}
