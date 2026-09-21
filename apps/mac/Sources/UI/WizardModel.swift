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
/// bytes over the cable. No history, no analytics. The backup folder is
/// written for one run and taken away at the end of it, so a run that goes
/// through leaves nothing of the iPhone on this Mac.
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
    /// How long the phone is given to say what it is now, once it is back on
    /// the cable. A phone that has just restored takes a minute or two to
    /// settle before it answers MCInstall with the truth.
    private static let confirmTimeout: TimeInterval = 3 * 60
    /// How often it is asked while that runs.
    private static let confirmInterval = Duration.seconds(5)
    /// What the free space check asks for when the iPhone does not say how
    /// much it holds.
    private static let assumedPhoneBytes: UInt64 = 64_000_000_000

    let watcher: DeviceWatcher
    let engine: BackupEngine

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
    /// What the restore will send, which is the backup this run made, once its
    /// folder has been walked. Nil until then and on a run that skipped the
    /// walk, and the Restore step simply says less.
    @Published private(set) var restoreBytes: UInt64?
    /// True when the run cleared a backup that an earlier run left behind. The
    /// checks say so in one line, because a folder that size going away
    /// without a word is worse than the word.
    @Published private(set) var clearedLeftoverBackup = false
    /// What Finder's own backup folder on this Mac says about the chosen
    /// iPhone. It starts out saying nothing and is filled in by the look the
    /// checks start, which is the one thing in the run that Full Disk Access
    /// buys.
    @Published private(set) var finderBackup: BackupSafetyNet.Finder = .nothingHere
    /// Why the backup is still on this Mac after a run that should have taken
    /// it away, in the sentence that names the folder. Nil whenever there is
    /// nothing to say, which is every ordinary run: the backup is scaffolding
    /// this app puts up and takes down again, and the last step is about the
    /// iPhone rather than about the scaffolding.
    @Published private(set) var backupRemovalFailure: String?
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
    /// Where the one long job has got to, or nil while no job is running. It
    /// is the whole of what the job screen draws.
    @Published private(set) var job: JobPhase?
    @Published private(set) var profile = ProfileState()
    /// The profile the Profile step is building. It starts on the one this app
    /// has always installed and the step writes over it.
    @Published var draft = ProfileDraft.recommended
    /// What the search field over the blocked list is showing.
    @Published private(set) var appSearch = AppSearchState()

    private var relays: [AnyCancellable] = []
    private var poll: Task<Void, Never>?
    /// The job, from the first byte of the copy to the phone saying what it is
    /// now. Every move off the job screen cancels it, so two of them can never
    /// run at once.
    private var jobTask: Task<Void, Never>?
    /// The clearing of a leftover backup, while it is still running. The
    /// backup waits on it, because the folder it is about to write into is the
    /// folder being taken away.
    private var clearing: Task<Void, Never>?
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

    /// A model that runs an engine of its own, which is every model but the
    /// one the smoke draws a transfer in flight from.
    convenience init(watcher: DeviceWatcher) {
        self.init(watcher: watcher, engine: BackupEngine())
    }

    /// The watcher and the engine publish their own changes. Re-sending them
    /// here means every view can watch this one object and still redraw when a
    /// phone appears or a progress bar moves.
    ///
    /// Both are handed in rather than made here, so the hidden `--ui-smoke`
    /// path can draw the steps from a watcher holding phones that are not
    /// there and from an engine that is running nothing.
    init(watcher: DeviceWatcher, engine: BackupEngine) {
        self.watcher = watcher
        self.engine = engine
        relays = [
            watcher.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            engine.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            // The estimate is fed from the progress itself rather than from
            // the redraw, so a step that asks it again every second cannot
            // watch the figure slide towards zero on its own.
            engine.$progress.sink { [weak self] progress in
                self?.estimate.record(progress: progress)
            },
        ]
    }

    /// A model whose run is already over: an iPhone that came back on the cable
    /// saying it is supervised. It starts nothing and reads no bus, so the
    /// hidden `--ui-smoke` path can draw the last step the way it looks once a
    /// phone has been restored.
    convenience init(finished watcher: DeviceWatcher) {
        self.init(watcher: watcher)
        step = .done
        restore = RestoreState(stage: .finished, supervisedAfterwards: true)
    }

    /// A model standing in the middle of the job: the engine, the phase, the
    /// estimate and the clock all handed in, and nothing running. It reads no
    /// bus and sends nothing to a phone, so the hidden `--ui-smoke` path can
    /// draw each of the things the job says while the helper has the phone
    /// without one on the cable.
    convenience init(
        sample watcher: DeviceWatcher,
        running engine: BackupEngine,
        job: JobPhase,
        estimate: TransferEstimate,
        startedAt: Date
    ) {
        self.init(watcher: watcher, engine: engine)
        udid = watcher.devices.first?.udid
        selectedUdid = udid
        step = .job
        self.job = job
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
        /// What the backup on this Mac takes, so the Restore step can be drawn
        /// with the sentence that says how long sending it back will take.
        var restoreBytes: UInt64?
        var transferStartedAt: Date?
        var estimate = TransferEstimate()
        var patch = PatchState()
        var restore = RestoreState()
        /// Where the job screen is, so each of its phases can be drawn.
        var job: JobPhase?
        var profile = ProfileState()
        /// What the search field over the blocked list is showing, so a step
        /// can be drawn with rows under it.
        var appSearch = AppSearchState()
        /// What Finder's backups on this Mac say, so the one line the checks
        /// show about the reader's own way back can be drawn in each of its
        /// states, the refusal included.
        var finderBackup: BackupSafetyNet.Finder = .nothingHere
        /// The two things a step ever says about a backup, so both can be
        /// drawn: the line the checks show when a leftover was cleared, and
        /// the sentence the last step shows when one would not go.
        var clearedLeftoverBackup = false
        var backupRemovalFailure: String?
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
        restoreBytes = sample.restoreBytes
        transferStartedAt = sample.transferStartedAt
        estimate = sample.estimate
        patch = sample.patch
        restore = sample.restore
        job = sample.job
        profile = sample.profile
        appSearch = sample.appSearch
        finderBackup = sample.finderBackup
        clearedLeftoverBackup = sample.clearedLeftoverBackup
        backupRemovalFailure = sample.backupRemovalFailure
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
        clearLeftoverBackup(of: device.udid)
        go(to: .ready)
    }

    /// Take away whatever this Mac is still holding for this iPhone.
    ///
    /// A backup is made for one run and deleted at the end of it, and no run
    /// ever uses one that an earlier run made, because a backup from another
    /// day puts the phone back to another day. So a folder still sitting here
    /// is rubbish from a run that stopped part way, and it is rubbish the next
    /// backup would write over anyway, since both go in the folder named after
    /// the phone.
    ///
    /// A clear that fails says nothing here. The end of the run deletes the
    /// same folder and reports there, which is where a person can do something
    /// about it.
    private func clearLeftoverBackup(of udid: String) {
        clearedLeftoverBackup = false
        clearing = Task {
            clearedLeftoverBackup = await removeBackup(of: udid) == .deleted
        }
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
        stopJob()
        udid = nil
        selectedUdid = nil
        password = ""
        backupFolder = nil
        restoreBytes = nil
        finderBackup = .nothingHere
        clearedLeftoverBackup = false
        backupRemovalFailure = nil
        transferStartedAt = nil
        estimate = TransferEstimate()
        patch = PatchState()
        restore = RestoreState()
        job = nil
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
        // Every way off the job screen ends the job, whether the work went
        // through or somebody walked away from it.
        if step != .job {
            stopJob()
            job = nil
        }
        self.step = step
        switch step {
        case .ready:
            pollWhileFindMyIsOn()
            lookForFinderBackup()
        case .restrictions:
            profile = ProfileState()
        case .connect, .job, .done:
            break
        }
    }

    /// Drop the job without saying anything about it. It is the demo's way out
    /// of a step it is jumping off as well as the wizard's own.
    func stopJob() {
        jobTask?.cancel()
        jobTask = nil
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

    // MARK: - The reader's own way back

    /// What the iPhone says about its own iCloud backups.
    var cloudBackups: BackupSafetyNet.Cloud {
        switch device?.cloudBackupOn {
        case true: return .on(device?.lastCloudBackup)
        case false: return .off
        case nil: return .unknown
        }
    }

    /// The one line the checks show about the backup that is the reader's own
    /// rather than this app's. It informs and never blocks: the button under
    /// it says Back up whatever this says.
    var safetyNet: BackupSafetyNet.Row {
        BackupSafetyNet.row(cloud: cloudBackups, finder: finderBackup)
    }

    /// Look in Finder's own backup folder for a backup of this iPhone.
    ///
    /// It runs off the main thread because the answer comes from the disk, and
    /// because macOS takes its time refusing a folder it protects. The answer
    /// lands back here, where the checks read it.
    func lookForFinderBackup() {
        guard let udid = device?.udid else { return }
        Task.detached(priority: .utility) { [weak self] in
            let answer = BackupSafetyNet.finderBackup(of: udid)
            await self?.looked(answer)
        }
    }

    /// The answer, back on the main thread where the checks read it.
    private func looked(_ answer: BackupSafetyNet.Finder) {
        finderBackup = answer
    }

    /// Open the Full Disk Access list in System Settings.
    ///
    /// macOS offers no way for an app to ask for that permission. There is no
    /// prompt and no callback: the app can only be refused, and the person has
    /// to add it to the list by hand and then open the app again. So the most
    /// any app can do is open the list at the right page, which is what this
    /// is.
    func openFullDiskAccessSettings() {
        guard let pane = URL(string: Self.fullDiskAccessPane) else { return }
        NSWorkspace.shared.open(pane)
    }

    private static let fullDiskAccessPane =
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles"

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

    /// True when a password is needed to read the backup this run will make.
    /// The phone decides: it encrypts what it writes, and the patch then needs
    /// the same password to open the folder.
    var needsPassword: Bool { device?.backupEncrypted == true }

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

    // MARK: - The job

    /// The phase the screen draws, which is `job` with one thing folded in.
    ///
    /// The helper moves to `.finishing` the moment the last byte is across,
    /// and from there the iPhone is the one working: it closes the snapshot,
    /// or it writes the backup over itself. This Mac can see none of that, so
    /// the bar stops claiming a figure and the line says whose work it is.
    var jobPhase: JobPhase? {
        guard let job, job == .copying || job == .restoring else { return job }
        return engine.phase == .finishing ? .finishing : job
    }

    /// How much longer the copying has, in the words the line shows. Nil while
    /// the figure has not settled, and nil in every other phase: the copying
    /// is the only piece of the job this Mac can measure.
    var estimateText: String? {
        guard jobPhase?.showsEstimate == true,
              case .about(let seconds) = estimate.reading()
        else { return nil }
        return "About \(TransferEstimate.duration(seconds)) remaining"
    }

    /// Run the whole job: the copy, the flag, the wait for Find My, the
    /// restore, the restart and the question at the end.
    ///
    /// Nothing is asked of anybody between any two of them, which is the whole
    /// point of the screen. They pressed Supervise, and the next thing they
    /// are asked for is the restrictions.
    func startJob() {
        guard udid != nil else { return }
        go(to: .job)
        runJob(from: .copy)
    }

    /// Run the job again from the piece Try Again offers.
    func retryJob(from piece: JobFailure.Retry) {
        guard step == .job else { return }
        runJob(from: piece)
    }

    /// Stop the job. While the helper has the phone it is asked to stop first
    /// and the job lands back on Ready when it does. Everywhere else there is
    /// nothing to ask and the run goes back at once.
    func cancelJob() {
        guard !engine.phase.isRunning else { return cancelTransfer() }
        stopJob()
        go(to: .ready)
    }

    func cancelTransfer() {
        engine.cancel()
    }

    private func runJob(from piece: JobFailure.Retry) {
        stopJob()
        poll?.cancel()
        errorMessage = nil
        // The first phase is written here rather than in the task, so no frame
        // is ever drawn with the phase the last attempt ended on.
        switch piece {
        case .copy: job = .copying
        case .patch: job = .preparing
        case .restore: job = .restoring
        }
        jobTask = Task { [weak self] in
            await self?.walkTheJob(from: piece)
        }
    }

    /// The order of the job, which is the order of the screen.
    private func walkTheJob(from piece: JobFailure.Retry) async {
        if piece == .copy {
            job = .copying
            do {
                try await copyTheIPhone()
            } catch {
                return fail(error, in: .copying)
            }
        }
        if piece != .restore {
            job = .preparing
            do {
                try await markTheCopy()
            } catch {
                return fail(error, in: .preparing)
            }
        }
        await waitUntilFindMyIsOff()
        guard !Task.isCancelled else { return }
        job = .restoring
        do {
            try await sendTheCopyBack()
        } catch {
            return fail(error, in: .restoring)
        }
        job = .restarting
        if await waitForPhone(until: Date().addingTimeInterval(Self.rebootTimeout)) == false {
            // A phone that is still booting is not a phone that is gone, so
            // the screen says what to do and the reading goes on underneath.
            job = .phoneGone
            guard await waitForPhone(until: nil) else { return }
            job = .restarting
        }
        job = .confirming
        let answered = await confirmWhatTheIPhoneIs()
        guard !Task.isCancelled else { return }
        restore.stage = .finished
        restore.supervisedAfterwards = isSupervised
        // Unsupervising installs no profile, so a phone that came back saying
        // what the run asked for has finished the run and the copy can go. The
        // gate is the whole of that rule.
        deleteBackupIfTheRunIsDone()
        guard answered else {
            job = .checkOnIPhone
            return
        }
        job = .done
        advance()
    }

    /// What a piece of the job that went wrong leaves on screen.
    private func fail(_ error: Error, in piece: JobFailure.Piece) {
        // A task that was cancelled was cancelled by something that has
        // already moved the run, so there is nothing to say and nowhere to go.
        if error is CancellationError { return }
        guard let failure = JobFailure.from(error, in: piece, missingSpace: missingSpace) else {
            // A stop somebody asked for is not a failure. The copy stays where
            // it is, which is the rule for every run that did not go through.
            return cancelJob()
        }
        job = .failed(failure)
    }

    /// How much room this Mac is short, in the words a person says. Nil while
    /// the free space reads fine or will not read at all.
    private var missingSpace: String? {
        let space = diskSpace
        guard space.passes == false, let free = space.free else { return nil }
        return WizardStyle.size(space.needed - free)
    }

    /// Copy the iPhone onto this Mac. The phone decides whether what it writes
    /// is encrypted; the password is only passed on.
    ///
    /// The demo replaces it with a scripted transfer that reaches no phone.
    func copyTheIPhone() async throws {
        guard let udid else { return }
        patch = PatchState()
        restore = RestoreState()
        backupFolder = nil
        let started = Date()
        transferStartedAt = started
        estimate = TransferEstimate()
        // Unlinking the 69,445 files of a leftover backup takes seconds, and
        // the helper is about to write into that very folder, so the clearing
        // finishes first.
        await clearing?.value
        let folder = try await engine.backup(
            udid: udid,
            into: Self.backupRoot,
            // The phone does the encrypting, so the password only goes down
            // when the phone says it encrypts its backups.
            password: device?.backupEncrypted == true ? secret : nil
        )
        backupFolder = folder
        measureBackup(at: folder, took: Date().timeIntervalSince(started))
    }

    /// Hold the job while the iPhone still says Find My is on.
    ///
    /// It is the one thing the restore cannot go round: Apple refuses a
    /// restore to a phone with Find My on. The hour of copying ran while
    /// somebody was turning it off, which is why the wait is here and not in
    /// front of the button.
    private func waitUntilFindMyIsOff() async {
        watcher.reload()
        while !Task.isCancelled, restoreGate == .blockedByFindMy {
            job = .waitingForFindMy
            try? await Task.sleep(for: Self.pollInterval)
            watcher.reload()
        }
    }

    /// Walk the folder the backup landed in, and write down how fast this Mac
    /// moved the bytes.
    ///
    /// The size of the folder is the only honest divisor for the rate, and the
    /// Restore step needs the same number to say how much longer sending it
    /// back will take, so one walk answers both. It runs off the main thread
    /// because a 63 GB backup is 69,445 files, and nothing on screen is waiting
    /// for the number. A folder that cannot be measured leaves the last
    /// measurement where it was.
    private func measureBackup(at folder: URL, took seconds: TimeInterval) {
        Task.detached(priority: .utility) { [weak self] in
            guard let bytes = BackupStore.size(of: folder), bytes > 0 else { return }
            TransferRate.remember(.backup, bytes: bytes, seconds: seconds)
            await self?.measured(bytes)
        }
    }

    /// The number the walk came to, back on the main thread where the Restore
    /// step reads it.
    private func measured(_ bytes: UInt64) {
        restoreBytes = bytes
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

        /// True once the patch has something to show. Until it has, the
        /// Restore step has nothing worth sending to the phone.
        var hasResult: Bool {
            WizardGate.patched(changes: changes, alreadyCorrect: alreadyCorrect, running: isRunning)
        }
    }

    /// Read the copy, unlock it when it is encrypted, write the flag and check
    /// it. All of it off the main thread: deriving the keys of an encrypted
    /// backup takes seconds.
    ///
    /// The demo replaces it with a scripted one that opens no folder.
    func markTheCopy() async throws {
        guard let folder = backupFolder else { return }
        patch = PatchState(status: "Reading the copy", isRunning: true)
        let password = secret ?? ""
        let target = direction.target
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
        } catch {
            patch = PatchState()
            throw error
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

    /// How far the restore has got.
    ///
    /// The job screen draws none of this: it has a phase of its own. This is
    /// what the delete rule and the last step read, which is why it outlives
    /// the screen that used to show it.
    enum RestoreStage: Equatable {
        /// Nothing has been sent to the phone.
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

    /// Whether the phone will take the backup back: the patch has to have
    /// written the flag first, and this is the one place Find My matters,
    /// because the iPhone refuses a restore while it is on.
    var restoreGate: WizardGate.Restore {
        WizardGate.restore(findMyOn: device?.findMyOn, patched: patch.hasResult)
    }

    /// Put the copy back on the phone and let it reboot into it.
    ///
    /// The demo replaces it with a scripted transfer that reaches no phone.
    func sendTheCopyBack() async throws {
        guard let udid, let folder = backupFolder else { return }
        // The helper has the phone from here, so the Find My poll stops rather
        // than opening a lockdown handshake of its own every three seconds.
        poll?.cancel()
        restore = RestoreState(stage: .running)
        let started = Date()
        transferStartedAt = started
        estimate = TransferEstimate()
        do {
            try await engine.restore(
                udid: udid,
                from: folder,
                password: secret,
                system: true,
                settings: true,
                reboot: true
            )
        } catch {
            restore.stage = .ready
            throw error
        }
        // The folder was walked when it was made, so the rate needs no second
        // walk of the same 69,445 files.
        if let bytes = restoreBytes {
            TransferRate.remember(.restore, bytes: bytes, seconds: Date().timeIntervalSince(started))
        }
        restore.stage = .waitingForPhone
    }

    /// Read the bus until the phone is back and has answered MCInstall again,
    /// or until `deadline`. True when it came back. A nil deadline waits for
    /// as long as the job is left running, which is what the screen offers
    /// once the quarter of an hour is up.
    ///
    /// The demo replaces it with a pause and a phone that comes back.
    func waitForPhone(until deadline: Date?) async -> Bool {
        while !Task.isCancelled {
            if let deadline, Date() >= deadline { return false }
            try? await Task.sleep(for: Self.pollInterval)
            watcher.reload()
            if device?.pairingState == .paired, cloudConfiguration != nil {
                return true
            }
        }
        return false
    }

    /// Ask the iPhone what it is now, every five seconds for three minutes,
    /// and stop at the first answer that is the one the run asked for.
    ///
    /// A phone that has just restored answers MCInstall before it has settled,
    /// and the answer before it settles is the phone as it was. So this asks
    /// again rather than believing the first thing it hears.
    ///
    /// The demo replaces it with a pause and the switches on its bar.
    func confirmWhatTheIPhoneIs() async -> Bool {
        let deadline = Date().addingTimeInterval(Self.confirmTimeout)
        while !Task.isCancelled {
            watcher.reload()
            try? await Task.sleep(for: Self.confirmInterval)
            if isSupervised == direction.target { return true }
            if Date() >= deadline { return false }
        }
        return false
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
        /// True once the phone has been read back and lists the profile the
        /// run asked for: one of ours, on, and locked or removable the way the
        /// draft said. It is what the backup delete waits for.
        var isConfirmed = false

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
        // The draft is the only thing that knows whether trial mode was asked
        // for, so what it asked for is read here and held against what the
        // phone says afterwards.
        let removalDisallowed = !draft.allowsRemoval
        errorMessage = nil
        profile = ProfileState(stage: .signing)
        Task {
            do {
                let data = try await ProfileSigner().signedProfile(for: config)
                profile.stage = .installing
                let listed = try await Self.install(data, on: udid)
                finishInstall(listed, removalDisallowed: removalDisallowed)
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
                let listed = try await Self.install(data, on: udid)
                // The file was built on the site rather than here, so this app
                // never knew whether it was asked to lock the profile down and
                // has nothing to hold the answer against. Everything else is
                // checked the same way.
                finishInstall(listed, removalDisallowed: nil)
            } catch {
                profile.stage = .ready
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Put the signed bytes on the phone and read its profile list straight
    /// back, both over one connection.
    ///
    /// The phone answering Acknowledged means it took the bytes, which is not
    /// the same as the profile being on and saying what it was asked to say,
    /// and that is the whole reason the list is read again here.
    private nonisolated static func install(
        _ data: Data,
        on udid: String
    ) async throws -> [InstalledProfile] {
        try await Task.detached(priority: .userInitiated) {
            let service = try MCInstall(udid: udid)
            try service.installProfile(data)
            return try service.profileList()
        }.value
    }

    /// Weigh what the phone lists against what the run asked for. A profile
    /// that comes back wrong is said in one sentence and keeps the backup;
    /// only a confirmed one ends the run.
    private func finishInstall(_ listed: [InstalledProfile], removalDisallowed: Bool?) {
        profile.stage = .installed
        if let problem = ProfileCheck.problem(with: listed, removalDisallowed: removalDisallowed) {
            errorMessage = problem.sentence
        } else {
            profile.isConfirmed = true
            deleteBackupIfTheRunIsDone()
        }
        // The phone lists one more profile now, so read it again for the card
        // and the summary.
        watcher.reload()
    }

    // MARK: - Taking the backup away

    /// What one attempt to take everything this Mac holds for an iPhone came
    /// to.
    enum BackupRemoval: Equatable {
        /// This Mac was holding nothing for that phone.
        case nothingThere
        case deleted
        /// Why the folder is still there, in the sentence that names it.
        case failed(String)
    }

    /// Take the backup off this Mac, once the run has done everything the
    /// backup was made for. Nothing short of that: the gate is the whole of
    /// the rule, and the hidden `--demo` path walks the same one.
    ///
    /// The whole of it goes: the folder the phone was copied into and the
    /// untouched copy the patch saved beside it. Everything they hold is back
    /// on the iPhone by now, so the copy on this Mac is redundant, and a whole
    /// copy of somebody's phone is not a thing to leave lying about.
    func deleteBackupIfTheRunIsDone() {
        guard let udid, backupFolder != nil else { return }
        guard WizardGate.backupCanGo(
            direction: direction,
            restoreFinished: restore.stage == .finished,
            supervisedAfterwards: restore.supervisedAfterwards,
            profileConfirmed: profile.isConfirmed
        ) else { return }
        Task {
            if case .failed(let sentence) = await removeBackup(of: udid) {
                backupRemovalFailure = sentence
            }
        }
    }

    /// Take everything this Mac holds for one iPhone off the disk, for good.
    ///
    /// It is the one thing in this class that deletes, so it is the one the
    /// hidden `--demo` path replaces with a method that reaches no disk. The
    /// work goes on a background task, because unlinking the 69,445 files of a
    /// 63 GB backup is not instant.
    func removeBackup(of udid: String) async -> BackupRemoval {
        let root = Self.backupRoot
        return await Task.detached(priority: .utility) {
            do {
                return try BackupStore.delete(udid: udid, root: root) ? .deleted : .nothingThere
            } catch {
                return .failed(error.localizedDescription)
            }
        }.value
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
