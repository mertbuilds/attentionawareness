import Foundation
import Testing

/// What each step demands before it runs.
///
/// Find My is the whole reason this is a type of its own: it has to be off
/// before the run starts, and the restore asks again in case it was turned
/// back on during the copy. These are the rules that say so, and the one that
/// says when a copy is patched enough to send, and none of them reads an
/// iPhone.
struct WizardGateTests {
    // MARK: - The checks

    @Test func theChecksPassWhenTheDiskIsBigEnoughAndAPasswordIsTyped() {
        #expect(WizardGate.checksPass(diskSpacePasses: true, findMyOn: false, hasPassword: true, key: .usable))
    }

    @Test func aDiskThatIsTooSmallStopsTheRun() {
        #expect(WizardGate.checksPass(diskSpacePasses: false, findMyOn: false, hasPassword: true, key: .usable) == false)
    }

    @Test func freeSpaceThatCouldNotBeReadBlocksNothingOnItsOwn() {
        #expect(WizardGate.checksPass(diskSpacePasses: nil, findMyOn: false, hasPassword: true, key: .usable))
    }

    @Test func aMissingPasswordStopsTheRun() {
        // The copy is always encrypted now, so a password is always required.
        #expect(WizardGate.checksPass(diskSpacePasses: true, findMyOn: false, hasPassword: false, key: .usable) == false)
    }

    @Test func aMissingPasswordStopsTheRunEvenWhenTheDiskWouldNotRead() {
        #expect(WizardGate.checksPass(diskSpacePasses: nil, findMyOn: false, hasPassword: false, key: .usable) == false)
    }

    @Test func aKeyThatHasNotBeenCheckedYetStopsTheRun() {
        // Nothing pasted, or a check still on its way back.
        #expect(WizardGate.checksPass(diskSpacePasses: true, findMyOn: false, hasPassword: true, key: nil) == false)
    }

    @Test func anIPhoneThatSaysFindMyIsOnStopsTheRun() {
        // The restore would be refused, so the copy does not start an hour of
        // work that ends in a wait.
        #expect(WizardGate.checksPass(diskSpacePasses: true, findMyOn: true, hasPassword: true, key: .usable) == false)
    }

    @Test func anIPhoneThatWillNotSayAboutFindMyIsNotHeldBack() {
        // The same rule the restore keeps, which still holds if it turns out
        // to be on.
        #expect(WizardGate.checksPass(diskSpacePasses: true, findMyOn: nil, hasPassword: true, key: .usable))
    }

    @Test func findMyOnStopsTheRunWhateverElseReadsFine() {
        for diskSpacePasses in [true, nil] as [Bool?] {
            #expect(
                WizardGate.checksPass(
                    diskSpacePasses: diskSpacePasses,
                    findMyOn: true,
                    hasPassword: true,
                    key: .usable
                ) == false
            )
        }
    }

    @Test(arguments: [LicenseCheck.usedUp, .revoked, .notFound, .unavailable])
    func onlyAUsableKeyLetsTheRunStart(_ check: LicenseCheck) {
        // A key server that could not be reached is no answer either: the run
        // waits for one rather than starting on a key nobody vouched for.
        #expect(WizardGate.checksPass(diskSpacePasses: true, findMyOn: false, hasPassword: true, key: check) == false)
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

    // MARK: - The iPhone leaving the cable

    @Test(arguments: [WizardStep.ready, .restrictions, .done, .profiles])
    func unpluggingThePickedIPhoneOffTheJobScreenGoesBackToConnect(_ step: WizardStep) {
        // These steps hold no job, the key field on the checks included.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: step,
                job: nil,
                helperRunning: false,
                leftoverShown: false
            ) == .startOver
        )
    }

    @Test(arguments: [
        JobPhase.preparing,
        .waitingForFindMy,
        .checkOnIPhone(reportedSupervised: true),
        .done,
        .failed(JobFailure(title: "Copy Didn't Finish", fix: "Try again.", raw: "", retry: .copy)),
        .failed(JobFailure(title: "Wrong Backup Password", fix: "Type it.", raw: "", retry: .patch)),
    ])
    func unpluggingThePickedIPhoneWhileNothingHasItGoesBackToConnect(_ job: JobPhase) {
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [Self.otherUdid],
                step: .job,
                job: job,
                helperRunning: false,
                leftoverShown: false
            ) == .startOver
        )
    }

    @Test(arguments: [JobPhase.encrypting, .connecting, .copying])
    func unpluggingThePickedIPhoneWhileTheHelperCopiesItStopsTheHelperFirst(_ job: JobPhase) {
        // Dropping the job under a running helper would leave it running with
        // nobody listening, so it is cancelled the way Cancel cancels it.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: .job,
                job: job,
                helperRunning: true,
                leftoverShown: false
            ) == .stopTheHelperFirst
        )
    }

    @Test(arguments: [JobPhase.encrypting, .connecting, .copying])
    func unpluggingThePickedIPhoneOnceTheHelperHasStoppedGoesBackToConnect(_ job: JobPhase) {
        // The phase can still name the copy for a moment after the helper has
        // stopped, and there is nothing left to wait for then.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: .job,
                job: job,
                helperRunning: false,
                leftoverShown: false
            ) == .startOver
        )
    }

    @Test(arguments: [
        JobPhase.restoring,
        .finishing,
        .restarting,
        .confirming,
        .phoneGone,
        .failed(JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)),
    ])
    func theRestoreRebootingThePhoneIsNotAnUnplug(_ job: JobPhase) {
        // The restore takes the phone off the cable on every run that works,
        // and a restore that stopped part way keeps its copy and its Try
        // Again rather than a new run that would clear the copy first.
        for helperRunning in [true, false] {
            #expect(
                WizardGate.lostPhone(
                    picked: Self.udid,
                    onCable: [],
                    step: .job,
                    job: job,
                    helperRunning: helperRunning,
                    leftoverShown: false
                ) == .carryOn,
                "helper running: \(helperRunning)"
            )
        }
    }

    @Test(arguments: [JobPhase.restarting, .confirming, .phoneGone])
    func aRestorePhaseLeftBehindOnTheChecksHoldsNothing(_ job: JobPhase) {
        // Cancel during the restart lands on Ready, and the cancelled job can
        // still write the phase it woke up to. Off the job screen that phase
        // is no reason to keep a run whose iPhone has gone.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: .ready,
                job: job,
                helperRunning: false,
                leftoverShown: false
            ) == .startOver
        )
    }

    @Test func theLastScreenStaysWhileItNamesALeftoverFolder() {
        // It is the one place the folder is named, and the person may want to
        // take it off this Mac themselves before they press Done.
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: .done,
                job: nil,
                helperRunning: false,
                leftoverShown: true
            ) == .carryOn
        )
    }

    @Test(arguments: [WizardStep.ready, .restrictions, .profiles])
    func aLeftoverFolderHoldsNoOtherStep(_ step: WizardStep) {
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [],
                step: step,
                job: nil,
                helperRunning: false,
                leftoverShown: true
            ) == .startOver
        )
    }

    @Test(arguments: [
        nil,
        JobPhase.copying,
        .waitingForFindMy,
        .checkOnIPhone(reportedSupervised: false),
    ])
    func unpluggingAnotherIPhoneChangesNothing(_ job: JobPhase?) {
        #expect(
            WizardGate.lostPhone(
                picked: Self.udid,
                onCable: [Self.udid],
                step: job == nil ? .ready : .job,
                job: job,
                helperRunning: job == .copying,
                leftoverShown: false
            ) == .carryOn
        )
    }

    @Test func nothingIsForgottenBeforeAnIPhoneIsPicked() {
        // Connect is where a phone is chosen, so there is no run to forget.
        #expect(
            WizardGate.lostPhone(
                picked: nil,
                onCable: [],
                step: .connect,
                job: nil,
                helperRunning: false,
                leftoverShown: false
            ) == .carryOn
        )
    }

    // MARK: - Spending the key

    private static let key = "AA-3F2C1D0E-8B7A-4C6D-9E5F-1A2B3C4D5E6F"
    private static let otherKey = "AA-9A8B7C6D-5E4F-4A3B-8C2D-1E0F9A8B7C6D"
    private static let udid = "00008140-000000000000001A"
    private static let otherUdid = "00008140-000B2C3D4E5F6071"

    @Test func aPhoneThatReadsAsSupervisedMakesItsSpendsDue() {
        let pending = [
            PendingSpend(key: Self.key, deviceID: Self.udid),
            PendingSpend(key: Self.otherKey, deviceID: Self.otherUdid),
        ]

        #expect(
            WizardGate.spendsDue(pending, supervision: [Self.udid: true])
                == [PendingSpend(key: Self.key, deviceID: Self.udid)]
        )
    }

    @Test func anEarlyReadAfterTheRestoreSpendsNothing() {
        // The phone answers as it was before it has settled, so a read that
        // says not supervised is no reason to spend and no reason to forget.
        let pending = [PendingSpend(key: Self.key, deviceID: Self.udid)]

        #expect(WizardGate.spendsDue(pending, supervision: [Self.udid: false]).isEmpty)
    }

    @Test func aPhoneThatIsNotOnTheCableSpendsNothing() {
        // A run that failed leaves its spend behind, and the phone it was for
        // has to say it is supervised before anything is counted.
        let pending = [PendingSpend(key: Self.key, deviceID: Self.udid)]

        #expect(WizardGate.spendsDue(pending, supervision: [:]).isEmpty)
        #expect(WizardGate.spendsDue(pending, supervision: [Self.otherUdid: true]).isEmpty)
    }

    @Test func aSpendThatIsAlreadyDueIsNotMadeDueAgain() {
        let due = PendingSpend(key: Self.key, deviceID: Self.udid, due: true)

        #expect(WizardGate.spendsDue([due], supervision: [Self.udid: true]).isEmpty)
    }

    @Test func pressingItsSupervisedCountsAsASupervisedRead() {
        // A cable pulled during the reboot leaves a phone this Mac never saw
        // come back supervised, so the person saying it is has to be enough.
        #expect(WizardGate.confirmsSupervision(.checkOnIPhone(reportedSupervised: false)))
        #expect(WizardGate.confirmsSupervision(.checkOnIPhone(reportedSupervised: true)))

        let pending = [PendingSpend(key: Self.key, deviceID: Self.udid)]
        #expect(WizardGate.spendsDue(pending, supervision: [Self.udid: true]) == pending)
    }

    @Test func aRunThatDidNotGetToTheEndConfirmsNothing() {
        let failed = JobFailure(title: "Restore Didn't Finish", fix: "Try again.", raw: "", retry: .restore)

        #expect(WizardGate.confirmsSupervision(.failed(failed)) == false)
        #expect(WizardGate.confirmsSupervision(.phoneGone) == false)
        #expect(WizardGate.confirmsSupervision(.restarting) == false)
        #expect(WizardGate.confirmsSupervision(.confirming) == false)
    }

    @Test func everyDueSpendIsSentWhicheverIPhoneIsOnTheCable() {
        let dueHere = PendingSpend(key: Self.key, deviceID: Self.udid, due: true)
        let dueElsewhere = PendingSpend(key: Self.otherKey, deviceID: Self.otherUdid, due: true)
        let waiting = PendingSpend(key: Self.otherKey, deviceID: Self.udid)

        #expect(WizardGate.spendsToSend([dueHere, waiting, dueElsewhere]) == [dueHere, dueElsewhere])
    }

    @Test func aKeyADueSpendHoldsIsUsedUpWithoutAskingPolar() {
        let pending = [PendingSpend(key: Self.key, deviceID: Self.otherUdid, due: true)]

        #expect(WizardGate.localCheck(key: Self.key, pending: pending) == .usedUp)
    }

    @Test func aKeyNoDueSpendHoldsIsLeftToPolar() {
        // A waiting spend is a run that may still fail, and a failed run costs
        // nothing, so it holds nothing.
        let waiting = PendingSpend(key: Self.key, deviceID: Self.udid)
        let otherKeyDue = PendingSpend(key: Self.otherKey, deviceID: Self.udid, due: true)

        #expect(WizardGate.localCheck(key: Self.key, pending: [waiting, otherKeyDue]) == nil)
        #expect(WizardGate.localCheck(key: Self.key, pending: []) == nil)
    }

    @Test func oneKeyCannotPayForASecondIPhoneWhilePolarIsOutOfReach() throws {
        let store = PendingSpendStore(storage: MemoryStorage())
        // The run on the first iPhone starts and the iPhone reads as
        // supervised, which marks the spend due before Polar is asked.
        try store.addPending(key: Self.key, deviceID: Self.udid)
        for spend in try WizardGate.spendsDue(store.allPending(), supervision: [Self.udid: true]) {
            try store.markDue(spend)
        }
        // Polar cannot be reached, so the spend stays owed.
        #expect(WizardGate.settle(.transient, key: Self.key, savedKey: Self.key) == .keep)

        // The second iPhone's Ready screen checks the same key. Polar never
        // heard of the spend and would call it usable; this Mac does not ask.
        let check = try WizardGate.localCheck(key: Self.key, pending: store.allPending())
        #expect(check == .usedUp)
        #expect(WizardGate.checksPass(diskSpacePasses: true, findMyOn: false, hasPassword: true, key: check) == false)
        // And the spend goes out again with the first iPhone nowhere near.
        #expect(
            try WizardGate.spendsToSend(store.allPending())
                == [PendingSpend(key: Self.key, deviceID: Self.udid, due: true)]
        )
    }

    @Test func aCountedSpendIsForgottenAndTakesTheSavedKeyWithIt() {
        #expect(
            WizardGate.settle(.spent, key: Self.key, savedKey: Self.key)
                == .forget(clearSavedKey: true)
        )
    }

    @Test func aRefusedSpendIsForgottenJustTheSame() {
        // A spend whose answer was lost comes back refused as used up, which
        // ends it the way a count would have.
        #expect(
            WizardGate.settle(.rejected, key: Self.key, savedKey: Self.key)
                == .forget(clearSavedKey: true)
        )
    }

    @Test func anotherKeyThatIsSavedStaysSaved() {
        // Somebody may have pasted their next key while this one was owed.
        #expect(
            WizardGate.settle(.spent, key: Self.key, savedKey: Self.otherKey)
                == .forget(clearSavedKey: false)
        )
        #expect(WizardGate.settle(.spent, key: Self.key, savedKey: nil) == .forget(clearSavedKey: false))
    }

    @Test func aSpendPolarCouldNotAnswerStaysOwed() {
        #expect(WizardGate.settle(.transient, key: Self.key, savedKey: Self.key) == .keep)
    }

    @Test func aNewRunOnAnIPhoneTakesOverTheSpendAFailedRunLeftUnderAnotherKey() {
        let failed = PendingSpend(key: Self.otherKey, deviceID: Self.udid)
        let sameKey = PendingSpend(key: Self.key, deviceID: Self.udid)
        let otherPhone = PendingSpend(key: Self.otherKey, deviceID: Self.otherUdid)

        #expect(
            WizardGate.supersededSpends(
                [failed, sameKey, otherPhone],
                byKey: Self.key,
                on: Self.udid
            ) == [failed]
        )
    }

    @Test func aDueSpendIsNeverTakenOverByANewRun() {
        // Its supervision went through, so its key is owed whatever runs next.
        let due = PendingSpend(key: Self.otherKey, deviceID: Self.udid, due: true)

        #expect(WizardGate.supersededSpends([due], byKey: Self.key, on: Self.udid).isEmpty)
    }
}
