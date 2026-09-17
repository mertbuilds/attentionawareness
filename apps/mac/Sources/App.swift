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
    }

    var body: some Scene {
        Window("Attention Awareness", id: "main") {
            ContentView()
                .frame(minWidth: 560, minHeight: 520)
        }
        .windowResizability(.contentMinSize)
    }
}
