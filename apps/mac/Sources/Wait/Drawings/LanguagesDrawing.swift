import SwiftUI

/// "Hello" in a speech bubble, flipping through one language after another,
/// slowly at first, then in a blur, then slowly onto the last. Under it a tick
/// for every language turns orange as it is counted.
///
/// A port of the site's languages drawing, drawn in the site's 320 by 216 box
/// and scaled to fit. Everything on it is worked out from `elapsed`, so the
/// clock lives with the parent; past `duration` it stands on the last word
/// with every tick counted.
struct LanguagesDrawing: View {
    /// The whole run, the site's `drawing.deck`.
    static let duration: TimeInterval = 4

    let elapsed: TimeInterval
    /// How many languages: one flip and one tick for each.
    let amount: Int

    init(elapsed: TimeInterval, amount: Int = 29) {
        self.elapsed = elapsed
        self.amount = amount
    }

    /// Hello, then the same word in one language after another, each in its
    /// own script where it has one. The list comes round again if the count
    /// outruns it.
    private static let greetings = [
        "hello",
        "hola",
        "bonjour",
        "привет",
        "こんにちは",
        "merhaba",
        "你好",
        "ciao",
        "مرحبا",
        "olá",
        "नमस्ते",
        "hallo",
        "안녕하세요",
        "γεια σου",
        "שלום",
        "hej",
        "สวัสดี",
        "cześć",
        "xin chào",
        "jambo",
        "ahoj",
        "வணக்கம்",
        "halo",
        "გამარჯობა",
        "szia",
        "բարեւ",
        "kia ora",
        "নমস্কার",
        "salut",
        "aloha",
        "sawubona",
        "hei",
    ]

    private static let box = CGSize(width: 320, height: 216)
    /// The bubble the word is said in, and its tail, hanging off the lower left.
    private static let bubble = (top: 32.0, right: 288.0, bottom: 144.0, left: 32.0, radius: 6.0)
    private static let tail = (from: 84.0, tipX: 56.0, tipY: 160.0, to: 64.0)
    private static let wordY = (bubble.top + bubble.bottom) / 2
    private static let wordSize = 32.0
    /// A word swaps for the next the way any text does on the site: the old
    /// one goes up and out of focus, and only then does the new one come up
    /// into it, so the two are never on top of each other.
    private static let swapRise = 4.0
    private static let swapBlur = 2.0
    /// A tick for every language under the bubble.
    private static let ticks = (top: 174.0, right: 272.0, bottom: 184.0, left: 48.0)
    /// How much of its turn a word stands still before it flips to the next.
    private static let hold = 0.5

    private static let bubblePath: Path = {
        let (top, right, bottom, left, radius) = bubble
        var path = Path()
        path.move(to: CGPoint(x: left + radius, y: top))
        path.addLine(to: CGPoint(x: right - radius, y: top))
        path.addArc(
            tangent1End: CGPoint(x: right, y: top),
            tangent2End: CGPoint(x: right, y: top + radius),
            radius: radius
        )
        path.addLine(to: CGPoint(x: right, y: bottom - radius))
        path.addArc(
            tangent1End: CGPoint(x: right, y: bottom),
            tangent2End: CGPoint(x: right - radius, y: bottom),
            radius: radius
        )
        path.addLine(to: CGPoint(x: tail.from, y: bottom))
        path.addLine(to: CGPoint(x: tail.tipX, y: tail.tipY))
        path.addLine(to: CGPoint(x: tail.to, y: bottom))
        path.addLine(to: CGPoint(x: left + radius, y: bottom))
        path.addArc(
            tangent1End: CGPoint(x: left, y: bottom),
            tangent2End: CGPoint(x: left, y: bottom - radius),
            radius: radius
        )
        path.addLine(to: CGPoint(x: left, y: top + radius))
        path.addArc(
            tangent1End: CGPoint(x: left, y: top),
            tangent2End: CGPoint(x: left + radius, y: top),
            radius: radius
        )
        path.closeSubpath()
        return path
    }()

    var body: some View {
        Canvas { context, size in
            let scale = size.width / Self.box.width
            var drawing = context
            drawing.scaleBy(x: scale, y: scale)

            drawing.stroke(
                Self.bubblePath,
                with: .style(.secondary),
                style: StrokeStyle(lineWidth: 1, lineJoin: .round)
            )

            let reel = Self.reel(at: SiteEasing.easeInOut(elapsed / Self.duration), flips: amount)
            let whole = reel.rounded(.down)
            let flip = reel - whole
            // How far into the swap the word is: none while it stands, all of
            // it at the turn, where the old word is gone and the new one not
            // yet come.
            let away = 1 - abs(1 - 2 * flip)
            let shown = Int(whole) + (flip < 0.5 ? 0 : 1)
            let y = flip < 0.5
                ? Self.wordY - Self.swapRise * 2 * flip
                : Self.wordY + Self.swapRise * 2 * (1 - flip)

            // Drawn in the canvas's own points so the blur is the site's blur
            // at this size.
            var word = context
            word.opacity = 1 - away
            if away > 0 {
                word.addFilter(.blur(radius: Self.swapBlur * away * scale))
            }
            word.draw(
                Text(Self.greetings[shown % Self.greetings.count])
                    .font(.system(size: Self.wordSize * scale))
                    .foregroundStyle(.primary),
                at: CGPoint(x: Self.box.width / 2 * scale, y: y * scale),
                anchor: .center
            )

            let count = max(0, amount)
            let counted = Int(reel.rounded())
            var done = Path()
            var rest = Path()
            for index in 0..<count {
                let x = count > 1
                    ? Self.ticks.left + Double(index) * (Self.ticks.right - Self.ticks.left) / Double(count - 1)
                    : Self.box.width / 2
                if index < counted {
                    done.move(to: CGPoint(x: x, y: Self.ticks.top))
                    done.addLine(to: CGPoint(x: x, y: Self.ticks.bottom))
                } else {
                    rest.move(to: CGPoint(x: x, y: Self.ticks.top))
                    rest.addLine(to: CGPoint(x: x, y: Self.ticks.bottom))
                }
            }
            let tick = StrokeStyle(lineWidth: 1.5, lineCap: .round)
            drawing.stroke(rest, with: .style(.tertiary), style: tick)
            drawing.stroke(done, with: .color(WizardStyle.accent), style: tick)
        }
        .aspectRatio(Self.box.width / Self.box.height, contentMode: .fit)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }

    /// Where the reel stands `t` of the way through: a whole number while a
    /// word holds, and the fraction of a flip on the way to the next.
    private static func reel(at t: Double, flips: Int) -> Double {
        let at = t * Double(max(0, flips))
        let whole = at.rounded(.down)
        return whole + SiteEasing.smoothstep((at - whole - hold) / (1 - hold))
    }
}

#Preview("Playing") {
    TimelineView(.animation) { timeline in
        LanguagesDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: LanguagesDrawing.duration + 1.5)
        )
    }
    .frame(width: 400, height: 300)
}

#Preview("Finished, dark") {
    LanguagesDrawing(elapsed: LanguagesDrawing.duration)
        .frame(width: 400, height: 300)
        .background(.background)
        .environment(\.colorScheme, .dark)
}
