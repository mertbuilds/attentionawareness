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

        let folder = arguments.count > flag + 1
            ? URL(fileURLWithPath: arguments[flag + 1], isDirectory: true)
            : nil
        // The steps that are about a run which has not started are drawn with
        // nothing on the cable, from a watcher that reads no bus. A real one
        // would put whatever iPhone happens to be plugged in into the
        // pictures, and would open a lockdown handshake to do it.
        let model = WizardModel(watcher: DeviceWatcher(sample: []))
        // The job screen and the last screen have no one state to be drawn in,
        // so they are left out here and drawn once per state below. The step
        // the loop does draw for Connect is the one with nothing on the cable.
        for step in WizardStep.allCases where step != .job && step != .done {
            report(step.rawValue, WizardStepContent(step: step, model: model), into: folder)
        }
        // The last step in each of the things it says: the plain end of a run,
        // the reminder a phone whose Find My is still off gets, the phone that
        // never said what it is now, a copy this Mac would not let go of, and
        // the other direction.
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
        // Everything Customize opens, with a search under its field. The rows
        // come from the demo's own canned store, so the list, the artwork it
        // falls back to and the Add buttons are drawn without asking Apple
        // anything. That store is compiled out of a Release build, so this one
        // picture is drawn by a debug build alone.
        #if DEBUG
        let searching = WizardModel(watcher: sampleWatcher([sampleDevice]))
        searching.show(
            WizardModel.Sample(
                step: .restrictions,
                udid: sampleDevice.udid,
                appSearch: WizardModel.AppSearchState(
                    storefront: "us",
                    term: "in",
                    results: DemoWorld.appResults(for: "in")
                )
            )
        )
        report("restrictions-builder", RestrictionsBuilder(model: searching), into: folder)
        #endif
        // Find My is named on the checks, so they are drawn for a phone that
        // says it is on and for one that says it is off. The one the loop
        // above drew comes from a Mac with nothing on the cable, which is the
        // third answer: no answer at all.
        for (name, findMyOn) in [("find-my-on", true), ("find-my-off", false)] {
            let phone = samplePhone(findMyOn: findMyOn)
            report(
                "ready-\(name)",
                WizardStepContent(step: .ready, model: WizardModel(watcher: sampleWatcher([phone]))),
                into: folder
            )
        }
        // The one row the checks show about the reader's own backups, in each
        // of the things it can say: a copy on this Mac, one only iCloud has,
        // one too old to lean on, none at all, and the refusal that keeps
        // Finder's own out of the app's reach for good.
        for sample in safetyNetSamples() {
            report("ready-\(sample.name)", WizardStepContent(step: .ready, model: sample.model), into: folder)
        }
        // Every phase of the one long job, which is one bar and one line in
        // each of them, and the three ends it can come to.
        let now = Date()
        for sample in jobSamples(at: now) {
            report("job-\(sample.name)", WizardStepContent(step: .job, model: sample.model), into: folder)
        }
        // The first screen in each of the things it says. The one with nothing
        // on the cable is the one the loop above drew.
        for sample in connectSamples() {
            report("connect-\(sample.name)", ConnectStep(model: sample.model), into: folder)
        }
        report("device-card", DeviceCard(device: sampleDevice), into: folder)
        report("error", ErrorText(DeviceError.trustPending.localizedDescription), into: folder)
        report("window", ContentView(), into: folder)
        exit(0)
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
                done(
                    findMyOn: true,
                    backupRemovalFailure: BackupStoreError
                        .removeFailed(
                            BackupFolder.applicationSupportRoot.appendingPathComponent(sampleDevice.udid),
                            SampleFailure()
                        )
                        .localizedDescription
                )
            ),
            (
                "done-unsupervised",
                done(findMyOn: true, direction: .unsupervise, supervisedAfterwards: false)
            ),
        ]
    }

    /// A run that is over: the phone back on the cable, whatever it said about
    /// itself when it got there, and whatever this Mac could not take away
    /// after it.
    private static func done(
        findMyOn: Bool,
        direction: WizardDirection = .supervise,
        supervisedAfterwards: Bool = true,
        backupRemovalFailure: String? = nil
    ) -> WizardModel {
        let phone = samplePhone(findMyOn: findMyOn)
        let model = WizardModel(finished: sampleWatcher([phone]))
        model.show(
            WizardModel.Sample(
                step: .done,
                direction: direction,
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
            // A phone this app has already put a profile on, which is the one
            // line the card ever grows.
            ("already-installed", restrictions(WizardModel.ProfileState())),
            // Signing and installing are one wait, so one picture covers both.
            ("installing", restrictions(WizardModel.ProfileState(stage: .installing))),
            (
                "failed",
                restrictions(
                    WizardModel.ProfileState(stage: .installed),
                    errorMessage: DeviceError
                        .profileRejected(reason: "The iPhone is not supervised.")
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
            ("backups-not-read", safetyNet(cloudBackupOn: nil, lastCloudBackup: nil)),
        ]
    }

    /// The checks for one iPhone whose own iCloud backups read a given way,
    /// and for one answer from Finder's folder on this Mac. It reads no
    /// folder: the answer is handed in, which is the only way to draw the
    /// refusal without taking Full Disk Access away from this Mac.
    private static func safetyNet(
        cloudBackupOn: Bool? = true,
        lastCloudBackup: Date?,
        finderBackup: BackupSafetyNet.Finder = .nothingHere
    ) -> WizardModel {
        let phone = samplePhone(
            findMyOn: false,
            cloudBackupOn: cloudBackupOn,
            lastCloudBackup: lastCloudBackup
        )
        let model = WizardModel(watcher: sampleWatcher([phone]))
        model.show(WizardModel.Sample(step: .ready, udid: phone.udid, finderBackup: finderBackup))
        return model
    }

    /// The job screen in every phase it has, drawn from engines that are
    /// running nothing and phones that are not there.
    ///
    /// `now` is the clock the whole set is built against, so the elapsed time
    /// and the estimate agree with each other in every picture.
    private static func jobSamples(at now: Date) -> [(name: String, model: WizardModel)] {
        [
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
            ("check-on-iphone", waiting(.checkOnIPhone, on: samplePhone(findMyOn: false))),
            ("phone-gone", waiting(.phoneGone, on: samplePhone(findMyOn: false))),
            (
                "failed-copy",
                waiting(
                    .failed(failure(BackupError.failed(DemoFailure.cableCameOut), in: .copying)),
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
        backupEncrypted: Bool = false
    ) -> ConnectedDevice {
        ConnectedDevice(
            udid: "33333333-3333333333333333",
            name: "iPhone",
            productType: "iPhone15,2",
            marketingName: "iPhone 14 Pro",
            iosVersion: "26.6.2",
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
    /// one state that offers to undo a run rather than start one.
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

    private static func report(_ name: String, _ view: some View, into folder: URL?) {
        let host = NSHostingView(rootView: AnyView(view.frame(width: WizardStyle.contentWidth)))
        host.layoutSubtreeIfNeeded()
        let size = host.fittingSize
        print("\(name): \(Int(size.width))x\(Int(size.height))")
        guard let folder, size.width > 0, size.height > 0 else { return }
        // `ImageRenderer` draws the text too, which `cacheDisplay` on the
        // hosting view does not.
        let renderer = ImageRenderer(
            content: view
                .frame(width: WizardStyle.contentWidth)
                .padding(20)
                .background(Color(nsColor: .windowBackgroundColor))
        )
        renderer.scale = 2
        guard
            let image = renderer.nsImage,
            let tiff = image.tiffRepresentation,
            let bitmap = NSBitmapImageRep(data: tiff),
            let png = bitmap.representation(using: .png, properties: [:])
        else {
            return
        }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? png.write(to: folder.appendingPathComponent("\(name).png"))
    }
}
