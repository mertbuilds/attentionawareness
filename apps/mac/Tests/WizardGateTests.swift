import Foundation
import Testing

/// What each step demands before it runs.
///
/// Find My is the whole reason this is a type of its own: it has to be off for
/// the restore and for nothing else, so the checks let an hour of copying start
/// while the reader is still turning it off. These are the rules that say so,
/// and the one that says when a copy is patched enough to send, and none of
/// them reads an iPhone.
struct WizardGateTests {
    // MARK: - The checks

    @Test func theChecksPassWhenTheDiskIsBigEnoughAndNoPasswordIsNeeded() {
        #expect(
            WizardGate.checksPass(diskSpacePasses: true, needsPassword: false, hasPassword: false)
        )
    }

    @Test func aDiskThatIsTooSmallStopsTheRun() {
        #expect(
            WizardGate.checksPass(diskSpacePasses: false, needsPassword: false, hasPassword: false) == false
        )
    }

    @Test func freeSpaceThatCouldNotBeReadBlocksNothing() {
        #expect(
            WizardGate.checksPass(diskSpacePasses: nil, needsPassword: false, hasPassword: false)
        )
    }

    @Test func aPasswordThatIsNeededAndMissingStopsTheRun() {
        #expect(
            WizardGate.checksPass(diskSpacePasses: true, needsPassword: true, hasPassword: false) == false
        )
    }

    @Test func aPasswordThatIsNeededAndTypedLetsTheRunGo() {
        #expect(
            WizardGate.checksPass(diskSpacePasses: true, needsPassword: true, hasPassword: true)
        )
    }

    @Test func aDiskThatIsTooSmallStopsTheRunEvenWithThePasswordIn() {
        #expect(
            WizardGate.checksPass(diskSpacePasses: false, needsPassword: true, hasPassword: true) == false
        )
    }

    // MARK: - The patch

    @Test func aFlagThatWasWrittenIsAPatchedCopy() {
        #expect(
            WizardGate.patched(
                changes: ["IsSupervised: false -> true"],
                alreadyCorrect: false,
                running: false
            )
        )
    }

    @Test func aCopyThatAlreadySaidTheRightThingCountsAsPatched() {
        // Nothing was written, so there are no changes to show. The copy still
        // says what the restore is about to send.
        #expect(WizardGate.patched(changes: [], alreadyCorrect: true, running: false))
    }

    @Test func aPatchThatIsStillRunningHasNothingToShowYet() {
        #expect(
            WizardGate.patched(changes: ["IsSupervised: false -> true"], alreadyCorrect: false, running: true) == false
        )
    }

    @Test func aPatchThatWroteNothingAndSaysNothingIsNotAPatchedCopy() {
        // This is the arrival that runs the patch, and the one a failed patch
        // leaves behind. Both offer to patch rather than to restore, which is
        // what keeps the job from patching the same copy twice.
        #expect(WizardGate.patched(changes: [], alreadyCorrect: false, running: false) == false)
    }

    // MARK: - The restore

    @Test func theRestoreWaitsWhileTheIPhoneSaysFindMyIsOn() {
        #expect(WizardGate.restore(findMyOn: true, patched: true) == .blockedByFindMy)
    }

    @Test func theRestoreGoesAheadOnceTheIPhoneSaysFindMyIsOff() {
        #expect(WizardGate.restore(findMyOn: false, patched: true) == .allowed)
    }

    @Test func aPhoneThatWillNotSayIsNotHeldBack() {
        #expect(WizardGate.restore(findMyOn: nil, patched: true) == .allowed)
    }

    @Test func aCopyThatIsNotPatchedYetIsNeverSentWhateverFindMySays() {
        // Sending it back would put the phone where it already is, so the
        // button waits for the patch whichever way Find My reads.
        for findMyOn in [true, false, nil] as [Bool?] {
            #expect(WizardGate.restore(findMyOn: findMyOn, patched: false) == .notPatchedYet)
        }
    }

    // MARK: - Taking the backup away

    @Test func aRunThatWentThroughCanLetTheBackupGo() {
        #expect(
            WizardGate.backupCanGo(
                restoreFinished: true,
                supervisedAfterwards: true,
                profileConfirmed: true
            )
        )
    }

    @Test func aProfileThatWasNotConfirmedKeepsTheBackup() {
        // A failed install and a profile the phone lists with the wrong
        // settings both land here, and both keep the only way back.
        #expect(
            WizardGate.backupCanGo(
                restoreFinished: true,
                supervisedAfterwards: true,
                profileConfirmed: false
            ) == false
        )
    }

    @Test func aRestoreThatDidNotFinishKeepsTheBackup() {
        #expect(
            WizardGate.backupCanGo(
                restoreFinished: false,
                supervisedAfterwards: true,
                profileConfirmed: true
            ) == false
        )
    }

    @Test func aPhoneThatNeverCameBackKeepsTheBackup() {
        #expect(
            WizardGate.backupCanGo(
                restoreFinished: true,
                supervisedAfterwards: nil,
                profileConfirmed: true
            ) == false
        )
    }

    @Test func aPhoneThatCameBackUnsupervisedKeepsTheBackup() {
        #expect(
            WizardGate.backupCanGo(
                restoreFinished: true,
                supervisedAfterwards: false,
                profileConfirmed: true
            ) == false
        )
    }

    @Test func aRunNobodyFinishedKeepsTheBackup() {
        // Nothing happened yet, which is every step before the restore and
        // every run somebody walked away from.
        #expect(
            WizardGate.backupCanGo(
                restoreFinished: false,
                supervisedAfterwards: nil,
                profileConfirmed: false
            ) == false
        )
    }
}
