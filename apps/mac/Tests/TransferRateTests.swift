import Foundation
import Testing

/// What the step says a transfer will take before the button is pressed.
///
/// The first run has nothing measured and gets a range. Every run after it
/// gets the figure this Mac earned. Both go through their own defaults here,
/// so nothing a test writes lands in the app's.
final class TransferRateTests {
    private let defaults: UserDefaults
    private let suite: String

    /// A 63 GB iPhone, which is the backup the band was measured against.
    private static let phoneBytes: UInt64 = 67_882_442_752

    init() throws {
        suite = "transfer-rate-tests-\(UUID().uuidString)"
        defaults = try #require(UserDefaults(suiteName: suite))
    }

    deinit {
        UserDefaults.standard.removePersistentDomain(forName: suite)
    }

    // MARK: - What is remembered

    @Test func nothingIsRememberedUntilATransferFinishes() {
        #expect(TransferRate.remembered(.backup, in: defaults) == nil)
    }

    @Test func aFinishedTransferIsRememberedAsBytesPerSecond() throws {
        TransferRate.remember(.backup, bytes: 36_000_000_000, seconds: 3_600, in: defaults)

        let rate = try #require(TransferRate.remembered(.backup, in: defaults))
        #expect(abs(rate - 10_000_000) <= 1)
    }

    @Test func theTwoTransfersAreRememberedApart() {
        TransferRate.remember(.backup, bytes: 36_000_000_000, seconds: 3_600, in: defaults)

        #expect(TransferRate.remembered(.backup, in: defaults) != nil)
        #expect(TransferRate.remembered(.restore, in: defaults) == nil)
    }

    @Test func aTransferThatTookNoTimeIsNotRemembered() {
        TransferRate.remember(.backup, bytes: 36_000_000_000, seconds: 0, in: defaults)

        #expect(TransferRate.remembered(.backup, in: defaults) == nil)
    }

    // MARK: - What the step says

    @Test func aPhoneOfUnknownSizeIsPromisedNothing() {
        #expect(TransferRate.expectation(.backup, bytes: nil, in: defaults) == nil)
    }

    @Test func theFirstRunIsGivenARange() {
        #expect(
            TransferRate.expectation(.backup, bytes: Self.phoneBytes, in: defaults)
                == "This usually takes 30 minutes to 1 hour 30 minutes for a phone this size."
        )
    }

    @Test func aRunWithAMeasurementBehindItIsGivenOneFigure() {
        TransferRate.remember(.backup, bytes: Self.phoneBytes, seconds: 3_300, in: defaults)

        #expect(
            TransferRate.expectation(.backup, bytes: Self.phoneBytes, in: defaults)
                == "This usually takes about 55 minutes on this Mac."
        )
    }

    @Test func aTransferTooSmallForARangeIsGivenOneFigure() {
        #expect(
            TransferRate.expectation(.backup, bytes: 600_000_000, in: defaults)
                == "This usually takes about 1 minute for a phone this size."
        )
    }

    // MARK: - The line over the button

    @Test func theFirstRunIsGivenTheBandRatherThanAFigure() {
        #expect(
            TransferRate.howLong(.backup, bytes: Self.phoneBytes, in: defaults)
                == "This usually takes 30 to 90 minutes. Keep iPhone connected."
        )
    }

    @Test func aPhoneThatWillNotSayHowMuchItHoldsIsGivenTheBandToo() {
        TransferRate.remember(.backup, bytes: Self.phoneBytes, seconds: 3_300, in: defaults)

        #expect(
            TransferRate.howLong(.backup, bytes: nil, in: defaults)
                == "This usually takes 30 to 90 minutes. Keep iPhone connected."
        )
    }

    @Test func aMeasuredMacSaysTheFigureItEarned() {
        TransferRate.remember(.backup, bytes: Self.phoneBytes, seconds: 3_300, in: defaults)

        #expect(
            TransferRate.howLong(.backup, bytes: Self.phoneBytes, in: defaults)
                == "This takes about 55 minutes. Keep iPhone connected."
        )
    }
}
