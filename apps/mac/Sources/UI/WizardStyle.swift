import SwiftUI

/// The few looks the window does not get from the system.
///
/// Everything else is system: system font, system colours, native controls,
/// light and dark. The one colour of our own is the accent, and it is only
/// ever the primary button and the progress bar.
enum WizardStyle {
    /// The accent of the site and the extension, #ff4f00.
    static let accent = Color(.sRGB, red: 1, green: 0.310, blue: 0, opacity: 1)

    /// The same orange, lifted and softened, for the ring macOS draws around
    /// whatever holds the keyboard. A ring at full strength competes with the
    /// one button on the step that is meant to be the loudest thing on it, and
    /// the system would otherwise draw that ring in its own blue.
    static let accentSoft = Color(.sRGB, red: 1, green: 0.541, blue: 0.318, opacity: 1)
    /// The column the content sits in. Wider than this and a sentence is
    /// harder to read than it should be.
    static let contentWidth: CGFloat = 480
    static let cardRadius: CGFloat = 8

    /// Bytes as the size a person would say, so 76.8 GB rather than a number
    /// of bytes.
    static func size(_ bytes: UInt64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }

    /// A day and a time the way this Mac writes them, so 19 Sep 2026 at 07:44
    /// where the system is set to English.
    static func date(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    /// A length of time in whole words, because the copy never abbreviates a
    /// unit.
    static func elapsed(_ seconds: TimeInterval) -> String {
        let whole = max(0, Int(seconds))
        let minutes = whole / 60
        let remainder = whole % 60
        guard minutes > 0 else { return count(remainder, "second") }
        return "\(count(minutes, "minute")) \(count(remainder, "second"))"
    }

    private static func count(_ value: Int, _ unit: String) -> String {
        "\(value) \(unit)\(value == 1 ? "" : "s")"
    }
}

/// Links from the app to the site. Every one of them carries its own campaign,
/// which is the house rule for links between our own sites.
enum SiteLink {
    static var home: URL? { url(path: "/", campaign: "footer") }
    static var help: URL? { url(path: "/", campaign: "help") }

    private static func url(path: String, campaign: String) -> URL? {
        URL(string: "https://attentionawareness.com\(path)"
            + "?utm_source=mac-app&utm_medium=referral&utm_campaign=\(campaign)")
    }
}

/// The shape every step shares: the step number, a title, a sentence under it,
/// the step's own content, whatever went wrong, and the buttons at the bottom.
struct StepLayout<Content: View, Actions: View>: View {
    let position: String
    let title: String
    let lead: String?
    let error: String?
    let content: Content
    let actions: Actions

    init(
        position: String,
        title: String,
        lead: String? = nil,
        error: String? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder actions: () -> Actions
    ) {
        self.position = position
        self.title = title
        self.lead = lead
        self.error = error
        self.content = content()
        self.actions = actions()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(position)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.title2)
                    .fontWeight(.semibold)
            }

            if let lead {
                Text(lead)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            content

            if let error {
                ErrorText(error)
            }

            HStack(spacing: 10) {
                actions
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Every plain button on a step takes the orange. The filled one sets
        // its own style, so it wins over this. It sits here rather than on the
        // window so a step drawn on its own carries it too.
        .buttonStyle(TextButton())
    }
}

/// A sentence from one of the three layers. Errors are shown in the step that
/// caused them, never in a modal alert.
struct ErrorText: View {
    let sentence: String

    init(_ sentence: String) {
        self.sentence = sentence
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(sentence)
                .fixedSize(horizontal: false, vertical: true)
        }
        .font(.callout)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: WizardStyle.cardRadius))
    }
}

/// A boxed group of lines, for the device card and the summary.
struct Card<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: WizardStyle.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: WizardStyle.cardRadius)
                .strokeBorder(Color(nsColor: .separatorColor))
        )
    }
}

/// One name and one value, side by side.
struct CardRow: View {
    let name: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(name)
                .foregroundStyle(.secondary)
            Spacer(minLength: 12)
            Text(value)
                .multilineTextAlignment(.trailing)
        }
        .font(.callout)
    }
}

/// A field that draws its own ring. macOS rings the field that holds the
/// keyboard in `keyboardFocusIndicatorColor`, which is a system setting no
/// app can tint, so the system ring is left off and this one drawn instead.
struct RingedField<Content: View>: View {
    private static var radius: CGFloat { 6 }

    let focused: Bool
    @ViewBuilder let content: Content

    var body: some View {
        content
            .textFieldStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(
                Color(nsColor: .textBackgroundColor),
                in: RoundedRectangle(cornerRadius: Self.radius)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Self.radius)
                    .strokeBorder(
                        focused ? WizardStyle.accent : Color(nsColor: .separatorColor),
                        lineWidth: focused ? 2 : 1
                    )
            )
    }
}

/// A button that is only its words. A step has at most one filled button, so
/// everything beside it would otherwise be grey system furniture. The orange
/// is what says these are the things you can press.
struct TextButton: ButtonStyle {
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(configuration.isPressed ? WizardStyle.accentSoft : WizardStyle.accent)
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Rectangle())
    }
}

/// The accent button. There is one of these on a step at most.
struct PrimaryButton: View {
    let title: String
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .buttonStyle(.borderedProminent)
            .tint(WizardStyle.accent)
            .controlSize(.large)
            .disabled(!enabled)
    }
}
