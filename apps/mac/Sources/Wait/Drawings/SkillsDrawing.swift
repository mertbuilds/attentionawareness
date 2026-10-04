import SwiftUI

/// The world-class skills the hours would have bought: a ten-thousand-hour
/// track for each, under its ruler and its name, filling orange one after
/// another, with its hours over the end once it is full.
///
/// The site's skills drawing, drawn in its 320 by 216 box and scaled to fit
/// whatever frame it is given. Everything on it is a function of `elapsed`,
/// the seconds since it started: the run takes `duration`, and the last
/// track's hours finish fading in a moment after it.
struct SkillsDrawing: View {
    /// The whole run, from the first track starting to the last one full.
    static let duration: TimeInterval = 4

    let elapsed: TimeInterval
    /// The skills, a track each.
    let amount: Int
    /// What the tracks are for, in turn and round again.
    let labels: [String]
    /// The hours each one took, over the end of its track once it is full.
    let hoursLabel: String

    init(
        elapsed: TimeInterval,
        amount: Int = 4,
        labels: [String] = ["Software design", "Drawing", "Photography", "Chess"],
        hoursLabel: String = "10,000 hours"
    ) {
        self.elapsed = elapsed
        self.amount = amount
        self.labels = labels
        self.hoursLabel = hoursLabel
    }

    var body: some View {
        Canvas { context, size in
            Self.draw(in: &context, size: size, elapsed: elapsed, amount: amount, labels: labels, hoursLabel: hoursLabel)
        }
        .accessibilityHidden(true)
    }
}

extension SkillsDrawing {
    private static let box = CGSize(width: 320, height: 216)
    /// What one skill takes: the folk figure for mastery.
    private static let hours = 10_000
    /// The ruler over each track: a fine mark every 250 hours, a longer one
    /// every thousand.
    private static let fine = 250
    private static let long = 1000
    private static let fineLength = 3.0
    private static let longLength = 6.0
    /// The track's two ends, how thick it is, and how far over it the ruler
    /// stands.
    private static let start = 16.0
    private static let end = box.width - start
    private static let track = 6.0
    private static let rulerGap = 2.0
    /// The skill over the start of each ruler, and its hours over the end once
    /// the track is full.
    private static let labelSize = 11.0
    private static let labelGap = 5.0
    /// The rows stand this far apart at most, inside this much of the box's
    /// height.
    private static let rowPitch = 48.0
    private static let room = 200.0
    /// The part of each track's turn it spends filling: the rest is a beat
    /// before the next.
    private static let fillShare = 0.84
    /// How long a full track's hours take to come in.
    private static let hoursFade: TimeInterval = 0.4

    /// The middle of each track, the rows centred in the box.
    private static func rows(_ amount: Int) -> [Double] {
        let count = max(0, amount)
        let pitch = min(rowPitch, room / Double(max(1, count)))
        let above = track / 2 + rulerGap + longLength + labelGap + labelSize
        let height = Double(count - 1) * pitch + above + track / 2
        let top = (box.height - height) / 2 + above
        return (0..<count).map { top + Double($0) * pitch }
    }

    /// When track `index` of `count` is full: each has its turn, one after
    /// another.
    private static func fullAt(_ index: Int, count: Int) -> TimeInterval {
        let turn = duration / Double(count)
        return Double(index) * turn + turn * fillShare
    }

    /// How much of a track is filled `seconds` in: it eases full in its turn.
    private static func filled(_ index: Int, count: Int, seconds: Double) -> Double {
        let turn = duration / Double(count)
        return SiteEasing.easeInOut((seconds - Double(index) * turn) / (turn * fillShare))
    }

    /// The marks over a track, one each 250 hours from the first to the last.
    private static func rulerPath(_ y: Double) -> Path {
        let foot = y - track / 2 - rulerGap
        return Path { path in
            for step in 0...(hours / fine) {
                let x = start + (end - start) * Double(step * fine) / Double(hours)
                let length = (step * fine) % long == 0 ? longLength : fineLength
                path.move(to: CGPoint(x: x, y: foot))
                path.addLine(to: CGPoint(x: x, y: foot - length))
            }
        }
    }

    /// Words over the ruler, small and quiet, sitting on `baseline` and
    /// starting at `x`, or ending there when `trailing`.
    private static func label(
        _ words: String,
        x: Double,
        baseline: Double,
        trailing: Bool,
        opacity: Double,
        in context: GraphicsContext
    ) {
        guard !words.isEmpty, opacity > 0 else { return }
        var quiet = context
        quiet.opacity = opacity
        var text = quiet.resolve(Text(words).font(.system(size: labelSize)))
        text.shading = .style(.secondary)
        let size = text.measure(in: CGSize(width: CGFloat.infinity, height: CGFloat.infinity))
        let top = baseline - text.firstBaseline(in: size)
        quiet.draw(text, at: CGPoint(x: x, y: top), anchor: trailing ? .topTrailing : .topLeading)
    }

    private static func draw(
        in context: inout GraphicsContext,
        size: CGSize,
        elapsed: TimeInterval,
        amount: Int,
        labels: [String],
        hoursLabel: String
    ) {
        let fit = min(size.width / box.width, size.height / box.height)
        context.translateBy(x: (size.width - box.width * fit) / 2, y: (size.height - box.height * fit) / 2)
        context.scaleBy(x: fit, y: fit)

        let seconds = min(duration, max(0, elapsed))
        let ys = rows(amount)
        for (index, y) in ys.enumerated() {
            let labelY = y - track / 2 - rulerGap - longLength - labelGap
            if !labels.isEmpty {
                label(labels[index % labels.count], x: start, baseline: labelY, trailing: false, opacity: 1, in: context)
            }
            // The hours wait unseen and come in once the track is full.
            let full = fullAt(index, count: ys.count)
            let shown = elapsed < full ? 0 : SiteEasing.smoothOut((elapsed - full) / hoursFade)
            label(hoursLabel, x: end, baseline: labelY, trailing: true, opacity: shown, in: context)

            context.stroke(Path(CGRect(x: start, y: y - track / 2, width: end - start, height: track)), with: .style(.tertiary), lineWidth: 1)
            context.stroke(rulerPath(y), with: .style(.tertiary), lineWidth: 1)

            // The hours, solid orange, a hair larger than the track so they
            // cover its outline.
            let width = filled(index, count: ys.count, seconds: seconds) * (end - start + 1)
            if width > 0 {
                context.fill(
                    Path(CGRect(x: start - 0.5, y: y - track / 2 - 0.5, width: width, height: track + 1)),
                    with: .color(WizardStyle.accent)
                )
            }
        }
    }
}

#Preview {
    TimelineView(.animation) { timeline in
        SkillsDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: SkillsDrawing.duration + 3)
        )
    }
    .aspectRatio(4 / 3, contentMode: .fit)
    .frame(width: 400)
    .padding()
}
