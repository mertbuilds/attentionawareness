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
        for step in WizardStep.allCases {
            report(step.rawValue, WizardStepContent(step: step, model: model), into: folder)
        }
        report("device-card", DeviceCard(device: sampleDevice, supervised: false), into: folder)
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
