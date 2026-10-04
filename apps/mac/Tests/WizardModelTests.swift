import Foundation
import Testing

/// Answers that come back after the run that asked for them was forgotten.
///
/// Reading Finder's folder, sizing a backup and taking one away all run on a
/// task that forgetting the run does not stop. Here each answer is held back
/// until the run has been forgotten and the same iPhone is up again, and it
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
        iosVersion: nil,
        findMyOn: false,
        backupEncrypted: true,
        cloudBackupOn: nil,
        lastCloudBackup: nil,
        dataCapacity: nil,
        dataAvailable: nil,
        pairingState: .paired
    )

    /// Where a backup of it would be. Nothing reads it: the model's disk work
    /// is held back.
    private static let folder = URL(fileURLWithPath: "/nowhere/\(udid)")

    /// The last step of a run that went through, which is the one place the
    /// backup is taken away.
    private static let done = WizardModel.Sample(
        step: .done,
        udid: udid,
        backupFolder: folder,
        restore: WizardModel.RestoreState(stage: .finished, supervisedAfterwards: true),
        profile: WizardModel.ProfileState(isConfirmed: true)
    )

    private let model: HeldModel

    init() {
        model = HeldModel(
            watcher: DeviceWatcher(sample: [Self.phone]),
            engine: BackupEngine(sample: .idle, progress: 0),
            spendStore: PendingSpendStore(storage: MemoryStorage())
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

    @Test func aRemovalThatFailedForAForgottenRunIsNotSaidOnTheNextRun() async throws {
        model.show(Self.done)
        model.deleteBackupIfTheRunIsDone()
        await settle()
        let removal = try #require(model.removals.first)
        model.startOver()
        model.show(Self.done)
        removal.resume(returning: .failed("x"))
        await settle()
        #expect(model.backupRemovalFailure == nil)
    }

    @Test func aLeftoverClearedForAForgottenRunIsNotSaidOnTheNextRun() async throws {
        model.start()
        await settle()
        let clearing = try #require(model.removals.first)
        model.startOver()
        model.start()
        clearing.resume(returning: .deleted)
        await settle()
        #expect(model.clearedLeftoverBackup == false)
    }

    @Test func aBackupSizedForAForgottenRunIsNotShownOnTheNextRun() async throws {
        let job = WizardModel.Sample(step: .job, udid: Self.udid)
        model.show(job)
        // No time taken, so no rate is written into the defaults.
        model.measureBackup(at: Self.folder, took: 0)
        await settle()
        let size = try #require(model.sizes.first)
        model.startOver()
        model.show(job)
        size.resume(returning: 63_000_000_000)
        await settle()
        #expect(model.restoreBytes == nil)
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

/// The wizard with the answers that come from the disk held back, each
/// waiting until the test hands it in.
private final class HeldModel: WizardModel {
    private(set) var looks: [CheckedContinuation<BackupSafetyNet.Finder, Never>] = []
    private(set) var removals: [CheckedContinuation<BackupRemoval, Never>] = []
    private(set) var sizes: [CheckedContinuation<UInt64?, Never>] = []

    override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder {
        await withCheckedContinuation { looks.append($0) }
    }

    override func removeBackup(of udid: String) async -> BackupRemoval {
        await withCheckedContinuation { removals.append($0) }
    }

    override func backupSize(at folder: URL) async -> UInt64? {
        await withCheckedContinuation { sizes.append($0) }
    }
}
