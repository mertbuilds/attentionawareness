import Foundation
import Testing

@MainActor
struct SeedEngineTests {
    @Test(arguments: [nil, "", "invalid", "26.x", "27.0", "30.1"] as [String?])
    func refusedVersionNeverReadsPolicyOrRestores(_ version: String?) async throws {
        let phone = Phone(version: version)
        let engine = SeedEngine(operations: phone.operations)
        await #expect(throws: SeedRunError.self) { try await engine.supervise(udid: "phone") }
        #expect(phone.events == ["version"])
        #expect(!engine.restoreApplied)
    }

    @Test(arguments: ["27.0", "27.1", nil, "26.0"] as [String?])
    func theDebugValueLetsBothGateReadsThrough(_ version: String?) async throws {
        let phone = Phone(version: version)
        let engine = SeedEngine(operations: phone.operations)
        try await engine.supervise(udid: "phone", allowsFastOnAnyIOS: true)
        #expect(phone.events == ["version", "configuration", "version", "restore", "restart"])
        #expect(engine.phase == .done)
    }

    @Test func theDebugValueSendsUnsupervisedOnIOS27() async throws {
        let phone = Phone(version: "27.0")
        phone.policy = ["IsSupervised": true]
        let engine = SeedEngine(operations: phone.operations)
        try await engine.supervise(udid: "phone", supervised: false, allowsFastOnAnyIOS: true)
        #expect(phone.content?["IsSupervised"] as? Bool == false)
        #expect(engine.phase == .done)
    }

    @Test func aRestartRetryOnIOS27IsHeldToTheValueItIsGiven() async throws {
        let phone = Phone(version: "27.0")
        phone.restartError = true
        let engine = SeedEngine(operations: phone.operations)
        await #expect(throws: SeedRunError.self) { try await engine.supervise(udid: "phone", allowsFastOnAnyIOS: true) }
        #expect(engine.restoreApplied)
        phone.restartError = false
        await #expect(throws: SeedRunError.refused(.iosNotSupportedYet)) { try await engine.restart(udid: "phone") }
        try await engine.restart(udid: "phone", allowsFastOnAnyIOS: true)
        #expect(phone.events.filter { $0 == "restart" }.count == 2)
        #expect(engine.phase == .done)
    }

    @Test func versionIsRecheckedImmediatelyBeforeRestore() async throws {
        let phone = Phone(version: "26.1")
        phone.versions = ["26.1", "27.0"]
        let engine = SeedEngine(operations: phone.operations)
        await #expect(throws: SeedRunError.refused(.iosNotSupportedYet)) {
            try await engine.supervise(udid: "phone")
        }
        #expect(phone.events == ["version", "configuration", "version"])
        #expect(!engine.restoreApplied)
    }

    @Test func successRestoresOnlyAnIsolatedSeedPreservesPolicyAndRestarts() async throws {
        let phone = Phone(version: "26.0")
        phone.policy = ["OrganizationName": "Existing", "CustomPolicy": ["Keep": true]]
        let engine = SeedEngine(operations: phone.operations)
        try await engine.supervise(udid: "phone")
        #expect(phone.events == ["version", "configuration", "version", "restore", "restart"])
        #expect(phone.content?["OrganizationName"] as? String == "Existing")
        #expect((phone.content?["CustomPolicy"] as? [String: Bool])?["Keep"] == true)
        #expect(phone.content?["IsSupervised"] as? Bool == true)
        #expect(phone.seedFileNames == Set([
            SeedBackup.contentFileName, SeedBackup.setupFileName, Mbdb.fileName, "Status.plist", "Manifest.plist", "Info.plist"
        ]))
        let folder = try #require(phone.folder)
        #expect(folder.lastPathComponent == "phone")
        #expect(folder.deletingLastPathComponent().lastPathComponent.hasPrefix("attentionawareness-seed-"))
        #expect(!FileManager.default.fileExists(atPath: folder.deletingLastPathComponent().path))
        #expect(engine.restoreApplied)
        #expect(engine.phase == .done)
    }

    @Test func configurationFailureNeverSendsASeed() async throws {
        let phone = Phone(version: "26.0")
        phone.configurationError = true
        let engine = SeedEngine(operations: phone.operations)
        await #expect(throws: DeviceError.self) { try await engine.supervise(udid: "phone") }
        #expect(phone.events == ["version", "configuration"])
    }

    @Test func restoreFailureDoesNotRestartAndRemovesItsTempFolder() async throws {
        let phone = Phone(version: "26.0")
        phone.restoreError = .failed("Test restore failed")
        let engine = SeedEngine(operations: phone.operations)
        await #expect(throws: BackupError.self) { try await engine.supervise(udid: "phone") }
        #expect(!phone.events.contains("restart"))
        #expect(!engine.restoreApplied)
        let folder = try #require(phone.folder)
        #expect(!FileManager.default.fileExists(atPath: folder.deletingLastPathComponent().path))
    }

    @Test func restartFailureRetainsAppliedStateAndRetryDoesNotRestoreAgain() async throws {
        let phone = Phone(version: "26.0")
        phone.restartError = true
        let engine = SeedEngine(operations: phone.operations)
        await #expect(throws: SeedRunError.self) { try await engine.supervise(udid: "phone") }
        #expect(engine.restoreApplied)
        #expect(engine.restoredUDID == "phone")
        phone.restartError = false
        try await engine.restart(udid: "phone")
        #expect(phone.events.filter { $0 == "restore" }.count == 1)
        #expect(phone.events.filter { $0 == "restart" }.count == 2)
        #expect(engine.phase == .done)
    }

    @Test func cannotRestartAnotherPhoneOrBeforeRestore() async throws {
        let phone = Phone(version: "26.0")
        let engine = SeedEngine(operations: phone.operations)
        await #expect(throws: SeedRunError.noAppliedRestore) { try await engine.restart(udid: "phone") }
        #expect(phone.events.isEmpty)
        try await engine.supervise(udid: "phone")
        let events = phone.events
        await #expect(throws: SeedRunError.noAppliedRestore) { try await engine.restart(udid: "other") }
        #expect(phone.events == events)
    }

    @Test func cancellationBeforePolicyReturnsPreventsRestore() async throws {
        let phone = Phone(version: "26.0")
        let engine = SeedEngine(operations: phone.operations)
        phone.afterConfiguration = { engine.cancel() }
        await #expect(throws: SeedRunError.cancelled(restoreApplied: false)) {
            try await engine.supervise(udid: "phone")
        }
        #expect(phone.events == ["version", "configuration"])
        #expect(engine.phase == .cancelled)
    }

    @Test func cancellationDuringRestoreWaitsForTheOperationAndNeverRestarts() async throws {
        let phone = Phone(version: "26.0")
        let engine = SeedEngine(operations: phone.operations)
        phone.duringRestore = { engine.cancel() }
        phone.restoreError = .cancelled
        await #expect(throws: SeedRunError.cancelled(restoreApplied: false)) {
            try await engine.supervise(udid: "phone")
        }
        #expect(phone.events.suffix(2) == ["restore", "cancel"])
        #expect(engine.phase == .cancelled)
        let folder = try #require(phone.folder)
        #expect(!FileManager.default.fileExists(atPath: folder.deletingLastPathComponent().path))
    }

    @Test func cancellationAfterSuccessfulRestoreAllowsRestartRetry() async throws {
        let phone = Phone(version: "26.0")
        let engine = SeedEngine(operations: phone.operations)
        phone.duringRestore = { engine.cancel() }
        await #expect(throws: SeedRunError.cancelled(restoreApplied: true)) {
            try await engine.supervise(udid: "phone")
        }
        #expect(engine.restoreApplied)
        #expect(!phone.events.contains("restart"))
        try await engine.restart(udid: "phone")
        #expect(engine.phase == .done)
    }

    @Test func sampleBackupEngineRefusesBeforeDeviceOrDiskAccess() async throws {
        let engine = SeedEngine(backupEngine: BackupEngine(sample: .idle, progress: 0))
        await #expect(throws: BackupError.failed("This engine runs nothing.")) {
            try await engine.supervise(udid: "phone")
        }
        #expect(!engine.restoreApplied)
    }

    @Test func seedRestoreArgumentsCannotRequestFullRestoreOrReboot() {
        let arguments = BackupEngine.restoreArguments(
            udid: "phone", folder: URL(fileURLWithPath: "/isolated/phone"), password: nil,
            system: true, settings: false, reboot: false, skipApps: true
        )
        #expect(arguments == ["-u", "phone", "restore", "--system", "--skip-apps", "--no-reboot", "/isolated"])
    }

    @Test func configurationResponseRequiresADictionaryAndValidAcknowledgement() throws {
        let empty = try plist(["Status": "Acknowledged"])
        #expect(try SeedDevice.configuration(from: empty).isEmpty)
        let response = try plist(["Status": "Acknowledged", "CloudConfiguration": ["OrganizationName": "Keep"]])
        #expect(try SeedDevice.configuration(from: response)["OrganizationName"] as? String == "Keep")
        let invalid = try plist(["Status": "Error"])
        #expect(throws: DeviceError.self) { try SeedDevice.configuration(from: invalid) }
        let array = try PropertyListSerialization.data(fromPropertyList: ["array"], format: .xml, options: 0)
        #expect(throws: DeviceError.self) { try SeedDevice.configuration(from: array) }
    }

    @Test func strictCloudReadRefusesMissingAcknowledgementAndUnreadablePolicy() throws {
        for response: [String: Any] in [
            [:], ["CloudConfiguration": ["OrganizationName": "Keep"]],
            ["Status": "Acknowledged", "CloudConfiguration": "unreadable"],
            ["Status": "Error"],
        ] {
            let data = try plist(response)
            #expect(throws: DeviceError.self) { try MCInstall.checkedCloudConfiguration(from: data) }
        }
        let empty = try plist(["Status": "Acknowledged"])
        #expect(try MCInstall.checkedCloudConfiguration(from: empty).isEmpty)
        let existing = try plist(["Status": "Acknowledged", "CloudConfiguration": ["OrganizationName": "Keep"]])
        #expect(try MCInstall.checkedCloudConfiguration(from: existing)["OrganizationName"] as? String == "Keep")
    }

    private func plist(_ dictionary: [String: Any]) throws -> Data {
        try PropertyListSerialization.data(fromPropertyList: dictionary, format: .xml, options: 0)
    }

    @MainActor
    private final class Phone {
        var version: String?
        var versions: [String?] = []
        var policy: [String: Any] = [:]
        var events: [String] = []
        var folder: URL?
        var content: [String: Any]?
        var seedFileNames: Set<String> = []
        var configurationError = false
        var restoreError: BackupError?
        var restartError = false
        var afterConfiguration: (() -> Void)?
        var duringRestore: (() -> Void)?

        init(version: String?) { self.version = version }

        var operations: SeedEngine.Operations {
            SeedEngine.Operations(
                readVersion: { _ in
                    self.events.append("version")
                    return self.versions.isEmpty ? self.version : self.versions.removeFirst()
                },
                readConfiguration: { _ in
                    self.events.append("configuration")
                    if self.configurationError { throw DeviceError.unexpectedResponse(request: "test") }
                    self.afterConfiguration?()
                    return try PropertyListSerialization.data(fromPropertyList: self.policy, format: .xml, options: 0)
                },
                restore: { _, folder in
                    self.events.append("restore")
                    self.folder = folder
                    self.seedFileNames = Set(try FileManager.default.contentsOfDirectory(atPath: folder.path))
                    let data = try Data(contentsOf: folder.appendingPathComponent(SeedBackup.contentFileName))
                    self.content = try SeedDevice.configuration(from: data)
                    self.duringRestore?()
                    if let error = self.restoreError { throw error }
                },
                restart: { _ in
                    self.events.append("restart")
                    if self.restartError { throw DeviceError.requestFailed(request: "Restart", code: -1) }
                },
                cancelRestore: { self.events.append("cancel") }
            )
        }
    }
}
