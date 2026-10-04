import Foundation
import Testing

/// The run the weekends make past their line.
///
/// The drawing reads every tile's place off this one function of time, so a
/// jump in it is a jump on screen and a step back is the tape running the
/// wrong way. What is tested here is that it does neither, for the story's
/// twenty years of weekends and for counts too few for the rush, that it
/// starts at rest and stops on the last weekend, and that the few weekends
/// watched light up in turn, where they should, before the run is over.
struct WeekendsRunTests {
    private let story = WeekendsRun(weekends: WaitMath.horizonWeeks)
    /// Every count from one weekend to past the fewest the rush needs, a
    /// year's, and the story's.
    private let counts = Array(1...16) + [52, WaitMath.horizonWeeks]

    /// The most the run moves from one sample to the next, sampled `every`
    /// so often from start to stop.
    private func largestStep(_ run: WeekendsRun, every step: TimeInterval) -> Double {
        let passed = stride(from: 0, through: WeekendsRun.duration, by: step).map(run.passed(at:))
        return zip(passed, passed.dropFirst()).map { abs($1 - $0) }.max() ?? 0
    }

    @Test func theRunStartsAtRestAndStopsOnTheLastWeekend() {
        for weekends in counts {
            let run = WeekendsRun(weekends: weekends)

            #expect(run.passed(at: 0) == 0)
            #expect(abs(run.passed(at: WeekendsRun.duration) - (Double(weekends) - 0.5)) < 1e-9)
            // Either side of the run it stands where it starts or stops.
            #expect(run.passed(at: -1) == 0)
            #expect(run.passed(at: WeekendsRun.duration + 1) == run.passed(at: WeekendsRun.duration))
        }
    }

    @Test func theRunNeverGoesBack() {
        for weekends in counts {
            let run = WeekendsRun(weekends: weekends)
            let passed = stride(from: 0, through: WeekendsRun.duration, by: 0.001).map(run.passed(at:))
            let back = zip(passed, passed.dropFirst()).filter { $1 < $0 }

            #expect(back.isEmpty, "\(weekends) weekends")
        }
    }

    @Test func theRunNeverJumps() {
        // Sampled ten times as often, a run with no jump in it moves about a
        // tenth as far from one sample to the next. Across a jump it moves as
        // far however often it is sampled.
        for weekends in counts {
            let run = WeekendsRun(weekends: weekends)

            #expect(largestStep(run, every: 0.0005) < largestStep(run, every: 0.005) / 5, "\(weekends) weekends")
        }
    }

    @Test func theTwoHalvesMeetOnTheMiddleWeekend() {
        // Where the run turns round is where a count too few for the rush
        // once stepped back.
        let middle = WeekendsRun.duration / 2
        for weekends in counts {
            let run = WeekendsRun(weekends: weekends)

            #expect(abs(run.passed(at: middle) - (Double(weekends) - 0.5) / 2) < 1e-6, "\(weekends) weekends")
            #expect(abs(run.passed(at: middle + 1e-9) - run.passed(at: middle - 1e-9)) < 1e-5, "\(weekends) weekends")
        }
    }

    @Test func theWatchedWeekendsLightUpInTurnBeforeTheRunIsOver() {
        let watched = [0, 1, 2, 1037, 1038, 1039]
        let lit = watched.compactMap(story.lit)

        #expect(lit.count == watched.count)
        #expect(lit == lit.sorted())
        #expect(lit.allSatisfy { $0 > 0 && $0 < WeekendsRun.duration })
    }

    @Test func aWatchedWeekendLightsUpAsItsMiddleComesALeadShortOfTheLine() {
        for index in [0, 1, 2, 1037, 1038, 1039] {
            let lit = story.lit(index) ?? -1

            #expect(abs(story.passed(at: lit) - (Double(index) + 0.5 - WeekendsRun.lead)) < 1e-6, "weekend \(index)")
        }
    }

    @Test func everyWeekendBetweenIsLitWholeAsItRushesPast() {
        for index in [3, 100, 520, 1036] {
            #expect(story.lit(index) == nil, "weekend \(index)")
        }
    }

    @Test func aRunOfAFewWeekendsWatchesEveryOne() {
        let run = WeekendsRun(weekends: 4)

        #expect((0..<4).allSatisfy { run.lit($0) != nil })
    }
}
