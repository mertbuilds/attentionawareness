import AppKit
import Combine
import Foundation
import UniformTypeIdentifiers

/// Everything one run of the wizard knows: which step is on screen, which
/// iPhone it is about, where the backup went, the backup password and whatever
/// went wrong last.
///
/// The step order itself lives in `WizardStep`, which knows nothing about the
/// iPhone. This class holds the parts that do: it owns the device watcher and
/// the backup engine, and it runs the patch, the restore and the profile
/// install. Every move between steps goes through `go(to:)`, so a step can
/// never start half way through.
///
/// Nothing is written anywhere but the backup folder. No preference, no
/// history, no analytics.
@MainActor
final class WizardModel: ObservableObject {
    /// Where the backups go. The app writes into its own Application Support
    /// folder, which needs no Full Disk Access, unlike the folder Finder uses.
    static var backupRoot: URL { BackupFolder.applicationSupportRoot }

    /// How long the phone is given to come back on the cable after the restore
    /// reboots it.
    private static let rebootTimeout: TimeInterval = 15 * 60
    /// How often the phone is read again while a check is waiting for it.
    private static let pollInterval = Duration.seconds(3)
    /// How long the patch step holds the line about what changed on screen
    /// before it moves on by itself.
    private static let patchPause = Duration.seconds(2)
    /// What the free space check asks for when the iPhone does not say how
    /// much it holds.
    private static let assumedPhoneBytes: UInt64 = 64_000_000_000

    let watcher: DeviceWatcher
    let engine = BackupEngine()

    @Published private(set) var step: WizardStep = .connect
    @Published private(set) var direction: WizardDirection = .supervise
    /// The iPhone this run is about, from the moment the user picks it. Nil on
    /// the first step, where whatever is plugged in is the candidate.
    @Published private(set) var udid: String?
    /// The row picked on the Connect step while more than one iPhone is on the
    /// cable. It is only a preference: `udid` is what fixes the run.
    @Published private(set) var selectedUdid: String?
    /// The password of an encrypted backup. It is the password the user set
    /// for encrypted backups, never the passcode of the phone.
    @Published var password = ""
    @Published private(set) var backupFolder: URL?
    /// The sentence the step on screen shows. It always comes from a
    /// `LocalizedError` of one of the three layers, never from a modal alert.
    @Published private(set) var errorMessage: String?
    /// When the transfer on screen started, for the elapsed time.
    @Published private(set) var transferStartedAt: Date?

    @Published private(set) var patch = PatchState()
    @Published private(set) var restore = RestoreState()
    @Published private(set) var profile = ProfileState()
    /// Trial mode: the profile can be deleted on the phone. Off, because a
    /// profile that can be removed is one that will be.
    @Published var allowsRemoval = false
    /// Apple's adult-content heuristic, which costs nothing to leave on.
    @Published var filtersAdultWebsites = true

    private var relays: [AnyCancellable] = []
    private var poll: Task<Void, Never>?

    /// A model that watches the real USB bus, which is what the window uses.
    convenience init() {
        self.init(watcher: DeviceWatcher())
    }

    /// The watcher and the engine publish their own changes. Re-sending them
    /// here means every view can watch this one object and still redraw when a
    /// phone appears or a progress bar moves.
    ///
    /// The watcher is handed in rather than made here, so the hidden
    /// `--ui-smoke` path can draw the steps from a watcher holding phones that
    /// are not there.
    init(watcher: DeviceWatcher) {
        self.watcher = watcher
        relays = [
            watcher.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            engine.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
        ]
    }

    // MARK: - What the phone says

    /// Every iPhone on the cable, in the order usbmuxd lists them. The Connect
    /// step offers a choice only while there is more than one.
    var devices: [ConnectedDevice] { watcher.devices }

    /// The iPhone this run is about. Before the user picks a direction it is
    /// the row picked on the Connect step, which starts on the first phone on
    /// the cable and falls back to the first one left when that phone is
    /// unplugged. After that it is that phone and no other, so a second phone
    /// plugged in half way through changes nothing.
    var device: ConnectedDevice? {
        if let udid {
            return watcher.devices.first { $0.udid == udid }
        }
        if let selectedUdid, let picked = watcher.devices.first(where: { $0.udid == selectedUdid }) {
            return picked
        }
        return watcher.devices.first
    }

    /// What MCInstall last said about the chosen phone.
    var cloudConfiguration: CloudConfiguration? {
        guard let udid = device?.udid else { return nil }
        return watcher.cloudConfigurations[udid]
    }

    /// True while the phone says it is supervised. Nil while it has not been
    /// read, which is how a phone that has not trusted this Mac reads.
    var isSupervised: Bool? { cloudConfiguration?.isSupervised }

    /// The configuration profiles the chosen phone lists. Empty until it has
    /// answered, which is also how a phone that has not trusted this Mac reads.
    var installedProfiles: [InstalledProfile] {
        guard let udid = device?.udid else { return [] }
        return watcher.installedProfiles[udid] ?? []
    }

    /// The ones this app put there. The Profile step asks about these before it
    /// offers to install another.
    var ourProfiles: [InstalledProfile] { installedProfiles.filter(\.isOurs) }

    /// The password to hand to the engine and the patch. An empty field means
    /// no password at all.
    private var secret: String? { password.isEmpty ? nil : password }

    /// True while something is running that stepping back would interrupt.
    var isBusy: Bool {
        engine.phase.isRunning
            || patch.isRunning
            || restore.stage == .running
            || restore.stage == .waitingForPhone
            || profile.isRunning
    }

    // MARK: - Moving between steps

    /// Pick which iPhone the run will be about, while more than one is on the
    /// cable. It does nothing once the run has started, so no step past Connect
    /// can change phones.
    func select(_ device: ConnectedDevice) {
        guard udid == nil else { return }
        selectedUdid = device.udid
    }

    /// Pick the phone on the cable and the direction, then start the checks.
    func start(_ direction: WizardDirection) {
        guard let device, device.pairingState == .paired else { return }
        self.direction = direction
        udid = device.udid
        // Stepping back to Connect clears `udid`, so the pick is kept here as
        // well and the same phone comes back highlighted.
        selectedUdid = device.udid
        go(to: .checks)
    }

    /// Step back. The button is only offered where this changes nothing on the
    /// iPhone and nothing in the backup.
    func back() {
        guard let previous = step.previous(in: direction) else { return }
        if previous == .connect {
            udid = nil
        }
        go(to: previous)
    }

    /// Move on to whatever comes after the step on screen.
    func advance() {
        guard let next = step.next(in: direction) else { return }
        go(to: next)
    }

    /// Forget this run and ask for a phone again.
    func startOver() {
        poll?.cancel()
        udid = nil
        selectedUdid = nil
        password = ""
        backupFolder = nil
        transferStartedAt = nil
        patch = PatchState()
        restore = RestoreState()
        profile = ProfileState()
        allowsRemoval = false
        filtersAdultWebsites = true
        direction = .supervise
        errorMessage = nil
        step = .connect
        watcher.reload()
    }

    /// The one way a step changes. A step that starts something of its own
    /// starts it here, so entering it twice cannot leave two runs going.
    private func go(to step: WizardStep) {
        poll?.cancel()
        errorMessage = nil
        self.step = step
        switch step {
        case .checks:
            pollWhileFindMyIsOn()
        case .patch:
            runPatch()
        case .restore:
            restore = RestoreState()
        case .profile:
            profile = ProfileState()
        case .connect, .backUp, .done:
            break
        }
    }

    // MARK: - Checks

    /// Read the phone again every three seconds while Find My is still on, so
    /// the tick turns green as soon as the user switches it off. The poll stops
    /// the moment Find My reads off, or the step changes.
    private func pollWhileFindMyIsOn() {
        poll = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.pollInterval)
                guard let self, !Task.isCancelled else { return }
                guard self.step == .checks, self.device?.findMyOn != false else { return }
                self.watcher.reload()
            }
        }
    }

    /// How much room the backup needs on this Mac, and how much there is.
    struct DiskSpace {
        /// What the backup is expected to need.
        let needed: UInt64
        /// What this Mac has, or nil when the volume did not answer.
        let free: UInt64?
        /// True when the iPhone did not say how much it holds, so `needed` is
        /// the flat assumption rather than a number from the phone.
        let assumed: Bool

        /// Nil when the free space could not be read, so the check neither
        /// passes nor blocks.
        var passes: Bool? {
            guard let free else { return nil }
            return free >= needed
        }
    }

    /// The free space check: the phone's used space plus a fifth, against what
    /// this Mac has left.
    var diskSpace: DiskSpace {
        var needed = Self.assumedPhoneBytes
        var assumed = true
        if let capacity = device?.dataCapacity, let available = device?.dataAvailable, capacity >= available {
            needed = UInt64(Double(capacity - available) * 1.2)
            assumed = false
        }
        return DiskSpace(needed: needed, free: Self.freeBytes(), assumed: assumed)
    }

    /// What the volume that holds the backups has left, purgeable space
    /// included, which is what macOS frees up when a write needs room.
    private static func freeBytes() -> UInt64? {
        let folder = backupRoot.deletingLastPathComponent().deletingLastPathComponent()
        let values = try? folder.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        guard let capacity = values?.volumeAvailableCapacityForImportantUsage, capacity > 0 else {
            return nil
        }
        return UInt64(capacity)
    }

    /// True when the phone encrypts its backups, which is the only case where
    /// the password field is shown and the password is needed.
    var needsPassword: Bool { device?.backupEncrypted == true }

    /// Every check that can be read says yes.
    var checksPass: Bool {
        if device?.findMyOn == true { return false }
        if diskSpace.passes == false { return false }
        if needsPassword, password.isEmpty { return false }
        return true
    }

    // MARK: - Back up

    /// Make the backup. The phone decides whether it is encrypted; the
    /// password is only passed on.
    func startBackup() {
        guard let udid, !engine.phase.isRunning else { return }
        go(to: .backUp)
        transferStartedAt = Date()
        Task {
            do {
                backupFolder = try await engine.backup(
                    udid: udid,
                    into: Self.backupRoot,
                    password: secret
                )
                go(to: .patch)
            } catch BackupError.cancelled {
                // The phase already says it was cancelled, and the step offers
                // Retry. A cancel the user asked for is not an error.
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func cancelTransfer() {
        engine.cancel()
    }

    // MARK: - Patch

    /// What the patch did, in the words the step shows.
    struct PatchState {
        /// The line under the title while the patch runs.
        var status: String?
        /// One line per flag that changed.
        var changes: [String] = []
        /// Where the untouched copy of the backup went.
        var pristinePath: String?
        var isRunning = false
        /// True when the backup already said what it should, so nothing was
        /// written.
        var alreadyCorrect = false
    }

    /// Read the backup, unlock it when it is encrypted, write the flag and
    /// check it. All of it off the main thread: deriving the keys of an
    /// encrypted backup takes seconds.
    func runPatch() {
        guard let folder = backupFolder, !patch.isRunning else { return }
        patch = PatchState(status: "Reading the backup", isRunning: true)
        errorMessage = nil
        let password = secret ?? ""
        let target = direction.target
        Task {
            do {
                let outcome = try await Self.applyPatch(
                    folder: folder,
                    password: password,
                    target: target,
                    status: { [weak self] line in
                        Task { @MainActor in self?.patch.status = line }
                    }
                )
                patch = PatchState(
                    status: nil,
                    changes: outcome.changes,
                    pristinePath: outcome.pristinePath,
                    isRunning: false,
                    alreadyCorrect: outcome.alreadyCorrect
                )
                // A backup that already says the right thing is a step the
                // user walked back into, so it waits rather than moving on by
                // itself and walking forward again.
                guard !outcome.alreadyCorrect else { return }
                // Long enough to read the line about what changed.
                try? await Task.sleep(for: Self.patchPause)
                guard step == .patch else { return }
                go(to: .restore)
            } catch {
                patch.isRunning = false
                patch.status = nil
                errorMessage = error.localizedDescription
            }
        }
    }

    /// The result of one patch, small enough to cross back to the main thread.
    private struct PatchOutcome: Sendable {
        let changes: [String]
        let pristinePath: String?
        let alreadyCorrect: Bool
    }

    /// The patch itself. The backup folder, the plan and the keys never leave
    /// this task.
    private nonisolated static func applyPatch(
        folder: URL,
        password: String,
        target: Bool,
        status: @escaping @Sendable (String) -> Void
    ) async throws -> PatchOutcome {
        try await Task.detached(priority: .userInitiated) {
            let backup = try BackupFolder.load(at: folder)
            if backup.isEncrypted {
                status("Deriving the backup keys, up to ten seconds")
                try backup.unlock(password: password)
            }
            let plan = try SupervisionPatch.plan(backup: backup, target: target)
            guard !plan.isEmpty else {
                return PatchOutcome(changes: [], pristinePath: nil, alreadyCorrect: true)
            }
            status("Writing the flag")
            let patch = SupervisionPatch(backup: backup)
            let pristine = try patch.apply(plan)
            status("Checking")
            try patch.verify(target: target)
            return PatchOutcome(
                changes: plan.changes,
                pristinePath: pristine.path,
                alreadyCorrect: false
            )
        }.value
    }

    // MARK: - Restore

    /// How far the restore has got. The phone reboots half way through, so the
    /// step waits for it to come back before it says anything about the result.
    enum RestoreStage: Equatable {
        /// The explanation, before anything is sent to the phone.
        case ready
        case running
        /// The files are back on the phone and it is restarting.
        case waitingForPhone
        case finished
    }

    struct RestoreState {
        var stage: RestoreStage = .ready
        /// What the phone said about itself after it came back. Nil when it
        /// never came back.
        var supervisedAfterwards: Bool?
    }

    /// Put the patched backup back on the phone and wait for the reboot.
    func startRestore() {
        guard let udid, let folder = backupFolder, !engine.phase.isRunning else { return }
        errorMessage = nil
        restore = RestoreState(stage: .running)
        transferStartedAt = Date()
        Task {
            do {
                try await engine.restore(
                    udid: udid,
                    from: folder,
                    password: secret,
                    system: true,
                    settings: true,
                    reboot: true
                )
                restore.stage = .waitingForPhone
                await waitForPhone()
                restore.supervisedAfterwards = isSupervised
                restore.stage = .finished
            } catch BackupError.cancelled {
                restore.stage = .ready
            } catch {
                restore.stage = .ready
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Read the bus until the phone is back and has answered MCInstall again.
    /// A phone that never comes back leaves the supervision state unknown,
    /// which the step says in as many words.
    private func waitForPhone() async {
        let deadline = Date().addingTimeInterval(Self.rebootTimeout)
        while Date() < deadline {
            try? await Task.sleep(for: Self.pollInterval)
            watcher.reload()
            if device?.pairingState == .paired, cloudConfiguration != nil {
                return
            }
        }
    }

    // MARK: - Profile

    enum ProfileStage: Equatable {
        case ready
        /// The site is turning the configuration into signed bytes.
        case signing
        case installing
        case installed
    }

    struct ProfileState {
        var stage: ProfileStage = .ready
        /// The file the user picked, when the profile came from one. Nil when
        /// the app built it.
        var fileName: String?

        /// True while something is on its way to the site or to the phone.
        var isRunning: Bool { stage == .signing || stage == .installing }
    }

    /// What the Profile step installs: the feed apps and their sites, with the
    /// two choices the step offers written over the top.
    var profileConfig: ProfileConfig {
        var config = ProfileConfig.default
        config.lockRemoval = !allowsRemoval
        config.autoFilterAdult = filtersAdultWebsites
        return config
    }

    /// Have the site sign the profile, then push it over the cable. The
    /// signing certificate never leaves the site, so the bytes make one round
    /// trip and go straight to the phone; nothing is written to disk.
    func signAndInstallProfile() {
        guard let udid, !profile.isRunning else { return }
        let config = profileConfig
        errorMessage = nil
        profile = ProfileState(stage: .signing)
        Task {
            do {
                let data = try await ProfileSigner().signedProfile(for: config)
                profile.stage = .installing
                try await Task.detached(priority: .userInitiated) {
                    try MCInstall(udid: udid).installProfile(data)
                }.value
                profile.stage = .installed
                // The phone lists one more profile now, so read it again for
                // the card and the summary.
                watcher.reload()
            } catch {
                profile.stage = .ready
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Ask for a `.mobileconfig` built somewhere else and push it over the
    /// cable, for a profile made on the site's build page.
    func chooseAndInstallProfile() {
        guard let udid, !profile.isRunning else { return }
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        if let type = UTType(filenameExtension: "mobileconfig") {
            panel.allowedContentTypes = [type]
        }
        panel.prompt = "Install"
        panel.message = "Pick the configuration profile you saved from attentionawareness.com."
        guard panel.runModal() == .OK, let url = panel.url else { return }

        errorMessage = nil
        profile = ProfileState(stage: .installing, fileName: url.lastPathComponent)
        Task {
            do {
                let data = try Data(contentsOf: url)
                try await Task.detached(priority: .userInitiated) {
                    try MCInstall(udid: udid).installProfile(data)
                }.value
                profile.stage = .installed
                watcher.reload()
            } catch {
                profile.stage = .ready
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Done

    /// Show the backup folder in Finder.
    func revealBackupFolder() {
        guard let backupFolder else { return }
        NSWorkspace.shared.activateFileViewerSelecting([backupFolder])
    }
}

extension BackupEngine.Phase {
    /// True while the helper is still working, which is when Cancel is the
    /// only button that makes sense.
    var isRunning: Bool {
        switch self {
        case .starting, .transferring, .finishing:
            return true
        case .idle, .done, .cancelled, .failed:
            return false
        }
    }
}
