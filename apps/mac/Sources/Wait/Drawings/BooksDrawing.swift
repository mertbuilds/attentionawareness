import SwiftUI

/// Book spines piling up on a shelf, a few bound in orange, one at a time at
/// first, then faster than they can be told apart, until the tower runs out
/// past the top edge and fades there.
///
/// A port of the site's books drawing, drawn in the site's 320 by 216 box and
/// scaled to fit. Everything on it is worked out from `elapsed`, so the clock
/// lives with the parent; past `duration` it stands piled high.
struct BooksDrawing: View {
    /// The whole pile, the site's `drawing.deck`.
    static let duration: TimeInterval = 4

    let elapsed: TimeInterval
    /// The number the drawing stands for. The pile is the same for any of
    /// them, as on the site.
    let amount: Int

    init(elapsed: TimeInterval, amount: Int = 5475) {
        self.elapsed = elapsed
        self.amount = amount
    }

    private static let box = CGSize(width: 320, height: 216)
    /// The shelf the tower stands on.
    private static let shelf = (left: 40.0, right: 280.0, y: 200.0)
    /// Each book's thickness, length and how far off the middle it lies, taken
    /// in turn from runs of different lengths, so no pattern shows in the pile.
    private static let thickness = [7.0, 5, 9, 6, 10, 5, 8]
    private static let length = [152.0, 124, 170, 136, 112, 160, 144, 128, 176, 118, 148]
    private static let shift = [-6.0, 4, -2, 9, -10, 2, 7, -4, 0, 11, -8, 3, -1]
    /// The books bound in orange, by their place up the tower.
    private static let orange: Set<Int> = [3, 10, 15, 21]
    /// The air between one book and the next, so every outline reads on its own.
    private static let gap = 1.5
    private static let corner = 1.5
    /// How far a book falls onto the pile, and how long it takes.
    private static let drop = 14.0
    private static let dropSeconds = 0.6
    /// Where a band or a title sits on a spine.
    private static let bandInset = 5.0
    private static let titleSpan = 0.15

    /// One book lying in the pile, spine out: its outline, what is drawn on
    /// its spine, and when it starts to drop.
    private struct Book {
        let outline: Path
        let detail: Path?
        let orange: Bool
        let lands: TimeInterval
    }

    /// The pile, from the shelf up, until a book crosses the top edge: the
    /// fade there hides where it stops, so it is never seen to end.
    private static let books: [Book] = {
        var shapes: [(outline: Path, detail: Path?, orange: Bool)] = []
        var floor = shelf.y - gap
        while floor > 0 {
            let index = shapes.count
            let height = thickness[index % thickness.count]
            let width = length[index % length.count]
            let x = box.width / 2 - width / 2 + shift[index % shift.count]
            let y = floor - height
            var detail: Path?
            switch index % 3 {
            case 1:
                var band = Path()
                for at in [x + bandInset, x + width - bandInset] {
                    band.move(to: CGPoint(x: at, y: y + corner))
                    band.addLine(to: CGPoint(x: at, y: y + height - corner))
                }
                detail = band
            case 2:
                let middle = x + width / 2
                var title = Path()
                title.move(to: CGPoint(x: middle - width * titleSpan, y: y + height / 2))
                title.addLine(to: CGPoint(x: middle + width * titleSpan, y: y + height / 2))
                detail = title
            default:
                detail = nil
            }
            shapes.append((
                outline: Path(
                    roundedRect: CGRect(x: x, y: y, width: width, height: height),
                    cornerRadius: corner,
                    style: .circular
                ),
                detail: detail,
                orange: orange.contains(index)
            ))
            floor = y - gap
        }
        // On the site a book drops once the eased run has counted past it, so
        // it starts the moment the run's ease reaches its share of the pile.
        return shapes.enumerated().map { index, shape in
            Book(
                outline: shape.outline,
                detail: shape.detail,
                orange: shape.orange,
                lands: duration * SiteEasing.easeInOutReaching(Double(index) / Double(shapes.count))
            )
        }
    }()

    var body: some View {
        Canvas { context, size in
            let scale = size.width / Self.box.width
            var drawing = context
            drawing.scaleBy(x: scale, y: scale)

            for book in Self.books {
                // It drops into place, slowing as it lands.
                let landed = SiteEasing.smoothOut((elapsed - book.lands) / Self.dropSeconds)
                guard landed > 0 else { continue }
                var layer = drawing
                layer.opacity = landed
                layer.translateBy(x: 0, y: -Self.drop * (1 - landed))
                let shading: GraphicsContext.Shading = book.orange
                    ? .color(WizardStyle.accent)
                    : .style(.secondary)
                layer.stroke(book.outline, with: shading, lineWidth: 1)
                if let detail = book.detail {
                    // The bands and titles, a step fainter than the books.
                    layer.opacity = landed * 0.5
                    layer.stroke(detail, with: shading, style: StrokeStyle(lineWidth: 1, lineCap: .round))
                }
            }

            var shelf = Path()
            shelf.move(to: CGPoint(x: Self.shelf.left, y: Self.shelf.y))
            shelf.addLine(to: CGPoint(x: Self.shelf.right, y: Self.shelf.y))
            drawing.stroke(shelf, with: .style(.secondary), style: StrokeStyle(lineWidth: 1, lineCap: .round))
        }
        .aspectRatio(Self.box.width / Self.box.height, contentMode: .fit)
        // The top of the drawing fades out, and the tower goes on past it.
        .mask {
            LinearGradient(
                stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.4)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }
}

#Preview("Playing") {
    TimelineView(.animation) { timeline in
        BooksDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: BooksDrawing.duration + 1.5)
        )
    }
    .frame(width: 400, height: 300)
}

#Preview("Finished, dark") {
    BooksDrawing(elapsed: BooksDrawing.duration + 1)
        .frame(width: 400, height: 300)
        .background(.background)
        .environment(\.colorScheme, .dark)
}
