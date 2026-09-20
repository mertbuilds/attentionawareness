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
        // Two steps are about what is already on this Mac rather than about a
        // run that has not started, so each is drawn from its own model. The
        // last one is a run that is already over: a phone that came back, the
        // backup it was restored from, and the backups this Mac is holding.
        // The Back up step is a run that has picked a phone whose backup is
        // already here, which is the offer it makes instead of another hour on
        // the cable.
        let finished = WizardModel(
            sample: sampleWatcher([sampleDevice]),
            backupFolder: sampleBackups[0].url,
            backups: BackupsList(sample: sampleBackups)
        )
        let offered = WizardModel(
            sample: sampleWatcher([sampleDevice]),
            waitingOn: sampleDevice.udid,
            backups: BackupsList(sample: sampleBackups)
        )
        let drawnFrom: [WizardStep: WizardModel] = [.backUp: offered, .done: finished]
        for step in WizardStep.allCases {
            report(step.rawValue, WizardStepContent(step: step, model: drawnFrom[step] ?? model), into: folder)
        }
        // The same step for a phone this Mac holds nothing for, which is the
        // one it has always drawn, and for a phone whose folder the iPhone
        // never finished writing.
        report("backUp-nothing-here", WizardStepContent(step: .backUp, model: model), into: folder)
        report(
            "backUp-unfinished",
            WizardStepContent(
                step: .backUp,
                model: WizardModel(
                    sample: sampleWatcher([sampleDevice]),
                    waitingOn: sampleBackups[2].udid,
                    backups: BackupsList(sample: sampleBackups)
                )
            ),
            into: folder
        )
        // Find My is named on the checks and asked for on the restore, so both
        // steps are drawn for a phone that says it is on and for one that says
        // it is off. The two the loop above drew come from a Mac with nothing
        // on the cable, which is the third answer: no answer at all.
        for (name, findMyOn) in [("find-my-on", true), ("find-my-off", false)] {
            let phone = WizardModel(watcher: sampleWatcher([samplePhone(findMyOn: findMyOn)]))
            report("checks-\(name)", WizardStepContent(step: .checks, model: phone), into: folder)
            report("restore-\(name)", WizardStepContent(step: .restore, model: phone), into: folder)
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
        dataCapacity: 128_000_000_000,
        dataAvailable: 40_000_000_000,
        pairingState: .paired
    )

    /// A trusted iPhone with Find My on or off and nothing else changed between
    /// the two, so the checks row and the restore gate can be drawn each way.
    /// Its backups are not encrypted, which keeps the password field out of
    /// those pictures and leaves the button saying only what Find My did to it.
    private static func samplePhone(findMyOn: Bool) -> ConnectedDevice {
        ConnectedDevice(
            udid: "33333333-3333333333333333",
            name: "iPhone",
            productType: "iPhone15,2",
            marketingName: "iPhone 14 Pro",
            iosVersion: "26.6.2",
            findMyOn: findMyOn,
            backupEncrypted: false,
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

    /// Backups on a Mac that has none: the one this run made, an older phone
    /// whose untouched copy is still beside it, and one whose folder is still
    /// being walked and which the iPhone never finished writing, so the
    /// section draws a measured row, a copy and the wait, and the Back up step
    /// draws both an offer and a folder it cannot offer.
    private static let sampleBackups: [StoredBackup] = [
        StoredBackup(
            url: BackupFolder.applicationSupportRoot.appendingPathComponent(sampleDevice.udid),
            udid: sampleDevice.udid,
            deviceName: "iPhone",
            productType: "iPhone15,2",
            iosVersion: "26.6.2",
            date: Date(timeIntervalSince1970: 1_789_793_040),
            isEncrypted: true,
            snapshotState: BackupStatus.finishedSnapshot,
            sizeInBytes: 67_882_442_752,
            pristineURL: nil,
            pristineSizeInBytes: nil
        ),
        StoredBackup(
            url: BackupFolder.applicationSupportRoot.appendingPathComponent(sampleSecondDevice.udid),
            udid: sampleSecondDevice.udid,
            deviceName: "Work iPhone",
            productType: "iPhone17,1",
            iosVersion: "26.6.2",
            date: Date(timeIntervalSince1970: 1_788_372_600),
            isEncrypted: false,
            snapshotState: BackupStatus.finishedSnapshot,
            sizeInBytes: 41_203_889_152,
            pristineURL: SupervisionPatch.pristineRoot(forBackupRoot: BackupFolder.applicationSupportRoot)
                .appendingPathComponent("\(sampleSecondDevice.udid)-20260902-211000"),
            pristineSizeInBytes: 41_112_616_960
        ),
        StoredBackup(
            url: BackupFolder.applicationSupportRoot.appendingPathComponent("22222222-2222222222222222"),
            udid: "22222222-2222222222222222",
            deviceName: "Old iPhone",
            productType: "iPhone13,2",
            iosVersion: "26.4.1",
            date: Date(timeIntervalSince1970: 1_784_009_100),
            isEncrypted: false,
            snapshotState: "uploading",
            sizeInBytes: nil,
            pristineURL: nil,
            pristineSizeInBytes: nil
        ),
    ]

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
