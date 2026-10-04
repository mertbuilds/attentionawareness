import SwiftUI

/// The hidden `--ui-smoke` command line path.
///
/// It builds every step view offscreen and prints the size each one asks for,
/// which is how the window is checked from a terminal: a step that fails to
/// build asks for no height. Give it a folder, `--ui-smoke <folder>`, and it
/// writes a picture of each one there as well. It opens no window and talks to
/// no iPhone, so it works on a Mac whose display is asleep.
@MainActor
enum UISmoke {
    static func runIfAsked(_ arguments: [String] = CommandLine.arguments) {
        guard let flag = arguments.firstIndex(of: "--ui-smoke") else { return }
        setvbuf(stdout, nil, _IOLBF, 0)
        // Hosting a SwiftUI view needs the application object, but not a
        // window and not the run loop.
        _ = NSApplication.shared
        drawAsActive()

        let folder = arguments.count > flag + 1
            ? URL(fileURLWithPath: arguments[flag + 1], isDirectory: true)
            : nil
        // `--appearance light` or `--appearance dark` draws the pictures that
        // way, whatever this Mac is set to. Without it they follow the Mac.
        if let named = arguments.firstIndex(of: "--appearance"), arguments.count > named + 1 {
            appearance = NSAppearance(named: arguments[named + 1] == "dark" ? .darkAqua : .aqua)
            NSApplication.shared.appearance = appearance
        }
        // The steps that are about a run which has not started are drawn with
        // nothing on the cable, from a watcher that reads no bus. A real one
        // would put whatever iPhone happens to be plugged in into the
        // pictures, and would open a lockdown handshake to do it.
        let model = WizardModel(watcher: DeviceWatcher(sample: []))
        // The job screen, the last screen and the Profiles screen have no one
        // state to be drawn in, so they are left out here and drawn once per
        // state below. The step the loop does draw for Connect is the one with
        // nothing on the cable.
        for step in WizardStep.allCases
        where step != .job && step != .done && step != .profiles {
            report(step.rawValue, WizardStepContent(step: step, model: model), into: folder)
        }
        // The last step in each of the things it says: the plain end of a run,
        // the reminder a phone whose Find My is still off gets, the iPhone that
        // never said what it is now, and a copy this Mac would not let go of.
        for sample in doneSamples() {
            report(sample.name, WizardStepContent(step: .done, model: sample.model), into: folder)
        }
        // The checks with the line about a backup an earlier run left behind,
        // which this one cleared on its way in.
        report(
            "ready-leftover-cleared",
            WizardStepContent(step: .ready, model: clearedLeftover()),
            into: folder
        )
        // The checks with the password row, which only an iPhone that encrypts
        // what it backs up ever shows.
        report(
            "ready-password",
            WizardStepContent(step: .ready, model: encryptedBackups()),
            into: folder
        )
        for sample in methodSamples() {
            report(sample.name, WizardStepContent(step: .ready, model: sample.model), into: folder)
        }
        // The Restrictions screen in the three states the loop above cannot
        // draw: a profile of ours already on the iPhone, the install running,
        // and one that did not take.
        for sample in restrictionsSamples() {
            report(
                "restrictions-\(sample.name)",
                WizardStepContent(step: .restrictions, model: sample.model),
                into: folder
            )
        }
        // The website list is folded away in the app, so the loop above never
        // draws it open. This one draws the builder with it open, where the
        // sites the filter blocks and the holes it keeps open for sign-in are
        // both editable rows on screen.
        report(
            "restrictions-sites",
            RestrictionsBuilder(model: sampleModel([sampleDevice]), sitesExpanded: true),
            into: folder
        )
        // The lists changed from the recommended ones, which is the one time
        // the builder offers to reset them.
        let changed = sampleModel([sampleDevice])
        changed.draft.addSite("news.ycombinator.com")
        report("restrictions-changed", RestrictionsBuilder(model: changed), into: folder)
        // The same list once the reader has kept another site open, which is
        // the default hole and the typed one both marked open.
        let customException = sampleModel([sampleDevice])
        customException.draft.addException("accounts.google.com")
        report(
            "restrictions-sites-custom-exception",
            RestrictionsBuilder(model: customException, sitesExpanded: true),
            into: folder
        )
        // The Profiles screen for a phone that is supervised already, in the
        // four states it has: nothing installed yet, a profile of ours on the
        // phone, the install running, and one that did not take.
        for sample in profilesSamples() {
            report(
                "profiles-\(sample.name)",
                WizardStepContent(step: .profiles, model: sample.model),
                into: folder
            )
        }
        // Find My is one of the checks, so they are drawn for a phone that
        // says it is on and for one that says it is off, each with a password
        // typed, so Find My is the one thing that keeps the button off. The one the loop above drew comes from a Mac with
        // nothing on the cable, which is the third answer: no answer at all.
        for (name, findMyOn) in [("find-my-on", true), ("find-my-off", false)] {
            let model = readyToStart(findMyOn: findMyOn)
            model.password = "hunter2"
            report("ready-\(name)", WizardStepContent(step: .ready, model: model), into: folder)
        }
        // The one row the checks show about the reader's own backups, in each
        // of the things it can say: a copy on this Mac, one only iCloud has,
        // one too old to lean on, none at all, and the refusal that keeps
        // Finder's own out of the app's reach until Full Disk Access is on,
        // before the trip to System Settings and after one that did not take.
        // A Mac with too little room for the copy, which is the one check
        // besides Find My that keeps the button off. The phone is made far
        // bigger than any disk, so the picture is the same on every Mac.
        report("ready-low-space", WizardStepContent(step: .ready, model: lowSpace()), into: folder)
        for sample in safetyNetSamples() {
            report("ready-\(sample.name)", WizardStepContent(step: .ready, model: sample.model), into: folder)
        }
        // The iPhone the run is about coming off the cable, from the steps
        // past Connect, drawn on whatever step the wizard lands on, which the
        // name ends with. Every one of them goes back to Connect, except while
        // the restore has the phone or the last screen names a folder that
        // would not go, and another iPhone coming off changes nothing. A
        // sample that lands anywhere else fails the smoke.
        var misplaced = 0
        for sample in unpluggedSamples() {
            report(
                "unplugged-\(sample.name)-\(sample.model.step.rawValue)",
                WizardStepContent(step: sample.model.step, model: sample.model),
                into: folder
            )
            if sample.model.step != sample.lands {
                let landed = sample.model.step.rawValue
                print("unplugged-\(sample.name): landed on \(landed), expected \(sample.lands.rawValue)")
                misplaced += 1
            }
        }
        // Every phase of the one long job, which is one bar and one line in
        // each of them, and the three ends it can come to.
        let now = Date()
        for sample in jobSamples(at: now) {
            report("job-\(sample.name)", WizardStepContent(step: .job, model: sample.model), into: folder)
        }
        // The cost story the job screen plays under the bar, a picture a
        // slide, each with its drawing finished.
        for (index, slide) in WaitSlide.story.enumerated() {
            report(
                String(format: "wait-%02d", index + 1),
                WaitSlideView(slide: slide, elapsed: WaitSlideshow.finished(slide.drawing)),
                into: folder
            )
        }
        // The first screen in each of the things it says. The one with nothing
        // on the cable is the one the loop above drew.
        for sample in connectSamples() {
            report("connect-\(sample.name)", ConnectStep(model: sample.model), into: folder)
        }
        // What an "i" opens, in both the things it can be: the words alone,
        // which is every popover but one, and the one that carries the
        // screenshot of the top of Settings above them.
        report(
            "info-popover-text",
            InfoPopoverContent(text: DoneCopy.note),
            into: folder
        )
        report(
            "info-popover-image",
            InfoPopoverContent(
                text: DoneCopy.note,
                image: InfoImage.checking
            ),
            into: folder
        )
        report("device-card", DeviceCard(device: sampleDevice), into: folder)
        report("device-card-reading", DeviceCard(device: sampleReadingDevice), into: folder)
        report("error", ErrorText(DeviceError.trustPending.localizedDescription), into: folder)
        // The whole window at its smallest, from a wizard that reads no bus.
        report(
            "window",
            ContentView(demo: WizardModel(watcher: DeviceWatcher(sample: []))),
            into: folder,
            windowSize: CGSize(width: 560, height: 520)
        )
        exit(misplaced == 0 ? 0 : 1)
    }

    /// The first screen in each of the things it says. Nothing on the cable is
    /// the state the loop above draws, so it is not here: what is here is a
    /// phone that has not trusted this Mac yet, one that refused, one that is
    /// ready, one that is supervised already, and two at once.
    private static func connectSamples() -> [(name: String, model: WizardModel)] {
        [
            ("trust-pending", sampleModel([sampleSecondDevice])),
            ("untrusted", sampleModel([sampleUntrustedDevice])),
            ("one-phone", sampleModel([sampleDevice])),
            ("supervised", supervisedModel()),
            ("two-phones", sampleModel([sampleDevice, sampleSecondDevice])),
        ]
    }

    /// The last screen in each of the things it says.
    private static func doneSamples() -> [(name: String, model: WizardModel)] {
        [
            ("done", done(findMyOn: true)),
            ("done-find-my-off", done(findMyOn: false)),
            ("done-mismatch", done(findMyOn: true, supervisedAfterwards: false)),
            (
                "done-leftover",
                done(findMyOn: true, backupRemovalFailure: sampleRemovalFailure)
            ),
        ]
    }

    /// What the last screen says about a backup folder macOS would not take
    /// away.
    private static var sampleRemovalFailure: String {
        BackupStoreError
            .removeFailed(
                BackupFolder.applicationSupportRoot.appendingPathComponent(sampleDevice.udid),
                SampleFailure()
            )
            .localizedDescription
    }

    /// A run that is over: the iPhone back on the cable, whatever it said about
    /// itself when it got there, and whatever this Mac could not take away
    /// after it.
    private static func done(
        findMyOn: Bool,
        supervisedAfterwards: Bool = true,
        backupRemovalFailure: String? = nil
    ) -> WizardModel {
        let phone = samplePhone(findMyOn: findMyOn)
        let model = WizardModel(finished: sampleWatcher([phone]))
        model.show(
            WizardModel.Sample(
                step: .done,
                udid: phone.udid,
                restore: WizardModel.RestoreState(
                    stage: .finished,
                    supervisedAfterwards: supervisedAfterwards
                ),
                backupRemovalFailure: backupRemovalFailure
            )
        )
        return model
    }

    /// The Restrictions screen in the states a run reaches after the card is
    /// on screen. The one the loop draws is the card itself, on a Mac with
    /// nothing on the cable.
    private static func restrictionsSamples() -> [(name: String, model: WizardModel)] {
        [
            // A phone the app has already put a profile on, which is the one
            // line the card ever grows.
            ("already-installed", restrictions(WizardModel.ProfileState())),
            // Signing and sending are one wait, so one picture covers both.
            ("sending", restrictions(WizardModel.ProfileState(stage: .sending))),
            // Reading the iPhone back after the person says they finished.
            ("checking", restrictions(WizardModel.ProfileState(stage: .checking))),
            // The profile is on the iPhone as a download now: finish it in
            // Settings, then confirm.
            ("finish", restrictions(WizardModel.ProfileState(stage: .guide(.downloaded)))),
            // The confirm read saw nothing, so the iPhone is likely locked.
            ("unlock", restrictions(WizardModel.ProfileState(stage: .guide(.locked)))),
            // The read worked and the profile is not turned on yet.
            ("not-installed", restrictions(WizardModel.ProfileState(stage: .guide(.notInstalled)))),
            (
                "failed",
                restrictions(
                    WizardModel.ProfileState(stage: .ready),
                    errorMessage: DeviceError
                        .profileRejected(reason: "iPhone isn't supervised.")
                        .localizedDescription
                )
            ),
        ]
    }

    /// The Restrictions screen for one profile state, against a phone that
    /// already carries a profile of ours.
    private static func restrictions(
        _ profile: WizardModel.ProfileState,
        errorMessage: String? = nil
    ) -> WizardModel {
        let model = WizardModel(watcher: sampleWatcher([sampleDevice]))
        model.show(
            WizardModel.Sample(
                step: .restrictions,
                udid: sampleDevice.udid,
                profile: profile,
                errorMessage: errorMessage
            )
        )
        return model
    }

    /// The Profiles screen in the four states it has, drawn against a phone
    /// that is supervised already.
    private static func profilesSamples() -> [(name: String, model: WizardModel)] {
        [
            ("empty", profiles(WizardModel.ProfileState(), installed: [])),
            ("has-ours", profiles(WizardModel.ProfileState(), installed: sampleProfiles)),
            ("sending", profiles(WizardModel.ProfileState(stage: .sending), installed: sampleProfiles)),
            ("checking", profiles(WizardModel.ProfileState(stage: .checking), installed: sampleProfiles)),
            // The profile is downloaded on the phone: finish it in Settings,
            // then confirm.
            ("finish", profiles(WizardModel.ProfileState(stage: .guide(.downloaded)), installed: sampleProfiles)),
            // The confirm read saw nothing, so the iPhone is likely locked.
            ("unlock", profiles(WizardModel.ProfileState(stage: .guide(.locked)), installed: sampleProfiles)),
            (
                "failed",
                profiles(
                    WizardModel.ProfileState(stage: .ready),
                    installed: sampleProfiles,
                    errorMessage: DeviceError
                        .profileRejected(reason: "iPhone isn't supervised.")
                        .localizedDescription
                )
            ),
        ]
    }

    /// The Profiles screen for one profile state, against a supervised phone
    /// that lists the given profiles.
    private static func profiles(
        _ profile: WizardModel.ProfileState,
        installed: [InstalledProfile],
        errorMessage: String? = nil
    ) -> WizardModel {
        let model = WizardModel(
            watcher: DeviceWatcher(
                sample: [sampleDevice],
                cloudConfigurations: [
                    sampleDevice.udid: CloudConfiguration(
                        isSupervised: true,
                        organizationName: "attentionawareness",
                        raw: "<dict/>"
                    ),
                ],
                installedProfiles: [sampleDevice.udid: installed]
            )
        )
        model.show(
            WizardModel.Sample(
                step: .profiles,
                udid: sampleDevice.udid,
                profile: profile,
                errorMessage: errorMessage
            )
        )
        return model
    }

    /// The checks drawn once for each thing the line about the reader's own
    /// backups can say. Find My is off and the backups are unencrypted in
    /// every one of them, so the only thing that moves between the pictures is
    /// that one row and the line under it.
    private static func safetyNetSamples() -> [(name: String, model: WizardModel)] {
        [
            (
                "backups-on-this-mac",
                safetyNet(
                    lastCloudBackup: Date().addingTimeInterval(-6 * dayInSeconds),
                    finderBackup: .made(Date().addingTimeInterval(-5 * 60 * 60))
                )
            ),
            (
                "backups-recent",
                safetyNet(lastCloudBackup: Date().addingTimeInterval(-dayInSeconds))
            ),
            (
                "backups-old",
                safetyNet(lastCloudBackup: Date().addingTimeInterval(-24 * dayInSeconds))
            ),
            ("backups-off", safetyNet(cloudBackupOn: false, lastCloudBackup: nil)),
            (
                "backups-no-full-disk-access",
                safetyNet(
                    lastCloudBackup: Date().addingTimeInterval(-24 * dayInSeconds),
                    finderBackup: .refused
                )
            ),
            // The iPhone would not say anything about iCloud either, which is
            // the row that used to read as a check that could not be made.
            (
                "backups-not-read-no-full-disk-access",
                safetyNet(cloudBackupOn: nil, lastCloudBackup: nil, finderBackup: .refused)
            ),
            // Back from System Settings with the folder still refused.
            (
                "backups-reopen",
                safetyNet(
                    lastCloudBackup: Date().addingTimeInterval(-24 * dayInSeconds),
                    finderBackup: .refused,
                    fullDiskAccess: .needsReopen
                )
            ),
            // A recent iCloud backup already covers the reader, so the refusal
            // asks for nothing.
            (
                "backups-recent-no-full-disk-access",
                safetyNet(lastCloudBackup: Date().addingTimeInterval(-dayInSeconds), finderBackup: .refused)
            ),
            // Finder's folder was read and held nothing for this iPhone, and
            // the iPhone said nothing about iCloud.
            ("backups-none-found", safetyNet(cloudBackupOn: nil, lastCloudBackup: nil)),
            // A Finder backup that will not say when it was made, which is
            // the one row left that cannot say either way.
            (
                "backups-not-read",
                safetyNet(cloudBackupOn: nil, lastCloudBackup: nil, finderBackup: .made(nil))
            ),
        ]
    }

    /// The checks for one iPhone whose own iCloud backups read a given way,
    /// and for one answer from Finder's folder on this Mac. It reads no
    /// folder: the answer is handed in, which is the only way to draw the
    /// refusal without taking Full Disk Access away from this Mac.
    private static func safetyNet(
        cloudBackupOn: Bool? = true,
        lastCloudBackup: Date?,
        finderBackup: BackupSafetyNet.Finder = .nothingHere,
        fullDiskAccess: BackupSafetyNet.Access = .notAsked
    ) -> WizardModel {
        let phone = samplePhone(
            findMyOn: false,
            cloudBackupOn: cloudBackupOn,
            lastCloudBackup: lastCloudBackup
        )
        let model = WizardModel(watcher: sampleWatcher([phone]))
        model.show(
            WizardModel.Sample(
                step: .ready,
                udid: phone.udid,
                finderBackup: finderBackup,
                fullDiskAccess: fullDiskAccess
            )
        )
        return model
    }

    /// A run on one step, and then the cable read again without the iPhone
    /// it is about, which is all the wizard needs to decide where it goes.
    /// `lands` is the step it has to end up on. Nothing is cancelled for
    /// real: no helper runs under any of these.
    private static func unpluggedSamples() -> [(name: String, model: WizardModel, lands: WizardStep)] {
        let phone = samplePhone(findMyOn: false)
        return [
            ("ready", unplugged(onStep(.ready, phone: phone)), .connect),
            ("restrictions", unplugged(onStep(.restrictions, phone: phone)), .connect),
            ("done", unplugged(onStep(.done, phone: phone)), .connect),
            // The last screen naming a folder that would not go stays up, so
            // the person can still read where it is.
            (
                "done-leftover",
                unplugged(done(findMyOn: false, backupRemovalFailure: sampleRemovalFailure)),
                .done
            ),
            ("profiles", unplugged(onStep(.profiles, phone: phone)), .connect),
            ("waiting-find-my", unplugged(waiting(.waitingForFindMy, on: samplePhone(findMyOn: true))), .connect),
            (
                "check-on-iphone",
                unplugged(waiting(.checkOnIPhone(reportedSupervised: true), on: phone)),
                .connect
            ),
            // The restore reboots the phone, so it leaving the cable is part
            // of the job, which waits for it to come back.
            ("restarting", unplugged(waiting(.restarting, on: phone)), .job),
            // Cancel during the restart lands on the checks, and the cancelled
            // job can leave its last phase behind. It holds nothing there.
            ("ready-after-cancelled-restart", unplugged(onStep(.ready, phone: phone, job: .phoneGone)), .connect),
            // Another iPhone on the cable is unplugged, and the run is about
            // the one that stays.
            (
                "other-phone",
                unplugged(onStep(.ready, phone: phone, alongside: sampleDevice), keeping: [phone]),
                .ready
            ),
        ]
    }

    /// A run standing on one step, about `phone`, with `alongside` on the
    /// cable as well when there is one, and `job` as whatever phase the job
    /// last wrote.
    private static func onStep(
        _ step: WizardStep,
        phone: ConnectedDevice,
        alongside other: ConnectedDevice? = nil,
        job: JobPhase? = nil
    ) -> WizardModel {
        let model = WizardModel(watcher: sampleWatcher([phone] + (other.map { [$0] } ?? [])))
        model.show(WizardModel.Sample(step: step, udid: phone.udid, job: job))
        return model
    }

    /// The cable read again with only `keeping` left on it.
    private static func unplugged(_ model: WizardModel, keeping: [ConnectedDevice] = []) -> WizardModel {
        model.watcher.show(devices: keeping)
        return model
    }

    /// The job screen in every phase it has, drawn from engines that are
    /// running nothing and phones that are not there.
    ///
    /// `now` is the clock the whole set is built against, so the elapsed time
    /// and the estimate agree with each other in every picture.
    private static func jobSamples(at now: Date) -> [(name: String, model: WizardModel)] {
        [
            // The first phase when the iPhone did not already encrypt its
            // backups: the person is sent to their phone to enter the passcode.
            ("encrypting", waiting(.encrypting, on: samplePhone(findMyOn: false))),
            // The copy is opening the backup service: the iPhone asks to trust
            // this Mac and for its passcode, so the person is sent to the phone
            // until the first bytes move.
            ("connecting", waiting(.connecting, on: samplePhone(findMyOn: false))),
            (
                "copying",
                moving(
                    .copying,
                    phase: .transferring(
                        progress: 0.42,
                        filesDone: 29_104,
                        filesTotal: nil,
                        bytes: "18.4 MB / 44.1 MB"
                    ),
                    progress: 0.42,
                    estimate: settledEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-720)
                )
            ),
            (
                // The same copying, too early in the run for a figure.
                "copying-early",
                moving(
                    .copying,
                    phase: .transferring(
                        progress: 0.01,
                        filesDone: 412,
                        filesTotal: nil,
                        bytes: "2.1 MB / 9.7 MB"
                    ),
                    progress: 0.01,
                    estimate: youngEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-20)
                )
            ),
            ("preparing", waiting(.preparing, on: samplePhone(findMyOn: false))),
            ("waiting-find-my", waiting(.waitingForFindMy, on: samplePhone(findMyOn: true))),
            (
                "restoring",
                moving(
                    .restoring,
                    phase: .transferring(
                        progress: 0.66,
                        filesDone: 45_800,
                        filesTotal: nil,
                        bytes: "9.2 MB / 128.6 MB"
                    ),
                    progress: 0.66,
                    estimate: settledEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-1_020)
                )
            ),
            (
                // Every file is across and the iPhone is the one working, which
                // the screen reads off the helper rather than off the wizard.
                "finishing",
                moving(
                    .restoring,
                    phase: .finishing,
                    progress: 1,
                    estimate: settledEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-1_740)
                )
            ),
            ("restarting", waiting(.restarting, on: samplePhone(findMyOn: false))),
            ("restarting-locked", backLocked()),
            ("check-on-iphone", waiting(.checkOnIPhone(reportedSupervised: true), on: samplePhone(findMyOn: false))),
            ("phone-gone", waiting(.phoneGone, on: samplePhone(findMyOn: false))),
            (
                "failed-copy",
                waiting(
                    .failed(failure(BackupError.failed(DemoFailure.cableCameOut), in: .copying)),
                    on: samplePhone(findMyOn: false)
                )
            ),
            (
                "failed-restore",
                waiting(
                    .failed(failure(BackupError.failed(DemoFailure.cableCameOut), in: .restoring)),
                    on: samplePhone(findMyOn: false)
                )
            ),
            (
                "failed-no-space",
                waiting(
                    .failed(failure(BackupError.failed("No space left on device"), in: .copying)),
                    on: samplePhone(findMyOn: false)
                )
            ),
            (
                "failed-encryption",
                waiting(
                    .failed(failure(BackupError.encryptionFailed("The iPhone is locked."), in: .copying)),
                    on: samplePhone(findMyOn: false)
                )
            ),
            (
                "failed-restart",
                waiting(
                    .failed(failure(SeedRunError.restartFailed("The iPhone did not answer."), in: .restoring)),
                    on: samplePhone(findMyOn: false)
                )
            ),
            (
                "failed-password",
                waiting(
                    .failed(failure(PatchError.wrongPassword, in: .preparing)),
                    on: samplePhone(findMyOn: false, backupEncrypted: true)
                )
            ),
        ]
    }

    /// The two sentences one failure shows, written the way the job writes
    /// them rather than by hand, so the pictures are of the mapping itself.
    private static func failure(_ error: Error, in piece: JobFailure.Piece) -> JobFailure {
        JobFailure.from(error, in: piece)
            ?? JobFailure(title: "", fix: "", raw: "", retry: .copy)
    }

    /// What the helper prints when the cable comes out, which is the failure a
    /// reader is most likely to meet.
    private enum DemoFailure {
        static let cableCameOut = BackupError.sentence(
            lastError: "ERROR: No device found, is it plugged in?",
            exitCode: 1
        )
    }

    /// One transfer in flight: the phase of the job, the phase and progress
    /// the helper would be printing, and an estimate fed the readings that put
    /// it there.
    private static func moving(
        _ job: JobPhase,
        phase: BackupEngine.Phase,
        progress: Double,
        estimate: TransferEstimate,
        startedAt: Date
    ) -> WizardModel {
        WizardModel(
            sample: sampleWatcher([samplePhone(findMyOn: false)]),
            running: BackupEngine(sample: phase, progress: progress, log: sampleLog),
            job: job,
            estimate: estimate,
            startedAt: startedAt
        )
    }

    /// One phase with no transfer under it: the bar has nothing to measure, or
    /// there is no bar at all.
    /// The restart wait once the iPhone is back on the cable and locked.
    private static func backLocked() -> WizardModel {
        let model = WizardModel(watcher: sampleWatcher([sampleLockedDevice]))
        model.show(WizardModel.Sample(
            step: .job, udid: sampleLockedDevice.udid, job: .restarting, phoneLeftForRestart: true
        ))
        return model
    }

    private static func waiting(_ job: JobPhase, on phone: ConnectedDevice) -> WizardModel {
        let model = WizardModel(watcher: sampleWatcher([phone]))
        model.show(WizardModel.Sample(step: .job, udid: phone.udid, job: job))
        return model
    }

    /// An estimate fed enough of a transfer to say a figure: twelve minutes of
    /// copying that got a little under half way, which is about fifteen
    /// minutes left.
    private static func settledEstimate(endingAt end: Date) -> TransferEstimate {
        var estimate = TransferEstimate()
        estimate.record(progress: 0, at: end.addingTimeInterval(-720))
        estimate.record(progress: 0.42, at: end)
        return estimate
    }

    /// An estimate from the first seconds of a transfer, which is too early to
    /// say anything at all.
    private static func youngEstimate(endingAt end: Date) -> TransferEstimate {
        var estimate = TransferEstimate()
        estimate.record(progress: 0, at: end.addingTimeInterval(-20))
        estimate.record(progress: 0.01, at: end)
        return estimate
    }

    /// A few lines of the sort the helper prints, so the folded-away details
    /// are drawn the way they look during a real transfer.
    private static let sampleLog = [
        "Started restore, the iPhone is waiting for the files.",
        "Sending Library/SMS/sms.db (48.2 MB)",
        "Sending Media/DCIM/108APPLE/IMG_8123.HEIC (3.1 MB)",
    ]

    /// An iPhone that is not there, so the card and the summary can be drawn
    /// without one on the cable.
    private static let sampleDevice = ConnectedDevice(
        udid: "00000000-0000000000000000",
        name: "iPhone",
        productType: "iPhone15,2",
        marketingName: "iPhone 14 Pro",
        iosVersion: "26.6.2",
        findMyOn: false,
        backupEncrypted: true,
        cloudBackupOn: true,
        lastCloudBackup: Date().addingTimeInterval(-dayInSeconds),
        dataCapacity: 128_000_000_000,
        dataAvailable: 40_000_000_000,
        pairingState: .paired
    )

    /// A trusted iPhone that has said its name but not yet its model or iOS,
    /// so the card draws the quiet meta line in its "Reading" fallback.
    private static let sampleReadingDevice = ConnectedDevice(
        udid: "44444444-4444444444444444",
        name: "Mert's iPhone",
        productType: nil,
        marketingName: nil,
        iosVersion: nil,
        findMyOn: false,
        backupEncrypted: nil,
        cloudBackupOn: nil,
        lastCloudBackup: nil,
        dataCapacity: nil,
        dataAvailable: nil,
        pairingState: .paired
    )

    /// One day, for the sample backup dates below. They are counted back from
    /// the clock rather than written down, so a picture drawn years from now
    /// still says the age this one says.
    /// It is nonisolated because a default argument is worked out before the
    /// call reaches the main actor this whole path lives on.
    private nonisolated static let dayInSeconds: TimeInterval = 24 * 60 * 60

    /// A trusted iPhone with Find My on or off and nothing else changed between
    /// the two, so the checks row and the restore gate can be drawn each way.
    /// Its backups are unencrypted unless a picture asks for the password row,
    /// which keeps that field out of the rest of them.
    private static func samplePhone(
        findMyOn: Bool,
        cloudBackupOn: Bool? = true,
        lastCloudBackup: Date? = Date().addingTimeInterval(-dayInSeconds),
        backupEncrypted: Bool = false,
        iosVersion: String = "26.6.2"
    ) -> ConnectedDevice {
        ConnectedDevice(
            udid: "33333333-3333333333333333",
            name: "iPhone",
            productType: "iPhone15,2",
            marketingName: "iPhone 14 Pro",
            iosVersion: iosVersion,
            findMyOn: findMyOn,
            backupEncrypted: backupEncrypted,
            cloudBackupOn: cloudBackupOn,
            lastCloudBackup: lastCloudBackup,
            dataCapacity: 128_000_000_000,
            dataAvailable: 40_000_000_000,
            pairingState: .paired
        )
    }

    /// A second iPhone, still showing the Trust dialog, so the list draws both
    /// a phone that is ready and one that is not.
    private static let sampleSecondDevice = ConnectedDevice(
        udid: "11111111-1111111111111111",
        name: "Work iPhone",
        productType: "iPhone17,1",
        marketingName: "iPhone 16 Pro",
        iosVersion: "26.6.2",
        findMyOn: nil,
        backupEncrypted: nil,
        cloudBackupOn: nil,
        lastCloudBackup: nil,
        dataCapacity: nil,
        dataAvailable: nil,
        pairingState: .trustPending
    )

    /// An iPhone that restarted and is waiting for its passcode.
    private static let sampleLockedDevice = ConnectedDevice(
        udid: "33333333-3333333333333333",
        name: "iPhone",
        productType: "iPhone15,2",
        marketingName: "iPhone 14 Pro",
        iosVersion: "26.6.2",
        findMyOn: nil,
        backupEncrypted: nil,
        cloudBackupOn: nil,
        lastCloudBackup: nil,
        dataCapacity: nil,
        dataAvailable: nil,
        pairingState: .locked
    )

    /// An iPhone that answered the Trust dialog with Don't Trust, which is the
    /// one state the first screen asks somebody to unplug a cable over.
    private static let sampleUntrustedDevice = ConnectedDevice(
        udid: "22222222-2222222222222222",
        name: "iPhone",
        productType: "iPhone15,2",
        marketingName: "iPhone 14 Pro",
        iosVersion: nil,
        findMyOn: nil,
        backupEncrypted: nil,
        cloudBackupOn: nil,
        lastCloudBackup: nil,
        dataCapacity: nil,
        dataAvailable: nil,
        pairingState: .untrusted
    )

    /// What MCInstall would say about the first sample phone.
    private static let sampleConfiguration = CloudConfiguration(
        isSupervised: false,
        organizationName: nil,
        raw: "<dict/>"
    )

    /// The first screen for a phone that is supervised already, which is the
    /// one state that offers to manage restrictions rather than start a run.
    private static func supervisedModel() -> WizardModel {
        WizardModel(
            watcher: DeviceWatcher(
                sample: [sampleDevice],
                cloudConfigurations: [
                    sampleDevice.udid: CloudConfiguration(
                        isSupervised: true,
                        organizationName: "attentionawareness",
                        raw: "<dict/>"
                    ),
                ],
                installedProfiles: [sampleDevice.udid: sampleProfiles]
            )
        )
    }

    /// A profile of ours on that phone, so the card draws the row the way it
    /// looks after a run.
    private static let sampleProfiles = [
        InstalledProfile(
            id: "com.attentionawareness.00000000-0000-0000-0000-000000000000",
            displayName: "attentionawareness",
            organization: "attentionawareness",
            description: "attentionawareness",
            isActive: true,
            removalDisallowed: true,
            uuid: "00000000-0000-0000-0000-000000000000"
        ),
    ]

    /// A run that has just started for a phone this Mac was still holding a
    /// backup of, which the checks say in one line.
    private static func clearedLeftover() -> WizardModel {
        let model = WizardModel(watcher: sampleWatcher([samplePhone(findMyOn: false)]))
        model.show(
            WizardModel.Sample(
                step: .ready,
                udid: samplePhone(findMyOn: false).udid,
                clearedLeftoverBackup: true
            )
        )
        return model
    }

    /// A run whose iPhone encrypts what it backs up, which is the one thing
    /// that puts the password row on the checks.
    private static func encryptedBackups() -> WizardModel {
        let phone = samplePhone(findMyOn: false, backupEncrypted: true)
        let model = WizardModel(
            watcher: sampleWatcher([phone]), engine: BackupEngine(sample: .idle, progress: 0)
        )
        model.show(WizardModel.Sample(step: .ready, supervisionMethod: .fullCopy, udid: phone.udid))
        return model
    }

    private static func methodSamples() -> [(name: String, model: WizardModel)] {
        [
            ("ready-fast", "26.6.2", SupervisionMethod.seed),
            ("ready-ios27-full-copy", "27.0", .fullCopy),
        ].map { name, version, method in
            let phone = samplePhone(findMyOn: false, iosVersion: version)
            let model = WizardModel(
                watcher: sampleWatcher([phone]), engine: BackupEngine(sample: .idle, progress: 0)
            )
            model.show(WizardModel.Sample(
                step: .ready, supervisionMethod: method, backupConfirmed: true,
                udid: phone.udid
            ))
            return (name, model)
        }
    }

    /// The checks for a phone that holds more than this Mac has room for.
    private static func lowSpace() -> WizardModel {
        let phone = ConnectedDevice(
            udid: "55555555-5555555555555555",
            name: "iPhone",
            productType: "iPhone15,2",
            marketingName: "iPhone 14 Pro",
            iosVersion: "26.6.2",
            findMyOn: false,
            backupEncrypted: false,
            cloudBackupOn: true,
            lastCloudBackup: Date().addingTimeInterval(-dayInSeconds),
            dataCapacity: 900_000_000_000_000,
            dataAvailable: 0,
            pairingState: .paired
        )
        let model = WizardModel(watcher: sampleWatcher([phone]))
        model.show(WizardModel.Sample(step: .ready, udid: phone.udid))
        return model
    }

    /// The checks for a phone with nothing else to fix.
    private static func readyToStart(findMyOn: Bool) -> WizardModel {
        let phone = samplePhone(findMyOn: findMyOn)
        let model = WizardModel(watcher: sampleWatcher([phone]))
        model.show(WizardModel.Sample(step: .ready, udid: phone.udid))
        return model
    }

    /// What macOS says when it will not take a folder away.
    private struct SampleFailure: LocalizedError {
        var errorDescription: String? { "The volume is read only." }
    }

    /// A model whose watcher holds phones that are not there, so the Connect
    /// step draws both the single-phone card and the list of more than one
    /// with nothing on the cable.
    private static func sampleModel(_ devices: [ConnectedDevice]) -> WizardModel {
        WizardModel(watcher: sampleWatcher(devices))
    }

    /// A watcher that watches nothing and answers for the first sample phone.
    private static func sampleWatcher(_ devices: [ConnectedDevice]) -> DeviceWatcher {
        DeviceWatcher(
            sample: devices,
            cloudConfigurations: [sampleDevice.udid: sampleConfiguration],
            installedProfiles: [sampleDevice.udid: sampleProfiles]
        )
    }

    /// The appearance the pictures are drawn in, or nil to follow the Mac.
    private static var appearance: NSAppearance?

    private static func report(
        _ name: String,
        _ view: some View,
        into folder: URL?,
        windowSize: CGSize? = nil
    ) {
        let host = NSHostingView(rootView: AnyView(view.frame(width: WizardStyle.contentWidth)))
        host.layoutSubtreeIfNeeded()
        let size = host.fittingSize
        print("\(name): \(Int(size.width))x\(Int(size.height))")
        guard let folder, size.width > 0, size.height > 0 else { return }
        // A step drawn the way the window draws it: the same margin, the same
        // background and the same tint, or the whole window at a fixed size.
        let content: AnyView = windowSize == nil
            ? AnyView(
                view
                    .frame(width: WizardStyle.contentWidth)
                    .padding(28)
                    .background(Color(nsColor: .windowBackgroundColor))
                    .tint(WizardStyle.accentSoft)
            )
            : AnyView(view)
        guard let png = picture(of: content, size: windowSize) else { return }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? png.write(to: folder.appendingPathComponent("\(name).png"))
    }

    /// A picture of `view` drawn in a real window that is never put on screen.
    /// `ImageRenderer` draws no AppKit control, so pickers, switches, fields
    /// and bars came out as empty boxes. A window hosts them all, and nothing
    /// shows: it is never ordered in and it sits far off every display.
    private static func picture(of view: AnyView, size fixed: CGSize?) -> Data? {
        let host = NSHostingView(rootView: view)
        let size = fixed ?? host.fittingSize
        let window = SmokeWindow(
            contentRect: NSRect(x: -20_000, y: -20_000, width: size.width, height: size.height),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        if let appearance {
            window.appearance = appearance
        }
        window.contentView = host
        host.frame = NSRect(origin: .zero, size: size)
        host.layoutSubtreeIfNeeded()
        // One turn of the run loop lets SwiftUI hand its controls to AppKit
        // and draw them.
        RunLoop.main.run(until: Date().addingTimeInterval(0.15))
        host.layoutSubtreeIfNeeded()
        guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return nil }
        host.cacheDisplay(in: host.bounds, to: bitmap)
        window.contentView = nil
        return bitmap.representation(using: .png, properties: [:])
    }

    /// The window the pictures are drawn in. It says it is the key window, so
    /// controls are drawn the way they look in front, in colour, rather than
    /// in the grey of a window in the background.
    private final class SmokeWindow: NSWindow {
        override var isKeyWindow: Bool { true }
        override var isMainWindow: Bool { true }
    }

    /// The app is never brought to the front while it draws, because that
    /// would take the screen from whoever is using it. A control in an app
    /// that is not in front draws grey, so in a debug build the app and its
    /// windows are told they look active for as long as the smoke runs, which
    /// is until it exits. A Release build draws the grey look.
    private static func drawAsActive() {
        #if DEBUG
        let yes: @convention(block) (AnyObject) -> Bool = { _ in true }
        if let method = class_getInstanceMethod(NSApplication.self, #selector(getter: NSApplication.isActive)) {
            method_setImplementation(method, imp_implementationWithBlock(yes))
        }
        for name in ["_hasActiveAppearance", "_hasActiveAppearanceIgnoringKeyFocus", "hasKeyAppearance"] {
            if let method = class_getInstanceMethod(NSWindow.self, NSSelectorFromString(name)) {
                method_setImplementation(method, imp_implementationWithBlock(yes))
            }
        }
        #endif
    }
}
