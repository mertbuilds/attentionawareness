import SwiftUI

/// The degrees the hours would have bought: a mortarboard for each, tossed up
/// one at a time, turning once in the air and landing in rows on a shelf, the
/// last one orange. Each throw leaves its arc behind as a dotted line.
///
/// The site's degrees drawing, drawn in its 320 by 216 box and scaled to fit
/// whatever frame it is given. Everything on it is a function of `elapsed`,
/// the seconds since it started: the run takes `duration`, and past it the
/// orange cap's tassel swings from its corner.
struct DegreesDrawing: View {
    /// The whole run, from the first throw to the orange cap's hop.
    static let duration: TimeInterval = 4

    let elapsed: TimeInterval
    /// The degrees, a cap each.
    let amount: Int

    init(elapsed: TimeInterval, amount: Int = 9) {
        self.elapsed = elapsed
        self.amount = amount
    }

    var body: some View {
        Canvas { context, size in
            Self.draw(in: &context, size: size, elapsed: elapsed, amount: amount)
        }
        .accessibilityHidden(true)
    }
}

extension DegreesDrawing {
    /// One cap's throw: how high it goes, where and when it leaves, how large
    /// it is drawn and where it lands.
    private struct Throw {
        let apex: Double
        let from: CGPoint
        let launch: TimeInterval
        let scale: Double
        let slot: CGPoint
    }

    /// Where a cap is at a moment: its board's middle, its size, and how far
    /// it has turned.
    private struct Pose {
        let at: CGPoint
        let scale: Double
        let turn: Double
    }

    private static let box = CGSize(width: 320, height: 216)
    /// The caps go up from behind the shelf, out of sight under it, and come
    /// down on it. Each leaves from a little way toward its own slot, so the
    /// arcs fan out instead of bunching in the middle, and all leave a little
    /// to the left of that, so the fan is not a mirror image of itself.
    private static let shelfY = 202.0
    private static let throwY = shelfY + 40
    private static let throwSpread = 0.35
    private static let throwLean = -16.0
    /// The room either side of the row, and the most caps a row holds before
    /// the next stands over it: few enough that each cap is large enough to
    /// read.
    private static let side = 14.0
    private static let columns = 5
    /// A cap in its own units, the middle of its board at the origin: the
    /// board seen from a little above, half as wide and half as deep, the
    /// crown under it, and the cord out to the right corner, where the tassel
    /// hangs.
    private static let boardDepth = 6.0
    private static let boardWidth = 14.0
    private static let crownBottom = 9.0
    private static let crownBulge = 13.0
    private static let crownWidth = 8.0
    private static let cordEnd = CGPoint(x: 12, y: 0.4)
    private static let button = 0.9
    private static let hang = 6.5
    private static let tassel = 3.0
    /// Where the crown's sides come out from under the board's front edges.
    private static let crownTop = boardDepth * (1 - crownWidth / boardWidth)
    /// How far the crown reaches under the board's middle: the lowest point
    /// of its curve.
    private static let capDepth = (crownBottom + crownBulge) / 2
    /// A cap and the gap after it at full size, the largest a few caps are
    /// drawn, and a row over the last.
    private static let capPitch = 32.0
    private static let largest = 1.6
    private static let rowPitch = 22.0
    /// One throw's flight, and the hop it lands with.
    private static let flight = duration / 3
    private static let hopSeconds = duration * 0.075
    /// The orange cap waits this many gaps instead of one, a beat after the
    /// rest.
    private static let lastWait = 1.8
    /// The top of a throw: the orange cap goes highest, the others a step
    /// lower in turn.
    private static let apex = 30.0
    private static let apexStep = 10.0
    private static let apexVariants = 3
    /// In the air a cap turns once, swells toward the eye at the top of its
    /// arc, and lands with a small hop.
    private static let turnAngle = 2 * Double.pi
    private static let swell = 0.18
    private static let hop = 2.5
    /// Each throw leaves its arc behind as a dotted line, drawn through this
    /// many points, faint, and the orange cap's in orange.
    private static let trailSteps = 48
    private static let trailOpacity = 0.45
    /// Once everything has landed, the orange cap's tassel swings a few
    /// degrees each way, through these angles in turn.
    private static let swing: [Double] = [0, 5.7, 8, 5.7, 0, -5.7, -8, -5.7, 0]
    private static let swingPeriod: TimeInterval = 3

    /// Every cap's throw. They land left to right, a row at a time from the
    /// bottom, and leave one after another; the last, the orange one, a beat
    /// after the rest, so it is the one the drawing ends on.
    private static func throwsFor(_ amount: Int) -> [Throw] {
        let count = max(0, amount)
        let perRow = max(1, min(count, columns))
        let scale = min(largest, (box.width - 2 * side) / Double(perRow) / capPitch)
        let pitch = capPitch * scale
        let last = count - 1
        let gaps = last > 0 ? Double(last - 1) + lastWait : 1
        let gap = (duration - flight - hopSeconds) / gaps
        return (0..<count).map { index in
            let row = index / perRow
            let inRow = min(perRow, count - row * perRow)
            let x = box.width / 2 + (Double(index % perRow) - Double(inRow - 1) / 2) * pitch
            return Throw(
                apex: index == last ? apex : apex + Double(1 + index % apexVariants) * apexStep,
                from: CGPoint(x: box.width / 2 + (x - box.width / 2) * throwSpread + throwLean, y: throwY),
                launch: (index == last && last > 0 ? gaps : Double(index)) * gap,
                scale: scale,
                slot: CGPoint(x: x, y: shelfY - (capDepth + Double(row) * rowPitch) * scale)
            )
        }
    }

    /// How far through its flight a cap is `seconds` in.
    private static func flownAt(_ cap: Throw, _ seconds: Double) -> Double {
        SiteEasing.clamp((seconds - cap.launch) / flight)
    }

    /// The point `t` of the way through a throw, on a parabola from the hand
    /// to the slot.
    private static func flightPoint(_ cap: Throw, _ t: Double) -> CGPoint {
        let lift = (cap.from.y + cap.slot.y) / 2 - cap.apex
        return CGPoint(
            x: cap.from.x + (cap.slot.x - cap.from.x) * t,
            y: cap.from.y + (cap.slot.y - cap.from.y) * t - 4 * lift * t * (1 - t)
        )
    }

    /// Where a cap is `seconds` in: waiting under the box, in the air, or on
    /// the shelf after its hop. It turns the way it flies, fast off the hand
    /// and slowing into the landing, and swells a little at the top of its
    /// arc.
    private static func poseAt(_ cap: Throw, _ seconds: Double) -> Pose {
        let landed = seconds - cap.launch - flight
        if landed >= 0 {
            let rise = sin(.pi * SiteEasing.clamp(landed / hopSeconds))
            return Pose(at: CGPoint(x: cap.slot.x, y: cap.slot.y - hop * cap.scale * rise), scale: cap.scale, turn: 0)
        }
        let t = flownAt(cap, seconds)
        let way: Double = cap.slot.x < cap.from.x ? -1 : 1
        return Pose(
            at: flightPoint(cap, t),
            scale: cap.scale * (1 + swell * sin(.pi * t)),
            turn: way * turnAngle * SiteEasing.easeOut(t)
        )
    }

    /// The arc a cap has flown `seconds` in, from the hand to where it is.
    private static func trailPath(_ cap: Throw, _ seconds: Double) -> Path {
        let t = flownAt(cap, seconds)
        let steps = Int((t * Double(trailSteps)).rounded(.up))
        return Path { path in
            guard steps > 0 else { return }
            path.move(to: flightPoint(cap, 0))
            for step in 1...steps {
                path.addLine(to: flightPoint(cap, min(t, Double(step) / Double(trailSteps))))
            }
        }
    }

    /// A point of the cap's own drawing, where the pose puts it in the box.
    private static func place(_ pose: Pose, _ x: Double, _ y: Double) -> CGPoint {
        let cosine = cos(pose.turn)
        let sine = sin(pose.turn)
        return CGPoint(
            x: pose.at.x + pose.scale * (x * cosine - y * sine),
            y: pose.at.y + pose.scale * (x * sine + y * cosine)
        )
    }

    /// The crown and the board. Both are drawn the same way round, so where
    /// they overlap the fill stays solid instead of cutting a hole.
    private static func bodyPath(_ pose: Pose) -> Path {
        Path { path in
            path.move(to: place(pose, crownWidth, crownTop))
            path.addLine(to: place(pose, crownWidth, crownBottom))
            path.addQuadCurve(to: place(pose, -crownWidth, crownBottom), control: place(pose, 0, crownBulge))
            path.addLine(to: place(pose, -crownWidth, crownTop))
            path.move(to: place(pose, -boardWidth, 0))
            path.addLine(to: place(pose, 0, -boardDepth))
            path.addLine(to: place(pose, boardWidth, 0))
            path.addLine(to: place(pose, 0, boardDepth))
            path.closeSubpath()
        }
    }

    /// The button in the board's middle, and the cord from it to the corner.
    private static func cordPath(_ pose: Pose) -> Path {
        let radius = button * pose.scale
        return Path { path in
            path.addEllipse(in: CGRect(x: pose.at.x - radius, y: pose.at.y - radius, width: 2 * radius, height: 2 * radius))
            path.move(to: pose.at)
            path.addLine(to: place(pose, cordEnd.x, cordEnd.y))
        }
    }

    /// The tassel's string, hanging straight down from the corner however the
    /// cap has turned.
    private static func hangPath(_ pose: Pose) -> Path {
        let from = place(pose, cordEnd.x, cordEnd.y)
        return Path { path in
            path.move(to: from)
            path.addLine(to: CGPoint(x: from.x, y: from.y + hang * pose.scale))
        }
    }

    /// The tassel itself, at the end of the string.
    private static func tasselPath(_ pose: Pose) -> Path {
        let from = place(pose, cordEnd.x, cordEnd.y)
        let top = from.y + hang * pose.scale
        return Path { path in
            path.move(to: CGPoint(x: from.x, y: top))
            path.addLine(to: CGPoint(x: from.x, y: top + tassel * pose.scale))
        }
    }

    /// How far the orange cap's tassel has swung `elapsed` in: not at all
    /// until every cap is down, then a few degrees each way, round and round.
    private static func swingAngle(_ elapsed: TimeInterval) -> Double {
        guard elapsed > duration else { return 0 }
        let cycle = ((elapsed - duration) / swingPeriod).truncatingRemainder(dividingBy: 1)
        let position = cycle * Double(swing.count - 1)
        let index = min(Int(position), swing.count - 2)
        let degrees = swing[index] + (swing[index + 1] - swing[index]) * (position - Double(index))
        return degrees * .pi / 180
    }

    private static func draw(in context: inout GraphicsContext, size: CGSize, elapsed: TimeInterval, amount: Int) {
        let fit = min(size.width / box.width, size.height / box.height)
        context.translateBy(x: (size.width - box.width * fit) / 2, y: (size.height - box.height * fit) / 2)
        context.scaleBy(x: fit, y: fit)

        let seconds = min(duration, max(0, elapsed))
        let throwsList = throwsFor(amount)
        let last = throwsList.count - 1

        var shelf = Path()
        shelf.move(to: CGPoint(x: side, y: shelfY))
        shelf.addLine(to: CGPoint(x: box.width - side, y: shelfY))
        context.stroke(shelf, with: .style(.tertiary), lineWidth: 1)

        // Everything that flies is cut off at the shelf, so the caps come up
        // from behind it. A stroke's width under it is kept for the ones
        // landed on it.
        context.clip(to: Path(CGRect(x: 0, y: 0, width: box.width, height: shelfY + 1)))

        let dotted = StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [0, 5])
        for (index, cap) in throwsList.enumerated() {
            var trail = context
            trail.opacity = index == last ? 1 : trailOpacity
            trail.stroke(
                trailPath(cap, seconds),
                with: index == last ? .color(WizardStyle.accent) : .style(.secondary),
                style: dotted
            )
        }

        let outline = StrokeStyle(lineWidth: 1.2, lineCap: .round, lineJoin: .round)
        let tasselStroke = StrokeStyle(lineWidth: 2.2, lineCap: .butt, lineJoin: .round)
        for (index, cap) in throwsList.enumerated() {
            let ink: GraphicsContext.Shading = index == last ? .color(WizardStyle.accent) : .style(.secondary)
            let pose = poseAt(cap, seconds)
            // The board and the crown are solid, so a cap in the air passes in
            // front of one on the shelf rather than through it.
            let body = bodyPath(pose)
            context.fill(body, with: .style(.background))
            context.stroke(body, with: ink, style: outline)
            context.stroke(cordPath(pose), with: ink, style: outline)

            var swung = CGAffineTransform.identity
            if index == last {
                let corner = place(poseAt(cap, duration), cordEnd.x, cordEnd.y)
                swung = CGAffineTransform(translationX: corner.x, y: corner.y)
                    .rotated(by: swingAngle(elapsed))
                    .translatedBy(x: -corner.x, y: -corner.y)
            }
            context.stroke(hangPath(pose).applying(swung), with: ink, style: outline)
            context.stroke(tasselPath(pose).applying(swung), with: ink, style: tasselStroke)
        }
    }
}

#Preview {
    TimelineView(.animation) { timeline in
        DegreesDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: DegreesDrawing.duration + 3)
        )
    }
    .aspectRatio(4 / 3, contentMode: .fit)
    .frame(width: 400)
    .padding()
}
