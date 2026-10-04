import SwiftUI

/// Every weekend in the next twenty years, a desk-calendar tile each, running
/// back past an orange line, and each one lit in orange as it passes it: a
/// weekend that is yours again.
///
/// The site's `Weekends` from the cost story, at the site's pace and turned
/// round. On the site the tiles run left past the line and are crossed out;
/// here they run right, the way a tape runs when it is rewound, and are lit
/// rather than crossed. The dates still start at the coming Saturday, so the
/// weekends still to come wait left of the line and the weekend on it runs on
/// through the twenty years. The run eases into a pace slow enough to watch
/// the first few light up, gathers speed into a rush through the years, and
/// slows the same way to a stop on the last weekend. It is laid out in the
/// site's pixels and scaled up to fill a frame wider than the site's strip; in
/// a narrower one the tiles keep their size and fewer of them show. It is a
/// function of `elapsed` alone: past `duration` it stands on the last weekend,
/// lit.
struct WeekendsDrawing: View {
    /// The run past the line, `drawing.weekends` on the site. The last weekend
    /// lights up as the run settles on it, and is lit in full before it stops.
    static let duration = WeekendsRun.duration

    let elapsed: TimeInterval
    /// How many weekends run past the line.
    let weekends: Int
    /// The words on the tiles, from the coming Saturday on.
    private let tiles: Tiles
    private let run: WeekendsRun

    init(elapsed: TimeInterval, weekends: Int = 1040) {
        self.elapsed = elapsed
        self.weekends = weekends
        tiles = Tiles.current()
        run = weekends == Self.story.weekends ? Self.story : WeekendsRun(weekends: weekends)
    }

    /// How long a weekend takes to light up, one stroke of the site's cross.
    private static let lightUp: TimeInterval = 0.21
    /// The story's run, worked out once, since its rush has to be searched for.
    private static let story = WeekendsRun(weekends: WaitMath.horizonWeeks)
    /// A tile, how far one is from the next, and how round its corners are, in
    /// the site's pixels.
    private static let tile = CGSize(width: 64, height: 76)
    private static let pitch: CGFloat = 72
    private static let corner: CGFloat = 4
    /// A lit weekend is filled with the accent this faintly.
    private static let litFill = 0.1
    /// The tiles drawn either side of the line, enough to run past both faded
    /// edges.
    private static let reach = 5
    /// The strip at its widest, and how far the line stands out above and
    /// below it.
    private static let trackWidth: CGFloat = 520
    private static let overhang: CGFloat = 8
    /// The month's band across the top of a tile, and the two days under it.
    private static let monthSize: CGFloat = 10
    private static let monthBand: CGFloat = 18
    private static let weekdaySize: CGFloat = 9
    private static let weekdayTracking: CGFloat = 0.06
    private static let dateSize: CGFloat = 18
    private static let dayGap: CGFloat = 4
    private static let legendGap: CGFloat = 12
    private static let legendHeight: CGFloat = 16
    /// The legend fades in as the tiles start to move, `duration.slow` on the site.
    private static let legendFade: TimeInterval = 0.4
    /// The strip fades out at both ends, so the tiles come from and go nowhere
    /// in particular.
    private static let fade = LinearGradient(
        stops: [
            .init(color: .clear, location: 0),
            .init(color: .black, location: 0.25),
            .init(color: .black, location: 0.75),
            .init(color: .clear, location: 1),
        ],
        startPoint: .leading,
        endPoint: .trailing
    )

    var body: some View {
        GeometryReader { proxy in
            let tall = (proxy.size.height - Self.legendGap - Self.legendHeight)
                / (Self.tile.height + 2 * Self.overhang)
            let scale = max(0, min(tall, max(1, proxy.size.width / Self.trackWidth)))
            VStack(spacing: Self.legendGap) {
                track(scale: scale, width: min(proxy.size.width, Self.trackWidth * scale))

                Text("1 tile = 1 weekend")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(height: Self.legendHeight)
                    .opacity(legendShown)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .accessibilityHidden(true)
    }

    /// The line and the strip of tiles running past it. The tiles hide the
    /// line where they pass, so it shows above and below the strip and in the
    /// gaps between them.
    private func track(scale: CGFloat, width: CGFloat) -> some View {
        let at = run.passed(at: elapsed)
        return ZStack {
            Canvas { context, size in
                drawLine(at: at, overhang: Self.overhang * scale, size: size, in: &context)
            }
            Canvas { context, size in
                drawTiles(at: at, scale: scale, size: size, in: &context)
            }
            .frame(height: Self.tile.height * scale)
            .mask { Self.fade }
        }
        .frame(width: width, height: (Self.tile.height + 2 * Self.overhang) * scale)
    }

    private var legendShown: Double {
        SiteEasing.smoothOut(elapsed / Self.legendFade)
    }

    private func drawLine(at: Double, overhang: CGFloat, size: CGSize, in context: inout GraphicsContext) {
        let x = (size.width / 2).rounded(.down)
        var line = Path()
        if covered(at) {
            line.addRect(CGRect(x: x, y: 0, width: 1, height: overhang))
            line.addRect(CGRect(x: x, y: size.height - overhang, width: 1, height: overhang))
        } else {
            line.addRect(CGRect(x: x, y: 0, width: 1, height: size.height))
        }
        context.fill(line, with: .color(WizardStyle.accent))
    }

    /// Whether a tile stands over the line.
    private func covered(_ at: Double) -> Bool {
        let nearest = (at - 0.5).rounded()
        guard nearest >= 0, nearest < Double(weekends) else { return false }
        return CGFloat(abs(nearest + 0.5 - at)) * Self.pitch < Self.tile.width / 2
    }

    private func drawTiles(at: Double, scale: CGFloat, size: CGSize, in context: inout GraphicsContext) {
        let reached = Int((at + 0.5 + WeekendsRun.lead).rounded(.down))
        let from = max(0, reached - Self.reach)
        let to = min(weekends - 1, reached + Self.reach)
        guard from <= to else { return }
        let center = (size.width / 2).rounded(.down)
        for index in from...to {
            var tile = context
            // The other way to the site's: a weekend still to come waits left
            // of the line, and one taken back moves off to the right.
            let offset = CGFloat(at - Double(index) - 0.5) * Self.pitch * scale
            tile.translateBy(x: center + offset - Self.tile.width * scale / 2, y: 0)
            let lit = index < reached ? light(index) : 0
            drawTile(index, light: lit, scale: scale, in: &tile)
        }
    }

    /// How far a weekend that has reached the line is lit: over `lightUp` from
    /// that moment for the few at either end, and whole for the ones that rush
    /// past, too fast for a light to be seen coming on.
    private func light(_ index: Int) -> Double {
        guard let lit = run.lit(index) else { return 1 }
        return SiteEasing.smoothOut((elapsed - lit) / Self.lightUp)
    }

    /// One weekend, a page off a desk calendar: the month in a band across the
    /// top and the two days under it. Lit, it is filled faintly with the accent
    /// and its outline is drawn over in it, from the middle of the top round
    /// both sides to meet at the middle of the bottom.
    private func drawTile(_ index: Int, light: Double, scale: CGFloat, in context: inout GraphicsContext) {
        let size = CGSize(width: Self.tile.width * scale, height: Self.tile.height * scale)
        let edge = CGRect(origin: .zero, size: size).insetBy(dx: 0.5, dy: 0.5)
        let outline = Path(roundedRect: edge, cornerRadius: Self.corner * scale)
        if light > 0 {
            context.fill(outline, with: .color(WizardStyle.accent.opacity(Self.litFill * light)))
        }
        context.stroke(outline, with: .style(.tertiary), lineWidth: 1)

        var words = context
        words.clip(to: outline)
        let tile = tiles.words(index)
        let band = 1 + Self.monthBand * scale
        words.draw(
            Text(tile.month)
                .font(.system(size: Self.monthSize * scale))
                .foregroundStyle(Color.secondary),
            at: CGPoint(x: size.width / 2, y: 1 + Self.monthBand * scale / 2)
        )
        var rule = Path()
        rule.move(to: CGPoint(x: 0, y: band + 0.5))
        rule.addLine(to: CGPoint(x: size.width, y: band + 0.5))
        words.stroke(rule, with: .style(.tertiary), lineWidth: 1)

        // The weekday over the date, the pair centred in what is left under
        // the band, a column a day.
        let middle = (band + 1 + size.height - 1) / 2
        let pair = (Self.weekdaySize + Self.dayGap + Self.dateSize) * scale
        let weekdayY = middle - pair / 2 + Self.weekdaySize * scale / 2
        let dateY = middle + pair / 2 - Self.dateSize * scale / 2
        let column = (size.width - 2) / 2
        for (day, (date, name)) in [(tile.saturday, tiles.names.saturday), (tile.sunday, tiles.names.sunday)].enumerated() {
            let x = 1 + column * (CGFloat(day) + 0.5)
            words.draw(
                Text(name)
                    .font(.system(size: Self.weekdaySize * scale))
                    .tracking(Self.weekdaySize * scale * Self.weekdayTracking)
                    .foregroundStyle(Color.secondary),
                at: CGPoint(x: x, y: weekdayY)
            )
            words.draw(
                Text(date)
                    .font(.system(size: Self.dateSize * scale).monospacedDigit())
                    .foregroundStyle(Color.primary),
                at: CGPoint(x: x, y: dateY)
            )
        }

        guard light > 0 else { return }
        for side in [edge.maxX, edge.minX] {
            var half = Path()
            half.move(to: CGPoint(x: edge.midX, y: edge.minY))
            half.addArc(
                tangent1End: CGPoint(x: side, y: edge.minY),
                tangent2End: CGPoint(x: side, y: edge.maxY),
                radius: Self.corner * scale
            )
            half.addArc(
                tangent1End: CGPoint(x: side, y: edge.maxY),
                tangent2End: CGPoint(x: edge.midX, y: edge.maxY),
                radius: Self.corner * scale
            )
            half.addLine(to: CGPoint(x: edge.midX, y: edge.maxY))
            context.stroke(half.trimmedPath(from: 0, to: light), with: .color(WizardStyle.accent), lineWidth: 1)
        }
    }

    /// The words the tiles carry: the names of the two days, and each tile's
    /// month and dates, worked out the first time the tile comes up and kept,
    /// so a frame only draws them. They count from the coming Saturday, so a
    /// new set starts once that Saturday is past.
    @MainActor
    private final class Tiles {
        /// One tile's month, and the dates of its Saturday and its Sunday.
        struct Words {
            let month: String
            let saturday: String
            let sunday: String
        }

        /// The names of the two days, the same on every tile.
        let names: (saturday: String, sunday: String)
        /// The first tile's Saturday: the coming one, or today if today is
        /// one. The set is good until the day after it.
        private let first: Date
        private let until: Date
        private let calendar: Calendar
        private var made: [Int: Words] = [:]

        private static var kept: Tiles?

        /// The set for today, kept from the last time unless its Saturday is
        /// past.
        static func current() -> Tiles {
            if let kept, Date() < kept.until {
                return kept
            }
            let tiles = Tiles()
            kept = tiles
            return tiles
        }

        private init() {
            let calendar = Calendar.current
            let today = calendar.startOfDay(for: Date())
            let saturday = 7
            let ahead = (saturday - calendar.component(.weekday, from: today) + 7) % 7
            let first = calendar.date(byAdding: .day, value: ahead, to: today) ?? today
            let sunday = calendar.date(byAdding: .day, value: 1, to: first) ?? first
            self.calendar = calendar
            self.first = first
            until = sunday
            names = (
                first.formatted(.dateTime.weekday(.abbreviated)).localizedUppercase,
                sunday.formatted(.dateTime.weekday(.abbreviated)).localizedUppercase
            )
        }

        func words(_ index: Int) -> Words {
            if let words = made[index] {
                return words
            }
            let saturday = calendar.date(byAdding: .day, value: 7 * index, to: first) ?? first
            let sunday = calendar.date(byAdding: .day, value: 1, to: saturday) ?? saturday
            let words = Words(
                month: saturday.formatted(.dateTime.month(.abbreviated).year()),
                saturday: saturday.formatted(.dateTime.day()),
                sunday: sunday.formatted(.dateTime.day())
            )
            made[index] = words
            return words
        }
    }
}

#Preview("Moments") {
    VStack(spacing: 0) {
        ForEach([0, 0.4, 1.2, 2.25, WeekendsDrawing.duration], id: \.self) { elapsed in
            HStack(spacing: 0) {
                ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                    WeekendsDrawing(elapsed: elapsed)
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
        WeekendsDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: WeekendsDrawing.duration + 1.5)
        )
        .frame(width: 480, height: 360)
        .padding(16)
        .background(.background)
    }
}
