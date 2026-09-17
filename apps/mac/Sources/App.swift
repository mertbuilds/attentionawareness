import SwiftUI

@main
struct AttentionAwarenessApp: App {
    init() {
        // `Attention Awareness.app/Contents/MacOS/Attention Awareness --devices`
        // prints the connected device count and exits. It proves the app links
        // and loads the vendored libimobiledevice without opening a window.
        if CommandLine.arguments.contains("--devices") {
            print(DeviceProbe.connectedDeviceCount())
            exit(0)
        }

        // `--probe` prints what the device layer reads from every connected
        // iPhone as JSON. It is a development aid for checking `Device/`
        // without the window.
        if CommandLine.arguments.contains("--probe") {
            DeviceReport.printJSON()
            exit(0)
        }

        // `--backup <udid> <root>` and `--restore <udid> <root>` run the
        // backup engine from a terminal, print every phase change and exit 0
        // or 1. They are how `Backup/` is checked against a real iPhone
        // without the window. Ctrl+C cancels the run.
        BackupCommandLine.runIfAsked()
    }

    var body: some Scene {
        Window("Attention Awareness", id: "main") {
            ContentView()
                .frame(minWidth: 560, minHeight: 520)
        }
        .windowResizability(.contentMinSize)
    }
}
