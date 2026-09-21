#if DEBUG
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
    /// Profiles the demo has installed from the Profiles screen this session,
    /// on top of whatever the conditions say the phone already lists. Reset
    /// clears them.
    private var addedProfiles: [InstalledProfile] = []
    /// True between Cancel and the helper stopping, so a second press does not
    /// start a second wait.
    private var cancelling = false
    /// True once this job has refused a backup password, so Try Again gets
    /// through rather than meeting the same wall.
    private var refusedThePassword = false

    /// How often a running transfer redraws.
    private static let tick = Duration.milliseconds(100)
    /// How long the copy takes on the clock, and the restore after it. The
    /// script keeps its own length and is read faster than it was written, so
    /// the whole job runs in about half a minute while the elapsed time, the
    /// estimate and the lines under the bar stay the ones a real run shows.
    private static let copySeconds: TimeInterval = 10
    private static let restoreSeconds: TimeInterval = 14
    /// The restart, and the question the wizard asks once the phone is back.
    private static let restartPause = Duration.seconds(3)
    private static let confirmPause = Duration.seconds(2)
    /// How long each line of the patch stays on screen.
    private static let patchStep = Duration.milliseconds(650)
    /// Deriving the keys of an encrypted backup, which is the one part of the
    /// patch that takes real seconds.
    private static let keyDerivation = Duration.milliseconds(1400)
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
    /// permission away from a real Mac.
    override func lookForFinderBackup() {
        var sample = currentSample
        sample.finderBackup = DemoWorld.finderBackup(conditions)
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
        show(sample(for: step))
        // The job is the one screen there is no standing on: it is an hour of
        // work with a bar over it, so landing there starts that work.
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
    }

    /// What a run standing on one step would be holding.
    private func sample(for step: WizardStep) -> Sample {
        var sample = Sample(step: step)
        sample.finderBackup = DemoWorld.finderBackup(conditions)
        guard step != .connect else { return sample }
        sample.udid = DemoWorld.udid
        // The job screen is landed on where it starts, on the copy, so it is
        // holding no folder yet either. The Profiles screen is not a run, so it
        // holds no folder either: it needs only the phone it manages.
        guard step != .ready, step != .job, step != .profiles else { return sample }
        sample.backupFolder = DemoWorld.backupFolder
        // A run that reached the restore has a measured folder behind it, so
        // the step can say how long sending it back will take.
        sample.restoreBytes = DemoWorld.backupBytes
        switch step {
        case .restrictions, .done:
            sample.restore = RestoreState(stage: .finished, supervisedAfterwards: true)
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
            udid: udid,
            backupFolder: backupFolder,
            restoreBytes: restoreBytes,
            transferStartedAt: transferStartedAt,
            estimate: estimate,
            patch: patch,
            restore: restore,
            job: job,
            profile: profile,
            appSearch: appSearch,
            finderBackup: finderBackup,
            clearedLeftoverBackup: clearedLeftoverBackup,
            backupRemovalFailure: backupRemovalFailure,
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

    /// The wizard's own job, with one thing of the demo's in front of it: a
    /// password the demo refused once is let through on the next attempt, and
    /// a new job forgets that it ever refused one.
    override func startJob() {
        refusedThePassword = false
        super.startJob()
    }

    /// How the next demo transfer ends.
    ///
    /// A run whose iPhone encrypts its backups puts its failure on the
    /// password instead of on the cable, because the password is the only
    /// thing about an encrypted copy that can be wrong. Both transfers have to
    /// go through for that screen to be reached at all.
    private var transferOutcome: DemoConditions.Outcome {
        guard conditions.outcome == .fails, conditions.backupsEncrypted else {
            return conditions.outcome
        }
        return .succeeds
    }

    /// The real model runs the helper here. The demo runs the script instead,
    /// and leaves this Mac holding a copy at the end of it.
    override func copyTheIPhone() async throws {
        var sample = currentSample
        sample.backupFolder = nil
        sample.restoreBytes = nil
        sample.patch = PatchState()
        sample.restore = RestoreState()
        sample.transferStartedAt = Date()
        sample.estimate = TransferEstimate()
        show(sample)
        try await runTransfer(.backup, in: Self.copySeconds)
        engine.show(phase: .done, progress: 1, log: engine.log)
        var done = currentSample
        done.backupFolder = DemoWorld.backupFolder
        done.restoreBytes = DemoWorld.backupBytes
        show(done)
        // This Mac is holding the copy now, which is what the end of the run
        // takes away again.
        conditions.holdingBackup = true
    }

    /// The real model writes the flag into the copy on this Mac. The demo
    /// writes nothing and says the same lines at the same pace. It is also
    /// where a copy the demo was asked to refuse ends the job, because an
    /// encrypted copy is the only one a password can be wrong about.
    override func markTheCopy() async throws {
        var sample = currentSample
        sample.patch = PatchState(status: "Reading the copy", isRunning: true)
        show(sample)
        try await Task.sleep(for: Self.patchStep)
        if conditions.backupsEncrypted {
            patchStatus("Deriving the backup keys, up to ten seconds")
            try await Task.sleep(for: Self.keyDerivation)
            // The demo holds no right password to weigh one against, so it
            // refuses the first attempt and lets the next through, which is
            // the shape of getting it wrong and then typing the right one.
            if conditions.outcome == .fails, !refusedThePassword {
                refusedThePassword = true
                var refused = currentSample
                refused.patch = PatchState()
                show(refused)
                throw PatchError.wrongPassword
            }
        }
        // The copy says what the phone says, so a phone that is already
        // supervised leaves the patch with nothing to write.
        guard !conditions.supervised else {
            var nothingToDo = currentSample
            nothingToDo.patch = PatchState(isRunning: false, alreadyCorrect: true)
            return show(nothingToDo)
        }
        patchStatus("Writing the flag")
        try await Task.sleep(for: Self.patchStep)
        patchStatus("Checking")
        try await Task.sleep(for: Self.patchStep)
        var done = currentSample
        done.patch = PatchState(
            changes: ["IsSupervised: false -> true", "CloudConfigurationUIComplete: false -> true"],
            pristinePath: DemoWorld.pristineFolder.path,
            isRunning: false
        )
        show(done)
    }

    /// The real model sends the copy over the cable. The demo runs the restore
    /// script, which ends with the phone leaving the cable to restart.
    override func sendTheCopyBack() async throws {
        var sample = currentSample
        sample.restore = RestoreState(stage: .running)
        sample.transferStartedAt = Date()
        sample.estimate = TransferEstimate()
        show(sample)
        try await runTransfer(.restore, in: Self.restoreSeconds)
    }

    /// The real model reads the bus until the phone is back. The demo has no
    /// bus: the phone went off the cable when the restore rebooted it, and it
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
    /// transfer loop below keeps.
    override func cancelTransfer() {
        guard engine.phase.isRunning, !cancelling else { return }
        cancelling = true
        engine.show(
            phase: engine.phase,
            progress: engine.progress,
            log: engine.log + ["Cancelling. The iPhone is told to stop, which takes a moment."]
        )
    }

    /// Walk one demo transfer from the first beat to the last, in the seconds
    /// a demo is worth rather than the hour the script is written at.
    ///
    /// It throws what the helper would have thrown, so the wizard's own job
    /// lands on the same screen a real failure lands on.
    private func runTransfer(_ kind: DemoScript.Kind, in seconds: TimeInterval) async throws {
        let script = DemoScript(kind: kind, outcome: transferOutcome)
        let scale = script.duration / seconds
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
            // comes back when the wizard waits for it.
            if !watcher.devices.isEmpty {
                watcher.show(devices: [])
            }
        case .finished, .stopped:
            return
        }
        // The engine's progress feeds the model's own estimate off the real
        // clock, so the reading the window shows is written afterwards: it is
        // the one a transfer of this length would be holding, and it is what
        // makes ten seconds read like the hour they stand for.
        let now = Date()
        var sample = currentSample
        sample.transferStartedAt = now.addingTimeInterval(-beat.elapsed)
        sample.estimate = beat.estimate(at: now)
        if beat.stage == .waitingForPhone {
            sample.restore.stage = .waitingForPhone
        }
        show(sample)
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

    /// The real model reads the phone again here. The demo's world already
    /// holds the list, so there is nothing to read: the override keeps a sample
    /// watcher's ignored bus read from doing anything and re-applies the world.
    override func refreshInstalledProfiles() {
        applyConditions()
    }

    /// Install another profile on a phone that is supervised already, from the
    /// Profiles screen. The demo signs and installs nothing: it waits the beat
    /// each step takes, then adds a fresh profile to the phone's list and stays
    /// on the screen, the way the real one does.
    override func installMoreProfile() {
        guard udid != nil, !profile.isRunning else { return }
        stopWork()
        var sample = currentSample
        sample.profile = ProfileState(stage: .signing)
        sample.errorMessage = nil
        show(sample)
        let fails = conditions.outcome == .fails
        work = Task { [weak self] in
            try? await Task.sleep(for: Self.signingPause)
            guard let self, !Task.isCancelled else { return }
            var installing = self.currentSample
            installing.profile.stage = .installing
            self.show(installing)
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
            // Each install mints a fresh identifier, so the demo adds one more
            // profile to the phone and reads the grown list back.
            self.addedProfiles.append(DemoWorld.anotherProfile())
            self.applyConditions()
            var done = self.currentSample
            done.profile = ProfileState()
            self.show(done)
        }
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
            // A confirmed install leaves nothing to press, so the last screen
            // comes up by itself here as it does on a real run.
            self.advance()
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
#endif
