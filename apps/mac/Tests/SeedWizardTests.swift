import Foundation
import Testing

@MainActor
struct SeedWizardTests {
    @Test func anIOS26IPhoneGoesFromConnectToReadyToAFastRunWithNoChoice() async throws {
        let model = makeModel(version: "26.4.1")
        model.freshVersion = "26.4.1"
        #expect(!model.showsManualGuide)
        #expect(model.iosRefusal == nil)
        model.start()
        #expect(model.step == .ready)
        #expect(model.supervisionMethod == .seed)
        #expect(!model.checksPass)
        model.confirmBackup(true)
        #expect(model.checksPass)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["version", "seed", "phone", "confirm"])
        #expect(model.activeMethod == .seed)
    }

    @Test(arguments: ["27", "27.0", "27.2", "30.0", nil, "", "26.x"] as [String?])
    func anIPhoneTheAppDoesNotRunOnLandsOnTheGuideAndCannotStart(_ version: String?) {
        let model = makeModel(version: version)
        #expect(model.showsManualGuide)
        #expect(model.iosRefusal == IOSSupport.refusal(iosVersion: version))
        model.start()
        #expect(model.step == .connect)
        #expect(model.udid == nil)
        #expect(model.events.isEmpty)
    }

    @Test(arguments: ["27.2", nil] as [String?])
    func theModelRefusesARunOnAnIPhoneTheAppDoesNotRunOn(_ version: String?) {
        let model = makeModel(version: version)
        // Even a run put on Ready by hand never starts.
        ready(model)
        #expect(!model.checksPass)
        model.startJob()
        #expect(model.step == .ready)
        #expect(model.errorMessage == model.iosRefusal?.message)
        #expect(model.events.isEmpty)
    }

    @Test func pluggingInAnotherIPhoneSwitchesBetweenTheGuideAndTheRun() {
        let model = makeModel(version: "27.2")
        #expect(model.showsManualGuide)
        model.watcher.show(devices: [phone(version: "26.6.2", udid: "other")])
        #expect(!model.showsManualGuide)
        model.start()
        #expect(model.step == .ready)
        model.back()
        #expect(model.step == .connect)
        model.watcher.show(devices: [phone(version: "27.0", udid: "third")])
        #expect(model.showsManualGuide)
        model.start()
        #expect(model.step == .connect)
    }

    @Test func pickingTheOtherIPhoneOnTheCableFollowsTheScreen() {
        let model = makeModel(version: "27.2")
        let ios26 = phone(version: "26.6.2", udid: "other")
        model.watcher.show(devices: [phone(version: "27.2"), ios26])
        #expect(model.showsManualGuide)
        model.select(ios26)
        #expect(!model.showsManualGuide)
        model.start()
        #expect(model.step == .ready)
        #expect(model.udid == "other")
    }

    @Test(arguments: ["27.2", nil] as [String?])
    func anIOS27IPhoneThatIsAlreadySupervisedStillReachesManageRestrictions(_ version: String?) {
        let calls = SeedCalls()
        let model = RoutingModel(
            watcher: DeviceWatcher(
                sample: [phone(version: version)],
                cloudConfigurations: [
                    "phone": CloudConfiguration(isSupervised: true, organizationName: "Me", raw: "<dict/>"),
                ]
            ),
            engine: BackupEngine(sample: .idle, progress: 0),
            seedEngine: SeedEngine(operations: calls.operations)
        )
        #expect(model.offersManageRestrictions)
        #expect(!model.showsManualGuide)
        model.manageRestrictions()
        #expect(model.step == .profiles)
        // The Profiles screen installs a profile over MCInstall. Nothing on
        // the way there reads the version for a run or restores anything.
        #expect(model.events.isEmpty)
        #expect(calls.restoreCount == 0)
        #expect(calls.restartCount == 0)
    }

    @Test func seedNeedsOnlyTheBackupTick() {
        let model = makeModel()
        ready(model, backupConfirmed: false)
        #expect(!model.checksPass)
        model.confirmBackup(true)
        #expect(model.checksPass)
    }

    @Test(arguments: [SupervisionMethod.fullCopy, .seed])
    func neitherMethodStartsUntilTheirOwnBackupIsConfirmed(_ method: SupervisionMethod) async throws {
        let model = makeModel()
        model.freeBytesWithoutLeftover = 1_000
        ready(model, method: method, backupConfirmed: false)
        model.password = "pw"
        #expect(!model.checksPass)
        model.startJob()
        #expect(model.step == .ready)
        #expect(model.events.isEmpty)
        model.confirmBackup(true)
        #expect(model.checksPass)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
    }

    @Test func theBackupNoticeNamesTheBackupAndWhoIsResponsible() {
        #expect(BackupSafetyNet.notice == """
            Back up your iPhone first, with Finder or iCloud. The app does not erase your iPhone, \
            but things can go wrong. If they do, your backup is the way back. We are not \
            responsible for lost data.
            """)
        #expect(BackupSafetyNet.confirmation == "I backed up my iPhone")
    }

    @Test func startClearsALeftoverWhicheverMethodFollows() async throws {
        let model = makeModel()
        model.leftoverOnDisk = true
        model.start()
        #expect(await waitUntil { model.clearedLeftoverBackup })
        #expect(model.removals == 1)
        #expect(!model.leftoverOnDisk)
    }

    @Test func cancelledFullCopyLeavesSuperviseUsable() async throws {
        let model = makeModel()
        model.freeBytesWithoutLeftover = 1_000
        model.holdCopy = true
        ready(model, method: .fullCopy)
        model.password = "pw"
        #expect(model.checksPass)
        model.startJob()
        #expect(await waitUntil { model.copyCompletion != nil })
        let finish = try #require(model.copyCompletion)
        #expect(model.diskSpace.passes == false)
        model.cancelJob()
        #expect(model.step == .ready)
        #expect(await waitUntil { model.clearedLeftoverBackup })
        #expect(model.removals == 1)
        #expect(model.checksPass)
        finish.resume()
    }

    @Test func cancelKeepsAFullCopyThatFinished() async throws {
        let model = makeModel()
        model.leftoverOnDisk = true
        model.show(WizardModel.Sample(
            step: .job, supervisionMethod: .fullCopy, udid: "phone",
            backupFolder: URL(fileURLWithPath: "/finished/phone")
        ))
        model.cancelJob()
        #expect(model.step == .ready)
        for _ in 0..<5 { await Task.yield() }
        #expect(model.removals == 0)
        #expect(model.leftoverOnDisk)
    }

    @Test(arguments: ["27.0", "27.2", nil] as [String?])
    func theDebugValueSkipsTheGuideAndLetsTheFastRunThrough(_ version: String?) async throws {
        let model = makeModel(version: version, allowsFastOnAnyIOS: true)
        model.freshVersion = version
        #expect(!model.showsManualGuide)
        #expect(model.iosRefusal == nil)
        model.start()
        #expect(model.step == .ready)
        model.confirmBackup(true)
        #expect(model.checksPass)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["version", "seed", "phone", "confirm"])
    }

    @Test func theDebugValueTakesTheFastRunThroughBothGuardsOnIOS27() async throws {
        let calls = SeedCalls()
        calls.failRestart = false
        calls.version = "27.0"
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(version: "27.0", seedEngine: engine, allowsFastOnAnyIOS: true)
        model.useSeedEngine = true
        model.freshVersion = "27.0"
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 1)
    }

    @Test func freshVersionRefusalStopsBeforeAnyWork() async throws {
        let model = makeModel()
        model.freshVersion = "27.0"
        ready(model)
        model.startJob()
        #expect(await waitUntil { if case .failed = model.job { return true }; return false })
        #expect(model.events == ["version"])
        guard case .failed(let failure) = model.job else { Issue.record("Expected version refusal"); return }
        #expect(failure.title == "Can't Supervise This iPhone")
        #expect(failure.fix == "This app cannot supervise iOS 27 or later yet. Nothing was sent to iPhone.")
    }

    @Test func seedRoutingSkipsCopyPatchAndFullRestoreAndRemovesNothingOfItsOwn() async throws {
        let model = makeModel()
        model.start()
        #expect(await waitUntil { model.removals == 1 })
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["version", "seed", "phone", "confirm"])
        #expect(model.removals == 1)
        #expect(model.backupFolder == nil)
        #expect(model.restore.stage == .finished)
        #expect(model.job == .checkOnIPhone(reportedSupervised: true))
        model.show(WizardModel.Sample(
            step: .done, supervisionMethod: .seed, udid: "phone", backupFolder: URL(fileURLWithPath: "/leftover/phone"),
            restore: .init(stage: .finished, supervisedAfterwards: true), profile: .init(isConfirmed: true)
        ))
        model.deleteBackupIfTheRunIsDone()
        #expect(model.removals == 1)
    }

    @Test func fullCopyRoutingRetainsItsThreeOperations() async throws {
        let model = makeModel()
        ready(model, method: .fullCopy)
        model.password = "pw"
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["copy", "patch", "full restore", "phone", "confirm"])
        #expect(model.activeMethod == .fullCopy)
    }

    @Test func unplugDuringSeedPreparationForgetsRunAndCannotLandAnOldAnswer() async throws {
        let model = makeModel()
        model.holdSeed = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.seedCompletion != nil })
        let finish = try #require(model.seedCompletion)
        model.watcher.show(devices: [])
        #expect(model.step == .connect)
        finish.resume()
        #expect(await waitUntil { model.seedReturned })
        #expect(model.step == .connect)
        #expect(model.job == nil)
        #expect(!model.events.contains("phone"))
        #expect(model.supervisionMethod == .seed)
    }

    @Test func failedSeedRestoreStaysRetryableWhenItsPhoneUnplugs() async throws {
        let model = makeModel()
        model.seedError = BackupError.failed("restore test failure")
        ready(model)
        model.startJob()
        #expect(await waitUntil { if case .failed = model.job { return true }; return false })
        guard case .failed(let failure) = model.job else { Issue.record("Expected restore failure"); return }
        #expect(failure.retry == .restore)
        model.watcher.show(devices: [])
        #expect(model.step == .job)
    }

    @Test func appliedSeedRetryRestartsWithoutResendingConfiguration() async throws {
        let calls = SeedCalls()
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(seedEngine: engine)
        model.useSeedEngine = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { if case .failed = model.job { return true }; return false })
        #expect(engine.restoreApplied)
        #expect(calls.restoreCount == 1)
        guard case .failed(let failure) = model.job else { Issue.record("Expected restart failure"); return }
        #expect(failure.title == "Restart Needed")
        calls.failRestart = false
        model.retryJob(from: .restore)
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 2)
        #expect(model.job == .checkOnIPhone(reportedSupervised: true))
    }

    @Test func notSupervisedAfterSeedMakesTryAgainResendTheConfiguration() async throws {
        let calls = SeedCalls()
        calls.failRestart = false
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(seedEngine: engine)
        model.useSeedEngine = true
        model.reportsSupervised = false
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: false) })
        #expect(calls.restoreCount == 1)
        #expect(!engine.restoreApplied)
        model.retryJob(from: .restore)
        #expect(await waitUntil { calls.restoreCount == 2 && model.job == .checkOnIPhone(reportedSupervised: false) })
        #expect(calls.restartCount == 2)
        #expect(model.events.filter { $0 == "seed restart" }.isEmpty)
        model.cancelJob()
        model.startJob()
        #expect(await waitUntil { calls.restoreCount == 3 && model.job == .checkOnIPhone(reportedSupervised: false) })
        #expect(calls.restartCount == 3)
    }

    @Test func newRunWaitsForAStoppedRunsDeviceReadInsteadOfFailing() async throws {
        let calls = SeedCalls()
        calls.failRestart = false
        calls.holdConfiguration = true
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(seedEngine: engine)
        model.useSeedEngine = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { calls.heldConfiguration != nil })
        let oldRead = try #require(calls.heldConfiguration)
        model.cancelJob()
        #expect(model.step == .ready)
        calls.holdConfiguration = false
        model.startJob()
        #expect(await waitUntil { model.events.filter { $0 == "seed" }.count == 2 })
        for _ in 0..<5 { await Task.yield() }
        #expect(engine.running)
        #expect(model.job == .preparing)
        oldRead.resume()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
    }

    @Test func cancelDuringPreparationReturnsToReadyWithoutAnOldCompletion() async throws {
        let model = makeModel()
        model.holdSeed = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.seedCompletion != nil })
        let finish = try #require(model.seedCompletion)
        model.cancelJob()
        #expect(model.step == .ready)
        finish.resume()
        #expect(await waitUntil { model.seedReturned })
        #expect(model.step == .ready)
        #expect(model.job == nil)
        #expect(!model.events.contains("phone"))
    }

    @Test func cancelDuringReconnectResetsBusyStateAndResumesOnlyRestart() async throws {
        let calls = SeedCalls()
        calls.failRestart = false
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(seedEngine: engine)
        model.useSeedEngine = true
        model.holdPhone = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.phoneCompletion != nil })
        let oldWait = try #require(model.phoneCompletion)
        model.cancelJob()
        #expect(model.step == .ready)
        #expect(!model.isBusy)
        model.holdPhone = false
        oldWait.resume(returning: true)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 2)
    }

    private func makeModel(
        version: String? = "26.0", seedEngine: SeedEngine? = nil, allowsFastOnAnyIOS: Bool = false
    ) -> RoutingModel {
        RoutingModel(
            watcher: DeviceWatcher(sample: [phone(version: version)]),
            engine: BackupEngine(sample: .idle, progress: 0),
            seedEngine: seedEngine,
            allowsFastOnAnyIOS: allowsFastOnAnyIOS
        )
    }

    private func phone(version: String?, udid: String = "phone") -> ConnectedDevice {
        ConnectedDevice(
            udid: udid, name: "Test iPhone", productType: nil, marketingName: nil,
            iosVersion: version, findMyOn: false, backupEncrypted: true,
            cloudBackupOn: nil, lastCloudBackup: nil, dataCapacity: nil, dataAvailable: nil,
            pairingState: .paired
        )
    }

    private func ready(
        _ model: WizardModel, method: SupervisionMethod = .seed, backupConfirmed: Bool = true
    ) {
        model.show(WizardModel.Sample(
            step: .ready, supervisionMethod: method, backupConfirmed: backupConfirmed,
            udid: "phone"
        ))
    }

    private func waitUntil(_ condition: () -> Bool) async -> Bool {
        let deadline = ContinuousClock.now + .seconds(3)
        while !condition(), ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(2))
        }
        return condition()
    }

    private final class RoutingModel: WizardModel {
        var events: [String] = []
        var removals = 0
        var freshVersion: String? = "26.0"
        var holdSeed = false
        var seedCompletion: CheckedContinuation<Void, Never>?
        var seedError: Error?
        var useSeedEngine = false
        var seedReturned = false
        var holdPhone = false
        var phoneCompletion: CheckedContinuation<Bool, Never>?
        var reportsSupervised = true
        /// A copy that never finished, which takes the room the next one needs.
        var leftoverOnDisk = false
        var freeBytesWithoutLeftover: UInt64 = 0
        var holdCopy = false
        var copyCompletion: CheckedContinuation<Void, Never>?

        override var diskSpace: DiskSpace {
            DiskSpace(needed: 100, free: leftoverOnDisk ? 0 : freeBytesWithoutLeftover, assumed: false)
        }
        override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder { .nothingHere }
        override func removeBackup(of udid: String) async -> BackupRemoval {
            removals += 1
            guard leftoverOnDisk else { return .nothingThere }
            leftoverOnDisk = false
            return .deleted
        }
        override func readDeviceIOSVersion(udid: String) async throws -> String? { events.append("version"); return freshVersion }
        override func copyTheIPhone() async throws {
            events.append("copy")
            guard holdCopy else { return }
            leftoverOnDisk = true
            await withCheckedContinuation { copyCompletion = $0 }
            try Task.checkCancellation()
        }
        override func markTheCopy() async throws { events.append("patch") }
        override func sendTheCopyBack() async throws { events.append("full restore") }
        override func sendSeedConfiguration(restartingOnly: Bool) async throws {
            defer { seedReturned = true }
            events.append(restartingOnly ? "seed restart" : "seed")
            if useSeedEngine { return try await super.sendSeedConfiguration(restartingOnly: restartingOnly) }
            if holdSeed { await withCheckedContinuation { seedCompletion = $0 } }
            try Task.checkCancellation()
            if let seedError { throw seedError }
        }
        override func waitForPhone(until deadline: Date?) async -> Bool {
            events.append("phone")
            if holdPhone { return await withCheckedContinuation { phoneCompletion = $0 } }
            return true
        }
        override func confirmWhatTheIPhoneIs() async -> Bool { events.append("confirm"); return reportsSupervised }
    }

    private final class SeedCalls {
        var restoreCount = 0
        var restartCount = 0
        var failRestart = true
        var version: String? = "26.0"
        var holdConfiguration = false
        var heldConfiguration: CheckedContinuation<Void, Never>?
        var operations: SeedEngine.Operations {
            .init(
                readVersion: { _ in self.version },
                readConfiguration: { _ in
                    if self.holdConfiguration { await withCheckedContinuation { self.heldConfiguration = $0 } }
                    return try PropertyListSerialization.data(fromPropertyList: [:], format: .xml, options: 0)
                },
                restore: { _, _ in self.restoreCount += 1 },
                restart: { _ in
                    self.restartCount += 1
                    if self.failRestart { throw DeviceError.requestFailed(request: "Restart", code: -1) }
                },
                cancelRestore: {}
            )
        }
    }
}
