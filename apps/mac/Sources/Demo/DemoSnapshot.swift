#if DEBUG
import AppKit

/// The hidden `--demo-snapshot <file>` flag, next to `--demo`.
///
/// It draws the demo's own window, on screen, in front and key, into a PNG
/// and then quits. The smoke pictures are drawn in a window nobody sees, which
/// is good for layout but has to pretend the app is in front; this is the
/// picture of the real thing, for checking colours. It needs no screen
/// recording permission, because the app only draws its own window.
///
/// `--demo-step <step>` lands the demo on that step first (for example
/// `ready`, where the backup box is also ticked), `--demo-fails` makes the
/// job that step starts fail, and `--appearance light` or `--appearance dark`
/// draws the window that way.
@MainActor
enum DemoSnapshot {
    static func scheduleIfAsked(_ model: DemoWizardModel, _ arguments: [String] = CommandLine.arguments) {
        guard let flag = arguments.firstIndex(of: "--demo-snapshot"), arguments.count > flag + 1 else { return }
        let file = URL(fileURLWithPath: arguments[flag + 1])
        if let named = arguments.firstIndex(of: "--appearance"), arguments.count > named + 1 {
            NSApplication.shared.appearance = NSAppearance(named: arguments[named + 1] == "dark" ? .darkAqua : .aqua)
        }
        let step = arguments.firstIndex(of: "--demo-step")
            .flatMap { arguments.count > $0 + 1 ? WizardStep(rawValue: arguments[$0 + 1]) : nil }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.5))
            if arguments.contains("--demo-fails") {
                model.conditions.outcome = .fails
            }
            if let step {
                model.jump(to: step)
                if step == .ready {
                    model.confirmBackup(true)
                }
            }
            // A job runs in about half a minute in the demo, and one that is
            // to fail fails during the copy.
            try? await Task.sleep(for: .seconds(step == .job ? 15 : 1.5))
            NSApplication.shared.activate(ignoringOtherApps: true)
            try? await Task.sleep(for: .seconds(0.5))
            guard let view = NSApplication.shared.windows.first(where: { $0.isVisible })?.contentView else {
                print("demo-snapshot: no window", NSApplication.shared.windows.map { "\($0.className) visible=\($0.isVisible) frame=\($0.frame)" })
                exit(1)
            }
            guard let png = picture(of: view) else {
                print("demo-snapshot: the window server gave no picture")
                exit(1)
            }
            try? png.write(to: file)
            print("demo-snapshot: key=\(view.window?.isKeyWindow == true) active=\(NSApplication.shared.isActive)")
            exit(0)
        }
    }

    /// The window as the window server shows it. An app may take a picture
    /// of its own windows without screen recording permission. The call is
    /// looked up at run time because the macOS 15 SDK hides it in favour of
    /// ScreenCaptureKit, which would ask for that permission.
    private static func picture(of view: NSView) -> Data? {
        typealias Capture = @convention(c) (CGRect, UInt32, UInt32, UInt32) -> Unmanaged<CGImage>?
        guard
            let window = view.window,
            let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage")
        else { return nil }
        let capture = unsafeBitCast(symbol, to: Capture.self)
        // Including this one window, its frame left out, at full resolution.
        guard let image = capture(.null, 1 << 3, UInt32(window.windowNumber), 1 | 1 << 3)?.takeRetainedValue() else {
            return nil
        }
        return NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
    }
}
#endif
