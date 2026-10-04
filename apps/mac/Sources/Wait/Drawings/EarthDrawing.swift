import SwiftUI

/// The walks around the Earth: a plain globe, and a line spiralling out round
/// it one lap for every trip, from just off the globe to the edge, with the
/// walker at its head.
///
/// The site's `Orbit` from the cost story, drawn in the same 200-unit box and
/// fitted into whatever frame the parent gives it. The line and the walker are
/// both drawn from how far the walk has gone, through the one point function,
/// so the walker never runs ahead of the line or falls behind it. It is a
/// function of `elapsed` alone: the walk plays over `duration` and stands
/// drawn whole after it.
struct EarthDrawing: View {
    /// How long the walk takes, `drawing.earth` on the site.
    static let duration: TimeInterval = 4.2

    let elapsed: TimeInterval
    /// One lap for every trip around the Earth the hours would have walked.
    let laps: Int

    init(elapsed: TimeInterval, laps: Int = 5) {
        self.elapsed = elapsed
        self.laps = laps
    }

    /// The drawing's own box, square, in the site's units.
    private static let box: CGFloat = 200
    private static let center = CGPoint(x: box / 2, y: box / 2)
    private static let globeRadius: CGFloat = 52
    private static let meridianSquash: CGFloat = 0.42
    private static let equatorSquash: CGFloat = 0.3
    private static let orbitInner: CGFloat = 64
    private static let orbitOuter: CGFloat = 94
    private static let pointsPerLap = 72
    private static let walkerRadius: CGFloat = 3.5
    /// The walker comes in over this first share of the walk.
    private static let walkerFadeIn = 0.02

    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / Self.box
            context.translateBy(
                x: (size.width - Self.box * scale) / 2,
                y: (size.height - Self.box * scale) / 2
            )
            context.scaleBy(x: scale, y: scale)
            draw(in: &context)
        }
        .accessibilityHidden(true)
    }

    /// How far the walk has gone, from 0 to 1.
    private var walked: Double {
        SiteEasing.smoothOut(elapsed / Self.duration)
    }

    private func draw(in context: inout GraphicsContext) {
        let muted = GraphicsContext.Shading.style(.secondary)
        let accent = GraphicsContext.Shading.color(WizardStyle.accent)
        let radius = Self.globeRadius
        let globe = Self.circle(Self.center, radius).boundingRect

        context.stroke(Path(ellipseIn: globe), with: muted, lineWidth: 1)
        var faint = context
        faint.opacity = 0.5
        faint.stroke(
            Path(ellipseIn: globe.insetBy(dx: radius * (1 - Self.meridianSquash), dy: 0)),
            with: muted,
            lineWidth: 1
        )
        faint.stroke(
            Path(ellipseIn: globe.insetBy(dx: 0, dy: radius * (1 - Self.equatorSquash))),
            with: muted,
            lineWidth: 1
        )

        let walked = self.walked
        context.stroke(
            Self.path(laps: laps, walked: walked),
            with: accent,
            style: StrokeStyle(lineWidth: 1.5, lineCap: .round)
        )
        var walker = context
        walker.opacity = min(1, walked / Self.walkerFadeIn)
        walker.fill(Self.circle(Self.point(laps: laps, walked: walked), Self.walkerRadius), with: accent)
    }

    /// Where the walk is `walked` of the way along: one lap a trip, starting at
    /// the top, clockwise, spiralling out.
    private static func point(laps: Int, walked: Double) -> CGPoint {
        let angle = walked * Double(laps) * 2 * .pi - .pi / 2
        let radius = orbitInner + (orbitOuter - orbitInner) * walked
        return CGPoint(x: center.x + radius * cos(angle), y: center.y + radius * sin(angle))
    }

    /// The walk as far as `walked` of the way along. It ends on `point`, where
    /// the walker stands, so the two are always the same distance along.
    private static func path(laps: Int, walked: Double) -> Path {
        var path = Path()
        guard walked > 0 else {
            return path
        }
        let steps = max(1, laps) * pointsPerLap
        let behind = min(steps, Int((walked * Double(steps)).rounded(.down)))
        path.move(to: point(laps: laps, walked: 0))
        for step in stride(from: 1, through: behind, by: 1) {
            path.addLine(to: point(laps: laps, walked: Double(step) / Double(steps)))
        }
        path.addLine(to: point(laps: laps, walked: walked))
        return path
    }

    private static func circle(_ center: CGPoint, _ radius: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
    }
}

#Preview {
    TimelineView(.animation) { timeline in
        let elapsed = timeline.date.timeIntervalSinceReferenceDate
            .truncatingRemainder(dividingBy: EarthDrawing.duration + 1.5)
        HStack(spacing: 0) {
            ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                EarthDrawing(elapsed: elapsed)
                    .frame(width: 320, height: 240)
                    .padding(20)
                    .background(.background)
                    .environment(\.colorScheme, scheme)
            }
        }
    }
}
