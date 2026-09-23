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

    @Test func theChecksPassWhenTheDiskIsBigEnoughAndAPasswordIsTyped() {
        #expect(WizardGate.checksPass(diskSpacePasses: true, hasPassword: true))
    }

    @Test func aDiskThatIsTooSmallStopsTheRun() {
        #expect(WizardGate.checksPass(diskSpacePasses: false, hasPassword: true) == false)
    }

    @Test func freeSpaceThatCouldNotBeReadBlocksNothingOnItsOwn() {
        #expect(WizardGate.checksPass(diskSpacePasses: nil, hasPassword: true))
    }

    @Test func aMissingPasswordStopsTheRun() {
        // The copy is always encrypted now, so a password is always required.
        #expect(WizardGate.checksPass(diskSpacePasses: true, hasPassword: false) == false)
    }

    @Test func aMissingPasswordStopsTheRunEvenWhenTheDiskWouldNotRead() {
        #expect(WizardGate.checksPass(diskSpacePasses: nil, hasPassword: false) == false)
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

    // MARK: - The restore password

    @Test func anEncryptedCopyIsSentBackWithThePassword() {
        #expect(WizardGate.restorePassword(secret: "hunter2", backupEncrypted: true) == "hunter2")
    }

    @Test func anUnencryptedCopyIsSentBackWithoutAPassword() {
        // A copy where encryption did not take carries no keybag, and a restore
        // with a password over it is refused with a keybag error that reads as a
        // wrong backup password. So the password is dropped and it goes back
        // without one.
        #expect(WizardGate.restorePassword(secret: "hunter2", backupEncrypted: false) == nil)
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
