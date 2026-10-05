import Foundation
import Testing

/// Answers that come back after the run that asked for them was forgotten.
///
/// Reading Finder's folder runs on a task that forgetting the run does not
/// stop. Here the answer is held back until the run has been forgotten, and it
/// must not land on the run that is on screen by then.
@MainActor
struct WizardModelTests {
    private static let udid = "00008140-000000000000001A"

    /// A trusted iPhone that is not there, which is all a run needs to pick.
    private static let phone = ConnectedDevice(
        udid: udid,
        name: "iPhone",
        productType: nil,
        marketingName: nil,
        iosVersion: "26.6.2",
        findMyOn: false,
        backupEncrypted: true,
        cloudBackupOn: nil,
        lastCloudBackup: nil,
        dataCapacity: nil,
        dataAvailable: nil,
        pairingState: .paired
    )

    private let model: HeldModel

    init() {
        model = HeldModel(
            watcher: DeviceWatcher(sample: [Self.phone]),
            engine: BackupEngine(sample: .idle, progress: 0)
        )
    }

    @Test func aLookAtFindersFolderLandsNowhereOnceItsRunIsForgotten() async throws {
        model.lookForFinderBackup()
        await settle()
        let look = try #require(model.looks.first)
        model.startOver()
        look.resume(returning: .made(Date()))
        await settle()
        #expect(model.finderBackup == .notLooked)
    }

    /// Let whatever the model has queued on the main actor run up to the next
    /// answer it waits for. Each yield puts the test behind every job queued
    /// before it, so a few are more than the one hop each answer makes.
    private func settle() async {
        for _ in 0..<5 {
            await Task.yield()
        }
    }
}

/// The wizard with the answer that comes from the disk held back, waiting
/// until the test hands it in.
private final class HeldModel: WizardModel {
    private(set) var looks: [CheckedContinuation<BackupSafetyNet.Finder, Never>] = []

    override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder {
        await withCheckedContinuation { looks.append($0) }
    }
}
