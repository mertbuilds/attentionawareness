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
        #expect(!model.checksPass)
        model.confirmBackup(true)
        #expect(model.checksPass)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["version", "seed", "phone", "confirm"])
    }

    @Test(arguments: ["28", "28.0", "30.0", nil, "", "26.x"] as [String?])
    func anIPhoneTheAppDoesNotRunOnLandsOnTheGuideAndCannotStart(_ version: String?) {
        let model = makeModel(version: version)
        #expect(model.showsManualGuide)
        #expect(model.iosRefusal == IOSSupport.refusal(iosVersion: version))
        model.start()
        #expect(model.step == .connect)
        #expect(model.udid == nil)
        #expect(model.events.isEmpty)
    }

    @Test(arguments: ["28.0", nil] as [String?])
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
        let model = makeModel(version: "28.0")
        #expect(model.showsManualGuide)
        model.watcher.show(devices: [phone(version: "26.6.2", udid: "other")], cloudConfigurations: notSupervised("other"))
        #expect(!model.showsManualGuide)
        model.start()
        #expect(model.step == .ready)
        model.back()
        #expect(model.step == .connect)
        model.watcher.show(devices: [phone(version: "28.0", udid: "third")], cloudConfigurations: notSupervised("third"))
        #expect(model.showsManualGuide)
        model.start()
        #expect(model.step == .connect)
    }

    @Test func pickingTheOtherIPhoneOnTheCableFollowsTheScreen() {
        let model = makeModel(version: "28.0")
        let ios26 = phone(version: "26.6.2", udid: "other")
        model.watcher.show(
            devices: [phone(version: "28.0"), ios26],
            cloudConfigurations: notSupervised("phone", "other")
        )
        #expect(model.showsManualGuide)
        model.select(ios26)
        #expect(!model.showsManualGuide)
        model.start()
        #expect(model.step == .ready)
        #expect(model.udid == "other")
    }

    @Test(arguments: ["28.0", nil] as [String?])
    func anIOS28IPhoneThatIsAlreadySupervisedStillReachesManageRestrictions(_ version: String?) {
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

    /// MCInstall can miss a read right after Trust. Until it answers, an
    /// iOS 28 iPhone could be one supervised by hand, so it gets neither the
    /// guide nor Continue, and the answer decides.
    @Test func anIOS28IPhoneWhoseSupervisionIsUnreadWaitsForTheRead() {
        let model = RoutingModel(
            watcher: DeviceWatcher(sample: [phone(version: "28.0")]),
            engine: BackupEngine(sample: .idle, progress: 0)
        )
        #expect(model.readsSupervisionFirst)
        #expect(!model.showsManualGuide)
        #expect(!model.offersManageRestrictions)
        model.start()
        #expect(model.step == .connect)
        model.watcher.show(
            devices: [phone(version: "28.0")],
            cloudConfigurations: ["phone": CloudConfiguration(isSupervised: true, organizationName: "Me", raw: "<dict/>")]
        )
        #expect(!model.readsSupervisionFirst)
        #expect(model.offersManageRestrictions)
        #expect(!model.showsManualGuide)
        model.watcher.show(devices: [phone(version: "28.0")], cloudConfigurations: notSupervised("phone"))
        #expect(model.showsManualGuide)
    }

    @Test func seedNeedsOnlyTheBackupTick() {
        let model = makeModel()
        ready(model, backupConfirmed: false)
        #expect(!model.checksPass)
        model.confirmBackup(true)
        #expect(model.checksPass)
    }

    @Test func aRunDoesNotStartUntilTheOwnBackupIsConfirmed() async throws {
        let model = makeModel()
        ready(model, backupConfirmed: false)
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

    @Test(arguments: ["28.0", "30.1", nil] as [String?])
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

    /// A normal run on iOS 27 goes through the restore, the wait, the live
    /// step and the confirm. iOS 28 gets the same run only with the debug
    /// value.
    @Test(arguments: [("27.2", false), ("27.0", false), ("28.0", true)])
    func aRunOnIOS27GoesThroughTheRestoreTheWaitTheLiveStepAndTheConfirm(
        _ version: String, _ debug: Bool
    ) async throws {
        let calls = SeedCalls()
        calls.failRestart = false
        calls.version = version
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(version: version, seedEngine: engine, allowsFastOnAnyIOS: debug)
        model.useSeedEngine = true
        model.freshVersion = version
        #expect(!model.showsManualGuide)
        #expect(model.iosRefusal == nil)
        model.start()
        #expect(model.step == .ready)
        model.confirmBackup(true)
        #expect(model.checksPass)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
        // On iOS 27 the restore restarts iPhone itself.
        #expect(calls.restartCount == 0)
        // The setting is sent live once iPhone is back, and the run then ends
        // where a run on iOS 26 ends.
        #expect(model.events == ["version", "seed", "phone", "live", "confirm"])
        #expect(calls.liveCount == 1)
        #expect(model.liveConfigurationApplied)
        #expect(model.restore.stage == .finished)
        model.advance()
        #expect(model.step == .restrictions)
    }

    /// The restore is what a failed live step is tried again from, so it is
    /// not forgotten before that step went through.
    @Test func theRestoreIsNotForgottenBeforeTheLiveStepWentThrough() async throws {
        let calls = SeedCalls()
        calls.version = "27.0"
        let engine = SeedEngine(operations: calls.operations)
        calls.engine = engine
        let model = makeModel(version: "27.0", seedEngine: engine)
        model.useSeedEngine = true
        model.freshVersion = "27.0"
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.owedAtLiveStep == [true])
        // Once it went through, another try sends the configuration again.
        #expect(!engine.restoreApplied)
        #expect(!engine.liveConfigurationOwed)
    }

    @Test func aLiveStepIPhoneDidNotTakeIsTriedAgainAloneWithNoRestoreAndNoRestart() async throws {
        let calls = SeedCalls()
        calls.version = "27.0"
        calls.takesLiveConfiguration = false
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(version: "27.0", seedEngine: engine)
        model.useSeedEngine = true
        model.freshVersion = "27.0"
        ready(model)
        model.startJob()
        #expect(await waitUntil { if case .failed = model.job { return true }; return false })
        guard case .failed(let failure) = model.job else { Issue.record("Expected the live step to fail"); return }
        #expect(failure.title == "iPhone Didn't Take the Setting")
        #expect(engine.restoreApplied)
        #expect(engine.liveConfigurationOwed)
        #expect(!model.liveConfigurationApplied)
        #expect(calls.liveCount == SeedEngine.liveConfigurationAttemptLimit)
        calls.takesLiveConfiguration = true
        model.retryJob(from: failure.retry)
        #expect(model.job == .awaitingLiveConfiguration)
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        // Try Again read no version and sent no seed: the wait and the live
        // step, nothing else.
        #expect(model.events == ["version", "seed", "phone", "live", "phone", "live", "confirm"])
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 0)
        #expect(calls.liveCount == SeedEngine.liveConfigurationAttemptLimit + 1)
        #expect(model.liveConfigurationApplied)
    }

    @Test func cancelWhileTheLiveStepIsOwedThenSuperviseAgainSendsOnlyTheLiveStep() async throws {
        let calls = SeedCalls()
        calls.version = "27.0"
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(version: "27.0", seedEngine: engine)
        model.useSeedEngine = true
        model.freshVersion = "27.0"
        model.holdPhone = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.phoneCompletion != nil })
        #expect(model.job == .awaitingLiveConfiguration)
        let oldWait = try #require(model.phoneCompletion)
        model.cancelJob()
        #expect(model.step == .ready)
        #expect(!model.isBusy)
        #expect(engine.liveConfigurationOwed)
        model.holdPhone = false
        oldWait.resume(returning: true)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 0)
        #expect(calls.liveCount == 1)
    }

    /// Cancel landed while the set was out, and iPhone took that set. The
    /// next Supervise sends the setting again and never a second restore.
    @Test func cancelWhileASetIsOutThenSuperviseAgainNeverRestoresAgain() async throws {
        let calls = SeedCalls()
        calls.version = "27.0"
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(version: "27.0", seedEngine: engine)
        model.useSeedEngine = true
        model.freshVersion = "27.0"
        calls.duringLive = {
            calls.duringLive = nil
            model.cancelJob()
        }
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.step == .ready && !engine.running })
        #expect(calls.liveCount == 1)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 0)
        #expect(calls.liveCount == 2)
    }

    @Test func aRunOnIOS26NeverSendsTheSettingLive() async throws {
        let calls = SeedCalls()
        calls.failRestart = false
        let engine = SeedEngine(operations: calls.operations)
        let model = makeModel(seedEngine: engine)
        model.useSeedEngine = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["version", "seed", "phone", "confirm"])
        #expect(calls.restoreCount == 1)
        #expect(calls.restartCount == 1)
        #expect(calls.liveCount == 0)
        #expect(!model.liveConfigurationApplied)
        #expect(model.restoreCompletedLine(for: .checkOnIPhone(reportedSupervised: true)) == nil)
    }

    @Test func freshVersionRefusalStopsBeforeAnyWork() async throws {
        let model = makeModel()
        model.freshVersion = "28.0"
        ready(model)
        model.startJob()
        #expect(await waitUntil { if case .failed = model.job { return true }; return false })
        #expect(model.events == ["version"])
        guard case .failed(let failure) = model.job else { Issue.record("Expected version refusal"); return }
        #expect(failure.title == "Can't Supervise This iPhone")
        #expect(failure.fix == "This app cannot supervise iOS 28 or later yet. Nothing was sent to iPhone.")
    }

    @Test func aRunReadsTheVersionSendsTheSeedAndWaitsForThePhone() async throws {
        let model = makeModel()
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.events == ["version", "seed", "phone", "confirm"])
        #expect(model.restore.stage == .finished)
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
            watcher: DeviceWatcher(sample: [phone(version: version)], cloudConfigurations: notSupervised("phone")),
            engine: BackupEngine(sample: .idle, progress: 0),
            seedEngine: seedEngine,
            allowsFastOnAnyIOS: allowsFastOnAnyIOS
        )
    }

    /// What MCInstall says about iPhones that are not supervised.
    private func notSupervised(_ udids: String...) -> [String: CloudConfiguration] {
        Dictionary(uniqueKeysWithValues: udids.map {
            ($0, CloudConfiguration(isSupervised: false, organizationName: nil, raw: "<dict/>"))
        })
    }

    private func phone(version: String?, udid: String = "phone") -> ConnectedDevice {
        ConnectedDevice(
            udid: udid, name: "Test iPhone", productType: nil, marketingName: nil,
            iosVersion: version, findMyOn: false, backupEncrypted: true,
            cloudBackupOn: nil, lastCloudBackup: nil, dataCapacity: nil, dataAvailable: nil,
            pairingState: .paired
        )
    }

    private func ready(_ model: WizardModel, backupConfirmed: Bool = true) {
        model.show(WizardModel.Sample(step: .ready, backupConfirmed: backupConfirmed, udid: "phone"))
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
        var freshVersion: String? = "26.0"
        var holdSeed = false
        var seedCompletion: CheckedContinuation<Void, Never>?
        var seedError: Error?
        var useSeedEngine = false
        var seedReturned = false
        var holdPhone = false
        var phoneCompletion: CheckedContinuation<Bool, Never>?
        var reportsSupervised = true

        override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder { .nothingHere }
        override func readDeviceIOSVersion(udid: String) async throws -> String? { events.append("version"); return freshVersion }
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
        override func applyLiveConfiguration() async throws {
            events.append("live")
            try await super.applyLiveConfiguration()
        }
        override func confirmWhatTheIPhoneIs() async -> Bool { events.append("confirm"); return reportsSupervised }
    }

    @MainActor
    private final class SeedCalls {
        var restoreCount = 0
        var restartCount = 0
        var failRestart = true
        var version: String? = "26.0"
        var holdConfiguration = false
        var heldConfiguration: CheckedContinuation<Void, Never>?
        /// How often a configuration was sent live, which only a run on iOS
        /// 27 or later does, and whether iPhone takes it.
        var liveCount = 0
        var takesLiveConfiguration = true
        var duringLive: (() -> Void)?
        private var supervisedLive = false
        /// Whether the engine still held the restore each time the live step
        /// reached iPhone.
        var owedAtLiveStep: [Bool] = []
        weak var engine: SeedEngine?
        var operations: SeedEngine.Operations {
            .init(
                readVersion: { _ in self.version },
                readConfiguration: { _ in
                    if self.holdConfiguration { await withCheckedContinuation { self.heldConfiguration = $0 } }
                    return try PropertyListSerialization.data(
                        fromPropertyList: self.supervisedLive ? ["IsSupervised": true] : [:], format: .xml, options: 0
                    )
                },
                restore: { _, _, _ in self.restoreCount += 1 },
                restart: { _ in
                    self.restartCount += 1
                    if self.failRestart { throw DeviceError.requestFailed(request: "Restart", code: -1) }
                },
                setConfiguration: { _, _ in
                    self.liveCount += 1
                    if let engine = self.engine {
                        self.owedAtLiveStep.append(engine.restoreApplied && engine.liveConfigurationOwed)
                    }
                    if self.takesLiveConfiguration { self.supervisedLive = true }
                    self.duringLive?()
                },
                sleep: { _ in },
                cancelRestore: {}
            )
        }
    }
}
