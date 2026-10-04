import Foundation

/// The pictures the "i" popovers show, and the names they go under.
///
/// A picture is a screenshot of an iPhone dropped into `Resources/Images/`,
/// and that is the whole of adding one: the popover asks the bundle for a name
/// and shows whatever it finds.
///
/// Nothing here opens a window, so the tests read it.
enum InfoImage {
    /// What the picture beside a claim about the iPhone is called. It settles
    /// the one line Settings grows: what the top of Settings says once the run
    /// is over.
    static var checking: String { "check-supervised" }

    /// What the film of turning the downloaded profile on is called. It goes
    /// beside the "Finish on iPhone" steps, and until somebody drops one in the
    /// bundle under this name the popover shows the words alone.
    static var installProfile: String { "install-profile" }

    /// The file of that name in the bundle, `.png` first and `.jpg` after it,
    /// or nil where nobody has taken one. The nil is the whole of the
    /// handling: a popover with no picture shows its words and says nothing
    /// about what is missing.
    static func url(named name: String, in bundle: Bundle = .main) -> URL? {
        for ext in ["png", "jpg"] {
            if let url = bundle.url(forResource: name, withExtension: ext, subdirectory: folder) {
                return url
            }
            if let url = bundle.url(forResource: name, withExtension: ext) {
                return url
            }
        }
        return nil
    }

    /// Where the pictures sit inside the app, which is the folder as it is in
    /// the repository: the target carries it whole rather than file by file,
    /// so a new screenshot needs no project change.
    private static let folder = "Images"
}
