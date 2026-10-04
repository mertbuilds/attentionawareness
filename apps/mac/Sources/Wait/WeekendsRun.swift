import Foundation

/// How far the weekends of `WeekendsDrawing` have run past the line at any
/// moment, the site's `weekendsBy`: easing from rest into a pace slow enough to
/// watch a weekend light up, holding it while the first few do, gathering
/// speed into a rush that gets through every weekend between in time, and the
/// same backwards to a stop on the last. Every change of speed eases in and
/// out, so the speed never jumps and never turns a corner.
///
/// Nothing here draws anything, which is why it is the part of the drawing
/// the tests can run.
struct WeekendsRun: Equatable {
    /// The run past the line, `drawing.weekends` on the site. The last weekend
    /// lights up as the run settles on it, and is lit in full before it stops.
    static let duration: TimeInterval = 4.5
    /// The weekends at each end that light up while they can be watched; every
    /// one between is lit whole as it rushes past. A weekend is lit once its
    /// middle is `lead` of a tile short of the line, so the last one lights up
    /// as the run settles rather than after.
    static let drawnTiles = 3
    static let lead = 0.25

    /// The pace the run eases into from rest, in tiles a second, slow enough
    /// to watch a weekend light up, and how long it takes to reach it.
    private static let pace = 2.8
    private static let ease: TimeInterval = 0.4
    /// How long the run takes to gather speed from the pace into the rush, and
    /// to lose it again at the end.
    private static let ramp: TimeInterval = 0.8
    /// The pace holds until this long after the last of the first few reaches
    /// the line: the site's two strokes of a cross, 0.125 s apart and 0.21 s
    /// each, which the site's run is timed around.
    private static let paceHeld: TimeInterval = 0.125 + 0.21
    /// The steps the distance gone while gathering speed is summed over.
    private static let rampSteps = 64

    let weekends: Int
    /// How far the run has gone when it starts to gather speed, and how long
    /// it holds the pace to get there.
    private let paced: Double
    private let hold: TimeInterval
    /// How fast the rush goes, and how far the run goes gathering it.
    private let rush: Double
    private let ramped: Double
    /// What the first half is drawn to, so it ends on the middle weekend:
    /// one, but for a rounding, wherever the rush gets there in time, and
    /// less where there are too few weekends even for a run that never
    /// gathers speed, which then goes the same way at a slower pace.
    private let scale: Double
    /// When each of the weekends that light up while they can be watched
    /// reaches the point it lights up at, worked out once.
    private var lights: [Int: TimeInterval] = [:]

    init(weekends: Int) {
        self.weekends = weekends
        let paced = Double(Self.drawnTiles) - 0.5 - Self.lead + Self.pace * Self.paceHeld
        let hold = paced / Self.pace - Self.ease / 2
        // How long the rush lasts between gathering and losing speed.
        let rushTime = Self.duration - 2 * (Self.ease + hold + Self.ramp)
        let half = max(0, Double(weekends) - 0.5) / 2
        let rush = Self.rushSpeed(left: half - paced, rushTime: rushTime)
        let ramped = Self.rampDistance(1, rush: rush)
        let gone = paced + ramped + rush * rushTime / 2
        self.paced = paced
        self.hold = hold
        self.rush = rush
        self.ramped = ramped
        scale = half / gone
        let watched = (0..<max(0, weekends)).filter {
            $0 < Self.drawnTiles || $0 >= weekends - Self.drawnTiles
        }
        lights = Dictionary(uniqueKeysWithValues: watched.map { index in
            (index, seconds(toPass: Double(index) + 0.5 - Self.lead))
        })
    }

    /// How many weekends have passed the line `seconds` into the run. The
    /// run is the same backwards as forwards, so its second half is the first
    /// turned round.
    func passed(at seconds: TimeInterval) -> Double {
        let run = Self.duration
        let seconds = min(run, max(0, seconds))
        if seconds > run / 2 {
            return max(0, Double(weekends) - 0.5) - passed(at: run - seconds)
        }
        return scale * firstHalf(at: seconds)
    }

    /// When the run has passed `target` weekends: `passed(at:)` turned round,
    /// found by halving, as the run only ever goes forward.
    func seconds(toPass target: Double) -> TimeInterval {
        var low: TimeInterval = 0
        var high = Self.duration
        for _ in 0..<50 {
            let middle = (low + high) / 2
            if passed(at: middle) < target {
                low = middle
            } else {
                high = middle
            }
        }
        return (low + high) / 2
    }

    /// When weekend `index` lights up, for the few at either end that light
    /// up while they can be watched. Nil for every one between, which is lit
    /// whole as it rushes past.
    func lit(_ index: Int) -> TimeInterval? {
        lights[index]
    }

    /// The first half of the run, before it is drawn to fit.
    private func firstHalf(at seconds: TimeInterval) -> Double {
        let ease = Self.ease
        let pace = Self.pace
        if seconds < ease {
            return pace * ease * Self.smootherstepArea(seconds / ease)
        }
        let held = seconds - ease
        if held < hold {
            return pace * (ease / 2 + held)
        }
        let ramping = held - hold
        let ramp = Self.ramp
        if ramping < ramp {
            return paced + Self.rampDistance(ramping / ramp, rush: rush)
        }
        return paced + ramped + rush * (ramping - ramp)
    }

    /// How much of a change of speed is made `u` of the way through it: none
    /// at first and all at the end, starting and stopping so gently that
    /// neither end is felt (smootherstep).
    private static func smootherstep(_ u: Double) -> Double {
        u * u * u * (u * (6 * u - 15) + 10)
    }

    /// How far a run easing from rest to one tile a second, over one second,
    /// has gone `u` of the way through.
    private static func smootherstepArea(_ u: Double) -> Double {
        u * u * u * u * (u * (u - 3) + 2.5)
    }

    /// How far the weekends go `u` of the way through gathering speed up to
    /// `rush`. The speed is multiplied rather than added to, by the same
    /// factor over equal steps of the change, since that is how the eye reads
    /// a speed picking up; added to, it would be a blur after the first few
    /// frames. Summed by Simpson's rule, as the distance has no closed form.
    private static func rampDistance(_ u: Double, rush: Double) -> Double {
        let steps = rampSteps
        let growth = log(rush / pace)
        let step = u / Double(steps)
        var sum = 0.0
        for index in 0...steps {
            let weight: Double = index == 0 || index == steps ? 1 : index % 2 == 0 ? 2 : 4
            sum += weight * exp(growth * smootherstep(Double(index) * step))
        }
        return pace * ramp * step * sum / 3
    }

    /// The rush that gets through the `left` weekends of each half in its
    /// time. A faster one only ever goes further, so it is found by doubling
    /// a guess until it goes too far, then halving the gap between the last
    /// two. Never slower than the pace, which is where too few weekends leave
    /// it.
    private static func rushSpeed(left: Double, rushTime: TimeInterval) -> Double {
        let gone = { (rush: Double) in rampDistance(1, rush: rush) + rush * rushTime / 2 }
        var low = pace
        var high = 2 * low
        while gone(high) < left {
            low = high
            high *= 2
        }
        for _ in 0..<50 {
            let middle = (low + high) / 2
            if gone(middle) < left {
                low = middle
            } else {
                high = middle
            }
        }
        return (low + high) / 2
    }
}
