import Foundation
import Testing

/// The time the copy line carries, worked out from what the copy can honestly
/// say about how much longer it has.
///
/// The line shows a figure from the first second: the live estimate once it has
/// read a rate off the copy, the rate this Mac wrote down last run before then,
/// and a plain range on a first-ever run with neither. A stalled copy says
/// nothing. None of it reads an iPhone or builds a view.
struct JobEstimateLineTests {
    /// A rate and a size that divide to a clean half hour, so the words are the
    /// only thing under test.
    private static let rate: Double = 20_000_000
    private static let bytes: Int64 = 36_000_000_000

    @Test func theLiveEstimatePassesThrough() {
        #expect(
            JobEstimateLine.text(live: .about(900), rememberedRate: nil, expectedBytes: nil)
                == "About 15 minutes remaining"
        )
    }

    @Test func theLiveEstimateWinsOverTheSeededOne() {
        #expect(
            JobEstimateLine.text(live: .about(900), rememberedRate: Self.rate, expectedBytes: Self.bytes)
                == "About 15 minutes remaining"
        )
    }

    @Test func tooEarlyWithARateSaysAFigureFromTheRememberedRate() {
        #expect(
            JobEstimateLine.text(live: .tooEarly, rememberedRate: Self.rate, expectedBytes: Self.bytes)
                == "About 30 minutes remaining"
        )
    }

    @Test func tooEarlyWithoutARateSaysTheRange() {
        #expect(
            JobEstimateLine.text(live: .tooEarly, rememberedRate: nil, expectedBytes: Self.bytes)
                == "Usually 30 to 90 minutes"
        )
    }

    @Test func tooEarlyWithARateButNoSizeSaysTheRange() {
        #expect(
            JobEstimateLine.text(live: .tooEarly, rememberedRate: Self.rate, expectedBytes: nil)
                == "Usually 30 to 90 minutes"
        )
    }

    @Test func aStalledCopySaysNothing() {
        #expect(
            JobEstimateLine.text(live: .working, rememberedRate: Self.rate, expectedBytes: Self.bytes) == nil
        )
    }
}
