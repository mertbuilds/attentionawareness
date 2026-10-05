import Combine
import Foundation

@MainActor
final class SeedEngine: ObservableObject {
    enum Phase: Equatable {
        case idle, preparing, restoring, restarting, done, cancelled
        /// The restore restarted iPhone itself. `applyLiveConfiguration` is owed.
        case awaitingLiveConfiguration
        case applyingLiveConfiguration
        case failed(String)
    }

    struct Operations {
        var readVersion: (String) async throws -> String?
        var readConfiguration: (String) async throws -> Data
        /// The last value picks the restore options. In the live mode the
        /// restore restarts iPhone itself.
        var restore: (String, URL, SeedMode) async throws -> Void
        var restart: (String) async throws -> Void
        var setConfiguration: (String, Data) async throws -> Void
        var sleep: (Duration) async throws -> Void
        var cancelRestore: () -> Void
    }

    /// How long the live step keeps trying. Right after the restart MCInstall
    /// can refuse or fail for some seconds.
    static let liveConfigurationRetryInterval: Duration = .seconds(2)
    static let liveConfigurationTimeout: TimeInterval = 90
    static let liveConfigurationAttemptLimit = 45

    @Published private(set) var phase: Phase = .idle
    /// A restart can be retried without resending a configuration already restored.
    @Published private(set) var restoreApplied = false
    private(set) var restoredUDID: String?
    /// True after a restore on iOS 27 or later until the live step went
    /// through. A restart is no recovery then: retry `applyLiveConfiguration`.
    @Published private(set) var liveConfigurationOwed = false
    private let operations: Operations
    /// True from the start of an operation until it has returned, which can
    /// be a while after `cancel()` when a device read is still out.
    private(set) var running = false
    private var cancelRequested = false

    init(operations: Operations) {
        self.operations = operations
    }

    convenience init(backupEngine: BackupEngine) {
        self.init(operations: Operations(
            readVersion: { udid in
                guard backupEngine.canRunHelper else { throw BackupError.failed("This engine runs nothing.") }
                return try await Task.detached { try SeedDevice.iosVersion(udid: udid) }.value
            },
            readConfiguration: { udid in
                try await Task.detached { try SeedDevice.cloudConfiguration(udid: udid) }.value
            },
            restore: { udid, folder, mode in
                try Task.checkCancellation()
                // On iOS 27.2 a restore with system files erased iPhone in our
                // device test on 2026-10-05. The live mode sends the option
                // set confirmed to keep the data on that iPhone with another
                // tool: no system files, remove, and the restore restarts
                // iPhone. With this app that is not yet confirmed.
                let live = mode == .live
                // Wait for the helper to stop before the temporary seed goes away.
                // Cancelling its AsyncStream consumer directly would stop draining
                // the pipes while the helper still has the device open.
                let transfer = Task { @MainActor in
                    try await backupEngine.restore(
                        udid: udid, from: folder,
                        system: !live, settings: false, reboot: live, skipApps: true, remove: live
                    )
                }
                do {
                    try await withTaskCancellationHandler {
                        try await transfer.value
                    } onCancel: {
                        Task { @MainActor in backupEngine.cancel(escalateIfRequested: false) }
                    }
                } catch {
                    for line in backupEngine.log.suffix(10) {
                        let said = line.replacingOccurrences(of: udid, with: "<udid>")
                        DeviceLog.logger.notice("fast: helper said: \(said, privacy: .public)")
                    }
                    throw error
                }
            },
            restart: { udid in
                try await Task.detached { try SeedDevice.restart(udid: udid) }.value
            },
            setConfiguration: { udid, content in
                try await Task.detached { try SeedDevice.setCloudConfiguration(udid: udid, content: content) }.value
            },
            sleep: { try await Task.sleep(for: $0) },
            cancelRestore: { backupEngine.cancel() }
        ))
    }

    /// `allowsFastOnAnyIOS` lets the gate through on every version; only the
    /// debug `--debug-fast-ios27` flag sets it (`DebugFastIOS27`).
    func supervise(udid: String, supervised: Bool = true, allowsFastOnAnyIOS: Bool = false) async throws {
        guard !running else { throw SeedRunError.alreadyRunning }
        running = true
        cancelRequested = false
        restoreApplied = false
        restoredUDID = nil
        liveConfigurationOwed = false
        phase = .preparing
        defer { running = false }
        do {
            try checkCancellation()
            // iOS 27 takes the configuration only live, after a restore that
            // restarts iPhone itself. The mode also decides what the seed holds.
            let mode = SeedMode(iosVersion: try await gate(udid: udid, allowsFastOnAnyIOS: allowsFastOnAnyIOS))
            DeviceLog.logger.notice("fast: reading the cloud configuration")
            let current = try await operations.readConfiguration(udid)
            DeviceLog.logger.notice("fast: cloud configuration read")
            try checkCancellation()
            let edit = CloudConfigurationEdit.plan(
                current: try SeedDevice.configuration(from: current), supervised: supervised
            )
            // This root is created by this run and removed at its end.
            let root = FileManager.default.temporaryDirectory
                .appendingPathComponent("attentionawareness-seed-\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
            defer { try? FileManager.default.removeItem(at: root) }
            let folder = try SeedBackup.write(in: root, udid: udid, content: edit.plistData(), mode: mode)
            // Re-read the phone immediately before the first write to it. A
            // seed made for the other mode is never sent.
            let version = try await gate(udid: udid, allowsFastOnAnyIOS: allowsFastOnAnyIOS)
            guard SeedMode(iosVersion: version) == mode else { throw SeedRunError.iosVersionChanged }
            let live = mode == .live
            try checkCancellation()
            phase = .restoring
            DeviceLog.logger.notice("fast: restore started, supervised \(supervised, privacy: .public), options: \(mode.restoreOptionsLogText, privacy: .public)")
            do {
                try await operations.restore(udid, folder, mode)
            } catch BackupError.cancelled {
                DeviceLog.logger.notice("fast: restore cancelled")
                throw SeedRunError.cancelled(restoreApplied: false)
            }
            DeviceLog.logger.notice("fast: restore finished")
            restoreApplied = true
            restoredUDID = udid
            if live {
                // The restore has restarted iPhone already, and that cannot
                // be withdrawn, so Cancel has nothing left to stop here.
                liveConfigurationOwed = true
                DeviceLog.logger.notice("fast: iPhone restarts from the restore, live configuration owed")
                phase = .awaitingLiveConfiguration
                return
            }
            try checkCancellation()
            try await performRestart(udid: udid)
        } catch {
            DeviceLog.logger.notice("fast: stopped: \(Self.logText(error, udid: udid), privacy: .public)")
            failed(error)
            throw error
        }
    }

    /// Retry only the restart after a successful restore, on the same phone.
    func restart(udid: String, allowsFastOnAnyIOS: Bool = false) async throws {
        guard !running else { throw SeedRunError.alreadyRunning }
        guard restoreApplied, restoredUDID == udid, !liveConfigurationOwed else {
            throw SeedRunError.noAppliedRestore
        }
        running = true
        cancelRequested = false
        defer { running = false }
        do {
            try checkCancellation()
            try await gate(udid: udid, allowsFastOnAnyIOS: allowsFastOnAnyIOS)
            try await performRestart(udid: udid)
        } catch {
            DeviceLog.logger.notice("fast: restart retry stopped: \(Self.logText(error, udid: udid), privacy: .public)")
            failed(error)
            throw error
        }
    }

    /// The step a restore on iOS 27 or later still owes: send the
    /// configuration live and read it back. iPhone has to be back from the
    /// restart, paired again and still on the Restore Completed screen. It can
    /// be called again alone after it failed.
    func applyLiveConfiguration(udid: String, supervised: Bool = true) async throws {
        guard !running else { throw SeedRunError.alreadyRunning }
        guard restoreApplied, restoredUDID == udid, liveConfigurationOwed else {
            throw SeedRunError.noAppliedRestore
        }
        running = true
        cancelRequested = false
        phase = .applyingLiveConfiguration
        defer { running = false }
        do {
            let deadline = Date().addingTimeInterval(Self.liveConfigurationTimeout)
            var lastReason: String?
            for attempt in 1...Self.liveConfigurationAttemptLimit {
                try checkLiveCancellation()
                do {
                    try await sendLiveConfiguration(udid: udid, supervised: supervised)
                    // A Cancel that landed while the set was out leaves the
                    // step owed, so the next run sends the setting again and
                    // never a second restore.
                    try checkLiveCancellation()
                    liveConfigurationOwed = false
                    phase = .done
                    return
                } catch {
                    try checkLiveCancellation()
                    DeviceLog.logger.notice("fast: live configuration attempt \(attempt, privacy: .public) failed: \(Self.logText(error, udid: udid), privacy: .public)")
                    lastReason = Self.reasonText(error, udid: udid)
                    // A request the app could not build fails the same way
                    // every time.
                    if case DeviceError.requestNotBuilt = error { break }
                }
                guard attempt < Self.liveConfigurationAttemptLimit, Date() < deadline else { break }
                try await operations.sleep(Self.liveConfigurationRetryInterval)
            }
            throw SeedRunError.liveConfigurationNotTaken(lastReason: lastReason)
        } catch {
            DeviceLog.logger.notice("fast: live configuration stopped: \(Self.logText(error, udid: udid), privacy: .public)")
            failed(error)
            throw error
        }
    }

    /// Forget a restore the iPhone has restarted into, so the next attempt
    /// sends the configuration again instead of only restarting.
    func forgetAppliedRestore() {
        guard !running else { return }
        restoreApplied = false
        restoredUDID = nil
        liveConfigurationOwed = false
    }

    func cancel() {
        guard running else { return }
        cancelRequested = true
        if phase == .restoring { operations.cancelRestore() }
    }

    /// One try of the live step: read, set, read back.
    private func sendLiveConfiguration(udid: String, supervised: Bool) async throws {
        DeviceLog.logger.notice("fast: live configuration: reading the cloud configuration")
        let current = try await operations.readConfiguration(udid)
        try checkLiveCancellation()
        let edit = CloudConfigurationEdit.plan(
            current: try SeedDevice.configuration(from: current), supervised: supervised
        )
        DeviceLog.logger.notice("fast: live configuration: sending, supervised \(supervised, privacy: .public)")
        try await operations.setConfiguration(udid, try edit.plistData())
        DeviceLog.logger.notice("fast: live configuration: acknowledged, reading it back")
        let after = try SeedDevice.configuration(from: try await operations.readConfiguration(udid))
        let reads = CloudConfigurationEdit.boolean(after["IsSupervised"]) ?? false
        guard reads == supervised else {
            throw SeedRunError.liveConfigurationNotTaken(
                lastReason: "iPhone acknowledged the setting, but it still reads as \(reads ? "supervised" : "not supervised")."
            )
        }
        DeviceLog.logger.notice("fast: live configuration: iPhone reads supervised \(reads, privacy: .public)")
    }

    /// The version the iPhone reports, for a run the gate lets through.
    @discardableResult
    private func gate(udid: String, allowsFastOnAnyIOS: Bool) async throws -> String? {
        let version = try await operations.readVersion(udid)
        try checkCancellation()
        DeviceLog.logger.notice("fast gate: iOS \(version ?? "not given", privacy: .public)")
        if let refusal = IOSSupport.refusal(iosVersion: version) {
            guard allowsFastOnAnyIOS else { throw SeedRunError.refused(refusal) }
            DeviceLog.logger.notice("fast gate: \(String(describing: refusal), privacy: .public) let through by the debug flag")
        }
        return version
    }

    private func performRestart(udid: String) async throws {
        try checkCancellation()
        phase = .restarting
        DeviceLog.logger.notice("fast: restart requested")
        do {
            try await operations.restart(udid)
        } catch {
            DeviceLog.logger.notice("fast: restart failed: \(Self.logText(error, udid: udid), privacy: .public)")
            throw SeedRunError.restartFailed(error.localizedDescription)
        }
        DeviceLog.logger.notice("fast: restart acknowledged")
        // Acknowledged restart is complete even if Cancel was pressed while
        // the request was in flight: the restart can no longer be withdrawn.
        phase = .done
    }

    /// An error as the log carries it, with the udid taken out of any text.
    private static func logText(_ error: Error, udid: String) -> String {
        if error is DeviceError { return DeviceLog.text(error) }
        return error.localizedDescription.replacingOccurrences(of: udid, with: "<udid>")
    }

    /// What an attempt of the live step failed with, in the layer's own words
    /// for the "i" of the failure, with the udid taken out.
    private static func reasonText(_ error: Error, udid: String) -> String {
        if case SeedRunError.liveConfigurationNotTaken(let reason?) = error { return reason }
        return error.localizedDescription.replacingOccurrences(of: udid, with: "<udid>")
    }

    private func checkCancellation() throws {
        if cancelRequested || Task.isCancelled { throw SeedRunError.cancelled(restoreApplied: restoreApplied) }
    }

    /// A stop in the live step is not a restart that was cancelled, so it
    /// does not carry that error's words.
    private func checkLiveCancellation() throws {
        if cancelRequested || Task.isCancelled { throw CancellationError() }
    }

    private func failed(_ error: Error) {
        if error is CancellationError || error as? BackupError == .cancelled
            || (error as? SeedRunError)?.isCancellation == true {
            phase = .cancelled
        } else {
            phase = .failed(error.localizedDescription)
        }
    }
}

enum SeedRunError: LocalizedError, Equatable {
    case refused(IOSSupport.Refusal)
    case cancelled(restoreApplied: Bool)
    case alreadyRunning
    case noAppliedRestore
    case restartFailed(String)
    /// `lastReason` is what the last attempt failed with, for the "i".
    case liveConfigurationNotTaken(lastReason: String?)
    /// The two version reads of one run put it in different modes.
    case iosVersionChanged

    var isCancellation: Bool {
        if case .cancelled = self { return true }
        return false
    }

    var errorDescription: String? {
        switch self {
        case .refused(let refusal):
            return "\(refusal.message) Nothing was sent to iPhone."
        case .cancelled(let applied):
            return applied
                ? "The configuration was restored, but the restart was cancelled. Restart iPhone to finish."
                : "The restore was cancelled. If the restore had begun, it may have applied part of the configuration. Check iPhone before trying again."
        case .alreadyRunning: return "A seed operation is already running."
        case .noAppliedRestore: return "No successful seed restore for this iPhone is waiting for a restart."
        case .restartFailed(let reason):
            return "The configuration was restored, but iPhone could not be restarted. Restart iPhone to finish. \(reason)"
        case .iosVersionChanged:
            return "The iOS version iPhone gave changed during the run. Nothing was sent to iPhone. Try again."
        case .liveConfigurationNotTaken:
            return "iPhone restarted, but it did not take the supervision setting. Keep iPhone on the Restore Completed screen, unlocked and on the cable, and try again."
        }
    }
}
