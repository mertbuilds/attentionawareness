import Combine
import Foundation
import Testing

/// The debug run that takes supervision off (`--debug-unsupervise`), and the
/// supervising run beside it, which must stay as it was.
///
/// Each read of the cable is what the test says it is, and every piece of the
/// job that would reach an iPhone is replaced.
@MainActor
struct UnsuperviseRunTests {
    @Test func anIPhoneThatIsSupervisedAlreadyCanStartARunThatTakesItOff() {
        let cable = Cable(supervised: true)
        let supervising = makeModel(cable, supervises: true)
        #expect(supervising.offersManageRestrictions)

        let model = makeModel(cable, supervises: false)
        #expect(!model.offersManageRestrictions)
        model.start()
        #expect(model.step == .ready)
    }

    @Test func theRunEndsOnceIPhoneSaysItIsNoLongerSupervised() async {
        let cable = Cable(supervised: true)
        let sent = Sent()
        let model = makeModel(cable, supervises: false, sent: sent)
        let steps = Steps()
        let watch = model.$step.sink { steps.seen.append($0) }
        defer { watch.cancel() }
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .confirming })
        // Still supervised after several reads: that is not the end.
        await pause()
        #expect(model.job == .confirming)
        cable.supervised = false
        #expect(await waitUntil { model.step == .done })
        #expect(!steps.seen.contains(.restrictions))
        #expect(model.isSupervised == false)
        #expect(sent.events.isEmpty)
        // Nothing on the last screen sends the count either.
        model.advance()
        #expect(sent.events.isEmpty)
    }

    @Test func aSupervisingRunStillWaitsForSupervisedAndAsksThePerson() async {
        let cable = Cable(supervised: false)
        let sent = Sent()
        let model = makeModel(cable, supervises: true, sent: sent)
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .confirming })
        await pause()
        #expect(model.job == .confirming)
        cable.supervised = true
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        model.advance()
        #expect(model.step == .restrictions)
        #expect(sent.events.count == 1)
    }

    @Test func anIPhoneThatStillSaysItIsSupervisedFailsTheRun() async {
        let cable = Cable(supervised: true)
        let sent = Sent()
        let model = makeModel(cable, supervises: false, sent: sent)
        model.confirmAnswer = false
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .failed(.stillSupervised) })
        #expect(model.step == .job)
        #expect(sent.events.isEmpty)
    }

    @Test(arguments: [true, false])
    func theFastMethodSendsTheFlagTheRunAsksFor(_ supervises: Bool) async throws {
        let sent = SentSeed()
        let engine = SeedEngine(operations: .init(
            readVersion: { _ in "26.0" },
            readConfiguration: { _ in
                try PropertyListSerialization.data(
                    fromPropertyList: ["IsSupervised": !supervises, "OrganizationMagic": "magic"],
                    format: .xml,
                    options: 0
                )
            },
            restore: { _, folder, _ in
                let data = try Data(contentsOf: folder.appendingPathComponent(SeedBackup.contentFileName))
                sent.content = try SeedDevice.configuration(from: data)
            },
            restart: { _ in },
            setConfiguration: { _, _ in },
            sleep: { _ in },
            cancelRestore: {}
        ))
        let model = makeModel(Cable(supervised: !supervises), supervises: supervises, seedEngine: engine)
        defer { model.stopJob() }
        ready(model)
        model.startJob()
        #expect(await waitUntil { sent.content != nil })
        let content = try #require(sent.content)
        #expect(CloudConfigurationEdit.boolean(content["IsSupervised"]) == supervises)
        #expect((content["OrganizationMagic"] != nil) == supervises)
    }

    /// iOS 27 ignores the restored configuration, so the run that takes
    /// supervision off sends it live as well, with the same flag.
    @Test func aFastRunThatTakesSupervisionOffIOS27SendsTheSettingLive() async throws {
        let sent = SentSeed()
        let engine = SeedEngine(operations: .init(
            readVersion: { _ in "27.0" },
            readConfiguration: { _ in
                // iPhone keeps what it had until the configuration sent live.
                try PropertyListSerialization.data(
                    fromPropertyList: ["IsSupervised": sent.live.isEmpty], format: .xml, options: 0
                )
            },
            restore: { _, folder, _ in
                let data = try Data(contentsOf: folder.appendingPathComponent(SeedBackup.contentFileName))
                sent.content = try SeedDevice.configuration(from: data)
            },
            restart: { _ in sent.restarts += 1 },
            setConfiguration: { _, data in sent.live.append(try SeedDevice.configuration(from: data)) },
            sleep: { _ in },
            cancelRestore: {}
        ))
        let cable = Cable(supervised: true, iosVersion: "27.0")
        let model = makeModel(cable, supervises: false, seedEngine: engine)
        model.iosVersion = "27.0"
        defer { model.stopJob() }
        ready(model)
        model.startJob()
        #expect(await waitUntil { sent.content != nil })
        #expect(CloudConfigurationEdit.boolean(sent.content?["IsSupervised"]) == false)
        #expect(await waitUntil { model.job == .confirming })
        #expect(sent.live.count == 1)
        #expect(CloudConfigurationEdit.boolean(sent.live.first?["IsSupervised"]) == false)
        #expect(sent.restarts == 0)
        #expect(model.liveConfigurationApplied)
        cable.supervised = false
        #expect(await waitUntil { model.step == .done })
    }

    // MARK: - The pieces

    private func makeModel(
        _ cable: Cable,
        supervises: Bool,
        sent: Sent = Sent(),
        seedEngine: SeedEngine? = nil
    ) -> RunModel {
        let model = RunModel(
            watcher: DeviceWatcher(reading: { cable.read() }, passTimeout: 0.05),
            engine: BackupEngine(sample: .idle, progress: 0),
            seedEngine: seedEngine,
            finishedEvent: { sent.events.append($0) },
            supervises: supervises
        )
        model.useSeedEngine = seedEngine != nil
        return model
    }

    private func ready(_ model: WizardModel) {
        model.show(WizardModel.Sample(step: .ready, backupConfirmed: true, udid: "phone"))
    }

    private func pause() async {
        try? await Task.sleep(for: .milliseconds(120))
    }

    private func waitUntil(_ condition: () -> Bool) async -> Bool {
        let deadline = ContinuousClock.now + .seconds(3)
        while !condition(), ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(2))
        }
        return condition()
    }

    private final class Sent {
        var events: [SupervisionFinishedEvent] = []
    }

    private final class SentSeed {
        var content: [String: Any]?
        /// Every configuration sent live, which only a run on iOS 27 sends.
        var live: [[String: Any]] = []
        var restarts = 0
    }

    private final class Steps {
        var seen: [WizardStep] = []
    }

    /// The wizard with every piece of the job that reaches an iPhone
    /// replaced. The ask after the restart is the one that ships, read
    /// quickly, unless a test answers it.
    private final class RunModel: WizardModel {
        var useSeedEngine = false
        var confirmAnswer: Bool?
        var iosVersion: String? = "26.0"

        override var confirmInterval: Duration { .milliseconds(10) }
        override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder { .nothingHere }
        override func readDeviceIOSVersion(udid: String) async throws -> String? { iosVersion }
        override func sendSeedConfiguration(restartingOnly: Bool) async throws {
            if useSeedEngine { try await super.sendSeedConfiguration(restartingOnly: restartingOnly) }
        }
        override func waitForPhone(until deadline: Date?) async -> Bool { true }
        override func confirmWhatTheIPhoneIs() async -> Bool {
            if let confirmAnswer { return confirmAnswer }
            return await super.confirmWhatTheIPhoneIs()
        }
    }

    /// One paired iPhone on the cable, supervised or not as the test says.
    private final class Cable: @unchecked Sendable {
        private let lock = NSLock()
        private var flag: Bool
        private let iosVersion: String?

        init(supervised: Bool, iosVersion: String? = "26.0") {
            flag = supervised
            self.iosVersion = iosVersion
        }

        var supervised: Bool {
            get { lock.withLock { flag } }
            set { lock.withLock { flag = newValue } }
        }

        func read() -> DeviceWatcher.Snapshot {
            let phone = ConnectedDevice(
                udid: "phone", name: "Test iPhone", productType: nil, marketingName: nil,
                iosVersion: iosVersion, findMyOn: false, backupEncrypted: true,
                cloudBackupOn: nil, lastCloudBackup: nil, dataCapacity: nil, dataAvailable: nil,
                pairingState: .paired
            )
            return DeviceWatcher.Snapshot(
                devices: [phone],
                onCable: ["phone"],
                cloudConfigurations: ["phone": CloudConfiguration(isSupervised: supervised, organizationName: nil, raw: "")]
            )
        }
    }
}
