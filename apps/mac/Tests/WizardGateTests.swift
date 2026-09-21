import XCTest

/// What each step demands before it runs.
///
/// Find My is the whole reason this is a type of its own: it has to be off for
/// the restore and for nothing else, so the checks let an hour of copying start
/// while the reader is still turning it off. These are the rules that say so,
/// and the one that says when a copy is patched enough to send, and none of
/// them reads an iPhone.
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

    // MARK: - The patch

    func testAFlagThatWasWrittenIsAPatchedCopy() {
        XCTAssertTrue(
            WizardGate.patched(
                changes: ["IsSupervised: false -> true"],
                alreadyCorrect: false,
                running: false
            )
        )
    }

    func testACopyThatAlreadySaidTheRightThingCountsAsPatched() {
        // Nothing was written, so there are no changes to show. The copy still
        // says what the restore is about to send.
        XCTAssertTrue(WizardGate.patched(changes: [], alreadyCorrect: true, running: false))
    }

    func testAPatchThatIsStillRunningHasNothingToShowYet() {
        XCTAssertFalse(
            WizardGate.patched(changes: ["IsSupervised: false -> true"], alreadyCorrect: false, running: true)
        )
    }

    func testAPatchThatWroteNothingAndSaysNothingIsNotAPatchedCopy() {
        // This is the arrival that runs the patch, and the one a failed patch
        // leaves behind. Both offer to patch rather than to restore, which is
        // what keeps the job from patching the same copy twice.
        XCTAssertFalse(WizardGate.patched(changes: [], alreadyCorrect: false, running: false))
    }

    // MARK: - The restore

    func testTheRestoreWaitsWhileTheIPhoneSaysFindMyIsOn() {
        XCTAssertEqual(WizardGate.restore(findMyOn: true, patched: true), .blockedByFindMy)
    }

    func testTheRestoreGoesAheadOnceTheIPhoneSaysFindMyIsOff() {
        XCTAssertEqual(WizardGate.restore(findMyOn: false, patched: true), .allowed)
    }

    func testAPhoneThatWillNotSayIsNotHeldBack() {
        XCTAssertEqual(WizardGate.restore(findMyOn: nil, patched: true), .allowed)
    }

    func testACopyThatIsNotPatchedYetIsNeverSentWhateverFindMySays() {
        // Sending it back would put the phone where it already is, so the
        // button waits for the patch whichever way Find My reads.
        for findMyOn in [true, false, nil] as [Bool?] {
            XCTAssertEqual(WizardGate.restore(findMyOn: findMyOn, patched: false), .notPatchedYet)
        }
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
