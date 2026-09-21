import SwiftUI

/// What the "i" opens: the picture where one has been taken, and the words
/// under it.
///
/// It is a view of its own rather than the body of the popover so that
/// `--ui-smoke` can draw it, which is the only way to see it from a terminal.
struct InfoPopoverContent: View {
    /// How wide the popover reads at, which the picture is held to as well so
    /// the words below it run the same width.
    private static let width: CGFloat = 280

    let text: String
    var image: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let image, let url = InfoImage.url(named: image),
               let picture = NSImage(contentsOf: url) {
                Image(nsImage: picture)
                    .resizable()
                    .scaledToFit()
                    .frame(width: Self.width)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            Text(text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
                .frame(width: Self.width, alignment: .leading)
        }
        .padding(12)
    }
}
