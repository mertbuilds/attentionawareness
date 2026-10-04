import SwiftUI

/// The next twenty years drawn a week a square, and the screen's share of them
/// filled in orange, a row at a time, with what the squares stand for under it.
///
/// The site's `Weeks` from the cost story: a row a year where the frame is
/// wide, half a year where it stands tall, whichever gives the bigger squares.
/// The squares are scaled to the frame the parent gives and snapped to whole
/// pixels so they stay sharp. It is a function of `elapsed` alone: the weeks
/// fill over `duration` and stand filled after it.
struct WeeksDrawing: View {
    /// How long the weeks take to fill, `drawing.weeks` on the site.
    static let duration: TimeInterval = 3.4

    let elapsed: TimeInterval
    /// The weeks the screen takes, filled in orange.
    let filledWeeks: Int
    /// Every week the grid holds.
    let totalWeeks: Int

    init(elapsed: TimeInterval, filledWeeks: Int = 390, totalWeeks: Int = 1040) {
        self.elapsed = elapsed
        self.filledWeeks = filledWeeks
        self.totalWeeks = totalWeeks
    }

    /// The grid as drawn: its columns and rows, how far one square is from the
    /// next, and how big each is, in points.
    private struct Grid {
        let columns: Int
        let rows: Int
        let pitch: CGFloat
        let square: CGFloat

        var size: CGSize {
            let gap = pitch - square
            return CGSize(
                width: CGFloat(columns) * pitch - gap,
                height: CGFloat(rows) * pitch - gap
            )
        }
    }

    /// The site's two ways to lay the weeks out, in its pixels: a row a year,
    /// and half a year, where the grid stands tall instead.
    private static let wide = (columns: 52, square: 7.0)
    private static let narrow = (columns: 26, square: 6.0)
    private static let gap: CGFloat = 2
    /// A square of the legend, a touch bigger than the grid's own so it reads
    /// at text size.
    private static let swatchSize: CGFloat = 8
    private static let legendGap: CGFloat = 12
    private static let legendHeight: CGFloat = 16
    /// The legend fades in as the grid starts to fill, `duration.slow` on the site.
    private static let legendFade: TimeInterval = 0.4

    @Environment(\.displayScale) private var displayScale

    var body: some View {
        GeometryReader { proxy in
            let grid = grid(fitting: CGSize(
                width: proxy.size.width,
                height: proxy.size.height - Self.legendGap - Self.legendHeight
            ))
            VStack(spacing: Self.legendGap) {
                Canvas { context, _ in
                    draw(grid, in: &context)
                }
                .frame(width: grid.size.width, height: grid.size.height)

                legend
                    .frame(height: Self.legendHeight)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .accessibilityHidden(true)
    }

    /// How many weeks are filled in so far.
    private var filled: Int {
        let played = SiteEasing.smoothOut(elapsed / Self.duration)
        return min(totalWeeks, max(0, Int((played * Double(filledWeeks)).rounded())))
    }

    private var legendShown: Double {
        SiteEasing.smoothOut(elapsed / Self.legendFade)
    }

    private var legend: some View {
        HStack(spacing: 16) {
            HStack(spacing: 8) {
                swatch(spent: false)
                Text("= 1 week")
            }
            HStack(spacing: 8) {
                swatch(spent: true)
                Text("= 1 week of screen time")
            }
        }
        .font(.callout)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .opacity(legendShown)
    }

    private func swatch(spent: Bool) -> some View {
        Group {
            if spent {
                Rectangle().fill(WizardStyle.accent)
            } else {
                Rectangle().strokeBorder(.tertiary, lineWidth: 1)
            }
        }
        .frame(width: Self.swatchSize, height: Self.swatchSize)
    }

    /// The layout whose squares come out bigger in `space`, scaled to fit it
    /// and snapped to whole pixels.
    private func grid(fitting space: CGSize) -> Grid {
        let wide = grid(columns: Self.wide.columns, square: Self.wide.square, fitting: space)
        let narrow = grid(columns: Self.narrow.columns, square: Self.narrow.square, fitting: space)
        return narrow.pitch > wide.pitch ? narrow : wide
    }

    private func grid(columns: Int, square: CGFloat, fitting space: CGSize) -> Grid {
        let pixel = 1 / max(1, displayScale)
        let rows = max(1, (totalWeeks + columns - 1) / columns)
        let pitch = square + Self.gap
        let scale = max(0, min(
            space.width / (CGFloat(columns) * pitch - Self.gap),
            space.height / (CGFloat(rows) * pitch - Self.gap)
        ))
        let snapped = max(2 * pixel, (pitch * scale / pixel).rounded(.down) * pixel)
        let gap = min(snapped - pixel, max(pixel, (Self.gap * scale / pixel).rounded() * pixel))
        return Grid(columns: columns, rows: rows, pitch: snapped, square: snapped - gap)
    }

    /// The weeks to come as faint outlines and the filled ones as solid orange
    /// squares, each set as one path.
    private func draw(_ grid: Grid, in context: inout GraphicsContext) {
        let filled = self.filled
        var spent = Path()
        var ahead = Path()
        for week in 0..<max(0, totalWeeks) {
            let square = CGRect(
                x: CGFloat(week % grid.columns) * grid.pitch,
                y: CGFloat(week / grid.columns) * grid.pitch,
                width: grid.square,
                height: grid.square
            )
            if week < filled {
                spent.addRect(square)
            } else {
                ahead.addRect(square.insetBy(dx: 0.5, dy: 0.5))
            }
        }
        context.stroke(ahead, with: .style(.tertiary), lineWidth: 1)
        context.fill(spent, with: .color(WizardStyle.accent))
    }
}

#Preview("Moments") {
    VStack(spacing: 0) {
        ForEach([0, 0.6, 1.4, WeeksDrawing.duration], id: \.self) { elapsed in
            HStack(spacing: 0) {
                ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                    WeeksDrawing(elapsed: elapsed)
                        .frame(width: 400, height: 300)
                        .padding(16)
                        .background(.background)
                        .environment(\.colorScheme, scheme)
                }
            }
        }
    }
}

#Preview("Playing") {
    TimelineView(.animation) { timeline in
        WeeksDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: WeeksDrawing.duration + 1.5)
        )
        .frame(width: 480, height: 360)
        .padding(16)
        .background(.background)
    }
}
