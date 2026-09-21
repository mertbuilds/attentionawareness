import XCTest

/// What the step says a transfer will take before the button is pressed.
///
/// The first run has nothing measured and gets a range. Every run after it
/// gets the figure this Mac earned. Both go through their own defaults here,
/// so nothing a test writes lands in the app's.
final class TransferRateTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suite: String!

    /// A 63 GB iPhone, which is the backup the band was measured against.
    private static let phoneBytes: UInt64 = 67_882_442_752

    override func setUpWithError() throws {
        suite = "transfer-rate-tests-\(UUID().uuidString)"
        defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
    }

    override func tearDownWithError() throws {
        UserDefaults.standard.removePersistentDomain(forName: suite)
        defaults = nil
        suite = nil
    }

    // MARK: - What is remembered

    func testNothingIsRememberedUntilATransferFinishes() {
        XCTAssertNil(TransferRate.remembered(.backup, in: defaults))
    }

    func testAFinishedTransferIsRememberedAsBytesPerSecond() {
        TransferRate.remember(.backup, bytes: 36_000_000_000, seconds: 3_600, in: defaults)

        XCTAssertEqual(try XCTUnwrap(TransferRate.remembered(.backup, in: defaults)), 10_000_000, accuracy: 1)
    }

    func testTheTwoTransfersAreRememberedApart() {
        TransferRate.remember(.backup, bytes: 36_000_000_000, seconds: 3_600, in: defaults)

        XCTAssertNotNil(TransferRate.remembered(.backup, in: defaults))
        XCTAssertNil(TransferRate.remembered(.restore, in: defaults))
    }

    func testATransferThatTookNoTimeIsNotRemembered() {
        TransferRate.remember(.backup, bytes: 36_000_000_000, seconds: 0, in: defaults)

        XCTAssertNil(TransferRate.remembered(.backup, in: defaults))
    }

    // MARK: - What the step says

    func testAPhoneOfUnknownSizeIsPromisedNothing() {
        XCTAssertNil(TransferRate.expectation(.backup, bytes: nil, in: defaults))
    }

    func testTheFirstRunIsGivenARange() {
        XCTAssertEqual(
            TransferRate.expectation(.backup, bytes: Self.phoneBytes, in: defaults),
            "This usually takes 30 minutes to 1 hour 30 minutes for a phone this size."
        )
    }

    func testARunWithAMeasurementBehindItIsGivenOneFigure() {
        TransferRate.remember(.backup, bytes: Self.phoneBytes, seconds: 3_300, in: defaults)

        XCTAssertEqual(
            TransferRate.expectation(.backup, bytes: Self.phoneBytes, in: defaults),
            "This usually takes about 55 minutes on this Mac."
        )
    }

    func testATransferTooSmallForARangeIsGivenOneFigure() {
        XCTAssertEqual(
            TransferRate.expectation(.backup, bytes: 600_000_000, in: defaults),
            "This usually takes about 1 minute for a phone this size."
        )
    }

    // MARK: - The line over the button

    func testTheFirstRunIsGivenTheBandRatherThanAFigure() {
        XCTAssertEqual(
            TransferRate.howLong(.backup, bytes: Self.phoneBytes, in: defaults),
            "This usually takes 30 to 90 minutes. Keep iPhone connected."
        )
    }

    func testAPhoneThatWillNotSayHowMuchItHoldsIsGivenTheBandToo() {
        TransferRate.remember(.backup, bytes: Self.phoneBytes, seconds: 3_300, in: defaults)

        XCTAssertEqual(
            TransferRate.howLong(.backup, bytes: nil, in: defaults),
            "This usually takes 30 to 90 minutes. Keep iPhone connected."
        )
    }

    func testAMeasuredMacSaysTheFigureItEarned() {
        TransferRate.remember(.backup, bytes: Self.phoneBytes, seconds: 3_300, in: defaults)

        XCTAssertEqual(
            TransferRate.howLong(.backup, bytes: Self.phoneBytes, in: defaults),
            "This takes about 55 minutes. Keep iPhone connected."
        )
    }
}
