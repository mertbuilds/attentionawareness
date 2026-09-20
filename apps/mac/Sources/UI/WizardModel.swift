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
/// Nothing is written anywhere but the backup folder and the two numbers
/// `TransferRate` keeps, which are a measurement of how fast this Mac moves
/// bytes over the cable. No history, no analytics.
@MainActor
class WizardModel: ObservableObject {
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
    /// What the free space check asks for when the iPhone does not say how
    /// much it holds.
    private static let assumedPhoneBytes: UInt64 = 64_000_000_000

    let watcher: DeviceWatcher
    let engine: BackupEngine
    /// The backups this Mac already holds, which the last step lists. They
    /// outlive one run, so this object only starts and stops the work; it
    /// keeps nothing about the run itself.
    let backups: BackupsList

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
    /// How much longer the transfer on screen has, as far as the progress the
    /// helper prints can say. It is started again by every transfer, so a
    /// second run never inherits the rate of the first.
    @Published private(set) var estimate = TransferEstimate()

    @Published private(set) var patch = PatchState()
    @Published private(set) var restore = RestoreState()
    @Published private(set) var profile = ProfileState()
    /// The profile the Profile step is building. It starts on the one this app
    /// has always installed and the step writes over it.
    @Published var draft = ProfileDraft.recommended
    /// What the search field over the blocked list is showing.
    @Published private(set) var appSearch = AppSearchState()

    private var relays: [AnyCancellable] = []
    private var poll: Task<Void, Never>?
    /// The keystroke being answered right now. The next one cancels it, which
    /// is what keeps a slow answer from landing under a newer term.
    private var searchTask: Task<Void, Never>?
    /// The artwork of the blocked apps, on its way in.
    private var iconTask: Task<Void, Never>?
    /// Bundle ids the store has already been asked about, so an app it does
    /// not carry is asked for once rather than on every redraw.
    private var askedForIcons = Set<String>()

    /// A model that watches the real USB bus, which is what the window uses.
    convenience init() {
        self.init(watcher: DeviceWatcher())
    }

    /// A model that keeps its own list of the backups on this Mac, which is
    /// every model but the one the smoke hands its own list to.
    convenience init(watcher: DeviceWatcher) {
        self.init(watcher: watcher, backups: BackupsList())
    }

    /// A model that runs an engine of its own, which is every model but the
    /// one the smoke draws a transfer in flight from.
    convenience init(watcher: DeviceWatcher, backups: BackupsList) {
        self.init(watcher: watcher, backups: backups, engine: BackupEngine())
    }

    /// The watcher and the engine publish their own changes. Re-sending them
    /// here means every view can watch this one object and still redraw when a
    /// phone appears or a progress bar moves.
    ///
    /// Both are handed in rather than made here, so the hidden `--ui-smoke`
    /// path can draw the steps from a watcher holding phones that are not
    /// there and from an engine that is running nothing.
    init(watcher: DeviceWatcher, backups: BackupsList, engine: BackupEngine) {
        self.watcher = watcher
        self.backups = backups
        self.engine = engine
        relays = [
            watcher.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            engine.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            // The checks and the Back up step both ask what this Mac already
            // holds for the phone on the cable, so a row landing in the list
            // has to redraw them too.
            backups.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            // The estimate is fed from the progress itself rather than from
            // the redraw, so a step that asks it again every second cannot
            // watch the figure slide towards zero on its own.
            engine.$progress.sink { [weak self] progress in
                self?.estimate.record(progress: progress)
            },
        ]
    }

    /// A model whose run is already over: the iPhone it was about, the backup
    /// it wrote and the backups this Mac holds, all handed in. It starts
    /// nothing and reads no bus, so the hidden `--ui-smoke` path can draw the
    /// last step the way it looks once a phone has been restored.
    convenience init(sample watcher: DeviceWatcher, backupFolder: URL, backups: BackupsList) {
        self.init(watcher: watcher, backups: backups)
        self.backupFolder = backupFolder
        step = .done
        restore = RestoreState(stage: .finished, supervisedAfterwards: true)
    }

    /// A model that has picked its iPhone and is standing on the Back up step,
    /// with the backups this Mac holds handed in. It starts nothing and reads
    /// no bus, so the hidden `--ui-smoke` path can draw that step the way it
    /// looks for a phone whose backup is already here.
    convenience init(sample watcher: DeviceWatcher, waitingOn udid: String, backups: BackupsList) {
        self.init(watcher: watcher, backups: backups)
        self.udid = udid
        selectedUdid = udid
        step = .backUp
    }

    /// A model standing in the middle of a restore: the engine, the stage, the
    /// estimate and the clock all handed in, and nothing running. It reads no
    /// bus and sends nothing to a phone, so the hidden `--ui-smoke` path can
    /// draw each of the things the Restore step says while the helper has the
    /// phone without one on the cable.
    convenience init(
        sample watcher: DeviceWatcher,
        restoring engine: BackupEngine,
        stage: RestoreStage,
        estimate: TransferEstimate,
        startedAt: Date
    ) {
        self.init(watcher: watcher, backups: BackupsList(sample: []), engine: engine)
        udid = watcher.devices.first?.udid
        selectedUdid = udid
        step = .restore
        restore = RestoreState(stage: stage)
        transferStartedAt = startedAt
        self.estimate = estimate
    }

    /// One run of the wizard, frozen: the step it is on and everything the
    /// steps before it would have set.
    ///
    /// It is the sample inits above, written down instead of run, so a model
    /// that is already on screen can be put where one of them would have put
    /// it. The hidden `--demo` path jumps between steps with it. Every field
    /// is one the window draws: nothing here reads an iPhone, a disk or a
    /// network, and nothing here starts any work.
    struct Sample {
        var step: WizardStep = .connect
        var direction: WizardDirection = .supervise
        var udid: String?
        var backupFolder: URL?
        var transferStartedAt: Date?
        var estimate = TransferEstimate()
        var patch = PatchState()
        var restore = RestoreState()
        var profile = ProfileState()
        /// What the search field over the blocked list is showing, so a step
        /// can be drawn with rows under it.
        var appSearch = AppSearchState()
        var errorMessage: String?
    }

    /// Put this model where a sample says. It starts nothing and sends nothing
    /// to a phone: the step that is now on screen is drawn from the fields
    /// handed in, and whatever the reader presses next goes through the same
    /// wizard as ever.
    func show(_ sample: Sample) {
        step = sample.step
        direction = sample.direction
        udid = sample.udid
        selectedUdid = sample.udid
        backupFolder = sample.backupFolder
        transferStartedAt = sample.transferStartedAt
        estimate = sample.estimate
        patch = sample.patch
        restore = sample.restore
        profile = sample.profile
        appSearch = sample.appSearch
        errorMessage = sample.errorMessage
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

    /// What this Mac already holds for the iPhone this run is about: a whole
    /// backup the Back up step offers instead of another hour on the cable, a
    /// folder that cannot be used, or nothing at all.
    ///
    /// It is nothing until a phone is picked and the list has come in, so a
    /// run that starts before the folder is read is the run this app has
    /// always made.
    var existingBackup: ExistingBackup.Offer {
        ExistingBackup.offer(for: udid, in: backups.backups)
    }

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
        // The checks ask for the backup password when the backup this Mac
        // already holds is an encrypted one, and the step after them offers
        // that backup, so the folder is read from here rather than from the
        // step that shows it.
        backups.load(measuringFirst: device.udid)
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
        // The last step is gone, so whatever it was still measuring is work
        // for nobody.
        backups.cancel()
        udid = nil
        selectedUdid = nil
        password = ""
        backupFolder = nil
        transferStartedAt = nil
        estimate = TransferEstimate()
        patch = PatchState()
        restore = RestoreState()
        profile = ProfileState()
        draft = .recommended
        clearAppSearch()
        iconTask?.cancel()
        iconTask = nil
        askedForIcons = []
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
            pollWhileFindMyIsOn()
        case .profile:
            profile = ProfileState()
        case .connect, .backUp, .done:
            break
        }
    }

    // MARK: - Checks

    /// Read the phone again every three seconds while Find My is still on, so
    /// the tick on the checks turns green and the Restore button turns on as
    /// soon as the user switches it off. The poll stops the moment Find My
    /// reads off, or the step changes: `go(to:)` cancels it on every move, so
    /// only the step that started it is ever the one waiting.
    ///
    /// The first read happens at once. Nothing reads the phone while the backup
    /// copies, so by the time the restore asks, the value in hand can be an
    /// hour old.
    private func pollWhileFindMyIsOn() {
        poll = Task { [weak self] in
            self?.watcher.reload()
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.pollInterval)
                guard let self, !Task.isCancelled, self.device?.findMyOn != false else { return }
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

    /// What a backup of this iPhone is expected to be. It is the size of the
    /// transfer rather than the room it wants on disk, so it carries none of
    /// the headroom the free space check adds.
    var backupBytes: UInt64? {
        guard let capacity = device?.dataCapacity,
              let available = device?.dataAvailable,
              capacity >= available
        else { return nil }
        return capacity - available
    }

    /// What the restore will send, which is the folder this run is about, once
    /// it has been walked.
    var restoreBytes: UInt64? {
        guard let backupFolder,
              let size = backups.backups.first(where: { $0.url == backupFolder })?.sizeInBytes,
              size > 0
        else { return nil }
        return UInt64(size)
    }

    /// How long the copying is expected to take, in the sentence the step puts
    /// in front of the button. Nil while nothing can be said about the size.
    var backupExpectation: String? { TransferRate.expectation(.backup, bytes: backupBytes) }
    var restoreExpectation: String? { TransferRate.expectation(.restore, bytes: restoreBytes) }

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

    /// True when a password is needed to read the backup this run will work
    /// with: the phone encrypts what it is about to write, or the backup this
    /// Mac already holds is an encrypted one. The second case is asked for
    /// here as well, because the patch needs the password of the folder it
    /// opens and a phone that has since stopped encrypting does not change
    /// what is in that folder.
    var needsPassword: Bool {
        if device?.backupEncrypted == true { return true }
        if case .usable(let backup) = existingBackup { return backup.isEncrypted }
        return false
    }

    /// Every check that can be read says yes.
    ///
    /// Find My is not one of them. It blocks the restore and nothing else, so
    /// the hour of copying starts while the reader is still turning it off.
    var checksPass: Bool {
        WizardGate.checksPass(
            diskSpacePasses: diskSpace.passes,
            needsPassword: needsPassword,
            hasPassword: !password.isEmpty
        )
    }

    // MARK: - Back up

    /// Leave the checks for the Back up step.
    ///
    /// A phone whose folder is already on this Mac stops there, because the
    /// step has something to put to the reader: the backup to use, or the
    /// reason the folder cannot be used. Every other phone starts the transfer
    /// the moment the button is pressed, which is what it has always done.
    func continueFromChecks() {
        if case .nothing = existingBackup {
            startBackup()
        } else {
            go(to: .backUp)
        }
    }

    /// Take the backup this Mac already holds and go straight to the patch.
    ///
    /// The hour on the cable is the only thing this skips. The folder becomes
    /// this run's backup, so the patch reads it, the restore puts it back and
    /// the last step marks it as the one this run used.
    func useExistingBackup(_ backup: StoredBackup) {
        guard step == .backUp, !engine.phase.isRunning else { return }
        backupFolder = backup.url
        go(to: .patch)
    }

    /// Make the backup. The phone decides whether it is encrypted; the
    /// password is only passed on.
    func startBackup() {
        guard let udid, !engine.phase.isRunning else { return }
        go(to: .backUp)
        let started = Date()
        transferStartedAt = started
        estimate = TransferEstimate()
        Task {
            do {
                let folder = try await engine.backup(
                    udid: udid,
                    into: Self.backupRoot,
                    // The phone does the encrypting, so the password only goes
                    // down when the phone says it encrypts its backups. The
                    // field is also shown for an encrypted backup that is
                    // already here, and that one is no business of the phone's.
                    password: device?.backupEncrypted == true ? secret : nil
                )
                backupFolder = folder
                // The listing in hand was made before this backup ran, so it
                // is read again: the Restore step says how big the thing it is
                // about to send is, and the last step lists what is on the
                // disk now.
                backups.load(measuringFirst: udid)
                rememberRate(.backup, folder: folder, since: started)
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

    /// Write down how fast this Mac moved the bytes, so the next run can put a
    /// figure in front of the button rather than a range.
    ///
    /// The folder is walked once the transfer is over and off the main thread,
    /// because its size is the only honest divisor and nothing on screen is
    /// waiting for the number. A folder that cannot be measured leaves the
    /// last measurement where it was.
    private func rememberRate(_ kind: TransferRate.Kind, folder: URL, since started: Date) {
        let seconds = Date().timeIntervalSince(started)
        let root = Self.backupRoot
        Task.detached(priority: .utility) {
            guard let listed = (try? BackupStore.list(root: root))?.first(where: { $0.url == folder })
            else { return }
            guard let bytes = BackupStore.measure(listed).sizeInBytes, bytes > 0 else { return }
            TransferRate.remember(kind, bytes: UInt64(bytes), seconds: seconds)
        }
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
                // The flag is the whole point of the wizard, so the step waits
                // here. Moving on by itself took the line about what changed
                // off the screen before anyone could read it.
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

    /// Whether the phone will take the backup back. This is the one place Find
    /// My matters: the iPhone refuses a restore while it is on.
    var restoreGate: WizardGate.Restore {
        WizardGate.restore(findMyOn: device?.findMyOn)
    }

    /// Put the patched backup back on the phone and wait for the reboot.
    func startRestore() {
        guard let udid, let folder = backupFolder, !engine.phase.isRunning else { return }
        guard restoreGate == .allowed else { return }
        // The helper has the phone from here, so the Find My poll stops rather
        // than opening a lockdown handshake of its own every three seconds.
        poll?.cancel()
        errorMessage = nil
        restore = RestoreState(stage: .running)
        let started = Date()
        transferStartedAt = started
        estimate = TransferEstimate()
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
                rememberRate(.restore, folder: folder, since: started)
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

    /// What the Profile step installs: the apps on the draft's list, the sites
    /// they imply and whatever else the reader typed or switched.
    var profileConfig: ProfileConfig { draft.config }

    // MARK: - Searching the App Store

    /// What the search field over the blocked list is showing: the term, the
    /// rows it found, and whatever there is to say instead of rows.
    struct AppSearchState: Equatable {
        /// The store the results come from. An app missing from one country's
        /// store is missing from its results, so this is the store the reader
        /// installs from rather than the one this Mac is set to.
        var storefront = Storefronts.current()
        var term = ""
        var results: [AppResult] = []
        var isSearching = false
        /// What went wrong, or that nothing matched. Nil while there is
        /// nothing to say.
        var message: String?
    }

    /// How long a keystroke waits before it is asked for, so typing a name
    /// costs one request rather than one per letter.
    private static let searchDelay = Duration.milliseconds(300)
    /// What a search that found nothing says.
    private static let noMatches = "No apps match that name."

    /// Answer what is in the search field. Every call cancels the one before
    /// it, so the rows on screen are always the ones the last term asked for.
    func searchApps(for term: String) {
        searchTask?.cancel()
        appSearch.term = term
        let query = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            appSearch.results = []
            appSearch.isSearching = false
            appSearch.message = nil
            return
        }
        appSearch.isSearching = true
        appSearch.message = nil
        let storefront = appSearch.storefront
        searchTask = Task {
            do {
                try await Task.sleep(for: Self.searchDelay)
                let rows = ProfileDraft.offerable(
                    try await appResults(for: query, storefront: storefront)
                )
                try Task.checkCancellation()
                appSearch.results = rows
                appSearch.isSearching = false
                appSearch.message = rows.isEmpty ? Self.noMatches : nil
            } catch is CancellationError {
                // A term the reader has already typed over. The list it was
                // going to fill is gone, and the newer search owns the field.
            } catch {
                appSearch.results = []
                appSearch.isSearching = false
                appSearch.message = error.localizedDescription
            }
        }
    }

    /// Search the store of another country, and ask the current term again.
    func chooseStorefront(_ code: String) {
        guard code != appSearch.storefront else { return }
        appSearch.storefront = code
        searchApps(for: appSearch.term)
    }

    /// Empty the search field and whatever it found.
    func clearAppSearch() {
        searchTask?.cancel()
        searchTask = nil
        appSearch = AppSearchState(storefront: appSearch.storefront)
    }

    /// Fill in the artwork of every blocked app the draft knows none for,
    /// which is how the recommended list gets its icons. It is best effort: a
    /// store that answers nothing leaves the rows drawn by their initials.
    func loadAppIcons() {
        let missing = draft.blockedApps
            .map(\.bundleId)
            .filter { draft.icons[$0] == nil && !askedForIcons.contains($0) }
        guard !missing.isEmpty else { return }
        askedForIcons.formUnion(missing)
        let storefront = appSearch.storefront
        iconTask = Task {
            guard let found = try? await appDetails(for: missing, storefront: storefront) else {
                return
            }
            for app in found where !app.iconUrl.isEmpty {
                draft.icons[app.bundleId] = app.iconUrl
            }
        }
    }

    /// What the App Store answers for one term. The demo overrides it with a
    /// canned set, so the step can be walked through with no network.
    func appResults(for term: String, storefront: String) async throws -> [AppResult] {
        try await AppSearch().search(term, country: storefront)
    }

    /// What the App Store knows about apps that are already on the list.
    func appDetails(for bundleIds: [String], storefront: String) async throws -> [AppResult] {
        try await AppSearch().lookup(bundleIds, country: storefront)
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
