import Foundation
import Testing

@MainActor
struct SeedWizardTests {
    @Test func fullCopyIsTheDefaultOnEveryNewRun() {
        let model = makeModel()
        #expect(model.supervisionMethod == .fullCopy)
        #expect(WizardModel.Sample().supervisionMethod == .fullCopy)
        model.start()
        #expect(model.supervisionMethod == .fullCopy)
        #expect(model.requiresFullCopy)
        model.selectSupervisionMethod(.seed)
        model.confirmBackup(true)
        model.back()
        model.start()
        #expect(model.supervisionMethod == .fullCopy)
        #expect(!model.backupConfirmed)
        model.selectSupervisionMethod(.seed)
        model.startOver()
        #expect(model.supervisionMethod == .fullCopy)
    }

    @Test func seedNeedsNeitherFullCopySpaceNorPassword() {
        let model = makeModel()
        ready(model)
        #expect(model.supervisionMethod == .seed)
        #expect(!model.requiresFullCopy)
        #expect(model.checksPass)
        model.selectSupervisionMethod(.fullCopy)
        #expect(model.requiresFullCopy)
        #expect(!model.checksPass)
        model.password = "backup password"
        #expect(!model.checksPass) // the full-copy space check still blocks
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

    @Test(arguments: ["26.0", "26.6.2", "17.6.1"])
    func iOS26AndOlderDefaultToFullCopyWithFastSelectable(_ version: String) {
        let model = makeModel(version: version)
        model.start()
        #expect(model.supervisionMethod == .fullCopy)
        #expect(model.fastRefusal == nil)
        model.selectSupervisionMethod(.seed)
        #expect(model.supervisionMethod == .seed)
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

    @Test(arguments: [nil, "", "26.x", "27.0", "30.0"] as [String?])
    func newOrUnknownVersionsRunTheFullCopyAndAreNotOfferedFast(_ version: String?) async throws {
        let model = makeModel(version: version)
        model.freshVersion = version
        model.freeBytesWithoutLeftover = 1_000
        model.start()
        #expect(model.supervisionMethod == .fullCopy)
        #expect(model.fastRefusal != nil)
        model.selectSupervisionMethod(.seed)
        #expect(model.supervisionMethod == .fullCopy)
        ready(model, method: .fullCopy)
        model.password = "pw"
        #expect(model.checksPass)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["copy", "patch", "full restore", "phone", "confirm"])
    }

    @Test(arguments: [nil, "", "26.x", "27.0", "30.0"] as [String?])
    func fastNeverStartsOnANewOrUnknownVersion(_ version: String?) throws {
        let model = makeModel(version: version)
        ready(model, method: .seed)
        #expect(!model.checksPass)
        model.startJob()
        #expect(model.step == .ready)
        #expect(model.errorMessage == model.fastRefusal)
        #expect(model.events.isEmpty)
        #expect(try model.spendStore.allPending().isEmpty)
    }

    @Test func freshVersionRefusalBeforeWorkRecordsNoSpend() async throws {
        let model = makeModel()
        model.freshVersion = "27.0"
        ready(model)
        model.startJob()
        #expect(await waitUntil { if case .failed = model.job { return true }; return false })
        #expect(model.events == ["version"])
        #expect(try model.spendStore.allPending().isEmpty)
        guard case .failed(let failure) = model.job else { Issue.record("Expected version refusal"); return }
        #expect(failure.title == "Can't Use Fast on This iPhone")
        #expect(failure.fix == "Fast does not work on iOS 27 or later yet. Use full copy. Nothing was sent to iPhone.")
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

    @Test func fullCopyRoutingRetainsItsThreeOperationsAndFreezesSelection() async throws {
        let model = makeModel()
        ready(model, method: .fullCopy)
        model.password = "pw"
        model.startJob()
        model.selectSupervisionMethod(.seed)
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
        #expect(model.supervisionMethod == .fullCopy)
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
        model.selectSupervisionMethod(.fullCopy)
        #expect(model.supervisionMethod == .fullCopy)
        model.selectSupervisionMethod(.seed)
        model.holdPhone = false
        oldWait.resume(returning: true)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 2)
    }

    private func makeModel(version: String? = "26.0", seedEngine: SeedEngine? = nil) -> RoutingModel {
        let phone = ConnectedDevice(
            udid: "phone", name: "Test iPhone", productType: nil, marketingName: nil,
            iosVersion: version, findMyOn: false, backupEncrypted: true,
            cloudBackupOn: nil, lastCloudBackup: nil, dataCapacity: nil, dataAvailable: nil,
            pairingState: .paired
        )
        return RoutingModel(
            watcher: DeviceWatcher(sample: [phone]), engine: BackupEngine(sample: .idle, progress: 0),
            seedEngine: seedEngine, spendStore: PendingSpendStore(storage: MemoryStorage())
        )
    }

    private func ready(
        _ model: WizardModel, method: SupervisionMethod = .seed, backupConfirmed: Bool = true
    ) {
        model.show(WizardModel.Sample(
            step: .ready, supervisionMethod: method, backupConfirmed: backupConfirmed,
            udid: "phone", licenseKey: "test key", keyStatus: .checked(.usable)
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
        override func checkLicense(key: String) async -> LicenseCheck { .usable }
        override func spendLicense(key: String) async -> LicenseSpend { .spent }
        override func confirmWhatTheIPhoneIs() async -> Bool { events.append("confirm"); return reportsSupervised }
    }

    private final class SeedCalls {
        var restoreCount = 0
        var restartCount = 0
        var failRestart = true
        var holdConfiguration = false
        var heldConfiguration: CheckedContinuation<Void, Never>?
        var operations: SeedEngine.Operations {
            .init(
                readVersion: { _ in "26.0" },
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
