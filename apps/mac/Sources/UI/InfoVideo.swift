import Foundation

/// The films the "i" popovers play, and the names they go under.
///
/// A film is a screen recording of an iPhone dropped into
/// `Resources/Videos/`, and that is the whole of adding one: the popover asks
/// the bundle for a name and plays whatever it finds. Until a file of that
/// name is there the popover is its words alone, which is what ships today.
///
/// Nothing here opens a window, so the tests read it.
enum InfoVideo {
    /// What the film beside a claim about the iPhone is called, each way a run
    /// can go. Both answer the same question: what the top of Settings says
    /// once the run is over.
    static func checking(_ direction: WizardDirection) -> String {
        direction == .supervise ? "check-supervised" : "check-unsupervised"
    }

    /// The file of that name in the bundle, `.mp4` first and `.mov` after it,
    /// or nil where nobody has recorded one. The nil is the whole of the
    /// handling: a popover with no film shows its words and says nothing about
    /// what is missing.
    static func url(named name: String, in bundle: Bundle = .main) -> URL? {
        for ext in ["mp4", "mov"] {
            if let url = bundle.url(forResource: name, withExtension: ext, subdirectory: folder) {
                return url
            }
            if let url = bundle.url(forResource: name, withExtension: ext) {
                return url
            }
        }
        return nil
    }

    /// Where the films sit inside the app, which is the folder as it is in the
    /// repository: the target carries it whole rather than file by file, so a
    /// new recording needs no project change.
    private static let folder = "Videos"
}
