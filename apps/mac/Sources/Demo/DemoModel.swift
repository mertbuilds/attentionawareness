import Foundation

/// The wizard, run against an iPhone that is not there.
///
/// It is the model the window always has. What changes is the other end of it:
/// every method that would reach a phone, a disk, the helper or the site is
/// replaced by one that waits the moment the real thing would take and then
/// says what the demo was asked to say. The steps, the stage machine, the
/// gates and every sentence on screen are the ones that ship.
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
        didSet { applyConditions() }
    }

    /// The transfer, patch or install running right now. A jump cancels it, so
    /// two of them can never run at once.
    private var work: Task<Void, Never>?
    /// True between Cancel and the helper stopping, so a second press does not
    /// start a second wait.
    private var cancelling = false

    /// How often a running transfer redraws.
    private static let tick = Duration.milliseconds(100)
    /// How long each line of the patch stays on screen.
    private static let patchStep = Duration.milliseconds(800)
    /// Deriving the keys of an encrypted backup, which is the one part of the
    /// patch that takes real seconds.
    private static let keyDerivation = Duration.milliseconds(1400)
    /// How long the reader is given to read what the patch changed. It is the
    /// pause the real patch takes as well.
    /// How long the helper takes to stop after Cancel.
    private static let cancelPause = Duration.milliseconds(1500)
    /// How long the store takes to answer one search.
    private static let signingPause = Duration.milliseconds(1200)
    private static let installPause = Duration.milliseconds(1600)
    /// What the demo says this Mac has free. It is a fixed figure rather than
    /// the volume's own, so the checks read the same on every machine.
    private static let freeBytes: UInt64 = 248_000_000_000

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
        watcher.show(
            devices: DemoWorld.devices(conditions),
            cloudConfigurations: DemoWorld.cloudConfigurations(conditions),
            installedProfiles: DemoWorld.installedProfiles(conditions)
        )
    }

    // MARK: - Jumping between steps

    /// Put the window on one step without walking the ones before it.
    ///
    /// It is the only thing the demo does that a run cannot: everything a step
    /// needs is written down rather than earned. From there every button is
    /// the real one, so the Patch step runs its patch and the Restore step
    /// waits for Find My exactly as it would on a cable.
    func jump(to step: WizardStep) {
        stopWork()
        // A restore that was waiting for the phone had taken it off the
        // cable, so the world is put back the way the switches say before the
        // next step is drawn.
        applyConditions()
        engine.show(phase: .idle, progress: 0, log: [])
        show(sample(for: step))
        // The Patch step is the one step whose whole content is the work it
        // starts on the way in, so landing on it starts it.
        if step == .patch {
            runPatch()
        }
    }

    /// Forget the run and the conditions both, which is the demo's way back to
    /// a window that has just been opened.
    func reset() {
        stopWork()
        conditions = DemoConditions()
        engine.show(phase: .idle, progress: 0, log: [])
        startOver()
    }

    /// What a run standing on one step would be holding.
    private func sample(for step: WizardStep) -> Sample {
        var sample = Sample(step: step, direction: direction)
        guard step != .connect else {
            // The first step is before the direction is chosen, and a run
            // always starts out putting supervision on.
            sample.direction = .supervise
            return sample
        }
        sample.udid = DemoWorld.udid
        guard step != .checks, step != .backUp else { return sample }
        sample.backupFolder = DemoWorld.backupFolder
        // A run that reached the patch has a measured folder behind it, so
        // the Restore step can say how long sending it back will take.
        sample.restoreBytes = DemoWorld.backupBytes
        switch step {
        case .profile:
            // Unsupervising leaves this step out, so landing on it is a run
            // that is putting supervision on.
            sample.direction = .supervise
            sample.restore = RestoreState(stage: .finished, supervisedAfterwards: true)
        case .done:
            sample.restore = RestoreState(stage: .finished, supervisedAfterwards: direction.target)
        case .connect, .checks, .backUp, .patch, .restore:
            // The Patch step is left empty on purpose: it is `runPatch` that
            // fills it, and a step that already says it is running would turn
            // that away.
            break
        }
        return sample
    }

    /// Everything the window is drawing right now, so one field of it can be
    /// written and the rest handed back unchanged.
    private var currentSample: Sample {
        Sample(
            step: step,
            direction: direction,
            udid: udid,
            backupFolder: backupFolder,
            restoreBytes: restoreBytes,
            transferStartedAt: transferStartedAt,
            estimate: estimate,
            patch: patch,
            restore: restore,
            profile: profile,
            appSearch: appSearch,
            clearedLeftoverBackup: clearedLeftoverBackup,
            backupRemovalFailure: backupRemovalFailure,
            errorMessage: errorMessage
        )
    }

    private func stopWork() {
        work?.cancel()
        work = nil
        cancelling = false
    }

    // MARK: - The transfers

    override func startBackup() {
        guard udid != nil, !engine.phase.isRunning else { return }
        stopWork()
        var sample = self.sample(for: .backUp)
        sample.transferStartedAt = Date()
        show(sample)
        runTransfer(.backup)
    }

    override func startRestore() {
        guard udid != nil, backupFolder != nil, !engine.phase.isRunning else { return }
        guard restoreGate == .allowed else { return }
        stopWork()
        var sample = currentSample
        sample.step = .restore
        sample.restore = RestoreState(stage: .running)
        sample.transferStartedAt = Date()
        sample.estimate = TransferEstimate()
        sample.errorMessage = nil
        show(sample)
        runTransfer(.restore)
    }

    override func cancelTransfer() {
        guard engine.phase.isRunning, !cancelling else { return }
        cancelling = true
        work?.cancel()
        engine.show(
            phase: engine.phase,
            progress: engine.progress,
            log: engine.log + ["Cancelling. The iPhone is told to stop, which takes a moment."]
        )
        work = Task { [weak self] in
            try? await Task.sleep(for: Self.cancelPause)
            guard let self, !Task.isCancelled else { return }
            self.work = nil
            self.cancelling = false
            self.engine.show(
                phase: .cancelled,
                progress: self.engine.progress,
                log: self.engine.log + ["The helper stopped."]
            )
            var sample = self.currentSample
            if sample.restore.stage == .running {
                sample.restore.stage = .ready
            }
            self.show(sample)
        }
    }

    /// Walk one demo transfer from the first beat to the last.
    private func runTransfer(_ kind: DemoScript.Kind) {
        let script = DemoScript(kind: kind, outcome: conditions.outcome)
        let started = Date()
        work = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                let elapsed = Date().timeIntervalSince(started)
                let beat = script.beat(at: elapsed)
                self.draw(beat, lines: script.lines(at: elapsed))
                switch beat.stage {
                case .stopped:
                    return self.stop(script)
                case .finished:
                    return self.finish(kind)
                case .starting, .transferring, .finishing, .waitingForPhone:
                    try? await Task.sleep(for: Self.tick)
                }
            }
        }
    }

    /// One beat of a transfer, in the two places the window reads it from: the
    /// engine, and the clock and estimate the model holds.
    private func draw(_ beat: DemoScript.Beat, lines: [String]) {
        switch beat.stage {
        case .starting:
            engine.show(phase: .starting, progress: 0, log: lines)
        case .transferring:
            engine.show(
                phase: .transferring(
                    progress: beat.progress,
                    filesDone: beat.files,
                    filesTotal: nil,
                    bytes: beat.bytes
                ),
                progress: beat.progress,
                log: lines
            )
        case .finishing:
            engine.show(phase: .finishing, progress: 1, log: lines)
        case .waitingForPhone:
            engine.show(phase: .done, progress: 1, log: lines)
            // The restore reboots the phone, so it goes off the cable here and
            // comes back when the run ends.
            if !watcher.devices.isEmpty {
                watcher.show(devices: [])
            }
        case .finished, .stopped:
            return
        }
        // The engine's progress feeds the model's own estimate off the real
        // clock, so the reading the window shows is written afterwards: it is
        // the one a transfer of this length would be holding, and it is what
        // makes twenty seconds read like the hour they stand for.
        let now = Date()
        var sample = currentSample
        sample.transferStartedAt = now.addingTimeInterval(-beat.elapsed)
        sample.estimate = beat.estimate(at: now)
        if beat.stage == .waitingForPhone {
            sample.restore.stage = .waitingForPhone
        }
        show(sample)
    }

    /// A transfer that ran to the end.
    private func finish(_ kind: DemoScript.Kind) {
        work = nil
        switch kind {
        case .backup:
            engine.show(phase: .done, progress: 1, log: engine.log)
            var sample = currentSample
            sample.backupFolder = DemoWorld.backupFolder
            sample.restoreBytes = DemoWorld.backupBytes
            show(sample)
            // This Mac is holding the backup now, which is what the end of the
            // run takes away again.
            conditions.holdingBackup = true
            advance()
        case .restore:
            // The phone is back on the cable, saying what the run asked it to
            // say.
            conditions = conditions.afterRestore(target: direction.target)
            var sample = currentSample
            sample.restore = RestoreState(stage: .finished, supervisedAfterwards: isSupervised)
            show(sample)
            // Unsupervising installs no profile, so the restore is the end of
            // that run and the backup goes here.
            deleteBackupIfTheRunIsDone()
        }
    }

    /// A transfer the demo was asked to stop part way.
    private func stop(_ script: DemoScript) {
        work = nil
        switch script.outcome {
        case .succeeds:
            return
        case .fails:
            let sentence = DemoScript.failureSentence
            engine.show(
                phase: .failed(sentence),
                progress: engine.progress,
                log: script.lines(at: script.duration)
            )
            var sample = currentSample
            sample.errorMessage = sentence
            if sample.restore.stage == .running {
                sample.restore.stage = .ready
            }
            show(sample)
        case .cancelled:
            cancelTransfer()
        }
    }

    // MARK: - The patch

    override func runPatch() {
        guard backupFolder != nil, !patch.isRunning else { return }
        stopWork()
        var sample = currentSample
        sample.step = .patch
        sample.patch = PatchState(status: "Reading the backup", isRunning: true)
        sample.errorMessage = nil
        show(sample)

        let encrypted = conditions.backupsEncrypted
        // The backup says what the phone says, so a phone that is already
        // where the run wants it leaves the patch with nothing to write.
        let alreadyCorrect = conditions.supervised == direction.target
        let changes = direction.target
            ? ["IsSupervised: false -> true", "CloudConfigurationUIComplete: false -> true"]
            : ["IsSupervised: true -> false"]
        work = Task { [weak self] in
            try? await Task.sleep(for: Self.patchStep)
            guard let self, !Task.isCancelled else { return }
            if encrypted {
                self.patchStatus("Deriving the backup keys, up to ten seconds")
                try? await Task.sleep(for: Self.keyDerivation)
                guard !Task.isCancelled else { return }
            }
            guard !alreadyCorrect else {
                self.work = nil
                var done = self.currentSample
                done.patch = PatchState(isRunning: false, alreadyCorrect: true)
                self.show(done)
                return
            }
            self.patchStatus("Writing the flag")
            try? await Task.sleep(for: Self.patchStep)
            guard !Task.isCancelled else { return }
            self.patchStatus("Checking")
            try? await Task.sleep(for: Self.patchStep)
            guard !Task.isCancelled else { return }

            var done = self.currentSample
            done.patch = PatchState(
                changes: changes,
                pristinePath: DemoWorld.pristineFolder.path,
                isRunning: false
            )
            self.show(done)
            // The real patch waits for Continue here, so the demo does too.
            self.work = nil
        }
    }

    private func patchStatus(_ line: String) {
        var sample = currentSample
        sample.patch.status = line
        show(sample)
    }

    // MARK: - The profile

    override func signAndInstallProfile() {
        guard udid != nil, !profile.isRunning else { return }
        install(ProfileState(stage: .signing))
    }

    /// The real step opens a file panel here. The demo takes the file as read,
    /// because a panel is macOS, not this app.
    override func chooseAndInstallProfile() {
        guard udid != nil, !profile.isRunning else { return }
        install(ProfileState(stage: .installing, fileName: "attentionawareness.mobileconfig"))
    }

    private func install(_ state: ProfileState) {
        stopWork()
        var sample = currentSample
        sample.profile = state
        sample.errorMessage = nil
        show(sample)
        // A demo that was asked for a failure fails here too, so the sentence
        // an iPhone that refuses a profile leaves behind can be read.
        let fails = conditions.outcome == .fails
        work = Task { [weak self] in
            if state.stage == .signing {
                try? await Task.sleep(for: Self.signingPause)
                guard let self, !Task.isCancelled else { return }
                var next = self.currentSample
                next.profile.stage = .installing
                self.show(next)
            }
            try? await Task.sleep(for: Self.installPause)
            guard let self, !Task.isCancelled else { return }
            self.work = nil
            guard !fails else {
                var failed = self.currentSample
                failed.profile = ProfileState(stage: .ready, fileName: state.fileName)
                failed.errorMessage = DeviceError
                    .profileRejected(reason: "The iPhone is not supervised.")
                    .localizedDescription
                self.show(failed)
                return
            }
            var done = self.currentSample
            done.profile.stage = .installed
            // The real model reads the phone back here and only then counts
            // the profile as the one the run asked for. A demo phone answers
            // whatever the switches say, so the check is taken as passed and
            // the backup goes, which is what the run does next.
            done.profile.isConfirmed = true
            self.show(done)
            self.conditions = self.conditions.afterProfileInstall()
            self.deleteBackupIfTheRunIsDone()
        }
    }

    // MARK: - The App Store

    // The App Store search is not overridden here on purpose. It reads a
    // public catalogue and writes nothing, so the demo asks Apple the same
    // question the real app asks and draws the same icons. Judging a search
    // against thirteen written-down rows tells you nothing about how it feels,
    // and a demo that cannot find an app the real one finds is misleading.
    // Everything that could reach the phone, the helper or the backups stays
    // overridden below.

    // MARK: - What the demo says about this Mac

    /// The free space check, answered from a figure rather than from the
    /// volume, so the checks read the same on a full Mac and an empty one.
    override var diskSpace: DiskSpace {
        var needed = UInt64(Double(67_882_442_752) * 1.2)
        if let capacity = device?.dataCapacity, let available = device?.dataAvailable, capacity >= available {
            needed = UInt64(Double(capacity - available) * 1.2)
        }
        return DiskSpace(needed: needed, free: Self.freeBytes, assumed: false)
    }

    /// The real model takes the folder off the disk here. The demo has no
    /// folder and reaches nothing, so it answers from the switches: a Mac that
    /// is holding one loses it, a Mac that is not was never holding anything,
    /// and a demo asked for a failure says what a refused delete says.
    override func removeBackup(of udid: String) async -> BackupRemoval {
        guard conditions.holdingBackup else { return .nothingThere }
        guard conditions.outcome != .fails else { return .failed(DemoWorld.removalFailure) }
        conditions.holdingBackup = false
        return .deleted
    }
}
