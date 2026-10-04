import SwiftUI

/// A running track seen from above, and a runner lapping it: off the line at a
/// run, then so fast the tail behind it rings the lane, then easing back over
/// the line. Once it is home a ring goes out from it now and then, and nothing
/// else moves.
///
/// A port of the site's marathons drawing, drawn in the site's 320 by 216 box
/// and scaled to fit. Everything on it is worked out from `elapsed`, so the
/// clock lives with the parent.
struct MarathonsDrawing: View {
    /// The run, the site's `drawing.deck`.
    static let duration: TimeInterval = 4

    let elapsed: TimeInterval
    /// The number the drawing stands for. The run is the same for any of
    /// them, as on the site.
    let amount: Int

    init(elapsed: TimeInterval, amount: Int = 219) {
        self.elapsed = elapsed
        self.amount = amount
    }

    private static let box = CGSize(width: 320, height: 216)
    /// The inner kerb, and the lanes outside it.
    private static let kerb = 56.0
    private static let lanes = 4
    private static let lane = 8.0
    /// The track, two straights and two bends around the middle of the box.
    private static let center = CGPoint(x: box.width / 2, y: box.height / 2)
    private static let halfStraight = 58.0
    /// The runner keeps to the middle of the inside lane, the one a lap is
    /// measured on.
    private static let runRadius = kerb + lane / 2
    private static let straight = 2 * halfStraight
    private static let bend = Double.pi * runRadius
    private static let lap = 2 * straight + 2 * bend
    /// The laps the runner is seen to run.
    private static let lapsRun = 8.0
    /// The tail reaches back to where the runner was this share of the run
    /// ago, and never round more than most of a lap.
    private static let tail = 1.0 / 12
    private static let tailMax = 0.85
    /// The tail fades out in this many pieces, each fainter than the one ahead.
    private static let tailPieces = 14
    /// How far apart the points a stretch of lane is drawn through stand.
    private static let sample = 3.0
    private static let runnerRadius = 3.5
    /// The ring that goes out from the runner once it is home.
    private static let rippleSeconds = 2.4
    private static let rippleGrowth = 3.2

    /// Every edge of every lane, all the way round: a stadium for each.
    private static let edges: [Path] = (0...lanes).map { index in
        let radius = kerb + Double(index) * lane
        return Path(
            roundedRect: CGRect(
                x: center.x - halfStraight - radius,
                y: center.y - radius,
                width: 2 * (halfStraight + radius),
                height: 2 * radius
            ),
            cornerRadius: radius,
            style: .circular
        )
    }

    /// The line across every lane at the end of the home straight, where each
    /// lap starts and ends.
    private static let finish: Path = {
        var path = Path()
        path.move(to: CGPoint(x: center.x + halfStraight, y: center.y + kerb))
        path.addLine(to: CGPoint(x: center.x + halfStraight, y: center.y + kerb + Double(lanes) * lane))
        return path
    }()

    var body: some View {
        Canvas { context, size in
            let scale = size.width / Self.box.width
            var drawing = context
            drawing.scaleBy(x: scale, y: scale)

            for (index, edge) in Self.edges.enumerated() {
                var lane = drawing
                if index > 0 && index < Self.lanes {
                    lane.opacity = 0.5
                }
                lane.stroke(edge, with: .style(.secondary), lineWidth: 1)
            }
            drawing.stroke(Self.finish, with: .style(.secondary), lineWidth: 1)

            // The playhead stops at the end, as the site's does, so the last of
            // the tail stays behind the runner.
            let at = min(1, elapsed / Self.duration)
            let ran = Self.laps(by: at)
            let head = ran * Self.lap
            let piece = min(Self.tailMax, ran - Self.laps(by: at - Self.tail)) * Self.lap / Double(Self.tailPieces)
            let accent = GraphicsContext.Shading.color(WizardStyle.accent)

            // The inside lane, faintly orange as far as the runner has worn it.
            if ran > 0 {
                var worn = drawing
                worn.opacity = 0.3
                worn.stroke(Self.stretch(from: 0, to: min(1, ran) * Self.lap), with: accent, lineWidth: 1.5)
            }
            if piece > 0 {
                for index in 0..<Self.tailPieces {
                    var tail = drawing
                    tail.opacity = 1 - Double(index) / Double(Self.tailPieces)
                    tail.stroke(
                        Self.stretch(from: head - Double(index + 1) * piece, to: head - Double(index) * piece),
                        with: accent,
                        lineWidth: 1.5
                    )
                }
            }

            let runner = Self.lapPoint(head)
            let home = elapsed - Self.duration
            if home >= 0 {
                let grown = SiteEasing.smoothOut(
                    home.truncatingRemainder(dividingBy: Self.rippleSeconds) / Self.rippleSeconds
                )
                let growth = 1 + (Self.rippleGrowth - 1) * grown
                let radius = Self.runnerRadius * growth
                var ripple = drawing
                ripple.opacity = 0.6 * (1 - grown)
                ripple.stroke(
                    Path(ellipseIn: CGRect(x: runner.x - radius, y: runner.y - radius, width: 2 * radius, height: 2 * radius)),
                    with: accent,
                    lineWidth: 0.75 * growth
                )
            }
            drawing.fill(
                Path(ellipseIn: CGRect(
                    x: runner.x - Self.runnerRadius,
                    y: runner.y - Self.runnerRadius,
                    width: 2 * Self.runnerRadius,
                    height: 2 * Self.runnerRadius
                )),
                with: accent
            )
        }
        .aspectRatio(Self.box.width / Self.box.height, contentMode: .fit)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }

    /// The laps run by the time the drawing is `at` of the way through: slow
    /// off the line, fast in the middle, slow over it again.
    private static func laps(by at: Double) -> Double {
        lapsRun * SiteEasing.cubicInOut(at)
    }

    /// Where the runner is `distance` along the inside lane. A lap starts on
    /// the line at the end of the home straight and runs the way a race does:
    /// up the right bend, back along the far straight, down the left.
    private static func lapPoint(_ distance: Double) -> CGPoint {
        var along = (distance.truncatingRemainder(dividingBy: lap) + lap).truncatingRemainder(dividingBy: lap)
        if along < bend {
            let angle = Double.pi / 2 - Double.pi * along / bend
            return CGPoint(
                x: center.x + halfStraight + runRadius * cos(angle),
                y: center.y + runRadius * sin(angle)
            )
        }
        along -= bend
        if along < straight {
            return CGPoint(x: center.x + halfStraight - along, y: center.y - runRadius)
        }
        along -= straight
        if along < bend {
            let angle = -Double.pi / 2 - Double.pi * along / bend
            return CGPoint(
                x: center.x - halfStraight + runRadius * cos(angle),
                y: center.y + runRadius * sin(angle)
            )
        }
        along -= bend
        return CGPoint(x: center.x - halfStraight + along, y: center.y + runRadius)
    }

    /// The inside lane from one distance along it to another, round the line
    /// as often as it takes.
    private static func stretch(from: Double, to: Double) -> Path {
        let steps = max(1, Int(((to - from) / sample).rounded(.up)))
        var path = Path()
        path.move(to: lapPoint(from))
        for step in 1...steps {
            path.addLine(to: lapPoint(from + (to - from) * Double(step) / Double(steps)))
        }
        return path
    }
}

#Preview("Playing") {
    TimelineView(.animation) { timeline in
        MarathonsDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: MarathonsDrawing.duration + 5)
        )
    }
    .frame(width: 400, height: 300)
}

#Preview("Finished, dark") {
    MarathonsDrawing(elapsed: MarathonsDrawing.duration + 0.4)
        .frame(width: 400, height: 300)
        .background(.background)
        .environment(\.colorScheme, .dark)
}
