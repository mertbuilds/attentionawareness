import Combine
import Foundation

@MainActor
final class SeedEngine: ObservableObject {
    enum Phase: Equatable {
        case idle, preparing, restoring, restarting, done, cancelled
        case failed(String)
    }

    struct Operations {
        var readVersion: (String) async throws -> String?
        var readConfiguration: (String) async throws -> Data
        var restore: (String, URL) async throws -> Void
        var restart: (String) async throws -> Void
        var cancelRestore: () -> Void
    }

    @Published private(set) var phase: Phase = .idle
    /// A restart can be retried without resending a configuration already restored.
    @Published private(set) var restoreApplied = false
    private(set) var restoredUDID: String?
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
            restore: { udid, folder in
                try Task.checkCancellation()
                // Wait for the helper to stop before the temporary seed goes away.
                // Cancelling its AsyncStream consumer directly would stop draining
                // the pipes while the helper still has the device open.
                let transfer = Task { @MainActor in
                    try await backupEngine.restore(
                        udid: udid, from: folder, password: nil,
                        system: true, settings: false, reboot: false, skipApps: true
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
        phase = .preparing
        defer { running = false }
        do {
            try checkCancellation()
            try await gate(udid: udid, allowsFastOnAnyIOS: allowsFastOnAnyIOS)
            DeviceLog.logger.notice("fast: reading the cloud configuration")
            let current = try await operations.readConfiguration(udid)
            DeviceLog.logger.notice("fast: cloud configuration read")
            try checkCancellation()
            let edit = CloudConfigurationEdit.plan(
                current: try SeedDevice.configuration(from: current), supervised: supervised
            )
            // This root is created by this run, never selected from BackupStore.
            let root = FileManager.default.temporaryDirectory
                .appendingPathComponent("attentionawareness-seed-\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
            defer { try? FileManager.default.removeItem(at: root) }
            let folder = try SeedBackup.write(in: root, udid: udid, content: edit.plistData())
            // Re-read the phone immediately before the first write to it.
            try await gate(udid: udid, allowsFastOnAnyIOS: allowsFastOnAnyIOS)
            try checkCancellation()
            phase = .restoring
            DeviceLog.logger.notice("fast: restore started, supervised \(supervised, privacy: .public)")
            do {
                try await operations.restore(udid, folder)
            } catch BackupError.cancelled {
                DeviceLog.logger.notice("fast: restore cancelled")
                throw SeedRunError.cancelled(restoreApplied: false)
            }
            DeviceLog.logger.notice("fast: restore finished")
            restoreApplied = true
            restoredUDID = udid
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
        guard restoreApplied, restoredUDID == udid else { throw SeedRunError.noAppliedRestore }
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

    /// Forget a restore the iPhone has restarted into, so the next attempt
    /// sends the configuration again instead of only restarting.
    func forgetAppliedRestore() {
        guard !running else { return }
        restoreApplied = false
        restoredUDID = nil
    }

    func cancel() {
        guard running else { return }
        cancelRequested = true
        if phase == .restoring { operations.cancelRestore() }
    }

    private func gate(udid: String, allowsFastOnAnyIOS: Bool) async throws {
        let version = try await operations.readVersion(udid)
        try checkCancellation()
        DeviceLog.logger.notice("fast gate: iOS \(version ?? "not given", privacy: .public)")
        if let refusal = SupervisionMethod.fastRefusal(iosVersion: version) {
            guard allowsFastOnAnyIOS else { throw SeedRunError.refused(refusal) }
            DeviceLog.logger.notice("fast gate: \(String(describing: refusal), privacy: .public) let through by the debug flag")
        }
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

    private func checkCancellation() throws {
        if cancelRequested || Task.isCancelled { throw SeedRunError.cancelled(restoreApplied: restoreApplied) }
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
    case refused(SupervisionMethod.Refusal)
    case cancelled(restoreApplied: Bool)
    case alreadyRunning
    case noAppliedRestore
    case restartFailed(String)

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
                : "The seed restore was cancelled. If the restore had begun, it may have applied part of the configuration. Check iPhone before trying again."
        case .alreadyRunning: return "A seed operation is already running."
        case .noAppliedRestore: return "No successful seed restore for this iPhone is waiting for a restart."
        case .restartFailed(let reason):
            return "The configuration was restored, but iPhone could not be restarted. Restart iPhone to finish. \(reason)"
        }
    }
}
