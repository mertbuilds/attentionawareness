import XCTest

/// How much longer a transfer has, read from nothing but the progress the
/// helper prints.
///
/// The rules are all about what the estimate refuses to say: nothing in the
/// first minute, nothing once the progress stops moving, and nothing at all
/// once the last of the bytes are across, because from there the iPhone is
/// doing work this Mac cannot see. The readings are handed in with their own
/// dates, so none of this waits on a clock.
final class TransferEstimateTests: XCTestCase {
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

    func testNothingIsSaidBeforeAnythingHasBeenRead() {
        XCTAssertEqual(TransferEstimate().reading(at: Self.start), .tooEarly)
    }

    func testNothingIsSaidInTheFirstSeconds() {
        let estimate = steady(to: 0.1, over: 30)

        XCTAssertEqual(estimate.reading(at: Self.start.addingTimeInterval(30)), .tooEarly)
    }

    func testNothingIsSaidWhileTheProgressIsStillUnderTwoPercent() {
        let estimate = steady(to: 0.015, over: 300)

        XCTAssertEqual(estimate.reading(at: Self.start.addingTimeInterval(300)), .tooEarly)
    }

    func testProgressThatHasNotMovedForTwoMinutesGivesNoFigure() {
        var estimate = steady(to: 0.4, over: 600)
        // The helper goes on publishing the same number, which is what a
        // transfer that is stuck looks like from here.
        for second in stride(from: 601.0, through: 780.0, by: 1) {
            estimate.record(progress: 0.4, at: Self.start.addingTimeInterval(second))
        }

        XCTAssertEqual(estimate.reading(at: Self.start.addingTimeInterval(780)), .working)
    }

    /// A transfer that comes back to life says a figure again, once it has
    /// moved far enough for the rate to mean something. The window it is read
    /// over is a minute, so that is how long the figure takes to come back.
    func testAStallIsForgottenOnceTheProgressHasMovedAgain() {
        var estimate = steady(to: 0.4, over: 600)
        for second in stride(from: 601.0, through: 780.0, by: 1) {
            estimate.record(progress: 0.4, at: Self.start.addingTimeInterval(second))
        }
        for second in stride(from: 781.0, through: 900.0, by: 1) {
            estimate.record(progress: 0.4 + 0.000_667 * (second - 780), at: Self.start.addingTimeInterval(second))
        }

        guard case .about = estimate.reading(at: Self.start.addingTimeInterval(900)) else {
            return XCTFail("a transfer that is moving again should say a figure")
        }
    }

    func testTheLastOfTheBytesBeingAcrossGivesNoFigure() {
        let estimate = steady(to: 1, over: 600)

        XCTAssertEqual(estimate.reading(at: Self.start.addingTimeInterval(600)), .working)
    }

    func testAFigureNobodyCouldActOnIsNotShown() {
        // A fiftieth of the job in an hour is nearly two days left, which is
        // no more use to anybody than no number at all.
        let estimate = steady(to: 0.021, over: 3_600)

        XCTAssertEqual(estimate.reading(at: Self.start.addingTimeInterval(3_600)), .working)
    }

    func testTheFigureDoesNotRunDownWhileNothingIsRead() {
        let estimate = steady(to: 0.5, over: 600)

        guard case .about(let first) = estimate.reading(at: Self.start.addingTimeInterval(600)),
              case .about(let later) = estimate.reading(at: Self.start.addingTimeInterval(660))
        else {
            return XCTFail("a steady transfer should say a figure")
        }
        XCTAssertEqual(first, later, accuracy: 0.001)
    }

    // MARK: - What it says

    func testASteadyTransferSaysWhatIsLeft() {
        // Half the job in ten minutes is ten minutes left.
        let estimate = steady(to: 0.5, over: 600)

        guard case .about(let seconds) = estimate.reading(at: Self.start.addingTimeInterval(600)) else {
            return XCTFail("a steady transfer should say a figure")
        }
        XCTAssertEqual(seconds, 600, accuracy: 60)
    }

    func testATransferThatSlowsDownSaysThereIsLongerToGo() {
        let steadyEstimate = steady(to: 0.5, over: 600)
        guard case .about(let before) = steadyEstimate.reading(at: Self.start.addingTimeInterval(600)) else {
            return XCTFail("a steady transfer should say a figure")
        }

        // The same transfer, then five minutes at a tenth of the speed.
        var slowed = steadyEstimate
        for second in stride(from: 601.0, through: 900.0, by: 1) {
            let crawl = 0.5 + 0.00008 * (second - 600)
            slowed.record(progress: crawl, at: Self.start.addingTimeInterval(second))
        }

        guard case .about(let after) = slowed.reading(at: Self.start.addingTimeInterval(900)) else {
            return XCTFail("a transfer that is still moving should say a figure")
        }
        XCTAssertGreaterThan(after, before * 2)
    }

    // MARK: - The words

    func testUnderAMinuteIsNotCountedDown() {
        XCTAssertEqual(TransferEstimate.remaining(20), "less than a minute left")
        XCTAssertEqual(TransferEstimate.remaining(59), "less than a minute left")
    }

    func testUnderTenMinutesIsSaidToTheMinute() {
        XCTAssertEqual(TransferEstimate.remaining(60), "about 1 minute left")
        XCTAssertEqual(TransferEstimate.remaining(200), "about 3 minutes left")
        XCTAssertEqual(TransferEstimate.remaining(430), "about 7 minutes left")
    }

    func testUnderAnHourIsSaidToFiveMinutes() {
        XCTAssertEqual(TransferEstimate.remaining(640), "about 10 minutes left")
        XCTAssertEqual(TransferEstimate.remaining(1_500), "about 25 minutes left")
        XCTAssertEqual(TransferEstimate.remaining(2_760), "about 45 minutes left")
    }

    func testAnHourAndMoreIsSaidInHoursAndTenMinutes() {
        XCTAssertEqual(TransferEstimate.remaining(3_500), "about 1 hour left")
        XCTAssertEqual(TransferEstimate.remaining(4_800), "about 1 hour 20 minutes left")
        XCTAssertEqual(TransferEstimate.remaining(9_000), "about 2 hours 30 minutes left")
    }

    func testTheUnitIsNeverAbbreviated() {
        XCTAssertEqual(TransferEstimate.duration(1_500), "25 minutes")
        XCTAssertEqual(TransferEstimate.duration(7_200), "2 hours")
    }
}
