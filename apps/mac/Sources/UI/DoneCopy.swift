import Foundation

/// The body of the last screen, in one short sentence.
///
/// One answer decides it: whether the iPhone came back saying what was asked
/// of it. Everything else that screen knows is already in its title, so there
/// is nothing here about the copy, the restore or the profile.
///
/// Nothing here reaches an iPhone or a window, so the tests read every line of
/// it.
enum DoneCopy {
    /// The body, top to bottom.
    static func lines(matched: Bool) -> [String] {
        [
            matched
                ? "You can disconnect iPhone."
                : "iPhone didn't report the change. Check the top of Settings.",
        ]
    }

    /// What the "i" beside the title holds: where to look on the iPhone for
    /// the thing the title claims. It is the slot the film goes in.
    static var note: String {
        "Settings shows 'This iPhone is supervised' at the top."
    }
}
