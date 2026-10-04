import SwiftUI

/// A sound that turns into one instrument after another: piano keys lit in a
/// run, guitar strings strummed, a drum struck and rippling, round and round,
/// faster each time. It ends as the sound it started from, in orange.
///
/// The site's instruments drawing, drawn in its 320 by 216 box and scaled to
/// fit whatever frame it is given. Everything on it is a function of
/// `elapsed`, the seconds since it started: the run takes `duration`, twice an
/// answer's time so no scene is rushed, and past it the last sound breathes.
struct InstrumentsDrawing: View {
    /// The whole run, from the first sound to the last.
    static let duration: TimeInterval = 8

    let elapsed: TimeInterval
    /// The instruments the hours would have learned. Past `shownMax`, one
    /// played stands for more than one.
    let amount: Int

    init(elapsed: TimeInterval, amount: Int = 21) {
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

extension InstrumentsDrawing {
    private enum Scene {
        case wave, piano, guitar, drum, played
    }

    /// How a part is filled: not at all, or as a white or a black key.
    private enum Fill {
        case none, white, black
    }

    /// Every part, in every instrument, is the same shape: a box whose corners
    /// round off by the same two radii, and whose top and bottom edges can
    /// bow. Square corners make a key, full radii an ellipse, no width a bar
    /// and no height a string. A morph is the numbers in between, so a part
    /// turns into the next without ever coming apart.
    private struct Part {
        var bow = 0.0
        var fill = Fill.none
        var height = 0.0
        var lit = false
        var opacity = 1.0
        var rx = 0.0
        var ry = 0.0
        var stroke = 1.0
        var width = 0.0
        var x = 0.0
        var y = 0.0
    }

    private static let box = CGSize(width: 320, height: 216)
    /// How long each step takes, before the run is scaled to its length:
    /// every step quicker than the one before, and the last few slowing again,
    /// so the run lands rather than stops.
    private static let speedUp = 0.72
    private static let slowDown = 0.45
    private static let settle = 0.9
    /// The share of a step spent playing the instrument it stands on. The rest
    /// morphs it into the next.
    private static let playingShare = 0.55
    /// The parts morph from left to right: the last starts this share of the
    /// morph after the first.
    private static let stagger = 0.3
    /// The instruments played in turn, up to this many.
    private static let shownMax = 9
    private static let instruments: [Scene] = [.piano, .guitar, .drum]
    /// The drawing is twelve parts, one for each key of an octave: the white
    /// keys C to B, then the black ones, drawn over them. Each is its key's
    /// place in the scale, which orders them left to right in every instrument.
    private static let scale = [0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10]
    private static let whiteKeys = 7
    /// The line every instrument stands on the middle of: the middle of the box.
    private static let middle = 108.0
    /// The sound: a bar for each note, the tallest in the middle.
    private static let barsX = 49.0
    private static let barPitch = 18.5
    private static let barWidth = 4.0
    private static let wave: [Double] = [19, 35, 53, 40, 72, 51, 85, 61, 45, 67, 32, 21]
    /// How quickly the bars of the first sound rise and fall, a little apart
    /// from each other.
    private static let waveHertz = 1.4
    private static let waveSpread = 1.3
    /// The keyboard: one octave, the black keys between the white ones they
    /// sit after.
    private static let keysX = 48.0
    private static let keysY = middle - 53
    private static let whiteWidth = 32.0
    private static let whiteHeight = 106.0
    private static let blackWidth = 19.0
    private static let blackHeight = 64.0
    private static let blackAfter = [1, 2, 4, 5, 6]
    /// How many keys the run has passed over once it is gone from the last.
    private static let runLength = Double(scale.count + 2)
    private static let runLit = 1.5
    /// The neck: six strings, thin to thick, across the nut and five frets
    /// closing up toward the body.
    private static let stringParts = [7, 8, 9, 10, 11, 6]
    private static let stringsX = 32.0
    private static let stringsWidth = 256.0
    private static let stringPitch = 15.0
    private static let stringsY = middle - stringPitch * 5 / 2
    private static let stringWidth = 0.8
    private static let stringThicker = 0.16
    private static let frets: [Double] = [40, 85, 128, 168, 207, 243]
    private static let fretHeight = 91.0
    private static let nut = 2.4
    /// The strum: each string plucked this long after the one over it,
    /// ringing out and dying away.
    private static let strum = 0.07
    private static let pluck = 4.3
    private static let decay = 4.0
    private static let ringHertz = 7.0
    /// The drum: its head, the shell under it, and the six lugs round the
    /// front, by their angle off the middle.
    private static let drumX = 160.0
    private static let headY = middle - 29
    private static let headRX = 83.0
    private static let headRY = 20.0
    private static let shell = 61.0
    private static let lugs: [Double] = [-75, -45, -15, 15, 45, 75]
    private static let lugInset = 5.0
    /// The head is struck as the drum comes on, and the ripples spread out
    /// across it, one after another.
    private static let hit = 0.3
    private static let rippleFirst = 8
    private static let rippleFrom = 0.12
    private static let rippleTo = 0.94
    private static let rippleAfter = 0.12
    private static let rippleSpan = 0.6
    /// What is sounding lights at once and fades back slowly: its outline over
    /// this long, a lit key's fill over this.
    private static let strokeFade: TimeInterval = 0.4
    private static let fillFade: TimeInterval = 0.25
    private static let fadeStep: TimeInterval = 1.0 / 120
    /// Once it is done the last sound keeps breathing, each bar a little after
    /// the one before, down to this share of its height and back.
    private static let breathAfter: TimeInterval = 0.09
    private static let breath: TimeInterval = 1.4
    private static let breathDepth = 0.2

    private static func mix(_ from: Double, _ to: Double, _ t: Double) -> Double {
        from + (to - from) * t
    }

    /// The scenes in turn: the sound, the instruments played, and the sound
    /// again, played.
    private static func scenes(_ amount: Int) -> [Scene] {
        let shown = max(0, min(shownMax, amount))
        return [.wave] + (0..<shown).map { instruments[$0 % instruments.count] } + [.played]
    }

    /// How long each step takes, relative to the others.
    private static func stepWeights(_ steps: Int) -> [Double] {
        (0..<steps).map { step in
            pow(speedUp, Double(step)) + settle * pow(slowDown, Double(steps - 1 - step))
        }
    }

    /// How many steps in the run is `run` of the way through it, counting the
    /// part of the one under way.
    private static func stepsAt(_ run: Double, weights: [Double]) -> Double {
        var left = run * weights.reduce(0, +)
        for (step, weight) in weights.enumerated() {
            if left < weight {
                return Double(step) + left / weight
            }
            left -= weight
        }
        return Double(weights.count)
    }

    /// A bar of the sound, `swing` of its full height.
    private static func bar(_ note: Int, swing: Double, lit: Bool) -> Part {
        let height = wave[note] * swing
        return Part(height: height, lit: lit, stroke: barWidth, x: barsX + (Double(note) + 0.5) * barPitch, y: middle - height / 2)
    }

    /// A key, lit while the run passes over it.
    private static func key(_ part: Int, note: Int, playing: Double) -> Part {
        let run = playing * runLength - 1
        let lit = playing > 0 && Double(note) <= run && run < Double(note) + runLit
        if part < whiteKeys {
            return Part(
                fill: .white,
                height: whiteHeight,
                lit: lit,
                width: whiteWidth,
                x: keysX + Double(part) * whiteWidth,
                y: keysY
            )
        }
        let after = blackAfter[part - whiteKeys]
        return Part(
            fill: .black,
            height: blackHeight,
            lit: lit,
            width: blackWidth,
            x: keysX + Double(after) * whiteWidth - blackWidth / 2,
            y: keysY
        )
    }

    /// A string, ringing once the strum reaches it, or a fret.
    private static func fretboard(_ part: Int, playing: Double, seconds: Double) -> Part {
        guard let string = stringParts.firstIndex(of: part) else {
            return Part(height: fretHeight, stroke: part == 0 ? nut : 1, x: frets[part], y: middle - fretHeight / 2)
        }
        let since = playing - Double(string) * strum
        let swing = since < 0 ? 0 : pluck * exp(-decay * since)
        return Part(
            bow: swing * sin(2 * .pi * (ringHertz + Double(string)) * seconds),
            lit: swing > pluck / 3,
            stroke: stringWidth + Double(string) * stringThicker,
            width: stringsWidth,
            x: stringsX,
            y: stringsY + Double(string) * stringPitch
        )
    }

    /// An ellipse on the drum's head, `scale` of the head's size.
    private static func onHead(_ scale: Double) -> Part {
        Part(
            height: 2 * headRY * scale,
            rx: headRX * scale,
            ry: headRY * scale,
            width: 2 * headRX * scale,
            x: drumX - headRX * scale,
            y: headY - headRY * scale
        )
    }

    /// A part of the drum: B is the shell, C sharp the head, the other black
    /// keys the ripples across it, and the white keys C to A the lugs round
    /// the front.
    private static func drum(_ part: Int, playing: Double) -> Part {
        if part == 6 {
            var shellPart = onHead(1)
            shellPart.height = 2 * headRY + shell
            return shellPart
        }
        if part == 7 {
            var head = onHead(1)
            head.lit = playing < hit
            return head
        }
        if part >= rippleFirst {
            let spread = SiteEasing.clamp((playing - Double(part - rippleFirst) * rippleAfter) / rippleSpan)
            var ripple = onHead(mix(rippleFrom, rippleTo, 1 - (1 - spread) * (1 - spread)))
            ripple.lit = true
            ripple.opacity = 1 - spread
            return ripple
        }
        let angle = lugs[part] * .pi / 180
        return Part(
            height: shell - 2 * lugInset,
            x: drumX + headRX * sin(angle),
            y: headY + headRY * cos(angle) + lugInset
        )
    }

    /// A part as it stands in a scene, `playing` of the way through playing it.
    private static func partIn(_ scene: Scene, _ part: Int, playing: Double, seconds: Double) -> Part {
        let note = scale[part]
        switch scene {
        case .wave:
            return bar(note, swing: 0.6 + 0.4 * sin(2 * .pi * waveHertz * seconds + Double(note) * waveSpread), lit: false)
        case .piano:
            return key(part, note: note, playing: playing)
        case .guitar:
            return fretboard(part, playing: playing, seconds: seconds)
        case .drum:
            return drum(part, playing: playing)
        case .played:
            return bar(note, swing: 1, lit: true)
        }
    }

    /// A part `t` of the way from one shape to the next. Its fill and light
    /// change over at halfway.
    private static func between(_ from: Part, _ to: Part, _ t: Double) -> Part {
        let after = t >= 0.5 ? to : from
        return Part(
            bow: mix(from.bow, to.bow, t),
            fill: after.fill,
            height: mix(from.height, to.height, t),
            lit: after.lit,
            opacity: mix(from.opacity, to.opacity, t),
            rx: mix(from.rx, to.rx, t),
            ry: mix(from.ry, to.ry, t),
            stroke: mix(from.stroke, to.stroke, t),
            width: mix(from.width, to.width, t),
            x: mix(from.x, to.x, t),
            y: mix(from.y, to.y, t)
        )
    }

    /// Part `index` `seconds` into the run, and how far through its morph it
    /// is.
    private static func state(_ index: Int, seconds: Double, scenes: [Scene], weights: [Double]) -> (part: Part, t: Double) {
        let at = stepsAt(seconds / duration, weights: weights)
        let step = min(Int(at.rounded(.down)), scenes.count - 2)
        let into = at - Double(step)
        let playing = min(1, into / playingShare)
        let morph = SiteEasing.clamp((into - playingShare) / (1 - playingShare))
        let note = Double(scale[index])
        let t = SiteEasing.smoothstep((morph - note / Double(scale.count - 1) * stagger) / (1 - stagger))
        let part = between(
            partIn(scenes[step], index, playing: playing, seconds: seconds),
            partIn(scenes[step + 1], index, playing: 0, seconds: seconds),
            t
        )
        return (part, t)
    }

    /// How much orange part `index` still carries `seconds` in, its outline
    /// and its fill: all of it while it sounds, fading back from the last
    /// moment it did.
    private static func glow(_ index: Int, seconds: Double, scenes: [Scene], weights: [Double]) -> (stroke: Double, fill: Double) {
        var stroke: Double?
        var fill: Double?
        var age = 0.0
        while age <= strokeFade, seconds - age >= 0, stroke == nil || (fill == nil && age <= fillFade) {
            let past = state(index, seconds: seconds - age, scenes: scenes, weights: weights).part
            if past.lit {
                if stroke == nil {
                    stroke = 1 - SiteEasing.quadOut(age / strokeFade)
                }
                if fill == nil, past.fill != .none {
                    fill = age <= fillFade ? 1 - SiteEasing.quadOut(age / fillFade) : 0
                }
            }
            age += fadeStep
        }
        return (stroke ?? 0, fill ?? 0)
    }

    /// A part's outline, clockwise from its top left: a curve along the top,
    /// each corner a quarter ellipse, which is a straight line when its radius
    /// is none.
    private static func outline(_ part: Part) -> Path {
        let left = part.x
        let top = part.y
        let right = part.x + part.width
        let bottom = part.y + part.height
        let center = part.x + part.width / 2
        let rx = part.rx
        let ry = part.ry
        // A quarter ellipse as one cubic: its handles reach this share of the
        // radius along each edge.
        let k = 0.5523
        return Path { path in
            path.move(to: CGPoint(x: left + rx, y: top))
            path.addQuadCurve(to: CGPoint(x: right - rx, y: top), control: CGPoint(x: center, y: top + 2 * part.bow))
            path.addCurve(
                to: CGPoint(x: right, y: top + ry),
                control1: CGPoint(x: right - rx + k * rx, y: top),
                control2: CGPoint(x: right, y: top + ry - k * ry)
            )
            path.addLine(to: CGPoint(x: right, y: bottom - ry))
            path.addCurve(
                to: CGPoint(x: right - rx, y: bottom),
                control1: CGPoint(x: right, y: bottom - ry + k * ry),
                control2: CGPoint(x: right - rx + k * rx, y: bottom)
            )
            path.addQuadCurve(to: CGPoint(x: left + rx, y: bottom), control: CGPoint(x: center, y: bottom + 2 * part.bow))
            path.addCurve(
                to: CGPoint(x: left, y: bottom - ry),
                control1: CGPoint(x: left + rx - k * rx, y: bottom),
                control2: CGPoint(x: left, y: bottom - ry + k * ry)
            )
            path.addLine(to: CGPoint(x: left, y: top + ry))
            path.addCurve(
                to: CGPoint(x: left + rx, y: top),
                control1: CGPoint(x: left, y: top + ry - k * ry),
                control2: CGPoint(x: left + rx - k * rx, y: top)
            )
            path.closeSubpath()
        }
    }

    /// `from` `t` of the way to `to`, mixed the way a browser mixes two
    /// colours in a transition.
    private static func blend(_ from: Color.Resolved, _ to: Color.Resolved, _ t: Double) -> Color {
        let t = Float(t)
        let opacity = from.opacity + (to.opacity - from.opacity) * t
        guard opacity > 0 else { return .clear }
        func channel(_ a: Float, _ b: Float) -> Float {
            (a * from.opacity + (b * to.opacity - a * from.opacity) * t) / opacity
        }
        return Color(Color.Resolved(
            red: channel(from.red, to.red),
            green: channel(from.green, to.green),
            blue: channel(from.blue, to.blue),
            opacity: opacity
        ))
    }

    /// The secondary grey laid flat on the window, so a part drawn over
    /// another covers it and a fret crossing a string stays one grey, the way
    /// the site's solid muted grey does.
    private static func muted(in environment: EnvironmentValues) -> Color.Resolved {
        let ink = Color.secondary.resolve(in: environment)
        let paper = Color(nsColor: .windowBackgroundColor).resolve(in: environment)
        func channel(_ a: Float, _ b: Float) -> Float {
            a * ink.opacity + b * (1 - ink.opacity)
        }
        return Color.Resolved(
            red: channel(ink.red, paper.red),
            green: channel(ink.green, paper.green),
            blue: channel(ink.blue, paper.blue)
        )
    }

    private static func draw(in context: inout GraphicsContext, size: CGSize, elapsed: TimeInterval, amount: Int) {
        let fit = min(size.width / box.width, size.height / box.height)
        context.translateBy(x: (size.width - box.width * fit) / 2, y: (size.height - box.height * fit) / 2)
        context.scaleBy(x: fit, y: fit)

        let seconds = min(duration, max(0, elapsed))
        let order = scenes(amount)
        let weights = stepWeights(order.count - 1)
        let grey = muted(in: context.environment)
        let orange = WizardStyle.accent.resolve(in: context.environment)
        let clear = Color.Resolved(red: 0, green: 0, blue: 0, opacity: 0)

        for index in scale.indices {
            let (part, t) = state(index, seconds: seconds, scenes: order, weights: weights)
            let light = glow(index, seconds: seconds, scenes: order, weights: weights)
            var shape = part
            // The sound, once it is done, slowly rising and falling about its
            // middle.
            let breathing = (elapsed - duration - Double(scale[index]) * breathAfter) / breath
            if breathing > 0 {
                let squeeze = 1 - breathDepth * (0.5 - 0.5 * cos(.pi * breathing))
                shape.y += shape.height * (1 - squeeze) / 2
                shape.height *= squeeze
            }
            let path = outline(shape)
            var drawn = context
            drawn.opacity = part.opacity
            // A key's fill goes over the first quarter of a morph and comes
            // back over the last, so a shape on its way between two is only
            // ever drawn in outline.
            let solid = part.fill == .none ? 0 : SiteEasing.clamp(abs(t - 0.5) * 4 - 1)
            if solid > 0 {
                var filled = drawn
                filled.opacity = part.opacity * solid
                filled.fill(path, with: .color(blend(part.fill == .black ? grey : clear, orange, light.fill)))
            }
            drawn.stroke(
                path,
                with: .color(blend(grey, orange, light.stroke)),
                style: StrokeStyle(lineWidth: part.stroke, lineCap: .round, lineJoin: .round)
            )
        }
    }
}

#Preview {
    TimelineView(.animation) { timeline in
        InstrumentsDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: InstrumentsDrawing.duration + 3)
        )
    }
    .aspectRatio(4 / 3, contentMode: .fit)
    .frame(width: 400)
    .padding()
}
