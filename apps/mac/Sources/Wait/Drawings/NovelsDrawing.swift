import SwiftUI

/// A manuscript writing itself: lines of words typed in left to right, the
/// page turned over when it is full and the next one started, faster and
/// faster. Every finished page drops onto the pile beside it, in orange.
///
/// The site's novels drawing, drawn in its 320 by 216 box and scaled to fit
/// whatever frame it is given. Everything on it is a function of `elapsed`,
/// the seconds since it started: the run takes `duration`, and past it the
/// pile stands and the caret pulses at the end of the last page.
struct NovelsDrawing: View {
    /// The whole run, from the first word to the last page done.
    static let duration: TimeInterval = 4

    let elapsed: TimeInterval
    /// The novels the hours would have written. Past `pileMax`, a slab of the
    /// pile stands for more than one.
    let amount: Int

    init(elapsed: TimeInterval, amount: Int = 87) {
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

extension NovelsDrawing {
    private static let box = CGSize(width: 320, height: 216)
    /// How long each page takes, before the run is scaled to its length: every
    /// page quicker than the one before, and the last few slowing again, so
    /// the run lands rather than stops.
    private static let speedUp = 0.68
    private static let slowDown = 0.45
    private static let settle = 0.6
    /// The page being written, on the right, square-cornered like paper.
    private static let sheet = CGRect(x: 147, y: 26, width: 122, height: 164)
    /// The text: a margin all round and a line every so often, in two
    /// paragraphs. A paragraph's first line is indented and its last one
    /// stops short.
    private static let margin = 16.0
    private static let firstLine = sheet.minY + 24
    private static let linePitch = 14.5
    private static let lineCount = 9
    private static let indent = 11.0
    private static let short = 0.55
    private static let paragraphEnds: Set<Int> = [4, 8]
    /// A word is a rounded bar this thick, with this much paper to the next.
    private static let wordWidth = 3.4
    private static let wordGap = 6.5
    /// The lengths the words take in turn. A word that does not fit goes to
    /// the next line, the way text wraps, so every line ends ragged.
    private static let wordLengths: [Double] = [12, 7, 16, 9, 5, 13, 8, 17, 11, 7, 15, 9, 8, 12, 5, 16]
    private static let textOpacity = 0.6
    /// The share of a page's time spent writing it. The rest turns it over.
    private static let writing = 0.78
    /// How far the turning page's free edge grows toward the reader, top and
    /// bottom, at its steepest.
    private static let lift = 13.0
    /// The caret: how far it reaches either side of its line, how far it
    /// stands off the last word, and how it pulses once the run is done.
    private static let caretReach = 6.0
    private static let caretGap = 2.5
    private static let caretWidth = 1.4
    private static let caretPulse: TimeInterval = 0.9
    private static let caretDim = 0.2
    /// The pile of finished manuscripts, left of the page, a slab each.
    private static let pileMax = 24
    private static let pileX = 51.0
    private static let pileWidth = 67.0
    private static let pilePitch = 5.3
    private static let slabWidth = 2.4
    /// Stacked by hand, a slab sits up to two of these off the one under it,
    /// either way.
    private static let slabShift = 1.1
    /// A slab drops onto the pile from this high, over this share of a page,
    /// landing as the page is done.
    private static let dropHeight = 11.0
    private static let drop = 0.2

    private struct Word {
        let from: Double
        let to: Double
    }

    /// A line of the page: where it starts and ends, and how much writing
    /// comes before it.
    private struct Line {
        let before: Double
        let end: Double
        let start: Double
        let words: [Word]
        let y: Double
    }

    /// The page's text, laid out once.
    private static let lines: [Line] = {
        let left = sheet.minX + margin
        let right = sheet.maxX - margin
        var word = 0
        var before = 0.0
        return (0..<lineCount).map { index in
            let start = index == 0 || paragraphEnds.contains(index - 1) ? left + indent : left
            let limit = paragraphEnds.contains(index) ? left + (right - left) * short : right
            var words: [Word] = []
            var at = start
            var length = wordLengths[word % wordLengths.count]
            while at + length <= limit {
                words.append(Word(from: at, to: at + length))
                at += length + wordGap
                word += 1
                length = wordLengths[word % wordLengths.count]
            }
            let end = words.last?.to ?? start
            let line = Line(before: before, end: end, start: start, words: words, y: firstLine + Double(index) * linePitch)
            before += end - start
            return line
        }
    }()

    /// How far the writing runs on a whole page, one line after the other.
    private static let textLength = lines.reduce(0) { $0 + $1.end - $1.start }

    /// How long each page takes, relative to the others.
    private static func pageWeights(_ pages: Int) -> [Double] {
        (0..<pages).map { page in
            pow(speedUp, Double(page)) + settle * pow(slowDown, Double(pages - 1 - page))
        }
    }

    /// How many pages in the run is `run` of the way through it, counting the
    /// part of the one under way.
    private static func pagesAt(_ run: Double, weights: [Double]) -> Double {
        var left = run * weights.reduce(0, +)
        for (page, weight) in weights.enumerated() {
            if left < weight {
                return Double(page) + left / weight
            }
            left -= weight
        }
        return Double(weights.count)
    }

    /// When a page is done, in pages: the last is all writing, and every other
    /// one turns after it.
    private static func doneAt(_ page: Int, pages: Int) -> Double {
        Double(page) + (page == pages - 1 ? 1 : writing)
    }

    /// A point of the page turned `angle` about its left edge: it closes in on
    /// that edge while the far side grows toward the reader.
    private static func turn(_ x: Double, _ y: Double, _ angle: Double) -> CGPoint {
        let along = x - sheet.minX
        let rise = (y - sheet.midY) / (sheet.height / 2) * (along / sheet.width) * lift
        return CGPoint(x: sheet.minX + along * cos(angle), y: y + rise * sin(angle))
    }

    /// The page's edge, turned `angle` about its left side.
    private static func leafPath(_ angle: Double) -> Path {
        Path { path in
            path.move(to: turn(sheet.minX, sheet.minY, angle))
            path.addLine(to: turn(sheet.maxX, sheet.minY, angle))
            path.addLine(to: turn(sheet.maxX, sheet.maxY, angle))
            path.addLine(to: turn(sheet.minX, sheet.maxY, angle))
            path.closeSubpath()
        }
    }

    /// The words written once `written` of the page is, as one path, on a
    /// page turned `angle`.
    private static func textPath(_ written: Double, _ angle: Double) -> Path {
        let ahead = written * textLength
        return Path { path in
            for line in lines {
                for word in line.words {
                    let reach = min(word.to, line.start + ahead - line.before)
                    guard reach > word.from else { continue }
                    let from = word.from + wordWidth / 2
                    let to = max(from, reach - wordWidth / 2)
                    path.move(to: turn(from, line.y, angle))
                    path.addLine(to: turn(to, line.y, angle))
                }
            }
        }
    }

    /// Where the writing has got to once `written` of the page is: just after
    /// the last word on its line.
    private static func headAt(_ written: Double) -> CGPoint {
        let ahead = written * textLength
        guard let line = lines.last(where: { $0.before <= ahead }) else {
            return CGPoint(x: sheet.minX + margin, y: firstLine)
        }
        return CGPoint(x: min(line.end, line.start + ahead - line.before), y: line.y)
    }

    /// The caret's strength `elapsed` in: whole while the page is written,
    /// then slowly fading and coming back while it waits for the next.
    private static func caretOpacity(_ elapsed: TimeInterval) -> Double {
        guard elapsed > duration else { return 1 }
        let fade = 0.5 - 0.5 * cos(.pi * (elapsed - duration) / caretPulse)
        return 1 - (1 - caretDim) * fade
    }

    private static func draw(in context: inout GraphicsContext, size: CGSize, elapsed: TimeInterval, amount: Int) {
        let fit = min(size.width / box.width, size.height / box.height)
        context.translateBy(x: (size.width - box.width * fit) / 2, y: (size.height - box.height * fit) / 2)
        context.scaleBy(x: fit, y: fit)

        let run = SiteEasing.clamp(elapsed / duration)
        let pages = max(0, min(pileMax, amount))
        let at = pagesAt(run, weights: pageWeights(pages))
        let page = max(0, min(Int(at.rounded(.down)), pages - 1))
        let last = page == pages - 1
        let into = at - Double(page)
        let written = pages == 0 ? 0 : min(1, into / (last ? 1 : writing))
        // The turn starts slowly and falls the rest of the way, the way a page
        // does.
        let turned = last ? 0 : SiteEasing.clamp((into - writing) / (1 - writing))
        let angle = .pi / 2 * turned * turned
        let head = headAt(written)

        // A finished manuscript, edge on: the novels the hours would have
        // written, stacked by hand, so no slab sits quite square on the one
        // under it.
        let slab = StrokeStyle(lineWidth: slabWidth, lineCap: .round)
        for index in 0..<pages {
            let landed = SiteEasing.clamp((at - doneAt(index, pages: pages)) / drop + 1)
            guard landed > 0 else { continue }
            let y = sheet.maxY - slabWidth / 2 - Double(index) * pilePitch - dropHeight * pow(1 - landed, 2)
            let shift = Double(((index * 7) % 5) - 2) * slabShift
            var line = Path()
            line.move(to: CGPoint(x: pileX + shift, y: y))
            line.addLine(to: CGPoint(x: pileX + pileWidth + shift, y: y))
            var dropping = context
            dropping.opacity = landed
            dropping.stroke(line, with: .color(WizardStyle.accent), style: slab)
        }

        let words = StrokeStyle(lineWidth: wordWidth, lineCap: .round)
        let paper = Path(sheet)
        context.fill(paper, with: .style(.background))
        context.stroke(paper, with: .style(.secondary), lineWidth: 1)

        if turned > 0 {
            // The written page turning over, with the next one blank under it.
            var leaf = context
            leaf.opacity = min(1, cos(angle) * 4)
            leaf.drawLayer { layer in
                let edge = leafPath(angle)
                layer.fill(edge, with: .style(.background))
                layer.stroke(edge, with: .style(.secondary), lineWidth: 1)
                var text = layer
                text.opacity = textOpacity * cos(angle)
                text.stroke(textPath(1, angle), with: .style(.secondary), style: words)
            }
        } else {
            var text = context
            text.opacity = textOpacity
            text.stroke(textPath(written, 0), with: .style(.secondary), style: words)

            var caret = Path()
            caret.move(to: CGPoint(x: head.x + caretGap, y: head.y - caretReach))
            caret.addLine(to: CGPoint(x: head.x + caretGap, y: head.y + caretReach))
            var blinking = context
            blinking.opacity = caretOpacity(elapsed)
            blinking.stroke(
                caret,
                with: .color(WizardStyle.accent),
                style: StrokeStyle(lineWidth: caretWidth, lineCap: .round)
            )
        }
    }
}

#Preview {
    TimelineView(.animation) { timeline in
        NovelsDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: NovelsDrawing.duration + 3)
        )
    }
    .aspectRatio(4 / 3, contentMode: .fit)
    .frame(width: 400)
    .padding()
}
