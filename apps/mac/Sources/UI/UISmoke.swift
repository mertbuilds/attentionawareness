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
        // The last step is about a run that is already over rather than about
        // one that has not started, so it is drawn from a model of its own: a
        // phone that came back on the cable saying it is supervised.
        let finished = WizardModel(finished: sampleWatcher([sampleDevice]))
        let drawnFrom: [WizardStep: WizardModel] = [.done: finished]
        for step in WizardStep.allCases {
            report(step.rawValue, WizardStepContent(step: step, model: drawnFrom[step] ?? model), into: folder)
        }
        // The last step again, for the one thing it ever says about the
        // backup: a folder that would not go, which is still on this Mac.
        report("done-backup-kept", WizardStepContent(step: .done, model: keptBackup()), into: folder)
        // The checks with the line about a backup an earlier run left behind,
        // which this one cleared on its way in.
        report(
            "checks-leftover-cleared",
            WizardStepContent(step: .checks, model: clearedLeftover()),
            into: folder
        )
        // The Profile step with a search under its field. The rows come from
        // the demo's own canned store, so the list, the artwork it falls back
        // to and the Add buttons are drawn without asking Apple anything. That
        // store is compiled out of a Release build, so this one picture is
        // drawn by a debug build alone.
        #if DEBUG
        let searching = WizardModel(watcher: sampleWatcher([sampleDevice]))
        searching.show(
            WizardModel.Sample(
                step: .profile,
                udid: sampleDevice.udid,
                appSearch: WizardModel.AppSearchState(
                    storefront: "us",
                    term: "in",
                    results: DemoWorld.appResults(for: "in")
                )
            )
        )
        report("profile-search", WizardStepContent(step: .profile, model: searching), into: folder)
        #endif
        // Find My is named on the checks and asked for on the restore, so both
        // steps are drawn for a phone that says it is on and for one that says
        // it is off. The two the loop above drew come from a Mac with nothing
        // on the cable, which is the third answer: no answer at all.
        for (name, findMyOn) in [("find-my-on", true), ("find-my-off", false)] {
            let phone = samplePhone(findMyOn: findMyOn)
            report(
                "checks-\(name)",
                WizardStepContent(step: .checks, model: WizardModel(watcher: sampleWatcher([phone]))),
                into: folder
            )
            report("restore-\(name)", RestoreStep(model: arriving(phone, patch: patchDone)), into: folder)
        }
        // The Restore step patches the copy on the way in, so it says three
        // things before the button: the patch running, the patch that would
        // not run, and the copy patched, that last one with the change lines
        // unfolded.
        report(
            "restore-patching",
            RestoreStep(
                model: arriving(
                    samplePhone(findMyOn: false),
                    patch: WizardModel.PatchState(status: "Writing the flag", isRunning: true)
                )
            ),
            into: folder
        )
        report(
            "restore-patch-failed",
            RestoreStep(
                model: arriving(
                    sampleDevice,
                    patch: WizardModel.PatchState(),
                    errorMessage: PatchError.wrongPassword.localizedDescription
                )
            ),
            into: folder
        )
        report(
            "restore-ready",
            RestoreStep(model: arriving(samplePhone(findMyOn: false), patch: patchDone), showsDetails: true),
            into: folder
        )
        // The one row the checks show about the reader's own backups, in each
        // of the things it can say: a copy on this Mac, one only iCloud has,
        // one too old to lean on, none at all, and the refusal that keeps
        // Finder's own out of the app's reach for good.
        for sample in safetyNetSamples() {
            report("checks-\(sample.name)", WizardStepContent(step: .checks, model: sample.model), into: folder)
        }
        // Everything the Restore step says once the helper has the phone: the
        // files moving with a figure for how much longer, the same thing too
        // early to have one, every file across and the iPhone applying them,
        // and the wait for the phone to come back. The third of these is the
        // one that used to go on saying the files were still being written.
        let now = Date()
        for sample in restoreSamples(at: now) {
            report("restore-\(sample.name)", WizardStepContent(step: .restore, model: sample.model), into: folder)
        }
        report("connect-one-phone", ConnectStep(model: sampleModel([sampleDevice])), into: folder)
        report(
            "connect-two-phones",
            ConnectStep(model: sampleModel([sampleDevice, sampleSecondDevice])),
            into: folder
        )
        report(
            "device-card",
            DeviceCard(device: sampleDevice, supervised: false, profiles: sampleProfiles),
            into: folder
        )
        report("error", ErrorText(DeviceError.trustPending.localizedDescription), into: folder)
        report("window", ContentView(), into: folder)
        exit(0)
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
        model.show(WizardModel.Sample(step: .checks, udid: phone.udid, finderBackup: finderBackup))
        return model
    }

    /// The Restore step as a run arrives on it, with the patch in whatever
    /// state the picture is about. The step patches the copy on the way in, so
    /// everything it says before the button is drawn from one of these.
    private static func arriving(
        _ device: ConnectedDevice,
        patch: WizardModel.PatchState,
        errorMessage: String? = nil
    ) -> WizardModel {
        let model = WizardModel(watcher: sampleWatcher([device]))
        model.show(
            WizardModel.Sample(
                step: .restore,
                udid: device.udid,
                patch: patch,
                errorMessage: errorMessage
            )
        )
        return model
    }

    /// A patch that has run: the two flags a supervise run writes, and where
    /// the untouched copy of the backup went.
    private static let patchDone = WizardModel.PatchState(
        changes: ["IsSupervised: false -> true", "CloudConfigurationUIComplete: false -> true"],
        pristinePath: SupervisionPatch
            .pristineRoot(forBackupRoot: BackupFolder.applicationSupportRoot)
            .path
    )

    /// The Restore step in each of the states the helper puts it in, drawn
    /// from engines that are running nothing.
    ///
    /// `now` is the clock the whole set is built against, so the elapsed time
    /// and the estimate agree with each other in every picture.
    private static func restoreSamples(at now: Date) -> [(name: String, model: WizardModel)] {
        [
            (
                "transferring",
                restoring(
                    phase: .transferring(
                        progress: 0.42,
                        filesDone: 29_104,
                        filesTotal: nil,
                        bytes: "18.4 MB / 44.1 MB"
                    ),
                    progress: 0.42,
                    stage: .running,
                    estimate: settledEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-720)
                )
            ),
            (
                "transferring-too-early",
                restoring(
                    phase: .transferring(
                        progress: 0.01,
                        filesDone: 412,
                        filesTotal: nil,
                        bytes: "2.1 MB / 9.7 MB"
                    ),
                    progress: 0.01,
                    stage: .running,
                    estimate: youngEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-20)
                )
            ),
            (
                "finishing",
                restoring(
                    phase: .finishing,
                    progress: 1,
                    stage: .running,
                    estimate: settledEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-1_740)
                )
            ),
            (
                "waiting-for-phone",
                restoring(
                    phase: .finishing,
                    progress: 1,
                    stage: .waitingForPhone,
                    estimate: settledEstimate(endingAt: now),
                    startedAt: now.addingTimeInterval(-2_460)
                )
            ),
        ]
    }

    /// One restore in flight: the phase and the progress the helper would be
    /// printing, the stage the wizard would be in, and an estimate fed the
    /// readings that put it there.
    private static func restoring(
        phase: BackupEngine.Phase,
        progress: Double,
        stage: WizardModel.RestoreStage,
        estimate: TransferEstimate,
        startedAt: Date
    ) -> WizardModel {
        WizardModel(
            sample: sampleWatcher([samplePhone(findMyOn: false)]),
            restoring: BackupEngine(sample: phase, progress: progress, log: sampleLog),
            stage: stage,
            estimate: estimate,
            startedAt: startedAt
        )
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
    /// Its backups are not encrypted, which keeps the password field out of
    /// those pictures and leaves the button saying only what Find My did to it.
    private static func samplePhone(
        findMyOn: Bool,
        cloudBackupOn: Bool? = true,
        lastCloudBackup: Date? = Date().addingTimeInterval(-dayInSeconds)
    ) -> ConnectedDevice {
        ConnectedDevice(
            udid: "33333333-3333333333333333",
            name: "iPhone",
            productType: "iPhone15,2",
            marketingName: "iPhone 14 Pro",
            iosVersion: "26.6.2",
            findMyOn: findMyOn,
            backupEncrypted: false,
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

    /// What MCInstall would say about the first sample phone.
    private static let sampleConfiguration = CloudConfiguration(
        isSupervised: false,
        organizationName: nil,
        raw: "<dict/>"
    )

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
                step: .checks,
                udid: samplePhone(findMyOn: false).udid,
                clearedLeftoverBackup: true
            )
        )
        return model
    }

    /// A run that is over and could not take its backup off the disk, which is
    /// the one sentence the last step ever says about a backup.
    private static func keptBackup() -> WizardModel {
        let model = WizardModel(finished: sampleWatcher([sampleDevice]))
        model.show(
            WizardModel.Sample(
                step: .done,
                udid: sampleDevice.udid,
                restore: WizardModel.RestoreState(stage: .finished, supervisedAfterwards: true),
                backupRemovalFailure: BackupStoreError
                    .removeFailed(
                        BackupFolder.applicationSupportRoot.appendingPathComponent(sampleDevice.udid),
                        SampleFailure()
                    )
                    .localizedDescription
            )
        )
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
