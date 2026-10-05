import Foundation
import Testing

/// The one anonymous count: what is in it, and when the wizard sends it.
///
/// No test here sends anything. The body is read as bytes, and the wizard is
/// handed a sender that only writes down what it was given.
@MainActor
struct SupervisionFinishedEventTests {
    private static let id = UUID(uuidString: "3F2C1D0E-8B7A-4C6D-9E5F-1A2B3C4D5E6F")!

    // MARK: - What is in it

    @Test func theBodyHoldsExactlyTheseKeys() throws {
        let event = SupervisionFinishedEvent(appVersion: "0.4.0", iosVersion: "26.6.2", macosMajor: 15)
        let request = try #require(SupervisionEventSender.request(for: event, distinctID: Self.id))
        let body = try #require(request.httpBody)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(Set(json.keys) == ["api_key", "event", "distinct_id", "properties"])
        #expect(json["api_key"] as? String == "phc_DfvN33UTDFBHJfUfC46o4aKL33aGLR7qEmEJYfWjh9gi")
        #expect(json["event"] as? String == "supervision_finished")
        #expect(json["distinct_id"] as? String == "3F2C1D0E-8B7A-4C6D-9E5F-1A2B3C4D5E6F")
        let properties = try #require(json["properties"] as? [String: Any])
        #expect(
            Set(properties.keys)
                == ["app_version", "method", "ios_major", "macos_major", "$process_person_profile", "$geoip_disable"]
        )
        #expect(properties["app_version"] as? String == "0.4.0")
        #expect(properties["method"] as? String == "fast")
        #expect(properties["ios_major"] as? Int == 26)
        #expect(properties["macos_major"] as? Int == 15)
        #expect(properties["$process_person_profile"] as? Bool == false)
        #expect(properties["$geoip_disable"] as? Bool == true)
    }

    /// The fast method is the only one, and the key keeps the value it has
    /// always sent for it, so the counts read the same as the older ones.
    @Test func theMethodIsAlwaysFast() {
        let event = SupervisionFinishedEvent(appVersion: "0.4.0", iosVersion: "26.0", macosMajor: 15)
        #expect(event.payload(distinctID: Self.id).properties.method == "fast")
        #expect(SupervisionFinishedEvent.method == "fast")
    }

    @Test(arguments: [("26.6.2", 26), ("27.0", 27), ("17", 17)])
    func onlyTheFirstNumberOfTheIOSVersionIsKept(_ version: String, _ major: Int) throws {
        let event = SupervisionFinishedEvent(appVersion: "0.4.0", iosVersion: version, macosMajor: 15)
        #expect(event.iosMajor == major)
        let body = try JSONEncoder().encode(event.payload(distinctID: Self.id))
        #expect(!String(decoding: body, as: UTF8.self).contains(version + "\""))
    }

    @Test(arguments: [nil, "", "26.x"] as [String?])
    func anIPhoneThatGaveNoVersionLeavesTheKeyOut(_ version: String?) throws {
        let event = SupervisionFinishedEvent(appVersion: "0.4.0", iosVersion: version, macosMajor: 15)
        let body = try JSONEncoder().encode(event.payload(distinctID: Self.id))
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let properties = try #require(json["properties"] as? [String: Any])
        #expect(properties["ios_major"] == nil)
    }

    @Test func theRequestIsOneShortPostToTheSitesOwnProxy() throws {
        let event = SupervisionFinishedEvent(appVersion: "0.4.0", iosVersion: "26.0", macosMajor: 15)
        let request = try #require(SupervisionEventSender.request(for: event, distinctID: Self.id))
        #expect(request.url?.absoluteString == "https://e.attentionawareness.com/i/v0/e/")
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        // Fixed, so the request names no Darwin build and no language of this Mac.
        #expect(request.value(forHTTPHeaderField: "User-Agent") == "attentionawareness-mac/0.4.0")
        #expect(request.value(forHTTPHeaderField: "Accept-Language") == "en")
        #expect(request.timeoutInterval == 5)
    }

    @Test func theDisclosureNamesEverythingTheCountHolds() {
        #expect(
            SupervisionFinishedEvent.disclosure
                == "When a supervision finishes, the app sends one anonymous count. "
                + "It holds the app version, the method, and the first number of the iOS version "
                + "and of the macOS version. "
                + "Nothing that names you or your iPhone."
        )
    }

    // MARK: - When the wizard sends it

    @Test func itIsSentOnceWhenThePersonSaysTheIPhoneIsSupervised() async {
        let sent = Sent()
        let model = makeModel(sent)
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        // Reaching the question sends nothing: the answer is what counts.
        #expect(sent.events.isEmpty)
        model.advance()
        #expect(model.step == .restrictions)
        #expect(sent.events.count == 1)
        #expect(sent.events.first?.iosMajor == 26)
        // The rest of the run, to the last screen, sends nothing more.
        model.advance()
        #expect(model.step == .done)
        #expect(sent.events.count == 1)
    }

    @Test func aSecondIPhoneInTheSameSessionIsCountedAgain() async {
        let sent = Sent()
        let model = makeModel(sent)
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        model.advance()
        #expect(sent.events.count == 1)
        // Done forgets the run, and the next iPhone is a run of its own.
        model.startOver()
        model.start()
        #expect(model.step == .ready)
        model.confirmBackup(true)
        model.startJob()
        #expect(await waitUntil { model.job == .checkOnIPhone(reportedSupervised: true) })
        model.advance()
        #expect(sent.events.count == 2)
    }

    @Test func aRunThatFailsSendsNothing() async {
        let sent = Sent()
        let model = makeModel(sent)
        model.freshVersion = "27.0"
        ready(model)
        model.startJob()
        #expect(await waitUntil { if case .failed = model.job { return true }; return false })
        model.cancelJob()
        #expect(model.step == .ready)
        #expect(sent.events.isEmpty)
    }

    @Test func aRunThatIsCancelledSendsNothing() async throws {
        let sent = Sent()
        let model = makeModel(sent)
        model.holdPhone = true
        ready(model)
        model.startJob()
        #expect(await waitUntil { model.phoneCompletion != nil })
        let wait = try #require(model.phoneCompletion)
        model.cancelJob()
        wait.resume(returning: false)
        #expect(model.step == .ready)
        #expect(sent.events.isEmpty)
    }

    @Test func aModelWithNoSenderIsWhatEveryPathButTheWindowBuilds() {
        let model = WizardModel(watcher: DeviceWatcher(sample: []), engine: BackupEngine(sample: .idle, progress: 0))
        #expect(model.finishedEvent == nil)
    }

    @Test func theDemoIsBuiltWithNothingToSendTheCount() {
        #expect(DemoWizardModel().finishedEvent == nil)
    }

    private func makeModel(_ sent: Sent) -> RunModel {
        let phone = ConnectedDevice(
            udid: "phone", name: "Test iPhone", productType: nil, marketingName: nil,
            iosVersion: "26.6.2", findMyOn: false, backupEncrypted: true,
            cloudBackupOn: nil, lastCloudBackup: nil, dataCapacity: nil, dataAvailable: nil,
            pairingState: .paired
        )
        return RunModel(
            watcher: DeviceWatcher(sample: [phone]), engine: BackupEngine(sample: .idle, progress: 0),
            finishedEvent: { sent.events.append($0) }
        )
    }

    private func ready(_ model: WizardModel) {
        model.show(WizardModel.Sample(step: .ready, backupConfirmed: true, udid: "phone"))
    }

    private func waitUntil(_ condition: () -> Bool) async -> Bool {
        let deadline = ContinuousClock.now + .seconds(3)
        while !condition(), ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(2))
        }
        return condition()
    }

    /// What the wizard handed its sender.
    private final class Sent {
        var events: [SupervisionFinishedEvent] = []
    }

    /// The wizard with every piece of the job answered at once, so a run gets
    /// to the question at the end without an iPhone.
    private final class RunModel: WizardModel {
        var freshVersion: String? = "26.6.2"
        var holdPhone = false
        var phoneCompletion: CheckedContinuation<Bool, Never>?

        override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder { .nothingHere }
        override func readDeviceIOSVersion(udid: String) async throws -> String? { freshVersion }
        override func sendSeedConfiguration(restartingOnly: Bool) async throws {}
        override func waitForPhone(until deadline: Date?) async -> Bool {
            if holdPhone { return await withCheckedContinuation { phoneCompletion = $0 } }
            return true
        }
        override func confirmWhatTheIPhoneIs() async -> Bool { true }
    }
}
