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

    // MARK: - Taking the backup away

    func testASuperviseRunThatWentThroughCanLetTheBackupGo() {
        XCTAssertTrue(
            WizardGate.backupCanGo(
                direction: .supervise,
                restoreFinished: true,
                supervisedAfterwards: true,
                profileConfirmed: true
            )
        )
    }

    func testAProfileThatWasNotConfirmedKeepsTheBackup() {
        // A failed install and a profile the phone lists with the wrong
        // settings both land here, and both keep the only way back.
        XCTAssertFalse(
            WizardGate.backupCanGo(
                direction: .supervise,
                restoreFinished: true,
                supervisedAfterwards: true,
                profileConfirmed: false
            )
        )
    }

    func testARestoreThatDidNotFinishKeepsTheBackup() {
        XCTAssertFalse(
            WizardGate.backupCanGo(
                direction: .supervise,
                restoreFinished: false,
                supervisedAfterwards: true,
                profileConfirmed: true
            )
        )
    }

    func testAPhoneThatNeverCameBackKeepsTheBackup() {
        XCTAssertFalse(
            WizardGate.backupCanGo(
                direction: .supervise,
                restoreFinished: true,
                supervisedAfterwards: nil,
                profileConfirmed: true
            )
        )
    }

    func testAPhoneThatCameBackTheOtherWayKeepsTheBackup() {
        XCTAssertFalse(
            WizardGate.backupCanGo(
                direction: .supervise,
                restoreFinished: true,
                supervisedAfterwards: false,
                profileConfirmed: true
            )
        )
        XCTAssertFalse(
            WizardGate.backupCanGo(
                direction: .unsupervise,
                restoreFinished: true,
                supervisedAfterwards: true,
                profileConfirmed: true
            )
        )
    }

    func testUnsupervisingAsksForNoProfileBeforeTheBackupGoes() {
        // That direction installs none, so the restore is the whole run.
        XCTAssertTrue(
            WizardGate.backupCanGo(
                direction: .unsupervise,
                restoreFinished: true,
                supervisedAfterwards: false,
                profileConfirmed: false
            )
        )
    }

    func testARunNobodyFinishedKeepsTheBackup() {
        // Nothing happened yet, which is every step before the restore and
        // every run somebody walked away from.
        XCTAssertFalse(
            WizardGate.backupCanGo(
                direction: .supervise,
                restoreFinished: false,
                supervisedAfterwards: nil,
                profileConfirmed: false
            )
        )
        XCTAssertFalse(
            WizardGate.backupCanGo(
                direction: .unsupervise,
                restoreFinished: false,
                supervisedAfterwards: nil,
                profileConfirmed: false
            )
        )
    }
}
