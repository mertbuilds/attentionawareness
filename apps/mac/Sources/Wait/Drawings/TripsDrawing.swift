import SwiftUI

/// A dotted map of the world, and flights drawn across it one after another,
/// each from one city to another and down on a small mark. A flight steps back
/// once it has landed, so the one in the air leads. Once the last is down, a
/// ring goes out from where it landed now and then.
///
/// A port of the site's trips drawing, drawn in the site's 320 by 216 box and
/// scaled to fit. Everything on it is worked out from `elapsed`, so the clock
/// lives with the parent.
struct TripsDrawing: View {
    /// The flights, the site's `drawing.deck`.
    static let duration: TimeInterval = 4

    let elapsed: TimeInterval
    /// The number the drawing stands for. The flights are the same for any of
    /// them, as on the site.
    let amount: Int

    init(elapsed: TimeInterval, amount: Int = 391) {
        self.elapsed = elapsed
        self.amount = amount
    }

    private static let box = CGSize(width: 320, height: 216)
    /// The land, a mark for every five degrees of longitude and latitude that
    /// is mostly land, from 80 degrees north to 55 south: the Antarctic is left
    /// off. The site rasterized it once from Natural Earth's 1:110m land.
    private static let land = [
        ".............#..#####.##########......##...............###..............",
        "...........####.#####....#######..................############.###......",
        "...#################.##..#####.........#################################",
        "...###############..###...##.........###################################",
        "....#...##########..####...........#.###########################...##...",
        "..........###############.........###############################..#....",
        "...........#############...........#############################........",
        "...........###########............#############################.#.......",
        "...........##########.............####..####################.#.#........",
        "............########..............#####.#..#################..#.........",
        ".............####..#.............###########################............",
        "...............##................###############..#########.............",
        "...............####..............##############...###..###..............",
        "..................##.............#############.....#...###..............",
        "....................#####........#############..........................",
        "....................######............#######..........##.##............",
        "....................########..........######............#.##..###.......",
        "....................#########.........######....................##......",
        "....................#########.........######..................#.........",
        ".....................#######..........######.#..............#####.......",
        "......................######...........####..#.............#######......",
        "......................####.............####................########.....",
        ".....................#####.............###.................########.....",
        ".....................####.......................................##......",
        ".....................##...............................................#.",
        ".....................##.................................................",
        ".....................##.................................................",
    ]
    private static let degrees = 5.0
    private static let north = 80.0
    private static let pitch = 4.4
    private static let dotRadius = 1.1
    private static let mapX = (box.width - Double(land[0].count) * pitch) / 2
    /// The flights stay inside the map, so it stands with as much air over it
    /// as under it.
    private static let mapY = (box.height - Double(land.count) * pitch) / 2
    /// A flight bows up off the straight line between its cities, by this much
    /// of that line at its middle.
    private static let arcRise = 0.22
    private static let arcSteps = 40
    /// The flights leave one after another, each in the air for this share of
    /// the drawing.
    private static let flight = 0.3
    /// A flight that has landed steps back to this, so the one in the air
    /// leads, over this share.
    private static let landedOpacity = 0.35
    private static let fade = 0.25
    /// A city's mark pops up as a flight leaves or lands there, over this share.
    private static let pop = 0.1
    private static let cityRadius = 1.6
    private static let planeRadius = 2.2
    /// The ring that goes out from the last city once the last flight is down.
    private static let rippleSeconds = 2.4
    private static let rippleGrowth = 3.2

    /// Every mark of land as one path.
    private static let landPath: Path = {
        var path = Path()
        for (row, cells) in land.enumerated() {
            for (column, cell) in cells.enumerated() where cell == "#" {
                path.addEllipse(in: CGRect(
                    x: mapX + (Double(column) + 0.5) * pitch - dotRadius,
                    y: mapY + (Double(row) + 0.5) * pitch - dotRadius,
                    width: 2 * dotRadius,
                    height: 2 * dotRadius
                ))
            }
        }
        return path
    }()

    /// A flight's way as a run of points, with how far along it each stands.
    private struct Route {
        let from: CGPoint
        let to: CGPoint
        let points: [CGPoint]
        let lengths: [Double]
    }

    /// The flights, in the order they leave, from one corner of the map to
    /// another and back.
    private static let routes: [Route] = {
        let london = place(-0.1, 51.5)
        let newYork = place(-74, 40.7)
        let tokyo = place(139.7, 35.7)
        let bali = place(115.2, -8.7)
        let lisbon = place(-9.1, 38.7)
        let rio = place(-43.2, -22.9)
        let dubai = place(55.3, 25.2)
        let sydney = place(151.2, -33.9)
        let sanFrancisco = place(-122.4, 37.8)
        let mexicoCity = place(-99.1, 19.4)
        let cairo = place(31.2, 30)
        let capeTown = place(18.4, -33.9)
        let reykjavik = place(-21.9, 64.1)
        let istanbul = place(29, 41)
        let mumbai = place(72.9, 19.1)
        return [
            (london, newYork),
            (tokyo, bali),
            (lisbon, rio),
            (dubai, sydney),
            (sanFrancisco, mexicoCity),
            (cairo, capeTown),
            (reykjavik, istanbul),
            (mumbai, tokyo),
        ].map { route($0.0, $0.1) }
    }()
    /// How long after the first flight leaves each next one does, so the last
    /// lands as the drawing ends.
    private static let stagger = (1 - flight) / Double(routes.count - 1)

    var body: some View {
        Canvas { context, size in
            let scale = size.width / Self.box.width
            var drawing = context
            drawing.scaleBy(x: scale, y: scale)

            var land = drawing
            land.opacity = 0.5
            land.fill(Self.landPath, with: .style(.secondary))

            // The playhead stops at the end, as the site's does, so the last
            // flight stays in front of the ones before it.
            let at = min(1, elapsed / Self.duration)
            let accent = GraphicsContext.Shading.color(WizardStyle.accent)
            for (index, route) in Self.routes.enumerated() {
                let leaves = Double(index) * Self.stagger
                let departed = SiteEasing.clamp((at - leaves) / Self.pop)
                guard departed > 0 else { continue }
                // Slow off the ground, fast at height, slow down onto it again.
                let share = SiteEasing.cubicInOut((at - leaves) / Self.flight)
                let since = at - leaves - Self.flight
                let landed = since >= 0
                let (path, plane) = Self.flown(route, share: share)

                var way = drawing
                if landed {
                    way.opacity = 1 - (1 - Self.landedOpacity) * SiteEasing.cubicOut(since / Self.fade)
                }
                way.stroke(path, with: accent, style: StrokeStyle(lineWidth: 1.25, lineCap: .round))
                drawing.fill(Self.dot(route.from, radius: Self.cityRadius * SiteEasing.backOut(departed)), with: accent)
                drawing.fill(
                    landed
                        ? Self.dot(route.to, radius: Self.cityRadius * SiteEasing.backOut(since / Self.pop))
                        : Self.dot(plane, radius: Self.planeRadius),
                    with: accent
                )
            }

            let home = elapsed - Self.duration
            if home >= 0, let last = Self.routes.last {
                let grown = SiteEasing.smoothOut(
                    home.truncatingRemainder(dividingBy: Self.rippleSeconds) / Self.rippleSeconds
                )
                let growth = 1 + (Self.rippleGrowth - 1) * grown
                var ripple = drawing
                ripple.opacity = 0.6 * (1 - grown)
                ripple.stroke(Self.dot(last.to, radius: Self.cityRadius * growth), with: accent, lineWidth: 0.75 * growth)
            }
        }
        .aspectRatio(Self.box.width / Self.box.height, contentMode: .fit)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }

    /// Where a place is on the map, at its longitude and latitude.
    private static func place(_ longitude: Double, _ latitude: Double) -> CGPoint {
        CGPoint(
            x: mapX + (longitude + 180) / degrees * pitch,
            y: mapY + (north - latitude) / degrees * pitch
        )
    }

    /// A flight's way, bowed up off the straight line between its cities.
    private static func route(_ from: CGPoint, _ to: CGPoint) -> Route {
        let dx = to.x - from.x
        let dy = to.y - from.y
        // Square to the line, on its upper side.
        let side: Double = dx >= 0 ? 1 : -1
        let bend = CGPoint(
            x: (from.x + to.x) / 2 + side * dy * 2 * arcRise,
            y: (from.y + to.y) / 2 - side * dx * 2 * arcRise
        )
        let points = (0...arcSteps).map { step in
            let t = Double(step) / Double(arcSteps)
            let start = (1 - t) * (1 - t)
            let middle = 2 * (1 - t) * t
            let end = t * t
            return CGPoint(
                x: start * from.x + middle * bend.x + end * to.x,
                y: start * from.y + middle * bend.y + end * to.y
            )
        }
        var lengths = [0.0]
        for index in points.indices.dropFirst() {
            let step = hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
            lengths.append(lengths[index - 1] + step)
        }
        return Route(from: from, to: to, points: points, lengths: lengths)
    }

    /// The way flown, `share` of it, and the point the plane is at.
    private static func flown(_ route: Route, share: Double) -> (Path, CGPoint) {
        let total = route.lengths[route.lengths.count - 1]
        let along = SiteEasing.clamp(share) * total
        let behind = max(1, route.lengths.firstIndex { $0 >= along } ?? route.lengths.count - 1)
        let from = route.points[behind - 1]
        let to = route.points[behind]
        let fromLength = route.lengths[behind - 1]
        let span = route.lengths[behind] - fromLength
        let t = span > 0 ? (along - fromLength) / span : 0
        let plane = CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t)
        var path = Path()
        path.addLines(Array(route.points[..<behind]) + [plane])
        return (path, plane)
    }

    private static func dot(_ center: CGPoint, radius: Double) -> Path {
        Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: 2 * radius, height: 2 * radius))
    }
}

#Preview("Playing") {
    TimelineView(.animation) { timeline in
        TripsDrawing(
            elapsed: timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: TripsDrawing.duration + 5)
        )
    }
    .frame(width: 400, height: 300)
}

#Preview("Finished, dark") {
    TripsDrawing(elapsed: TripsDrawing.duration + 0.4)
        .frame(width: 400, height: 300)
        .background(.background)
        .environment(\.colorScheme, .dark)
}
