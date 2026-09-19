import XCTest

/// What each step demands before it runs.
///
/// Find My is the whole reason this is a type of its own: it has to be off for
/// the restore and for nothing else, so the checks let an hour of copying start
/// while the reader is still turning it off. These are the two rules that say
/// so, and neither of them reads an iPhone.
final class WizardGateTests: XCTestCase {
    // MARK: - The checks

    func testTheChecksPassWhenTheDiskIsBigEnoughAndNoPasswordIsNeeded() {
        XCTAssertTrue(
            WizardGate.checksPass(diskSpacePasses: true, needsPassword: false, hasPassword: false)
        )
    }

    func testADiskThatIsTooSmallStopsTheRun() {
        XCTAssertFalse(
            WizardGate.checksPass(diskSpacePasses: false, needsPassword: false, hasPassword: false)
        )
    }

    func testFreeSpaceThatCouldNotBeReadBlocksNothing() {
        XCTAssertTrue(
            WizardGate.checksPass(diskSpacePasses: nil, needsPassword: false, hasPassword: false)
        )
    }

    func testAPasswordThatIsNeededAndMissingStopsTheRun() {
        XCTAssertFalse(
            WizardGate.checksPass(diskSpacePasses: true, needsPassword: true, hasPassword: false)
        )
    }

    func testAPasswordThatIsNeededAndTypedLetsTheRunGo() {
        XCTAssertTrue(
            WizardGate.checksPass(diskSpacePasses: true, needsPassword: true, hasPassword: true)
        )
    }

    func testADiskThatIsTooSmallStopsTheRunEvenWithThePasswordIn() {
        XCTAssertFalse(
            WizardGate.checksPass(diskSpacePasses: false, needsPassword: true, hasPassword: true)
        )
    }

    // MARK: - The restore

    func testTheRestoreWaitsWhileTheIPhoneSaysFindMyIsOn() {
        XCTAssertEqual(WizardGate.restore(findMyOn: true), .blockedByFindMy)
    }

    func testTheRestoreGoesAheadOnceTheIPhoneSaysFindMyIsOff() {
        XCTAssertEqual(WizardGate.restore(findMyOn: false), .allowed)
    }

    func testAPhoneThatWillNotSayIsNotHeldBack() {
        XCTAssertEqual(WizardGate.restore(findMyOn: nil), .allowed)
    }
}
