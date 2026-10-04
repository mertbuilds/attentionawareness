import Foundation
import Testing

/// How much longer a transfer has, read from nothing but the progress the
/// helper prints.
///
/// The rules are all about what the estimate refuses to say: nothing in the
/// first minute, nothing once the progress stops moving, and nothing at all
/// once the last of the bytes are across, because from there the iPhone is
/// doing work this Mac cannot see. The readings are handed in with their own
/// dates, so none of this waits on a clock.
struct TransferEstimateTests {
    private static let start = Date(timeIntervalSince1970: 1_789_793_040)

    /// A transfer that runs at one steady rate: `progress` after `seconds`,
    /// read once a second the way the engine publishes it.
    private func steady(
        to progress: Double,
        over seconds: TimeInterval,
        from start: Date = TransferEstimateTests.start
    ) -> TransferEstimate {
        var estimate = TransferEstimate()
        for second in stride(from: 0, through: seconds, by: 1) {
            estimate.record(progress: progress * second / seconds, at: start.addingTimeInterval(second))
        }
        return estimate
    }

    // MARK: - What it refuses to say

    @Test func nothingIsSaidBeforeAnythingHasBeenRead() {
        #expect(TransferEstimate().reading(at: Self.start) == .tooEarly)
    }

    @Test func nothingIsSaidInTheFirstSeconds() {
        let estimate = steady(to: 0.1, over: 30)

        #expect(estimate.reading(at: Self.start.addingTimeInterval(30)) == .tooEarly)
    }

    @Test func nothingIsSaidWhileTheProgressIsStillUnderTwoPercent() {
        let estimate = steady(to: 0.015, over: 300)

        #expect(estimate.reading(at: Self.start.addingTimeInterval(300)) == .tooEarly)
    }

    @Test func progressThatHasNotMovedForTwoMinutesGivesNoFigure() {
        var estimate = steady(to: 0.4, over: 600)
        // The helper goes on publishing the same number, which is what a
        // transfer that is stuck looks like from here.
        for second in stride(from: 601.0, through: 780.0, by: 1) {
            estimate.record(progress: 0.4, at: Self.start.addingTimeInterval(second))
        }

        #expect(estimate.reading(at: Self.start.addingTimeInterval(780)) == .working)
    }

    /// A transfer that comes back to life says a figure again, once it has
    /// moved far enough for the rate to mean something. The window it is read
    /// over is a minute, so that is how long the figure takes to come back.
    @Test func aStallIsForgottenOnceTheProgressHasMovedAgain() {
        var estimate = steady(to: 0.4, over: 600)
        for second in stride(from: 601.0, through: 780.0, by: 1) {
            estimate.record(progress: 0.4, at: Self.start.addingTimeInterval(second))
        }
        for second in stride(from: 781.0, through: 900.0, by: 1) {
            estimate.record(progress: 0.4 + 0.000_667 * (second - 780), at: Self.start.addingTimeInterval(second))
        }

        guard case .about = estimate.reading(at: Self.start.addingTimeInterval(900)) else {
            Issue.record("a transfer that is moving again should say a figure")
            return
        }
    }

    @Test func theLastOfTheBytesBeingAcrossGivesNoFigure() {
        let estimate = steady(to: 1, over: 600)

        #expect(estimate.reading(at: Self.start.addingTimeInterval(600)) == .working)
    }

    @Test func aFigureNobodyCouldActOnIsNotShown() {
        // A fiftieth of the job in an hour is nearly two days left, which is
        // no more use to anybody than no number at all.
        let estimate = steady(to: 0.021, over: 3_600)

        #expect(estimate.reading(at: Self.start.addingTimeInterval(3_600)) == .working)
    }

    @Test func theFigureDoesNotRunDownWhileNothingIsRead() {
        let estimate = steady(to: 0.5, over: 600)

        guard case .about(let first) = estimate.reading(at: Self.start.addingTimeInterval(600)),
              case .about(let later) = estimate.reading(at: Self.start.addingTimeInterval(660))
        else {
            Issue.record("a steady transfer should say a figure")
            return
        }
        #expect(abs(first - later) <= 0.001)
    }

    // MARK: - What it says

    @Test func aSteadyTransferSaysWhatIsLeft() {
        // Half the job in ten minutes is ten minutes left.
        let estimate = steady(to: 0.5, over: 600)

        guard case .about(let seconds) = estimate.reading(at: Self.start.addingTimeInterval(600)) else {
            Issue.record("a steady transfer should say a figure")
            return
        }
        #expect(abs(seconds - 600) <= 60)
    }

    @Test func aTransferThatSlowsDownSaysThereIsLongerToGo() {
        let steadyEstimate = steady(to: 0.5, over: 600)
        guard case .about(let before) = steadyEstimate.reading(at: Self.start.addingTimeInterval(600)) else {
            Issue.record("a steady transfer should say a figure")
            return
        }

        // The same transfer, then five minutes at a tenth of the speed.
        var slowed = steadyEstimate
        for second in stride(from: 601.0, through: 900.0, by: 1) {
            let crawl = 0.5 + 0.00008 * (second - 600)
            slowed.record(progress: crawl, at: Self.start.addingTimeInterval(second))
        }

        guard case .about(let after) = slowed.reading(at: Self.start.addingTimeInterval(900)) else {
            Issue.record("a transfer that is still moving should say a figure")
            return
        }
        #expect(after > before * 2)
    }

    // MARK: - The words

    @Test func underAMinuteIsNotCountedDown() {
        #expect(TransferEstimate.remaining(20) == "less than a minute left")
        #expect(TransferEstimate.remaining(59) == "less than a minute left")
    }

    @Test func underTenMinutesIsSaidToTheMinute() {
        #expect(TransferEstimate.remaining(60) == "about 1 minute left")
        #expect(TransferEstimate.remaining(200) == "about 3 minutes left")
        #expect(TransferEstimate.remaining(430) == "about 7 minutes left")
    }

    @Test func underAnHourIsSaidToFiveMinutes() {
        #expect(TransferEstimate.remaining(640) == "about 10 minutes left")
        #expect(TransferEstimate.remaining(1_500) == "about 25 minutes left")
        #expect(TransferEstimate.remaining(2_760) == "about 45 minutes left")
    }

    @Test func anHourAndMoreIsSaidInHoursAndTenMinutes() {
        #expect(TransferEstimate.remaining(3_500) == "about 1 hour left")
        #expect(TransferEstimate.remaining(4_800) == "about 1 hour 20 minutes left")
        #expect(TransferEstimate.remaining(9_000) == "about 2 hours 30 minutes left")
    }

    @Test func theUnitIsNeverAbbreviated() {
        #expect(TransferEstimate.duration(1_500) == "25 minutes")
        #expect(TransferEstimate.duration(7_200) == "2 hours")
    }
}
