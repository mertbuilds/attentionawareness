import Foundation
import Testing

/// The wait for an iPhone that restarted, which the first run on a real
/// iPhone never left: the iPhone was back on the cable and unlocked, and the
/// job only went on once the cable was pulled and put back.
///
/// Each read of the cable here is what the test says it is. No connect or
/// disconnect is ever heard, so the wait has to ask on its own.
@MainActor
struct RestartWaitTests {
    @Test(arguments: [SupervisionMethod.seed, .fullCopy])
    func aLockedPhoneHoldsTheWaitUntilItIsUnlocked(_ method: SupervisionMethod) async {
        let bus = Bus(.back())
        let model = makeModel(bus)
        model.onSent = { bus.show(.back(.locked)) }
        start(model, method)
        #expect(await waitUntil { model.restartHint == "Unlock iPhone." })
        #expect(model.job == .restarting)
        // The read from before the restart said the iPhone was here, and it
        // is not what ends the wait.
        await pause()
        #expect(model.job == .restarting)
        #expect(!model.events.contains("confirm"))
        bus.show(.back(supervised: true))
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.sends == 1)
    }

    @Test func aPhoneThatAsksForTrustSaysSoAndThenGoesOn() async {
        let bus = Bus(.back())
        let model = makeModel(bus)
        model.onSent = { bus.show(.back(.trustPending)) }
        start(model, .seed)
        #expect(await waitUntil { model.restartHint == "Tap Trust on iPhone." })
        #expect(model.job == .restarting)
        bus.show(.back(supervised: true))
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
    }

    /// The run on the real iPhone: it stays on the cable across the restart,
    /// the first read never comes back, the next ones fail, and nothing is
    /// heard from the cable when the iPhone starts to answer.
    @Test func aPhoneThatStaysOnTheCableIsFoundWithoutAnyConnectEvent() async {
        let bus = Bus(.back())
        let model = makeModel(bus)
        model.onSent = {
            bus.holdNextRead()
            bus.show(.unread)
        }
        start(model, .seed)
        #expect(await waitUntil { bus.reads >= 4 })
        #expect(model.job == .restarting)
        #expect(model.restartHint == "When it is back, unlock it with your passcode. If it asks, tap Trust.")
        bus.show(.back(supervised: true))
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        bus.release()
    }

    @Test(arguments: [SupervisionMethod.seed, .fullCopy])
    func aPhoneThatNeverComesBackEndsInCheckAgain(_ method: SupervisionMethod) async {
        let bus = Bus(.back())
        let model = makeModel(bus)
        model.onSent = { bus.show(.away) }
        start(model, method)
        #expect(await waitUntil { model.job == .phoneGone })
        #expect(JobPhase.phoneGone.headline == "iPhone Didn't Reconnect")
        // Check Again reads for a while and comes back to the same screen.
        model.checkPhoneAgain()
        #expect(model.job == .restarting)
        #expect(await waitUntil { model.job == .phoneGone })
        #expect(model.sends == 1)
    }

    @Test(arguments: [SupervisionMethod.seed, .fullCopy])
    func checkAgainGoesOnWithoutSendingOrRestartingAgain(_ method: SupervisionMethod) async {
        let bus = Bus(.back())
        let model = makeModel(bus)
        model.onSent = { bus.show(.away) }
        start(model, method)
        #expect(await waitUntil { model.job == .phoneGone })
        bus.show(.back(supervised: true))
        model.checkPhoneAgain()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(model.sends == 1)
        #expect(model.events.filter { $0 == "confirm" }.count == 1)
    }

    @Test func checkAgainNeverReachesTheSeedEngine() async {
        var restores = 0
        var restarts = 0
        let engine = SeedEngine(operations: .init(
            readVersion: { _ in "26.0" },
            readConfiguration: { _ in try PropertyListSerialization.data(fromPropertyList: [:], format: .xml, options: 0) },
            restore: { _, _ in restores += 1 },
            restart: { _ in restarts += 1 },
            cancelRestore: {}
        ))
        let bus = Bus(.back())
        let model = makeModel(bus, seedEngine: engine)
        model.useSeedEngine = true
        model.onSent = { bus.show(.away) }
        start(model, .seed)
        #expect(await waitUntil { model.job == .phoneGone })
        bus.show(.back(supervised: true))
        model.checkPhoneAgain()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        #expect(restores == 1)
        #expect(restarts == 1)
    }

    @Test func checkAgainDoesNothingAnywhereElse() {
        let model = makeModel(Bus(.back()))
        model.show(WizardModel.Sample(step: .job, udid: "phone", job: .checkOnIPhone(reportedSupervised: true)))
        model.checkPhoneAgain()
        #expect(model.job == .checkOnIPhone(reportedSupervised: true))
    }

    /// A read that never returns holds up nothing: the next one starts beside
    /// it once the pass is given up.
    @Test func aReadThatHangsDoesNotHoldTheNextOne() async {
        let bus = Bus(.away)
        let watcher = DeviceWatcher(reading: { bus.read() }, passTimeout: 0.05)
        bus.holdNextRead()
        watcher.reload()
        bus.show(.back(supervised: true))
        #expect(await waitUntil {
            watcher.reload()
            return watcher.devices.first?.pairingState == .paired
        })
        bus.release()
    }

    // MARK: - The pieces

    private func makeModel(_ bus: Bus, seedEngine: SeedEngine? = nil) -> WaitingModel {
        WaitingModel(
            watcher: DeviceWatcher(reading: { bus.read() }, passTimeout: 0.05),
            engine: BackupEngine(sample: .idle, progress: 0),
            seedEngine: seedEngine
        )
    }

    private func start(_ model: WaitingModel, _ method: SupervisionMethod) {
        model.show(WizardModel.Sample(
            step: .ready, supervisionMethod: method, backupConfirmed: true, udid: "phone"
        ))
        model.password = "pw"
        model.startJob()
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

    /// The wizard with everything that would reach an iPhone replaced, and
    /// the wait for the iPhone left as it ships.
    private final class WaitingModel: WizardModel {
        var events: [String] = []
        var sends = 0
        var onSent: () -> Void = {}
        var useSeedEngine = false

        override func rebootTimeout(for method: SupervisionMethod) -> TimeInterval { 0.4 }
        override var restartPollInterval: Duration { .milliseconds(10) }
        override var checkAgainTimeout: TimeInterval { 0.2 }
        override var diskSpace: DiskSpace { DiskSpace(needed: 100, free: 1_000, assumed: false) }
        override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder { .nothingHere }
        override func removeBackup(of udid: String) async -> BackupRemoval { .nothingThere }
        override func readDeviceIOSVersion(udid: String) async throws -> String? { "26.0" }
        override func copyTheIPhone() async throws {}
        override func markTheCopy() async throws {}
        override func sendTheCopyBack() async throws {
            sends += 1
            onSent()
        }
        override func sendSeedConfiguration(restartingOnly: Bool) async throws {
            sends += 1
            if useSeedEngine { try await super.sendSeedConfiguration(restartingOnly: restartingOnly) }
            onSent()
        }
        override func confirmWhatTheIPhoneIs() async -> Bool {
            events.append("confirm")
            return isSupervised == true
        }
    }

    /// What each read of the cable finds, set by the test from the main
    /// actor and read from the watcher's queue.
    private final class Bus: @unchecked Sendable {
        private let lock = NSLock()
        private var snapshot: DeviceWatcher.Snapshot
        private var hold: DispatchSemaphore?
        private var held: [DispatchSemaphore] = []
        private var count = 0

        init(_ snapshot: DeviceWatcher.Snapshot) {
            self.snapshot = snapshot
        }

        var reads: Int { lock.withLock { count } }

        func show(_ snapshot: DeviceWatcher.Snapshot) {
            lock.withLock { self.snapshot = snapshot }
        }

        /// The next read does not come back until `release()`.
        func holdNextRead() {
            lock.withLock { hold = DispatchSemaphore(value: 0) }
        }

        func release() {
            lock.withLock { held }.forEach { $0.signal() }
        }

        func read() -> DeviceWatcher.Snapshot {
            let hold = lock.withLock {
                count += 1
                let hold = self.hold
                self.hold = nil
                if let hold { held.append(hold) }
                return hold
            }
            hold?.wait()
            return lock.withLock { snapshot }
        }
    }
}

private extension DeviceWatcher.Snapshot {
    /// On the cable and answering, the way `pairing` says.
    static func back(_ pairing: PairingState = .paired, supervised: Bool = false) -> Self {
        let phone = ConnectedDevice(
            udid: "phone", name: "Test iPhone", productType: nil, marketingName: nil,
            iosVersion: "26.0", findMyOn: pairing == .paired ? false : nil, backupEncrypted: true,
            cloudBackupOn: nil, lastCloudBackup: nil, dataCapacity: nil, dataAvailable: nil,
            pairingState: pairing
        )
        return Self(
            devices: [phone],
            onCable: ["phone"],
            cloudConfigurations: pairing == .paired
                ? ["phone": CloudConfiguration(isSupervised: supervised, organizationName: nil, raw: "")]
                : [:]
        )
    }

    /// On the cable and not answering a read.
    static let unread = Self(onCable: ["phone"], error: "iPhone did not answer.")
    /// Off the cable.
    static let away = Self(onCable: [])
}
