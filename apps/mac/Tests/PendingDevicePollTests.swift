import Foundation
import Testing

/// The Connect step with an iPhone that is locked or waits for Trust. No
/// connect or disconnect is heard when the iPhone is unlocked or Trust is
/// tapped, so the wizard has to read the cable again on its own, and only
/// while something is pending.
@MainActor
struct PendingDevicePollTests {
    @Test func aLockedPhoneThatForgotTheMacIsPairedWithNoEventFromTheCable() async {
        let cable = Cable()
        cable.lockdown.forget()
        cable.lockdown.locked = true
        let model = PollingModel(watcher: DeviceWatcher(reading: { cable.read() }, passTimeout: 0.05))
        #expect(model.step == .connect)
        #expect(model.watcher.devices.first?.pairingState == .locked)
        cable.lockdown.locked = false
        #expect(await waitUntil { model.watcher.devices.first?.pairingState == .trustPending })
        #expect(cable.lockdown.dialogShown)
        cable.lockdown.accept()
        #expect(await waitUntil { model.watcher.devices.first?.pairingState == .paired })
        // Once it is paired the reading stops.
        let reads = cable.reads
        try? await Task.sleep(for: .milliseconds(150))
        #expect(cable.reads == reads)
    }

    @Test func aPairedPhoneIsNotReadAgain() async {
        let cable = Cable()
        let model = PollingModel(watcher: DeviceWatcher(reading: { cable.read() }, passTimeout: 0.05))
        #expect(model.watcher.devices.first?.pairingState == .paired)
        try? await Task.sleep(for: .milliseconds(200))
        #expect(cable.reads == 1)
    }

    private func waitUntil(_ condition: () -> Bool) async -> Bool {
        let deadline = ContinuousClock.now + .seconds(3)
        while !condition(), ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(2))
        }
        return condition()
    }

    private final class PollingModel: WizardModel {
        override var pendingPollInterval: Duration { .milliseconds(10) }

        convenience init(watcher: DeviceWatcher) {
            self.init(watcher: watcher, engine: BackupEngine(sample: .idle, progress: 0))
        }
    }

    /// One iPhone on the cable whose reads go through the real pairing step.
    private final class Cable: @unchecked Sendable {
        let lockdown = FakeLockdown()
        private let lock = NSLock()
        private var count = 0

        var reads: Int { lock.withLock { count } }

        func read() -> DeviceWatcher.Snapshot {
            lock.withLock { count += 1 }
            let pairing: PairingState
            do {
                try lockdown.open()
                pairing = .paired
            } catch {
                guard let state = (error as? DeviceError)?.pairingState else {
                    return DeviceWatcher.Snapshot(onCable: ["phone"], error: "iPhone did not answer.")
                }
                pairing = state
            }
            let phone = ConnectedDevice(
                udid: "phone", name: "Test iPhone", productType: nil, marketingName: nil,
                iosVersion: "26.0", findMyOn: nil, backupEncrypted: nil, cloudBackupOn: nil,
                lastCloudBackup: nil, dataCapacity: nil, dataAvailable: nil, pairingState: pairing
            )
            return DeviceWatcher.Snapshot(devices: [phone], onCable: ["phone"])
        }
    }
}
