import SwiftUI

/// The walk to the Moon: the Earth low on the left, the Moon high on the
/// right, and a dotted way bowing up between them like a launch. The hours
/// walk it as far as they reach, in orange, and a stick figure walks at the
/// head of it and stops there, with the rest of the way faint ahead of it.
///
/// The site's `Moon` from the cost story, drawn in the same 320 by 180 box and
/// fitted into whatever frame the parent gives it. It is a function of
/// `elapsed` alone: the walk plays over `duration` and stands where it stopped
/// after it.
struct MoonDrawing: View {
    /// How long the walk takes, `drawing.moon` on the site.
    static let duration: TimeInterval = 3.8

    let elapsed: TimeInterval
    /// How much of the way the hours walk, from 0 to 1.
    let share: Double

    init(elapsed: TimeInterval, share: Double = 0.57) {
        self.elapsed = elapsed
        self.share = share
    }

    /// A round body in the sky, in the drawing's units.
    private struct Sphere {
        let center: CGPoint
        let radius: CGFloat

        /// Where its surface faces a point: the way leaves the Earth and meets
        /// the Moon there.
        func surface(toward point: CGPoint) -> CGPoint {
            let angle = atan2(point.y - center.y, point.x - center.x)
            return CGPoint(x: center.x + radius * cos(angle), y: center.y + radius * sin(angle))
        }
    }

    /// The drawing's own box, in the site's units.
    private static let size = CGSize(width: 320, height: 180)
    private static let earth = Sphere(center: CGPoint(x: 38, y: 146), radius: 18)
    private static let moon = Sphere(center: CGPoint(x: 288, y: 34), radius: 10)
    private static let meridianSquash: CGFloat = 0.42
    private static let equatorSquash: CGFloat = 0.3
    /// The way bows up off the Earth toward this point, and is drawn as a run
    /// of points.
    private static let bend = CGPoint(x: 96, y: 28)
    private static let wayStepCount = 160
    /// The middle of the way, marked with a short line across it.
    private static let halfway = 0.5
    private static let halfTickReach: CGFloat = 5
    /// The walker's strides on the way out, a whole number so the legs land
    /// apart where it stops.
    private static let strides = 7.0
    private static let stride: CGFloat = 2.4
    private static let walkerHead: CGFloat = 12
    private static let walkerHeadRadius: CGFloat = 2.2

    /// The way from the Earth to the Moon as a run of points, bowed toward the
    /// bend.
    private static let way: [CGPoint] = {
        let start = earth.surface(toward: bend)
        let end = moon.surface(toward: bend)
        return (0...wayStepCount).map { step in
            let t = CGFloat(step) / CGFloat(wayStepCount)
            let fromStart = (1 - t) * (1 - t)
            let fromBend = 2 * (1 - t) * t
            let fromEnd = t * t
            return CGPoint(
                x: fromStart * start.x + fromBend * bend.x + fromEnd * end.x,
                y: fromStart * start.y + fromBend * bend.y + fromEnd * end.y
            )
        }
    }()

    /// How far along the way each of its points is.
    private static let wayLengths: [CGFloat] = way.indices.reduce(into: []) { lengths, index in
        lengths.append(index == 0 ? 0 : lengths[index - 1] + distance(way[index - 1], way[index]))
    }

    private static let wayLength = wayLengths.last ?? 0

    /// The short line across the way at its middle, square to it.
    private static let halfTick: Path = {
        let point = wayAt(halfway).point
        let before = wayAt(halfway - 0.01).point
        let after = wayAt(halfway + 0.01).point
        let length = distance(before, after)
        let across = CGPoint(
            x: (before.y - after.y) / length * halfTickReach,
            y: (after.x - before.x) / length * halfTickReach
        )
        return through([
            CGPoint(x: point.x - across.x, y: point.y - across.y),
            CGPoint(x: point.x + across.x, y: point.y + across.y),
        ])
    }()

    var body: some View {
        Canvas { context, size in
            let scale = min(size.width / Self.size.width, size.height / Self.size.height)
            context.translateBy(
                x: (size.width - Self.size.width * scale) / 2,
                y: (size.height - Self.size.height * scale) / 2
            )
            context.scaleBy(x: scale, y: scale)
            draw(in: &context)
        }
        .accessibilityHidden(true)
    }

    /// How far the walk has played, from 0 to 1.
    private var walked: Double {
        SiteEasing.smoothOut(elapsed / Self.duration)
    }

    private func draw(in context: inout GraphicsContext) {
        let muted = GraphicsContext.Shading.style(.secondary)
        let accent = GraphicsContext.Shading.color(WizardStyle.accent)
        var faint = context
        faint.opacity = 0.5

        let earth = Self.circle(Self.earth.center, Self.earth.radius).boundingRect
        let radius = Self.earth.radius
        context.stroke(Path(ellipseIn: earth), with: muted, lineWidth: 1)
        faint.stroke(
            Path(ellipseIn: earth.insetBy(dx: radius * (1 - Self.meridianSquash), dy: 0)),
            with: muted,
            lineWidth: 1
        )
        faint.stroke(
            Path(ellipseIn: earth.insetBy(dx: 0, dy: radius * (1 - Self.equatorSquash))),
            with: muted,
            lineWidth: 1
        )

        let moon = Self.moon.center
        context.stroke(Self.circle(moon, Self.moon.radius), with: muted, lineWidth: 1)
        faint.stroke(Self.circle(CGPoint(x: moon.x - 3, y: moon.y - 2), 2.5), with: muted, lineWidth: 1)
        faint.stroke(Self.circle(CGPoint(x: moon.x + 3.5, y: moon.y + 3.5), 1.5), with: muted, lineWidth: 1)

        let dotted = StrokeStyle(lineWidth: 2, lineCap: .round, dash: [0, 6])
        var way = context
        way.opacity = 0.45
        way.stroke(Self.through(Self.way), with: muted, style: dotted)
        context.stroke(Self.halfTick, with: muted, style: StrokeStyle(lineWidth: 1, lineCap: .round))

        let walked = self.walked
        let reach = min(1, share)
        context.stroke(Self.walkedTo(walked * reach), with: accent, style: dotted)

        let feet = Self.wayAt(walked * reach).point
        context.stroke(
            Self.walker(at: feet, stride: Self.strideAt(walked)),
            with: accent,
            style: StrokeStyle(lineWidth: 1.4, lineCap: .round, lineJoin: .round)
        )
        context.fill(
            Self.circle(CGPoint(x: feet.x, y: feet.y - Self.walkerHead), Self.walkerHeadRadius),
            with: accent
        )
    }

    /// The point `share` of the way along, and how many of the way's points lie
    /// behind it.
    private static func wayAt(_ share: Double) -> (behind: Int, point: CGPoint) {
        let along = SiteEasing.clamp(share) * wayLength
        let behind = max(1, wayLengths.firstIndex { $0 >= along } ?? way.count - 1)
        let from = way[behind - 1]
        let to = way[behind]
        let span = wayLengths[behind] - wayLengths[behind - 1]
        let t = span > 0 ? (along - wayLengths[behind - 1]) / span : 0
        return (behind, CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t))
    }

    /// The way walked, from the Earth to the point `share` of the way along.
    private static func walkedTo(_ share: Double) -> Path {
        let (behind, point) = wayAt(share)
        return through(Array(way.prefix(behind)) + [point])
    }

    /// The walker standing with its feet on a point of the way: legs `stride`
    /// either side, arms swinging the other way. Its head is drawn on its own,
    /// `walkerHead` over the point.
    private static func walker(at feet: CGPoint, stride: CGFloat) -> Path {
        let arm = stride * 0.8
        let (x, y) = (feet.x, feet.y)
        var path = Path()
        path.move(to: CGPoint(x: x - stride, y: y))
        path.addLine(to: CGPoint(x: x, y: y - 4))
        path.addLine(to: CGPoint(x: x + stride, y: y))
        path.move(to: CGPoint(x: x, y: y - 4))
        path.addLine(to: CGPoint(x: x, y: y - 9.5))
        path.move(to: CGPoint(x: x + arm, y: y - 5.5))
        path.addLine(to: CGPoint(x: x, y: y - 8.5))
        path.addLine(to: CGPoint(x: x - arm, y: y - 5.5))
        return path
    }

    /// The legs' spread `walked` of the way out, landing wide apart where the
    /// walk stops.
    private static func strideAt(_ walked: Double) -> CGFloat {
        stride * cos((1 - walked) * strides * 2 * .pi)
    }

    /// A run of points as one path.
    private static func through(_ points: [CGPoint]) -> Path {
        var path = Path()
        path.addLines(points)
        return path
    }

    private static func distance(_ from: CGPoint, _ to: CGPoint) -> CGFloat {
        hypot(to.x - from.x, to.y - from.y)
    }

    private static func circle(_ center: CGPoint, _ radius: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
    }
}

#Preview {
    TimelineView(.animation) { timeline in
        let elapsed = timeline.date.timeIntervalSinceReferenceDate
            .truncatingRemainder(dividingBy: MoonDrawing.duration + 1.5)
        HStack(spacing: 0) {
            ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                MoonDrawing(elapsed: elapsed)
                    .frame(width: 320, height: 240)
                    .padding(20)
                    .background(.background)
                    .environment(\.colorScheme, scheme)
            }
        }
    }
}
