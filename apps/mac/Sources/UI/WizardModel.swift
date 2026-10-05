import AppKit
import Combine
import Foundation

/// Everything one run of the wizard knows: which step is on screen, which
/// iPhone it is about and whatever went wrong last.
///
/// The step order itself lives in `WizardStep`, which knows nothing about the
/// iPhone. This class holds the parts that do: it owns the device watcher and
/// the seed engine, and it runs the fast method and the profile install.
/// Every move between steps goes through `go(to:)`, so a step can never start
/// half way through.
///
/// Nothing about the iPhone is kept on this Mac: the fast method writes its
/// small seed into a temporary folder of its own and removes it again. No
/// history, and one anonymous count sent when a supervision finishes
/// (`SupervisionFinishedEvent`).
@MainActor
class WizardModel: ObservableObject {
    /// How long the iPhone is given to come back and answer after the restart,
    /// before the screen offers Check Again. The restart takes a minute or two
    /// and then waits on the passcode.
    var rebootTimeout: TimeInterval { 5 * 60 }
    /// How often the iPhone is read while the job waits for it to come back.
    var restartPollInterval: Duration { .seconds(2) }
    /// How often a locked or untrusted iPhone is read again outside the job.
    var pendingPollInterval: Duration { .milliseconds(2500) }
    /// How often the iPhone is asked what it is now, once it is back.
    var confirmInterval: Duration { .seconds(5) }
    /// How long Check Again reads for before the screen offers it again.
    var checkAgainTimeout: TimeInterval { 20 }
    /// How often the iPhone is read again while a check is waiting for it.
    private static let pollInterval = Duration.seconds(3)
    /// How often a seed operation that is still stopping is asked about again.
    private static let seedIdleInterval = Duration.milliseconds(50)
    /// How long the iPhone is given to say what it is now, once it is back on
    /// the cable. A phone that has just restored takes a minute or two to
    /// settle before it answers MCInstall with the truth.
    private static let confirmTimeout: TimeInterval = 3 * 60

    let watcher: DeviceWatcher
    let engine: BackupEngine
    let seedEngine: SeedEngine
    /// The person has said they backed up the iPhone themselves, with Finder
    /// or iCloud. No run starts until they have.
    @Published private(set) var backupConfirmed = false

    @Published private(set) var step: WizardStep = .connect
    /// The iPhone this run is about, from the moment the user picks it. Nil on
    /// the first step, where whatever is plugged in is the candidate.
    @Published private(set) var udid: String?
    /// The row picked on the Connect step while more than one iPhone is on the
    /// cable. It is only a preference: `udid` is what fixes the run.
    @Published private(set) var selectedUdid: String?
    /// What Finder's own backup folder on this Mac says about the chosen
    /// iPhone. Every run starts out not having looked, so the checks never
    /// call the folder empty, or show the last iPhone's answer, before the
    /// look they start comes back. That look is the one thing in the run that
    /// Full Disk Access buys.
    @Published private(set) var finderBackup: BackupSafetyNet.Finder = .notLooked
    /// How far the reader has got with Full Disk Access in this launch. It
    /// outlives the run, because the switch in System Settings is about the
    /// app rather than about any one iPhone.
    @Published private(set) var fullDiskAccess: BackupSafetyNet.Access = .notAsked
    /// The sentence the step on screen shows. It always comes from a
    /// `LocalizedError` of one of the layers, never from a modal alert.
    @Published private(set) var errorMessage: String?

    @Published private(set) var restore = RestoreState()
    /// Where the one long job has got to, or nil while no job is running. It
    /// is the whole of what the job screen draws.
    @Published private(set) var job: JobPhase?
    @Published private(set) var profile = ProfileState()
    /// The profile the Restrictions screen is building. It starts on the one the app
    /// has always installed and the step writes over it.
    @Published var draft = ProfileDraft.recommended
    /// What the search field over the blocked list is showing.
    @Published private(set) var appSearch = AppSearchState()

    private var relays: [AnyCancellable] = []
    private var poll: Task<Void, Never>?
    /// Reads an iPhone that is locked or waiting for Trust again, on the steps
    /// that have no poll of their own. See `followPendingDevices()`.
    private var pendingPoll: Task<Void, Never>?
    /// The job, from the first read of the iPhone to it saying what it is
    /// now. Every move off the job screen cancels it, so two of them can never
    /// run at once.
    private var jobTask: Task<Void, Never>?
    /// The keystroke being answered right now. The next one cancels it, which
    /// is what keeps a slow answer from landing under a newer term.
    private var searchTask: Task<Void, Never>?
    /// The artwork of the blocked apps, on its way in.
    private var iconTask: Task<Void, Never>?
    /// Bundle ids the store has already been asked about, so an app it does
    /// not carry is asked for once rather than on every redraw.
    private var askedForIcons = Set<String>()
    /// What the draft asked of the profile that is now downloaded on the
    /// iPhone, held from the download until the person triggers the confirm
    /// check after finishing in Settings. Nil while nothing waits to be
    /// confirmed, and nil for a profile built somewhere else, where the app
    /// never knew what was asked for.
    private var pendingRemovalDisallowed: Bool?
    /// The profile on its way to the iPhone, or the read that confirms it.
    /// Forgetting the run cancels it, so an answer that comes back after the
    /// iPhone left never lands on the screen that replaced the run.
    private var profileTask: Task<Void, Never>?
    /// True from the moment the iPhone the run is about left the cable while
    /// the helper had it, until the helper has stopped and the run has been
    /// forgotten.
    private var startOverOnceTheHelperStops = false
    /// Which run this is, counted up each time one is forgotten. The look in
    /// Finder's folder and the fast method's engine are not stopped when a run
    /// is forgotten, so each compares it before its answer lands, and none of
    /// them lands on a later run, even one about the same iPhone.
    private var run = 0
    private var jobGeneration = 0
    /// True once a read made during the restart wait has missed the iPhone or
    /// found it locked, which is what tells the iPhone after the restart from
    /// the one before it.
    @Published private var phoneLeftForRestart = false
    /// True once this run has sent the supervision setting live, on iOS 27 or
    /// later, which is when the person may tap Continue on the Restore
    /// Completed screen.
    @Published private(set) var liveConfigurationApplied = false
    private var seedOperationRun: Int?
    /// What sends the anonymous count. Nil sends nothing, which is every
    /// model but the window's own: the demo, the smoke and the tests.
    let finishedEvent: ((SupervisionFinishedEvent) -> Void)?
    /// True once this run has sent its count, so one run sends one.
    private var finishedEventSent = false
    /// The flag every run writes: true puts supervision on. False takes it
    /// off, skips the Restrictions step and sends no count, which only the
    /// debug `--debug-unsupervise` flag asks for (`DebugUnsupervise`).
    let supervises: Bool
    /// True lets the fast method run on iOS 27 and later and on an unknown
    /// version, with the default and the tag as they are. Only the debug
    /// `--debug-fast-ios27` flag asks for it (`DebugFastIOS27`).
    let allowsFastOnAnyIOS: Bool

    /// A model that watches the real USB bus, which is what the window uses.
    /// It is the only one that sends the anonymous count, and the only one
    /// that takes the key of a paid version out of the Keychain and moves the
    /// copy of iPhone an older version kept to the Trash.
    convenience init() {
        // Can be removed in a later version, with `OldSupervisionKey`.
        OldSupervisionKey.remove()
        // Can be removed in a later version, with `OldBackupCopy`.
        OldBackupCopy.removeAtLaunch()
        #if DEBUG
        let supervises = !DebugUnsupervise.isOn
        let allowsFastOnAnyIOS = DebugFastIOS27.isOn
        #else
        let supervises = true
        let allowsFastOnAnyIOS = false
        #endif
        self.init(
            watcher: DeviceWatcher(),
            engine: BackupEngine(),
            finishedEvent: SupervisionEventSender.send,
            supervises: supervises,
            allowsFastOnAnyIOS: allowsFastOnAnyIOS
        )
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
    init(
        watcher: DeviceWatcher,
        engine: BackupEngine,
        seedEngine: SeedEngine? = nil,
        finishedEvent: ((SupervisionFinishedEvent) -> Void)? = nil,
        supervises: Bool = true,
        allowsFastOnAnyIOS: Bool = false
    ) {
        self.watcher = watcher
        self.engine = engine
        self.seedEngine = seedEngine ?? SeedEngine(backupEngine: engine)
        self.finishedEvent = finishedEvent
        self.supervises = supervises
        self.allowsFastOnAnyIOS = allowsFastOnAnyIOS
        relays = [
            watcher.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            engine.objectWillChange.sink { [weak self] in self?.objectWillChange.send() },
            // Every read of the cable is checked for the iPhone the run is
            // about, so unplugging it at any step takes the window back to
            // Connect.
            watcher.$onCable.sink { [weak self] onCable in
                self?.cableRead(onCable)
            },
            engine.$phase.sink { [weak self] phase in
                self?.helperMoved(to: phase)
            },
            // Coming back from System Settings is the moment Full Disk Access
            // may have changed, and macOS says nothing else about it.
            NotificationCenter.default
                .publisher(for: NSApplication.didBecomeActiveNotification)
                .sink { [weak self] _ in
                    self?.becameActive()
                },
        ]
        followPendingDevices()
    }

    /// A model whose run is already over: an iPhone that came back on the cable
    /// saying it is supervised. It starts nothing and reads no bus, so the
    /// hidden `--ui-smoke` path can draw the last step the way it looks once a
    /// phone has been restored.
    convenience init(finished watcher: DeviceWatcher) {
        self.init(watcher: watcher)
        step = .done
        restore = RestoreState(stage: .finished)
    }

    /// A model standing in the middle of the job: the engine and the phase
    /// handed in, and nothing running. It reads no bus and sends nothing to a
    /// phone, so the hidden `--ui-smoke` path can draw each of the things the
    /// job says while the helper has the iPhone without one on the cable.
    convenience init(
        sample watcher: DeviceWatcher,
        running engine: BackupEngine,
        job: JobPhase
    ) {
        self.init(watcher: watcher, engine: engine)
        udid = watcher.devices.first?.udid
        selectedUdid = udid
        step = .job
        self.job = job
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
        var backupConfirmed = false
        var udid: String?
        var restore = RestoreState()
        /// Where the job screen is, so each of its phases can be drawn.
        var job: JobPhase?
        /// True where the restart wait has already missed the iPhone, so the
        /// line it shows for an iPhone that is back and locked can be drawn.
        var phoneLeftForRestart = false
        /// True where the setting was sent live, so the line about Continue
        /// on iPhone can be drawn.
        var liveConfigurationApplied = false
        var profile = ProfileState()
        /// What the search field over the blocked list is showing, so a step
        /// can be drawn with rows under it.
        var appSearch = AppSearchState()
        /// What Finder's backups on this Mac say, so the one line the checks
        /// show about the reader's own way back can be drawn in each of its
        /// states, the refusal included.
        var finderBackup: BackupSafetyNet.Finder = .notLooked
        /// How far the reader has got with Full Disk Access, so the refusal
        /// can be drawn both before the trip to System Settings and after one
        /// that did not take.
        var fullDiskAccess: BackupSafetyNet.Access = .notAsked
        var errorMessage: String?
    }

    /// Put this model where a sample says. It starts nothing and sends nothing
    /// to a phone: the step that is now on screen is drawn from the fields
    /// handed in, and whatever the reader presses next goes through the same
    /// wizard as ever.
    func show(_ sample: Sample) {
        step = sample.step
        backupConfirmed = sample.backupConfirmed
        udid = sample.udid
        selectedUdid = sample.udid
        restore = sample.restore
        phoneLeftForRestart = sample.phoneLeftForRestart
        liveConfigurationApplied = sample.liveConfigurationApplied
        job = sample.job
        profile = sample.profile
        appSearch = sample.appSearch
        finderBackup = sample.finderBackup
        fullDiskAccess = sample.fullDiskAccess
        errorMessage = sample.errorMessage
    }

    // MARK: - What the iPhone says

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

    /// Whether Connect offers Manage Restrictions in place of Continue: the
    /// phone is supervised already, so a supervising run has nothing to do.
    /// A run that takes supervision off starts from exactly that phone.
    var offersManageRestrictions: Bool { supervises && isSupervised == true }

    /// Why the app does not run on the iPhone this run is about, from the
    /// version it reports, or nil when it does. Only the debug
    /// `--debug-fast-ios27` flag lets every version through.
    var iosRefusal: IOSSupport.Refusal? {
        IOSSupport.refusal(iosVersion: device?.iosVersion, allowsAnyIOS: allowsFastOnAnyIOS)
    }

    /// Whether Connect shows the manual guide in place of Continue: the
    /// iPhone has trusted this Mac and been read, it says it is not
    /// supervised, and the app does not run on its iOS. A supervised one still
    /// gets Manage Restrictions, because the profile does not care how it got
    /// supervised. It follows whatever iPhone Connect has picked, so another
    /// iPhone on a version the app runs on brings Continue back.
    var showsManualGuide: Bool {
        guard let device, device.pairingState == .paired, !offersManageRestrictions,
              isSupervised != nil || !supervises
        else { return false }
        return iosRefusal != nil
    }

    /// True while Connect waits for an iPhone the app does not run on to say
    /// whether it is supervised, which decides between the guide and Manage
    /// Restrictions. MCInstall can miss a read right after Trust.
    var readsSupervisionFirst: Bool {
        guard let device, device.pairingState == .paired, supervises, isSupervised == nil else { return false }
        return iosRefusal != nil
    }

    /// What MCInstall last said about the chosen phone.
    var cloudConfiguration: CloudConfiguration? {
        guard let udid = device?.udid else { return nil }
        return watcher.cloudConfigurations[udid]
    }

    /// True while the iPhone says it is supervised. Nil while it has not been
    /// read, which is how a phone that has not trusted this Mac reads.
    var isSupervised: Bool? { cloudConfiguration?.isSupervised }

    /// The configuration profiles the chosen phone lists. Empty until it has
    /// answered, which is also how a phone that has not trusted this Mac reads.
    var installedProfiles: [InstalledProfile] {
        guard let udid = device?.udid else { return [] }
        return watcher.installedProfiles[udid] ?? []
    }

    /// The ones the app put there. The Restrictions screen asks about these before it
    /// offers to install another.
    var ourProfiles: [InstalledProfile] { installedProfiles.filter(\.isOurs) }

    /// Read the phone's profile list again, which is what the Profiles screen
    /// shows. It reuses the one read path there is: the watcher asks MCInstall
    /// for the list and parses it into `InstalledProfile`, and the screen reads
    /// what it publishes. The hidden `--demo` path overrides it, because a
    /// sample watcher reads no bus.
    func refreshInstalledProfiles() {
        watcher.reload()
    }

    /// True while something is running that stepping back would interrupt.
    var isBusy: Bool {
        engine.phase.isRunning
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

    /// Pick the iPhone on the cable, then start the checks.
    func start() {
        guard let device, device.pairingState == .paired, iosRefusal == nil else { return }
        udid = device.udid
        // Stepping back to Connect clears `udid`, so the pick is kept here as
        // well and the same phone comes back highlighted.
        selectedUdid = device.udid
        // Back to Connect keeps the answer the last iPhone got, and this one
        // may be another iPhone.
        finderBackup = .notLooked
        backupConfirmed = false
        finishedEventSent = false
        go(to: .ready)
    }

    /// Step back. The button is only offered where this changes nothing on the
    /// iPhone.
    func back() {
        // The Profiles screen is a standalone destination off Connect rather
        // than a step of the run, so stepping back from it goes to Connect.
        if step == .profiles { return closeProfiles() }
        guard let previous = step.previous else { return }
        if previous == .connect {
            udid = nil
        }
        go(to: previous)
    }

    /// Open the Profiles screen for a phone that is already supervised. It
    /// fixes the run on that phone the way `start()` does, so installing
    /// another profile has a udid to send it to.
    func manageRestrictions() {
        guard let device, device.pairingState == .paired else { return }
        udid = device.udid
        selectedUdid = device.udid
        go(to: .profiles)
    }

    /// Leave the Profiles screen for Connect. There is nothing on the iPhone to
    /// undo: the screen is a destination, not a step, so this only puts the
    /// window back on the first screen with the phone still highlighted.
    func closeProfiles() {
        udid = nil
        go(to: .connect)
    }

    /// Move on to whatever comes after the step on screen. Moving on from the
    /// job is the person pressing It's Supervised, which is the moment the
    /// supervision finished and the one moment the anonymous count is sent.
    func advance() {
        guard let next = step.next else { return }
        if step == .job, let job, WizardGate.confirmsSupervision(job) {
            sendFinishedEvent()
        }
        go(to: next)
    }

    /// Send the anonymous count for this run, once. A failure to send is
    /// never heard of here, so it cannot hold the wizard up.
    private func sendFinishedEvent() {
        guard supervises, let finishedEvent, !finishedEventSent else { return }
        finishedEventSent = true
        finishedEvent(
            SupervisionFinishedEvent(
                appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
                    ?? "unknown",
                iosVersion: device?.iosVersion,
                macosMajor: ProcessInfo.processInfo.operatingSystemVersion.majorVersion
            )
        )
    }

    /// Forget this run and ask for a phone again. It is what Done does, and
    /// what unplugging the iPhone the run is about does at any step.
    ///
    /// The demo overrides it to stop its own work as well.
    func startOver() {
        // A restore that still owes its live step restarted the iPhone
        // already, and its leaving the cable is what forgets the run here. So
        // the next wait for it does not hold for a read that misses it.
        let leftForRestart = owesLiveConfiguration
        run += 1
        poll?.cancel()
        stopJob()
        profileTask?.cancel()
        profileTask = nil
        udid = nil
        selectedUdid = nil
        backupConfirmed = false
        seedOperationRun = nil
        finishedEventSent = false
        finderBackup = .notLooked
        restore = RestoreState()
        job = nil
        profile = ProfileState()
        pendingRemovalDisallowed = nil
        draft = .recommended
        clearAppSearch()
        iconTask?.cancel()
        iconTask = nil
        askedForIcons = []
        errorMessage = nil
        phoneLeftForRestart = leftForRestart
        liveConfigurationApplied = false
        step = .connect
        watcher.reload()
    }

    /// Act on one read of the cable. `WizardGate.lostPhone` is the whole of
    /// the rule; this only carries it out.
    ///
    /// While the helper has the iPhone it is not dropped mid-flight, which
    /// would leave it running with nobody listening: it is told to stop the
    /// way Cancel tells it, and `helperMoved(to:)` forgets the run once it
    /// has.
    private func cableRead(_ onCable: [String]) {
        guard !startOverOnceTheHelperStops else { return }
        switch WizardGate.lostPhone(
            picked: udid,
            onCable: onCable,
            step: step,
            job: job,
            helperRunning: engine.phase.isRunning
        ) {
        case .carryOn:
            return
        case .startOver:
            startOver()
        case .stopTheHelperFirst:
            startOverOnceTheHelperStops = true
            cancelTransfer()
        }
    }

    /// Forget the run the moment a helper that was told to stop has stopped.
    ///
    /// It runs as the engine writes its last phase, before the job hears how
    /// the helper ended, so the job finds itself cancelled and says nothing
    /// on a screen that is no longer its own.
    private func helperMoved(to phase: BackupEngine.Phase) {
        guard startOverOnceTheHelperStops, !phase.isRunning else { return }
        startOver()
    }

    /// The one way a step changes. A step that starts something of its own
    /// starts it here, so entering it twice cannot leave two runs going.
    private func go(to step: WizardStep) {
        poll?.cancel()
        pendingPoll?.cancel()
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
            refreshReadyChecks()
        case .restrictions:
            profile = ProfileState()
        case .profiles:
            profile = ProfileState()
            refreshInstalledProfiles()
        case .connect, .job, .done:
            break
        }
        // Ready reads on its own poll and the job on its own waits, and the
        // job's helper has the iPhone to itself.
        if step != .ready, step != .job { followPendingDevices() }
    }

    /// Read the cable again every few seconds while an iPhone on it is locked,
    /// waits for Trust or could not be read. A locked iPhone sends nothing
    /// when it is unlocked: usbmuxd cannot listen to a phone that has not
    /// been unlocked since it started, so without this the screen would say
    /// "Unlock iPhone." until the cable was pulled. Nothing is read while
    /// every iPhone is paired or the cable is empty.
    private func followPendingDevices() {
        pendingPoll = Task { [weak self] in
            while !Task.isCancelled {
                guard let interval = self?.pendingPollInterval else { return }
                try? await Task.sleep(for: interval)
                guard let self, !Task.isCancelled else { return }
                // A paired iPhone the app does not run on whose supervision
                // was not read sends no event either, and it decides between
                // the guide and Manage Restrictions.
                if self.watcher.hasPendingDevice || (self.step == .connect && self.readsSupervisionFirst) {
                    self.watcher.reload()
                }
            }
        }
    }

    /// Drop the job without saying anything about it. It is the demo's way out
    /// of a step it is jumping off as well as the wizard's own.
    ///
    /// A helper that was told to stop because its iPhone left belongs to the
    /// job being dropped, so the run no longer waits on it to start over.
    func stopJob() {
        jobGeneration += 1
        seedEngine.cancel()
        jobTask?.cancel()
        jobTask = nil
        startOverOnceTheHelperStops = false
    }

    // MARK: - Checks

    /// Keep the Ready screen's checks fresh for as long as the wizard sits on
    /// it. Every three seconds it reads the iPhone again (`watcher.reload()`,
    /// which refreshes Find My, the iCloud backup date and the rest) and
    /// re-reads Finder's own backup folder, so a backup made in Finder or on
    /// the phone while the reader waits here is seen without walking away and
    /// back. Find My is read the same way, so the tick on the checks turns
    /// green and the Supervise button turns on the moment it reads off.
    ///
    /// The first read happens at once, so the screen is not blank for three
    /// seconds. The loop runs the whole time the step is `.ready`, not just
    /// while Find My is on: `go(to:)` cancels it on every move, so only the
    /// step that started it is ever the one waiting.
    private func refreshReadyChecks() {
        poll = Task { [weak self] in
            self?.watcher.reload()
            self?.lookForFinderBackup()
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.pollInterval)
                guard let self, !Task.isCancelled else { return }
                self.watcher.reload()
                self.lookForFinderBackup()
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
    /// rather than the app's. It informs and never blocks: the button under
    /// it says Back up whatever this says.
    var safetyNet: BackupSafetyNet.Row {
        BackupSafetyNet.row(cloud: cloudBackups, finder: finderBackup, access: fullDiskAccess)
    }

    /// Look in Finder's own backup folder for a backup of the iPhone.
    ///
    /// `returning` is a look made because the app came back in front, which
    /// is the one look that can tell whether a trip to System Settings
    /// worked. The answer lands back here, where the checks read it.
    func lookForFinderBackup(returning: Bool = false) {
        guard let udid = device?.udid else { return }
        let run = self.run
        Task { [weak self] in
            guard let answer = await self?.readFinderBackup(of: udid) else { return }
            // Another iPhone picked, or the run forgotten, while the folder
            // was read: the answer belongs to checks no longer on screen.
            guard let self, self.device?.udid == udid, self.run == run else { return }
            self.looked(answer, returning: returning)
        }
    }

    /// What Finder's own backup folder says about one iPhone. It runs off the
    /// main thread because the answer comes from the disk, and because macOS
    /// takes its time refusing a folder it protects.
    ///
    /// The demo replaces it with the answer its bar is set to.
    func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder {
        await Task.detached(priority: .utility) {
            BackupSafetyNet.finderBackup(of: udid)
        }.value
    }

    /// The answer, back on the main thread where the checks read it.
    private func looked(_ answer: BackupSafetyNet.Finder, returning: Bool) {
        finderBackup = answer
        if returning {
            fullDiskAccess = BackupSafetyNet.access(fullDiskAccess, afterReturningTo: answer)
        }
    }

    /// The app is in front again. On the checks that is when Finder's folder
    /// is looked at again, at once rather than on the next poll, because the
    /// likeliest reason the app was away is System Settings.
    private func becameActive() {
        guard step == .ready else { return }
        lookForFinderBackup(returning: true)
    }

    /// Open the Full Disk Access list in System Settings.
    ///
    /// macOS offers no way for an app to ask for that permission. There is no
    /// prompt and no callback: the app can only be refused, and the person has
    /// to switch it on in the list by hand. So the most any app can do is open
    /// the list at the right page and look again when it is back in front,
    /// which `becameActive()` does.
    func openFullDiskAccessSettings() {
        guard let pane = URL(string: Self.fullDiskAccessPane) else { return }
        fullDiskAccess = .askedInSettings
        NSWorkspace.shared.open(pane)
    }

    private static let fullDiskAccessPane =
        "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"

    /// Quit the app and open it again, which is when macOS can apply a Full
    /// Disk Access switch turned on while the app was running.
    ///
    /// The new copy is opened by a shell that waits for this process to be
    /// gone first, so the two never run side by side and the new one is a
    /// fresh process in the eyes of macOS. A shell that will not start leaves
    /// the app open rather than closing it for nothing. The button that calls
    /// this is only on the checks, where nothing has reached the iPhone yet.
    ///
    /// The demo replaces it with a launch that never leaves the window.
    func reopenApp() {
        let waiter = Process()
        waiter.executableURL = URL(fileURLWithPath: "/bin/sh")
        // The process id and the app's path ride in as arguments rather than
        // inside the script, so a space in the app's name needs no quoting.
        waiter.arguments = [
            "-c",
            "while /bin/kill -0 \"$1\" 2>/dev/null; do /bin/sleep 0.2; done; exec /usr/bin/open \"$2\"",
            "reopen",
            String(ProcessInfo.processInfo.processIdentifier),
            Bundle.main.bundlePath,
        ]
        do {
            try waiter.run()
        } catch {
            return
        }
        NSApp.terminate(nil)
    }

    /// Every check that can be read says yes.
    ///
    /// A run needs the tick that says the person backed up the iPhone
    /// themselves and an iOS version the app runs on, and waits while Find My
    /// is on.
    var checksPass: Bool {
        guard backupConfirmed, iosRefusal == nil else { return false }
        return WizardGate.checksPass(findMyOn: device?.findMyOn)
    }

    /// Take the tick that says the person backed up the iPhone themselves.
    func confirmBackup(_ confirmed: Bool) {
        guard step == .ready, !isBusy else { return }
        backupConfirmed = confirmed
    }

    // MARK: - The job

    /// The phase the screen draws, which is `job` with one thing folded in.
    ///
    /// The helper moves to `.finishing` the moment the last byte is across,
    /// and from there the iPhone is the one working. This Mac can see none of
    /// that, so the bar stops claiming a figure and the line says whose work
    /// it is.
    var jobPhase: JobPhase? {
        guard let job, job == .restoring else { return job }
        return engine.phase == .finishing ? .finishing : job
    }

    /// Run the whole job: the version check, the wait for Find My, the
    /// restore, the restart and the question at the end.
    ///
    /// Nothing is asked of anybody between any two of them, which is the whole
    /// point of the screen. They pressed Supervise, and the next thing they
    /// are asked for is the restrictions.
    func startJob() {
        guard udid != nil else { return }
        guard backupConfirmed else { return }
        if let iosRefusal {
            errorMessage = iosRefusal.message
            return
        }
        guard !isBusy else { return }
        go(to: .job)
        runJob(from: hasAppliedSeed ? .restore : .start)
    }

    /// Run the job again from the piece Try Again offers.
    func retryJob(from piece: JobFailure.Retry) {
        guard step == .job else { return }
        runJob(from: piece)
    }

    /// Stop the job. While the helper has the iPhone it is asked to stop first
    /// and the job lands back on Ready when it does. Everywhere else there is
    /// nothing to ask and the run goes back at once.
    func cancelJob() {
        guard !engine.phase.isRunning else { return cancelTransfer() }
        stopJob()
        restore.stage = .ready
        go(to: .ready)
    }

    func cancelTransfer() {
        seedEngine.cancel()
    }

    private func runJob(from piece: JobFailure.Retry) {
        stopJob()
        poll?.cancel()
        errorMessage = nil
        // A restore that still owes its live step restarted the iPhone
        // already, so what an earlier wait saw of that restart still holds.
        phoneLeftForRestart = owesLiveConfiguration && phoneLeftForRestart
        liveConfigurationApplied = false
        // The first phase is written here rather than in the task, so no frame
        // is ever drawn with the phase the last attempt ended on.
        if owesLiveConfiguration {
            job = .awaitingLiveConfiguration
        } else {
            switch piece {
            case .start: job = .preparing
            case .restore: job = .restoring
            }
        }
        jobTask = Task { [weak self] in
            await self?.walkTheJob(from: piece)
        }
    }

    /// The order of the job, which is the order of the screen.
    ///
    /// Try Again from the restore and from the start walk the same way: the
    /// iPhone is read again, and a restore the iPhone has already taken is
    /// only restarted, never sent twice.
    ///
    /// A restore on iOS 27 or later that still owes its live step gets that
    /// step and nothing else: no restart and no second restore. The iPhone is
    /// on the Restore Completed screen and may not answer yet, so nothing is
    /// read from it first either.
    private func walkTheJob(from piece: JobFailure.Retry) async {
        if owesLiveConfiguration {
            restore = RestoreState(stage: .waitingForPhone)
            return await finishAfterRestart(waiting: rebootTimeout)
        }
        do {
            guard let udid else { return }
            try await verifyFastSupportsIOS(udid: udid)
            try Task.checkCancellation()
        } catch {
            return fail(error, in: .preparing)
        }
        await waitUntilFindMyIsOff()
        guard !Task.isCancelled else { return }
        do {
            try await sendSeedConfiguration(restartingOnly: hasAppliedSeed)
        } catch {
            return fail(error, in: .restoring)
        }
        guard !Task.isCancelled else { return }
        // The last read still says the iPhone is here, because it was made
        // before the restart. The wait holds until a read has missed it.
        phoneLeftForRestart = false
        await finishAfterRestart(waiting: rebootTimeout)
    }

    /// Look for the iPhone again from the screen that says it did not come
    /// back. Nothing is sent to it and it is not restarted: this is the end of
    /// the job alone, the read and what follows it.
    func checkPhoneAgain() {
        guard step == .job, job == .phoneGone else { return }
        stopJob()
        // Written here rather than in the task, as the first phase of a job
        // is, so no frame is drawn between the press and the read.
        job = restartWaitPhase
        jobTask = Task { [weak self] in
            guard let self else { return }
            await self.finishAfterRestart(waiting: self.checkAgainTimeout)
        }
    }

    /// The end of the job, from the restart on: wait for the iPhone, ask it
    /// what it is, and put the question to the person.
    ///
    /// On iOS 27 or later the iPhone comes back on the Restore Completed
    /// screen, not supervised, and the restore still owes its live step. The
    /// wait is the same one, paired again and MCInstall answering, and the
    /// step runs between the wait and the ask.
    private func finishAfterRestart(waiting timeout: TimeInterval) async {
        job = restartWaitPhase
        if await waitForPhone(until: Date().addingTimeInterval(timeout)) == false {
            // A wait cut short by Cancel has moved the run already, and a
            // phase written now would land on the step that replaced it.
            guard !Task.isCancelled else { return }
            // A phone that is still booting is not a phone that is gone, so
            // the screen says what to do and the reading goes on underneath.
            // After this long an iPhone that answers is one that is back,
            // whether or not a read ever missed it.
            DeviceLog.logger.notice("restart wait: timed out, offering Check Again")
            job = .phoneGone
            phoneLeftForRestart = true
            guard await waitForPhone(until: nil), !Task.isCancelled else { return }
            job = restartWaitPhase
        }
        guard !Task.isCancelled else { return }
        if owesLiveConfiguration {
            // The restore is not forgotten before this went through: a step
            // that failed is tried again alone, with no second restore.
            let run = self.run
            do {
                try await applyLiveConfiguration()
            } catch {
                return fail(error, in: .restoring)
            }
            // The setting is on the iPhone, so the restore is over, also for
            // a job that was stopped in the meantime and started again.
            seedEngine.forgetAppliedRestore()
            if self.run == run { liveConfigurationApplied = true }
            guard !Task.isCancelled else { return }
        } else {
            // The iPhone restarted and is back, so the restart is no longer
            // what is missing. Another try sends the configuration again.
            seedEngine.forgetAppliedRestore()
        }
        job = .confirming
        // The Mac's read after a reboot is unreliable, so it no longer decides
        // the run. It settles the phone and tunes the wording, and the person
        // is always shown the confirm-supervision gate before the restrictions
        // are installed.
        let reportedSupervised = await confirmWhatTheIPhoneIs()
        guard !Task.isCancelled else { return }
        let supervisedRead = isSupervised.map { "\($0)" } ?? "not read"
        DeviceLog.logger.notice(
            "restart check: supervised \(supervisedRead, privacy: .public), run wants \(self.supervises, privacy: .public)"
        )
        if allowsFastOnAnyIOS, let udid {
            let setup = await readSetupState(udid: udid)
            DeviceLog.logger.notice("restart check: \(setup, privacy: .public)")
        }
        restore.stage = .finished
        guard supervises else { return endUnsupervising(confirmed: reportedSupervised) }
        // Their tap on "It's Supervised" is what advances to Restrictions.
        job = .checkOnIPhone(reportedSupervised: reportedSupervised)
        // The restore no longer has the phone. An unplug while it did was let
        // pass, and nothing reads the cable again on this screen, so the last
        // read is weighed now.
        cableRead(watcher.onCable)
    }

    /// The end of a run that took supervision off. An unsupervised iPhone
    /// refuses the profile, so there is no Restrictions step and no question
    /// to ask: the iPhone saying it is not supervised is the end.
    private func endUnsupervising(confirmed: Bool) {
        guard confirmed else {
            job = .failed(.stillSupervised)
            return
        }
        go(to: .done)
        cableRead(watcher.onCable)
    }

    /// Read the connected phone, rather than trusting the Ready screen's cache.
    /// The demo and routing tests override this read and never open a device.
    func readDeviceIOSVersion(udid: String) async throws -> String? {
        guard engine.canRunHelper else { throw BackupError.failed("This engine runs nothing.") }
        return try await Task.detached { try SeedDevice.iosVersion(udid: udid) }.value
    }

    /// What the iPhone says about its activation and Setup Assistant after a
    /// fast run under `--debug-fast-ios27`, for the log alone. The demo and
    /// the tests run an engine that runs nothing, so nothing is read there.
    func readSetupState(udid: String) async -> String {
        guard engine.canRunHelper else { return "setup state not read" }
        return await Task.detached { SeedDevice.setupState(udid: udid) }.value
    }

    /// The run is held to a version the app runs on, read fresh from the
    /// iPhone rather than from the Ready screen's cache. It is the guard
    /// behind the guide screen on Connect, and `SeedEngine` reads it again.
    private func verifyFastSupportsIOS(udid: String) async throws {
        let version = try await readDeviceIOSVersion(udid: udid)
        try Task.checkCancellation()
        DeviceLog.logger.notice("fast check: iOS \(version ?? "not given", privacy: .public)")
        if let refusal = IOSSupport.refusal(iosVersion: version) {
            guard allowsFastOnAnyIOS else { throw SeedRunError.refused(refusal) }
            DeviceLog.logger.notice("fast check: \(String(describing: refusal), privacy: .public) let through by the debug flag")
        }
    }

    private var hasAppliedSeed: Bool {
        seedOperationRun == run && seedEngine.restoreApplied && seedEngine.restoredUDID == udid
    }

    /// True while a restore on iOS 27 or later still owes its live step on
    /// this iPhone. A restart is no part of that path, and neither is a second
    /// restore.
    ///
    /// The engine holds it and no run does: Cancel, and the iPhone leaving
    /// the cable for its restart, forget the run, and the iPhone still waits
    /// for the setting. It ends when the setting went through, when a run on
    /// another iPhone starts, or with the app.
    private var owesLiveConfiguration: Bool {
        udid != nil && seedEngine.liveConfigurationOwed && seedEngine.restoredUDID == udid
    }

    /// The phase the wait for the iPhone runs under.
    private var restartWaitPhase: JobPhase {
        owesLiveConfiguration ? .awaitingLiveConfiguration : .restarting
    }

    /// The phase relay belongs only to this operation and this run.
    func sendSeedConfiguration(restartingOnly: Bool) async throws {
        guard let udid else { return }
        let run = self.run
        let generation = jobGeneration
        seedOperationRun = run
        poll?.cancel()
        restore = RestoreState(stage: .running)
        let relay = seedEngine.$phase.sink { [weak self] phase in
            guard let self, self.run == run, self.jobGeneration == generation, self.udid == udid, self.step == .job else { return }
            switch phase {
            case .preparing: self.job = .preparing
            case .restoring: self.job = .restoring
            case .restarting, .done: self.job = .restarting
            case .awaitingLiveConfiguration: self.job = .awaitingLiveConfiguration
            case .applyingLiveConfiguration: self.job = .applyingLiveConfiguration
            case .idle, .cancelled, .failed: break
            }
        }
        defer { relay.cancel() }
        do {
            // A run that was just stopped can still have a read of the iPhone
            // out, and the engine runs one operation at a time.
            while seedEngine.running {
                try await Task.sleep(for: Self.seedIdleInterval)
            }
            if restartingOnly {
                try await seedEngine.restart(udid: udid, allowsFastOnAnyIOS: allowsFastOnAnyIOS)
            } else {
                try await seedEngine.supervise(
                    udid: udid, supervised: supervises, allowsFastOnAnyIOS: allowsFastOnAnyIOS
                )
            }
            try Task.checkCancellation()
        } catch {
            if self.run == run, self.jobGeneration == generation, self.udid == udid { restore.stage = .ready }
            throw error
        }
        guard self.run == run, self.jobGeneration == generation, self.udid == udid else { return }
        restore.stage = .waitingForPhone
    }

    /// Send the supervision setting live, the step a restore on iOS 27 or
    /// later owes once the iPhone is back and paired. It is that step alone:
    /// nothing is restored and nothing is restarted.
    func applyLiveConfiguration() async throws {
        guard let udid else { return }
        let run = self.run
        let generation = jobGeneration
        job = .applyingLiveConfiguration
        do {
            // A run that was just stopped can still have a read of the iPhone
            // out, and the engine runs one operation at a time.
            while seedEngine.running {
                try await Task.sleep(for: Self.seedIdleInterval)
            }
            try await seedEngine.applyLiveConfiguration(udid: udid, supervised: supervises)
        } catch {
            if self.run == run, self.jobGeneration == generation, self.udid == udid { restore.stage = .ready }
            throw error
        }
    }

    /// What a piece of the job that went wrong leaves on screen.
    private func fail(_ error: Error, in piece: JobFailure.Piece) {
        // A task that was cancelled was cancelled by something that has
        // already moved the run, so there is nothing to say and nowhere to go.
        // That holds whatever the helper threw on its way out, which is how a
        // run forgotten because its iPhone left the cable ends.
        if error is CancellationError || Task.isCancelled { return }
        guard let failure = JobFailure.from(error, in: piece) else {
            // A stop somebody asked for is not a failure.
            return cancelJob()
        }
        job = .failed(failure)
    }

    /// Hold the job while the iPhone still says Find My is on.
    ///
    /// It is the one thing the restore cannot go round: Apple refuses a
    /// restore to a phone with Find My on. The Supervise button already waited
    /// for it to be off, so this is the safety net for a phone where it was
    /// turned back on since, or one that would not say before. A phone that
    /// will not say goes through, and refuses the restore itself if it has to.
    private func waitUntilFindMyIsOff() async {
        watcher.reload()
        while !Task.isCancelled, device?.findMyOn == true {
            job = .waitingForFindMy
            try? await Task.sleep(for: Self.pollInterval)
            watcher.reload()
        }
    }

    // MARK: - Restore

    /// How far the restore has got.
    ///
    /// The job screen draws none of this: it has a phase of its own. This is
    /// what `isBusy` reads.
    enum RestoreStage: Equatable {
        /// Nothing has been sent to the iPhone.
        case ready
        case running
        /// The files are back on the iPhone and it is restarting.
        case waitingForPhone
        case finished
    }

    struct RestoreState {
        var stage: RestoreStage = .ready
    }

    /// Read the iPhone every two seconds until it is back and has answered
    /// MCInstall again, or until `deadline`. True when it came back. A nil
    /// deadline waits for as long as the job is left running, which is what
    /// goes on under the screen that offers Check Again.
    ///
    /// It asks for a read itself and waits on no connect or disconnect: an
    /// iPhone that restarts is back on the cable before it will answer, and
    /// nothing is heard from the cable when it starts to. Only a read that
    /// landed after the wait began counts, and only once a read has missed
    /// the iPhone, because the answer from before the restart looks the same
    /// as the one after it.
    ///
    /// The demo replaces it with a pause and a phone that comes back.
    func waitForPhone(until deadline: Date?) async -> Bool {
        var seen = watcher.passes
        while !Task.isCancelled {
            if let deadline, Date() >= deadline { return false }
            watcher.reload()
            try? await Task.sleep(for: restartPollInterval)
            guard watcher.passes > seen else { continue }
            seen = watcher.passes
            let readable = device?.pairingState == .paired
            if !readable {
                if !phoneLeftForRestart {
                    DeviceLog.logger.notice("restart wait: iPhone left or is not readable")
                }
                phoneLeftForRestart = true
            } else if phoneLeftForRestart, cloudConfiguration != nil {
                DeviceLog.logger.notice("restart wait: iPhone is back and paired")
                return true
            }
        }
        return false
    }

    /// What the restart wait asks of the person, from what the last read of
    /// the iPhone said.
    var restartHint: String {
        JobPhase.restartHint(pairing: phoneLeftForRestart ? device?.pairingState : nil)
    }

    /// The one thing missing once the iPhone is back on the cable in the
    /// wait of a run on iOS 27 or later. Nil while it is away, where the
    /// steps on screen already say all of it.
    var restoreCompletedHint: String? {
        guard phoneLeftForRestart, let pairing = device?.pairingState else { return nil }
        return JobPhase.restartHint(pairing: pairing)
    }

    /// What the job screen says about Continue on the Restore Completed
    /// screen under `phase`, `JobPhase.restoreCompletedLine`.
    func restoreCompletedLine(for phase: JobPhase) -> String? {
        JobPhase.restoreCompletedLine(
            for: phase, owed: owesLiveConfiguration, applied: liveConfigurationApplied
        )
    }

    /// Ask the iPhone what it is now, every five seconds for three minutes,
    /// and stop at the first answer that is the one the run asked for:
    /// supervised, or not supervised on a run that takes it off.
    ///
    /// A phone that has just restored answers MCInstall before it has settled,
    /// and the answer before it settles is the iPhone as it was. So this asks
    /// again rather than believing the first thing it hears.
    ///
    /// The demo replaces it with a pause and the switches on its bar.
    func confirmWhatTheIPhoneIs() async -> Bool {
        let deadline = Date().addingTimeInterval(Self.confirmTimeout)
        while !Task.isCancelled {
            watcher.reload()
            try? await Task.sleep(for: confirmInterval)
            if isSupervised == supervises { return true }
            if Date() >= deadline { return false }
        }
        return false
    }

    // MARK: - Profile

    enum ProfileStage: Equatable {
        case ready
        /// The site is turning the configuration into signed bytes.
        case signing
        /// The signed bytes are going over the cable, which puts the profile on
        /// the iPhone as a download rather than as something installed.
        case sending
        /// On the iPhone as a downloaded profile now: the person turns it on in
        /// Settings and then confirms. `Guide` is which words the screen shows.
        case guide(Guide)
        /// Reading the iPhone's profile list back to confirm the install, which
        /// needs the iPhone unlocked.
        case checking
    }

    /// Which words the "Finish on iPhone" guide shows, one for each thing the
    /// person needs to hear after the profile is downloaded.
    enum Guide: Equatable {
        /// Just downloaded: the whole how-to.
        case downloaded
        /// The confirm read saw nothing, so the iPhone is likely locked or
        /// still settling.
        case locked
        /// The read worked and the iPhone has not turned the profile on yet.
        case notInstalled
    }

    struct ProfileState {
        var stage: ProfileStage = .ready
        /// The file the user picked, when the profile came from one. Nil when
        /// the app built it.
        var fileName: String?

        /// True while something is on its way to the site or the iPhone, or
        /// while the iPhone is being read back. The guide waits on the person,
        /// so it is not one of these.
        var isRunning: Bool { stage == .signing || stage == .sending || stage == .checking }
    }

    /// What the Restrictions screen installs: the apps on the draft's list, the sites
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

    /// Sign the draft and put it on the iPhone as a downloaded profile. This is
    /// the Restrictions step of a run: the confirm check that the person
    /// triggers next ends the run once the iPhone lists it.
    ///
    /// The download is the whole of what this Mac can do here. The profile is
    /// not real MDM, so `InstallProfile` only puts it on the iPhone as a
    /// download; the person turns it on in Settings. So a good send is treated
    /// as downloaded, not installed, and the guide asks them to finish it.
    func signAndInstallProfile() {
        downloadProfile()
    }

    /// Put another profile on a phone that is already supervised, from the
    /// Profiles screen. The same download as the run, but the confirm check
    /// that follows reads the list back and leaves the screen up for another
    /// rather than ending a run.
    func installMoreProfile() {
        downloadProfile()
    }

    /// Have the site sign the draft and send it over the cable, which downloads
    /// it onto the iPhone. The signing certificate never leaves the site, so
    /// the bytes make one round trip and go straight to the iPhone; nothing is
    /// written to disk.
    ///
    /// It only ever runs from the Install button, never from a redraw. A good
    /// send moves to the guide, which asks the person to turn the profile on in
    /// Settings; it does not read the iPhone back, because that read needs the
    /// iPhone unlocked and the profile is not on yet. Only a real send failure
    /// is a hard failure.
    private func downloadProfile() {
        guard let udid, !profile.isRunning else { return }
        let config = profileConfig
        // The draft is the only thing that knows whether trial mode was asked
        // for. What it asked for is held here and weighed against what the
        // iPhone lists when the person confirms.
        pendingRemovalDisallowed = !draft.allowsRemoval
        errorMessage = nil
        profile = ProfileState(stage: .signing)
        profileTask = Task {
            do {
                let data = try await ProfileSigner().signedProfile(for: config)
                // A run forgotten while the site signed sends nothing.
                try Task.checkCancellation()
                profile.stage = .sending
                try await Self.send(data, on: udid)
                try Task.checkCancellation()
                // On the iPhone as a download now, not installed: the person
                // turns it on in Settings and then confirms.
                profile.stage = .guide(.downloaded)
            } catch {
                guard !Task.isCancelled else { return }
                profile.stage = .ready
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Put the signed bytes on the iPhone over one connection. The iPhone
    /// answering Acknowledged means it took the bytes as a download, which is
    /// not the same as the profile being on: that is the person's to finish in
    /// Settings, and `confirmProfileInstalled` is what reads it back.
    private nonisolated static func send(_ data: Data, on udid: String) async throws {
        try await Task.detached(priority: .userInitiated) {
            try MCInstall(udid: udid).installProfile(data)
        }.value
    }

    /// Read the iPhone back once the person says they finished the install in
    /// Settings, and act on what it lists. It only reads: the profile is never
    /// sent again here.
    ///
    /// The read needs the iPhone unlocked. A read that saw nothing is not a
    /// failure but a nudge to unlock and try again, and an iPhone that answered
    /// without the profile is a nudge to finish it in Settings. Only a
    /// confirmed one moves the run on.
    func confirmProfileInstalled() {
        guard let udid, case .guide = profile.stage else { return }
        let asked = pendingRemovalDisallowed
        let advancing = step == .restrictions
        errorMessage = nil
        profile.stage = .checking
        profileTask = Task {
            let read = await readInstalledProfiles(udid: udid)
            // A run forgotten while the iPhone was read must not be moved on.
            guard !Task.isCancelled else { return }
            switch ProfileCheck.confirmation(read: read, removalDisallowed: asked) {
            case .installed:
                profileConfirmed(advancing: advancing)
            case .notInstalled:
                profile.stage = .guide(.notInstalled)
                refreshInstalledProfiles()
            case .locked:
                profile.stage = .guide(.locked)
            }
        }
    }

    /// The iPhone's profile list, or nil when the read threw, which a locked
    /// iPhone does. It reaches the iPhone, so the hidden `--demo` path overrides
    /// it to answer from its own world.
    func readInstalledProfiles(udid: String) async -> [InstalledProfile]? {
        await Task.detached(priority: .userInitiated) {
            try? MCInstall(udid: udid).profileList()
        }.value
    }

    /// What a confirmed install does. On the Restrictions step of a run
    /// (`advancing`) there is nothing left to press, so the last screen comes
    /// up by itself. On the Profiles screen there is no run to
    /// end, so the list is read again and the builder is left up for another.
    private func profileConfirmed(advancing: Bool) {
        pendingRemovalDisallowed = nil
        guard advancing else {
            profile = ProfileState()
            refreshInstalledProfiles()
            return
        }
        refreshInstalledProfiles()
        advance()
    }

    /// Put the summary back after a download that did not take, which is what
    /// Cancel does on that screen. The draft is left alone, so pressing
    /// Install again sends the same profile.
    func forgetProfileFailure() {
        profile = ProfileState()
        errorMessage = nil
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
