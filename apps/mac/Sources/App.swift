import Combine
import Sparkle
import SwiftUI

@main
struct AttentionAwarenessApp: App {
    /// Sparkle. The feed, the public key and the once-a-day schedule are in
    /// `Info.plist`; nothing here needs a delegate.
    private let updaterController: SPUStandardUpdaterController
    #if DEBUG
    /// The demo's own wizard, built only when `--demo` is on the command line.
    /// Nil is the app as it ships, which is every other way of starting it.
    /// `Sources/Demo` is compiled into debug builds alone, so a Release build
    /// has no flag, no window and no menu for it.
    private let demo: DemoWizardModel?
    /// Whether the demo bar sits under the wizard. The Demo menu's ⌘⇧D takes
    /// it out and brings it back, so the window can be shown as the product
    /// alone. It means nothing outside demo mode.
    @State private var demoBarShown = true
    #endif

    init() {
        // `attention awareness.app/Contents/MacOS/attention awareness --devices`
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

        // `--patch <backup folder> [--unsupervise]` loads a backup folder,
        // plans the change, applies it and checks it, printing every step. It
        // is how `Patch/` is checked against a real backup without the window.
        PatchCommandLine.runIfAsked()

        // `--sign-profile <file>` asks the site to sign the profile the
        // Restrictions screen installs and writes it, which is how the signing
        // side is checked without an iPhone.
        ProfileCommandLine.runIfAsked()

        // `--ui-smoke` builds every step of the wizard offscreen and prints
        // the size each one asks for, so the window can be checked without a
        // display and without an iPhone.
        UISmoke.runIfAsked()

        // `--demo` opens the window on a wizard that reaches no iPhone, no
        // disk and no site, with a bar under it for driving the states by
        // hand. It is the one flag that stays and opens a window, and the one
        // a Release build does not have at all.
        #if DEBUG
        let demo = DemoWizardModel.ifAsked()
        self.demo = demo
        let startUpdater = demo == nil
        #else
        let startUpdater = true
        #endif

        // Last, so that every flag above leaves without ever asking the site
        // for an update. The demo asks it for nothing either.
        updaterController = SPUStandardUpdaterController(
            startingUpdater: startUpdater,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    var body: some Scene {
        Window("attention awareness", id: "main") {
            #if DEBUG
            if let demo {
                DemoWindow(model: demo, barShown: demoBarShown)
            } else {
                ContentView()
                    .frame(minWidth: 560, minHeight: 520)
            }
            #else
            ContentView()
                .frame(minWidth: 560, minHeight: 520)
            #endif
        }
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(after: .appInfo) {
                CheckForUpdatesButton(updater: updaterController.updater)
            }
            CommandGroup(replacing: .help) {
                if let url = SiteLink.help {
                    Link("attention awareness Help", destination: url)
                }
            }
            // Demo mode only, in a debug build only. The app as it ships has
            // no Demo menu.
            #if DEBUG
            if demo != nil {
                CommandMenu("Demo") {
                    Button(demoBarShown ? "Hide Demo Bar" : "Show Demo Bar") {
                        demoBarShown.toggle()
                    }
                    .keyboardShortcut("d", modifiers: [.command, .shift])
                }
            }
            #endif
        }
    }
}

/// The app menu's update item. Sparkle turns it off while a check is already
/// running, which is what `canCheckForUpdates` publishes.
private struct CheckForUpdatesButton: View {
    let updater: SPUUpdater
    @State private var canCheck = false

    var body: some View {
        Button("Check for Updates") {
            updater.checkForUpdates()
        }
        .disabled(!canCheck)
        .onReceive(updater.publisher(for: \.canCheckForUpdates)) { canCheck = $0 }
    }
}
