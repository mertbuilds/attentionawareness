import SwiftUI

/// A thumb under a line, swiping up over and over. Each swipe scrolls the
/// line higher, and the view zooms out to keep up with it, past a person, a
/// house and a block, until it reaches the Statue of Liberty's torch: a day's
/// scroll. A counter beside the tip says how far it has gone.
///
/// The site's `ThumbDistance`, drawn in the same 240 by 360 box and fitted
/// into whatever frame the parent gives it. It is a function of `elapsed`
/// alone and runs round a loop of `cycle`: the climb over `drawing.thumb`, a
/// hold on a day's scroll, a fade out and back in to the start, and a rest
/// before the next climb. `duration` is the climb and the hold.
struct FingerDrawing: View {
    /// The climb and the hold on its end, `drawing.thumb` and
    /// `drawing.thumbHold` on the site.
    static let duration: TimeInterval = climbSeconds + holdSeconds
    /// One time round: the climb, the hold, the fade out and in, and the rest.
    static let cycle: TimeInterval = duration + 2 * fadeSeconds + restSeconds

    let elapsed: TimeInterval
    /// How far a thumb scrolls a day.
    let meters: Double

    init(elapsed: TimeInterval, meters: Double = 90) {
        self.elapsed = elapsed
        self.meters = meters
    }

    private static let climbSeconds: TimeInterval = 11
    private static let holdSeconds: TimeInterval = 2.4
    /// The thumb rests a moment before each climb, `drawing.delay`.
    private static let restSeconds: TimeInterval = 0.54
    /// `duration.slow`.
    private static let fadeSeconds: TimeInterval = 0.4

    /// The drawing's own box, taller than it is wide, and the ground near its
    /// foot: the thumb stands under it.
    private static let width: CGFloat = 240
    private static let height: CGFloat = 360
    private static let ground: CGFloat = 300
    /// The line rises left of the middle: the landmarks stand to its right,
    /// the counter to its left.
    private static let lineX: CGFloat = 48
    private static let tipRadius: CGFloat = 3.5
    /// The counter stands this far left of the line, and never lower than
    /// this over the ground.
    private static let counterGap: CGFloat = 8
    private static let counterFloor: CGFloat = 12
    /// The view starts this many meters tall, a person and a little sky. Once
    /// the line outgrows that, the view zooms out to keep its tip this far up.
    private static let viewStart = 2.8
    private static let tipAt = 0.65
    /// The swipes a day's scroll is shown in. Each takes the line this many
    /// times as high as it stood, so it climbs at the same pace on screen
    /// however far the view has zoomed out.
    private static let swipes = 20
    private static let growth = 1.4
    /// A swipe's parts, as shares of it: the thumb pushes up until the first
    /// and comes back down after, the feed coasts on until the second, and
    /// the view starts catching up at the third.
    private static let push = 0.35
    private static let coast = 0.75
    private static let follow = 0.1
    /// How far up the thumb pushes, and how far under the ground its tip rests.
    private static let lift: CGFloat = 20
    private static let thumbRest: CGFloat = 5
    /// The sides fade out over this share of the width, so the landmarks come
    /// into the frame rather than being cut by it.
    private static let edgeFade = 0.08

    /// The thumb from behind, its tip at the origin: the outline runs on under
    /// the frame.
    private static let thumb = path(
        "M-14 110 C-14.5 60 -16 36 -15.5 21 C-15 8 -8 0 0 0 C8 0 15 8 15.5 21 C16 36 14.5 60 14 110"
    )
    private static let thumbDetail = path(
        "M-8.5 23 L-8.5 11 C-8.5 6 -4.5 3.5 0 3.5 C4.5 3.5 8.5 6 8.5 11 L8.5 23 "
            + "C8.5 27 4.5 29 0 29 C-4.5 29 -8.5 27 -8.5 23 Z "
            + "M-7 45 C-3 47 3 47 7 45 "
            + "M-5 50 C-2 51.5 2 51.5 5 50"
    )

    /// The landmarks, in meters from the foot of the line, up from the
    /// ground: a person, a two-storey house, a ten-storey block with its plant
    /// room, and the Statue of Liberty, 93 meters from the ground to the
    /// torch, standing `statueX` along.
    private static let landmarks = path(
        "M0.7 1.45 L0.7 0.9 M0.55 0 L0.7 0.9 L0.85 0 M0.52 0.98 L0.7 1.36 L0.88 0.98 "
            + "M2.2 0 L2.2 5.2 M5.8 5.2 L5.8 0 M1.9 5.2 L4 8 L6.1 5.2 Z M5 6.67 L5 7.4 L5.4 7.4 L5.4 6.13 "
            + "M8 0 L8 30 L16 30 L16 0 "
            + "M10 30 L10 31.5 L13 31.5 L13 30"
    )
    /// The house's door and windows, and the block's door and floors, faint.
    private static let landmarkDetail: Path = {
        var detail = path(
            "M2.6 0 L2.6 2.1 L3.4 2.1 L3.4 0 "
                + "M4.3 1 L5.1 1 L5.1 2 L4.3 2 Z M2.6 3.2 L3.4 3.2 L3.4 4.2 L2.6 4.2 Z "
                + "M4.3 3.2 L5.1 3.2 L5.1 4.2 L4.3 4.2 Z "
                + "M11.2 0 L11.2 2.4 L12.8 2.4 L12.8 0"
        )
        for floor in 1..<floors {
            let y = CGFloat(floor) * floorMeters
            detail.move(to: CGPoint(x: 8, y: y))
            detail.addLine(to: CGPoint(x: 16, y: y))
        }
        return detail
    }()
    private static let floors = 10
    private static let floorMeters: CGFloat = 3
    private static let personHead = (center: CGPoint(x: 0.7, y: 1.6), radius: CGFloat(0.15))

    /// The statue, about its own middle: the island's base, the pedestal, the
    /// figure with its torch and tablet, and the rays of its crown.
    private static let statue: Path = {
        var statue = path(
            "M-13 0 L-10.5 20 L10.5 20 L13 0 "
                + "M-8 20 L-6.6 43 L-7.6 44 L-7.6 47 L7.6 47 L7.6 44 L6.6 43 L8 20 "
                + "M-4.2 47 C-4.6 58 -4.3 70 -3.6 79 L-1.2 80.5 L1.2 80.5 L3.6 79 C4.3 70 4.6 58 4.2 47 "
                + "M-3.5 78.8 L-4.9 89.2 L-3.3 89.4 L-1.9 80 "
                + "M-5.4 89.4 L-2.8 89.6 L-3.4 91 L-4.8 90.9 Z "
                + "M-4.6 91 Q-4.7 92.5 -4.05 93 Q-3.5 92.5 -3.6 91 "
                + "M2.2 66.5 L5.2 68.4 L4.6 74 L1.6 72.2 Z"
        )
        for degrees in crownRays {
            let angle = degrees * .pi / 180
            let head = statueHead.center
            statue.move(to: CGPoint(x: head.x + 2.3 * cos(angle), y: head.y + 2.3 * sin(angle)))
            statue.addLine(to: CGPoint(x: head.x + 4.3 * cos(angle), y: head.y + 4.3 * sin(angle)))
        }
        return statue
    }()
    private static let statueDetail = path("M-7.2 33 L7.2 33")
    private static let statueX: CGFloat = 38
    private static let statueHead = (center: CGPoint(x: 0, y: 82.4), radius: CGFloat(1.9))
    private static let crownRays: [CGFloat] = [50, 70, 90, 110, 130]

    /// Where the drawing stands at a moment: the thumb's lift, the line's
    /// height, how much of it shows and the view's height, in meters.
    private struct Frame {
        var lift: Double
        var meters: Double
        var seen: Double
        var view: Double
    }

    var body: some View {
        Canvas { context, size in
            let scale = min(size.width / Self.width, size.height / Self.height)
            let origin = CGPoint(
                x: (size.width - Self.width * scale) / 2,
                y: (size.height - Self.height * scale) / 2
            )
            let frame = self.frame(at: elapsed)
            context.drawLayer { layer in
                layer.translateBy(x: origin.x, y: origin.y)
                layer.scaleBy(x: scale, y: scale)
                draw(frame, in: &layer)
            }

            var counter = context
            counter.opacity = frame.seen
            counter.draw(
                Text(counterText(frame.meters))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary),
                at: CGPoint(
                    x: origin.x + (Self.lineX - Self.counterGap) * scale,
                    y: origin.y + min(tip(frame), Self.ground - Self.counterFloor) * scale
                ),
                anchor: .trailing
            )
        }
        .accessibilityHidden(true)
    }

    /// The drawing in its own box: the ground, the landmarks and the line in
    /// the view of the moment, and the thumb in front of them, with the sides
    /// faded out.
    private func draw(_ frame: Frame, in context: inout GraphicsContext) {
        let box = CGRect(x: 0, y: 0, width: Self.width, height: Self.height)
        context.clip(to: Path(box))
        context.clipToLayer { mask in
            mask.fill(
                Path(box),
                with: .linearGradient(
                    Gradient(stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black, location: Self.edgeFade),
                        .init(color: .black, location: 1 - Self.edgeFade),
                        .init(color: .clear, location: 1),
                    ]),
                    startPoint: CGPoint(x: box.minX, y: 0),
                    endPoint: CGPoint(x: box.maxX, y: 0)
                )
            )
        }

        let muted = GraphicsContext.Shading.style(.secondary)
        let accent = GraphicsContext.Shading.color(WizardStyle.accent)
        let outline = StrokeStyle(lineWidth: 1, lineCap: .round, lineJoin: .round)

        var faint = context
        faint.opacity = 0.5
        var groundLine = Path()
        groundLine.move(to: CGPoint(x: 0, y: Self.ground))
        groundLine.addLine(to: CGPoint(x: Self.width, y: Self.ground))
        faint.stroke(groundLine, with: muted, lineWidth: 1)

        var shown = context
        shown.opacity = frame.seen
        shown.drawLayer { group in
            // Meters to the box: the foot of the line at the origin, up the
            // right way. The strokes stay one unit wide however far it zooms.
            let scale = Self.ground / frame.view
            let toBox = CGAffineTransform(translationX: Self.lineX, y: Self.ground)
                .scaledBy(x: scale, y: -scale)
            let statueToBox = CGAffineTransform(translationX: Self.statueX, y: 0).concatenating(toBox)
            var faintGroup = group
            faintGroup.opacity = 0.5

            group.stroke(Self.landmarks.applying(toBox), with: muted, style: outline)
            faintGroup.stroke(Self.landmarkDetail.applying(toBox), with: muted, style: outline)
            group.stroke(
                Self.circle(Self.personHead.center, Self.personHead.radius).applying(toBox),
                with: muted,
                style: outline
            )
            group.stroke(Self.statue.applying(statueToBox), with: muted, style: outline)
            faintGroup.stroke(Self.statueDetail.applying(statueToBox), with: muted, style: outline)
            group.stroke(
                Self.circle(Self.statueHead.center, Self.statueHead.radius).applying(statueToBox),
                with: muted,
                style: outline
            )

            let tip = self.tip(frame)
            var line = Path()
            line.move(to: CGPoint(x: Self.lineX, y: Self.ground))
            line.addLine(to: CGPoint(x: Self.lineX, y: tip))
            group.stroke(line, with: accent, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            group.fill(Self.circle(CGPoint(x: Self.lineX, y: tip), Self.tipRadius), with: accent)
        }

        // The thumb is filled with whatever is behind the drawing, so it
        // passes in front of the ground and the line's foot.
        var thumb = context
        thumb.translateBy(x: Self.lineX, y: Self.ground + Self.thumbRest - frame.lift * Self.lift)
        thumb.blendMode = .destinationOut
        thumb.fill(Self.thumb, with: .color(.black))
        thumb.blendMode = .normal
        thumb.stroke(Self.thumb, with: muted, style: StrokeStyle(lineWidth: 1.25, lineJoin: .round))
        thumb.opacity = 0.5
        thumb.stroke(Self.thumbDetail, with: muted, style: StrokeStyle(lineWidth: 1, lineCap: .round))
    }

    /// Where the line's tip stands in the box.
    private func tip(_ frame: Frame) -> CGFloat {
        Self.ground - frame.meters * Self.ground / frame.view
    }

    /// The counter: tenths of a meter while the line is short, whole meters
    /// once it is not, and the unit spelled out. The words are English, so
    /// the figure is written the English way whatever this Mac's own region
    /// is, with a point and not a comma.
    private func counterText(_ meters: Double) -> String {
        let tenths = (meters * 10).rounded() / 10
        let decimals = tenths < 10 ? 1 : 0
        let shown = decimals == 1 ? tenths : meters.rounded()
        let figure = shown.formatted(.number.precision(.fractionLength(decimals)).locale(Locale(identifier: "en_US")))
        return "\(figure) meters"
    }

    /// The loop `elapsed` in: the climb, a hold on a day's scroll, a fade out
    /// and back in to the start, and a rest before the next climb. It is the
    /// site's loop, which starts with the rest, begun at the climb instead.
    private func frame(at elapsed: TimeInterval) -> Frame {
        let start = climb(at: 0)
        guard elapsed > 0 else {
            return start
        }
        let seconds = elapsed.truncatingRemainder(dividingBy: Self.cycle)
        let held = Self.climbSeconds + Self.holdSeconds
        let faded = held + Self.fadeSeconds
        switch seconds {
        case ..<Self.climbSeconds:
            return climb(at: seconds)
        case ..<held:
            return climb(at: Self.climbSeconds)
        case ..<faded:
            var end = climb(at: Self.climbSeconds)
            end.seen = 1 - (seconds - held) / Self.fadeSeconds
            return end
        case ..<(faded + Self.fadeSeconds):
            var back = start
            back.seen = (seconds - faded) / Self.fadeSeconds
            return back
        default:
            return start
        }
    }

    /// The climb `seconds` in: the swipe under way, the thumb up and back
    /// down, the line coasting on after it, and the view catching up once it
    /// has.
    private func climb(at seconds: TimeInterval) -> Frame {
        let swipeSeconds = Self.climbSeconds / Double(Self.swipes)
        let swipe = min(Self.swipes - 1, Int((seconds / swipeSeconds).rounded(.down)))
        let through = seconds >= Self.climbSeconds
            ? 1
            : (seconds - Double(swipe) * swipeSeconds) / swipeSeconds
        let from = reach(swipe)
        let to = reach(swipe + 1)
        let lift = through < Self.push
            ? SiteEasing.easeInOut(through / Self.push)
            : 1 - SiteEasing.easeInOut((through - Self.push) / (1 - Self.push))
        let followed = SiteEasing.easeInOut((through - Self.follow) / (1 - Self.follow))
        return Frame(
            lift: lift,
            meters: from + (to - from) * SiteEasing.smoothOut(through / Self.coast),
            seen: 1,
            view: max(Self.viewStart, (from + (to - from) * followed) / Self.tipAt)
        )
    }

    /// How high the line stands after `swipe` swipes, from the ground to a
    /// day's scroll.
    private func reach(_ swipe: Int) -> Double {
        swipe == 0 ? 0 : meters * pow(Self.growth, Double(swipe - Self.swipes))
    }

    private static func circle(_ center: CGPoint, _ radius: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
    }

    /// SVG path data as a path, for the commands the site's drawing is written
    /// in: M, L, C, Q and Z, all absolute.
    private static func path(_ data: String) -> Path {
        let tokens = data.matches(of: #/[A-Za-z]|-?[0-9.]+/#).map { String($0.output) }
        var path = Path()
        var index = 0
        var command = "M"
        func number() -> CGFloat {
            defer { index += 1 }
            return CGFloat(Double(tokens[index]) ?? 0)
        }
        func point() -> CGPoint {
            let x = number()
            return CGPoint(x: x, y: number())
        }
        while index < tokens.count {
            if tokens[index].first?.isLetter == true {
                command = tokens[index]
                index += 1
            }
            switch command {
            case "M":
                path.move(to: point())
                command = "L"
            case "L":
                path.addLine(to: point())
            case "C":
                let control1 = point()
                let control2 = point()
                path.addCurve(to: point(), control1: control1, control2: control2)
            case "Q":
                let control = point()
                path.addQuadCurve(to: point(), control: control)
            case "Z":
                path.closeSubpath()
                command = ""
            default:
                index = tokens.count
            }
        }
        return path
    }
}

#Preview {
    TimelineView(.animation) { timeline in
        let elapsed = timeline.date.timeIntervalSinceReferenceDate
        HStack(spacing: 0) {
            ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                FingerDrawing(elapsed: elapsed)
                    .frame(width: 320, height: 240)
                    .padding(20)
                    .background(.background)
                    .environment(\.colorScheme, scheme)
            }
        }
    }
}
