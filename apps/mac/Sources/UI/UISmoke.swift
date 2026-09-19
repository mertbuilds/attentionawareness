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
        let model = WizardModel()
        // The last step is the only one that is about what a run left behind,
        // so it is drawn from a run that is already over: a phone that came
        // back, the backup it was restored from, and the backups this Mac is
        // holding. Every other step is drawn from a wizard that has not
        // started.
        let finished = WizardModel(
            sample: sampleWatcher([sampleDevice]),
            backupFolder: sampleBackups[0].url,
            backups: BackupsList(sample: sampleBackups)
        )
        for step in WizardStep.allCases {
            let drawnFrom = step == .done ? finished : model
            report(step.rawValue, WizardStepContent(step: step, model: drawnFrom), into: folder)
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
    /// being walked, so the section draws a measured row, a copy and the wait.
    private static let sampleBackups: [StoredBackup] = [
        StoredBackup(
            url: BackupFolder.applicationSupportRoot.appendingPathComponent(sampleDevice.udid),
            udid: sampleDevice.udid,
            deviceName: "iPhone",
            productType: "iPhone15,2",
            iosVersion: "26.6.2",
            date: Date(timeIntervalSince1970: 1_789_793_040),
            isEncrypted: true,
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
