#if DEBUG
import Foundation

/// The wizard, run against an iPhone that is not there.
///
/// It is the model the window always has. What changes is the other end of it:
/// every method that would reach a phone, the helper or the site is replaced
/// by one that waits the moment the real thing would take and then says what
/// the demo was asked to say. The steps, the stage
/// machine, the gates and every sentence on screen are the ones that ship.
///
/// Nothing in this file opens a file, starts a process or makes a request. It
/// is also built on sample parts, so a method missed here would still find
/// nothing to reach: a sample watcher reads no bus and a sample engine refuses
/// to start the helper.
@MainActor
final class DemoWizardModel: WizardModel {
    /// The hidden `--demo` flag. Without it the app builds the model it always
    /// has, against the real bus.
    static func ifAsked(_ arguments: [String] = CommandLine.arguments) -> DemoWizardModel? {
        arguments.contains("--demo") ? DemoWizardModel() : nil
    }

    /// What the demo says is true. The bar writes to it, and every change goes
    /// straight to the watcher, so the window redraws as the reader flips a
    /// switch.
    var conditions = DemoConditions() {
        willSet { objectWillChange.send() }
        didSet {
            applyConditions()
            // The Finder switch also says how far the reader has got with
            // Full Disk Access, so flipping it starts that over.
            if conditions.finderBackups != oldValue.finderBackups {
                showFullDiskAccess(DemoWorld.fullDiskAccess(conditions))
            }
        }
    }

    /// The install running right now. A jump cancels it, so two of them can
    /// never run at once.
    private var work: Task<Void, Never>?
    /// Profiles the demo has installed from the Profiles screen this session,
    /// on top of whatever the conditions say the phone already lists. Reset
    /// clears them.
    private var addedProfiles: [InstalledProfile] = []
    /// True between Cancel and the helper stopping, so a second press does not
    /// start a second wait.
    private var cancelling = false

    /// How often a running restore redraws.
    private static let tick = Duration.milliseconds(100)
    /// How much longer the restore takes when the bar asks for a long job:
    /// about two minutes, long enough for the cost story under the bar to go
    /// round.
    private static let longJobStretch: TimeInterval = 12
    /// The restart, and the question the wizard asks once the phone is back.
    private static let restartPause = Duration.seconds(3)
    private static let confirmPause = Duration.seconds(2)
    /// How long the helper takes to stop after Cancel.
    private static let cancelPause = Duration.milliseconds(1500)
    /// How long the site takes to sign, and the iPhone to take the bytes.
    private static let signingPause = Duration.milliseconds(1200)
    private static let installPause = Duration.milliseconds(1600)

    init() {
        super.init(
            watcher: DeviceWatcher(sample: []),
            engine: BackupEngine(sample: .idle, progress: 0)
        )
        applyConditions()
    }

    // MARK: - The world the demo says is there

    /// Hand the conditions to the parts of the wizard that read the world.
    private func applyConditions() {
        var profiles = DemoWorld.installedProfiles(conditions)
        if !addedProfiles.isEmpty {
            profiles[DemoWorld.udid, default: []].append(contentsOf: addedProfiles)
        }
        watcher.show(
            devices: DemoWorld.devices(conditions),
            cloudConfigurations: DemoWorld.cloudConfigurations(conditions),
            installedProfiles: profiles
        )
        lookForFinderBackup()
    }

    /// The real model reads Finder's backup folder here, which macOS protects.
    /// The demo reads nothing: the answer is the switch on the bar, which is
    /// also the only way to see the Full Disk Access line without taking that
    /// permission away from a real Mac. The look around it is the wizard's
    /// own, so coming back from System Settings to a switch that still says
    /// No access reads the way it does on a real Mac.
    override func readFinderBackup(of udid: String) async -> BackupSafetyNet.Finder {
        DemoWorld.finderBackup(conditions)
    }

    /// The real model quits and opens the app again, which is when macOS can
    /// apply Full Disk Access. The demo cannot reopen itself without leaving
    /// demo mode, so it stands for the launch that follows instead: the
    /// reopen the switch was waiting on lets the app see a backup on this
    /// Mac, and a reader who never switched it on is asked again.
    override func reopenApp() {
        showFullDiskAccess(.notAsked)
        if conditions.finderBackups == .needsReopen {
            conditions.finderBackups = .onThisMac
        } else {
            lookForFinderBackup()
        }
    }

    private func showFullDiskAccess(_ access: BackupSafetyNet.Access) {
        var sample = currentSample
        sample.fullDiskAccess = access
        show(sample)
    }

    // MARK: - Jumping between steps

    /// Put the window on one step without walking the ones before it.
    ///
    /// It is the only thing the demo does that a run cannot: everything a step
    /// needs is written down rather than earned. From there every button is
    /// the real one, and the job walks its own phases and waits for Find My
    /// exactly as it would on a cable.
    func jump(to step: WizardStep) {
        stopWork()
        // A restore that was waiting for the phone had taken it off the
        // cable, so the world is put back the way the switches say before the
        // next step is drawn.
        applyConditions()
        engine.show(phase: .idle, progress: 0, log: [])
        // An iPhone the app does not run on has no job to stand on: it gets
        // the guide on Connect, as it would on a cable.
        let step = step == .job && iosRefusal != nil ? .connect : step
        show(sample(for: step))
        // The job is the one screen there is no standing on: it is work with
        // a bar over it, so landing there starts that work.
        if step == .job {
            startJob()
        }
    }

    /// Forget the run and the conditions both, which is the demo's way back to
    /// a window that has just been opened.
    func reset() {
        stopWork()
        addedProfiles = []
        conditions = DemoConditions()
        engine.show(phase: .idle, progress: 0, log: [])
        startOver()
        // Nor has it been to System Settings.
        showFullDiskAccess(.notAsked)
    }

    /// The wizard's own way back to Connect, which unplugging the iPhone on
    /// the bar also takes. A demo download in flight belongs to the run being
    /// forgotten, so it stops with it.
    override func startOver() {
        stopWork()
        super.startOver()
    }

    /// What a run standing on one step would be holding.
    private func sample(for step: WizardStep) -> Sample {
        var sample = Sample(step: step)
        // A run past the checks has ticked the backup box on its way there.
        sample.backupConfirmed = step == .ready ? backupConfirmed : true
        sample.finderBackup = DemoWorld.finderBackup(conditions)
        sample.fullDiskAccess = fullDiskAccess
        guard step != .connect else { return sample }
        sample.udid = DemoWorld.udid
        switch step {
        case .restrictions, .done:
            sample.restore = RestoreState(stage: .finished)
        case .connect, .ready, .job, .profiles:
            break
        }
        return sample
    }

    /// Everything the window is drawing right now, so one field of it can be
    /// written and the rest handed back unchanged.
    private var currentSample: Sample {
        Sample(
            step: step,
            backupConfirmed: backupConfirmed,
            udid: udid,
            restore: restore,
            job: job,
            profile: profile,
            appSearch: appSearch,
            finderBackup: finderBackup,
            fullDiskAccess: fullDiskAccess,
            errorMessage: errorMessage
        )
    }

    private func stopWork() {
        work?.cancel()
        work = nil
        stopJob()
        cancelling = false
    }

    // MARK: - The job

    override func readDeviceIOSVersion(udid: String) async throws -> String? {
        watcher.devices.first(where: { $0.udid == udid })?.iosVersion
    }

    /// The real model sends the seed through the engine. The demo runs the
    /// restore script, which ends with the phone leaving the cable to
    /// restart, and reaches no `SeedDevice`.
    override func sendSeedConfiguration(restartingOnly: Bool) async throws {
        var sample = currentSample
        sample.restore = RestoreState(stage: .running)
        show(sample)
        try await runRestore()
    }

    /// The real model reads the bus until the phone is back. The demo has no
    /// bus: the phone went off the cable when the run restarted it, and it
    /// comes back here saying what the run asked it to say.
    override func waitForPhone(until deadline: Date?) async -> Bool {
        do {
            try await Task.sleep(for: Self.restartPause)
        } catch {
            return false
        }
        conditions = conditions.afterRestore(target: true)
        return true
    }

    /// The real model asks the phone every five seconds for three minutes. A
    /// demo phone answers whatever the switches say, so this waits the beat
    /// the question takes and then reads them.
    override func confirmWhatTheIPhoneIs() async -> Bool {
        do {
            try await Task.sleep(for: Self.confirmPause)
        } catch {
            return false
        }
        return isSupervised == true
    }

    /// The real model tells the helper to stop, and the helper takes a moment
    /// over it. Nothing here has a helper, so the moment is a pause the
    /// restore loop below keeps.
    override func cancelTransfer() {
        guard engine.phase.isRunning, !cancelling else { return }
        cancelling = true
        engine.show(
            phase: engine.phase,
            progress: engine.progress,
            log: engine.log + ["Cancelling. The iPhone is told to stop, which takes a moment."]
        )
    }

    /// Walk the demo restore from the first beat to the last, stretched when
    /// the bar asks for a long job.
    ///
    /// It throws what the helper would have thrown, so the wizard's own job
    /// lands on the same screen a real failure lands on.
    private func runRestore() async throws {
        let script = DemoScript(outcome: conditions.outcome)
        let scale = conditions.longJob ? 1 / Self.longJobStretch : 1
        let started = Date()
        while true {
            if cancelling {
                try await Task.sleep(for: Self.cancelPause)
                cancelling = false
                engine.show(
                    phase: .cancelled,
                    progress: engine.progress,
                    log: engine.log + ["The helper stopped."]
                )
                throw BackupError.cancelled
            }
            let elapsed = Date().timeIntervalSince(started) * scale
            let beat = script.beat(at: elapsed)
            draw(beat, lines: script.lines(at: elapsed))
            switch beat.stage {
            case .finished, .waitingForPhone:
                // A restore ends where the phone leaves the cable. The wizard
                // waits for it to come back on a phase of its own.
                return
            case .stopped:
                guard script.outcome == .fails else {
                    // A cancellation is the demo pressing its own button, so
                    // it goes through the pause a real one goes through.
                    cancelTransfer()
                    continue
                }
                let sentence = DemoScript.failureSentence
                engine.show(
                    phase: .failed(sentence),
                    progress: engine.progress,
                    log: script.lines(at: script.duration)
                )
                throw BackupError.failed(sentence)
            case .starting, .transferring, .finishing:
                try await Task.sleep(for: Self.tick)
            }
        }
    }

    /// One beat of the restore, in the two places the window reads it from:
    /// the engine, and the phase of the job the model holds.
    private func draw(_ beat: DemoScript.Beat, lines: [String]) {
        var sample = currentSample
        switch beat.stage {
        case .starting:
            engine.show(phase: .starting, progress: 0, log: lines)
        case .transferring:
            engine.show(
                phase: .transferring(progress: beat.progress, filesDone: beat.files, filesTotal: nil, bytes: nil),
                progress: beat.progress,
                log: lines
            )
            sample.job = .restoring
        case .finishing:
            engine.show(phase: .finishing, progress: 1, log: lines)
            sample.job = .restoring
        case .waitingForPhone:
            engine.show(phase: .done, progress: 1, log: lines)
            // The run restarts the phone, so it goes off the cable here and
            // comes back when the wizard waits for it.
            if !watcher.devices.isEmpty {
                watcher.show(devices: [])
            }
            sample.restore.stage = .waitingForPhone
        case .finished, .stopped:
            return
        }
        show(sample)
    }

    // MARK: - The profile

    /// The real model has the site sign the draft and sends it over the cable.
    /// The demo signs and sends nothing, and lands on the same guide.
    override func signAndInstallProfile() {
        demoDownload()
    }

    /// Put another profile on a phone that is supervised already, from the
    /// Profiles screen. Same demo download as the run: the confirm check that
    /// follows reads the grown list back and stays on the screen.
    override func installMoreProfile() {
        demoDownload()
    }

    /// The real model reads the phone again here. The demo's world already
    /// holds the list, so there is nothing to read: the override keeps a sample
    /// watcher's ignored bus read from doing anything and re-applies the world.
    override func refreshInstalledProfiles() {
        applyConditions()
    }

    /// The real model reads the phone's profile list over the cable when the
    /// person confirms. The demo has no cable: it answers from its own world,
    /// which the download below has already grown to hold the profile.
    override func readInstalledProfiles(udid: String) async -> [InstalledProfile]? {
        installedProfiles
    }

    /// Sign, send and land on the guide, in the beats each takes. A demo asked
    /// for a failure fails on the send, where an iPhone that refuses the bytes
    /// leaves its sentence. Otherwise the profile is added to the world so the
    /// confirm check the person triggers next finds it: the Profiles screen
    /// stacks a fresh one, the run marks its own on.
    private func demoDownload() {
        guard udid != nil, !profile.isRunning else { return }
        stopWork()
        var sample = currentSample
        sample.profile = ProfileState(stage: .signing)
        sample.errorMessage = nil
        show(sample)
        let fails = conditions.outcome == .fails
        let managing = step == .profiles
        work = Task { [weak self] in
            try? await Task.sleep(for: Self.signingPause)
            guard let self, !Task.isCancelled else { return }
            var sending = self.currentSample
            sending.profile.stage = .sending
            self.show(sending)
            try? await Task.sleep(for: Self.installPause)
            guard !Task.isCancelled else { return }
            self.work = nil
            guard !fails else {
                var failed = self.currentSample
                failed.profile = ProfileState(stage: .ready)
                failed.errorMessage = DeviceError
                    .profileRejected(reason: "The iPhone is not supervised.")
                    .localizedDescription
                self.show(failed)
                return
            }
            // The bytes are on the demo phone now, as a download waiting to be
            // turned on. The world is grown so the confirm check finds it.
            if managing {
                self.addedProfiles.append(DemoWorld.anotherProfile())
                self.applyConditions()
            } else {
                self.conditions = self.conditions.afterProfileInstall()
            }
            var guide = self.currentSample
            guide.profile = ProfileState(stage: .guide(.downloaded))
            self.show(guide)
        }
    }

    // MARK: - The App Store

    // The App Store search is not overridden here on purpose. It reads a
    // public catalogue and writes nothing, so the demo asks Apple the same
    // question the real app asks and draws the same icons. Judging a search
    // against thirteen written-down rows tells you nothing about how it feels,
    // and a demo that cannot find an app the real one finds is misleading.
    // Everything that could reach the phone or the helper stays overridden
    // above.
}

#endif
