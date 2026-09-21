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

}

/// A small "i" holding one more sentence than the screen has room for.
///
/// It is the slot the films go in: where one exists it will play here, and
/// until then the button holds the words. Hover help carries the one-line
/// fixes; this is for the places where somebody has to look at their phone and
/// a picture of it would settle the question.
struct InfoButton: View {
    let text: String

    @State private var shown = false

    var body: some View {
        Button {
            shown = true
        } label: {
            Image(systemName: "info.circle")
                .foregroundStyle(WizardStyle.accent)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More")
        .popover(isPresented: $shown) {
            Text(text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
                .frame(width: 260, alignment: .leading)
                .padding(14)
        }
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

/// The shape every step shares: a title, a sentence under it, the step's own
/// content, whatever went wrong, and the buttons at the bottom.
struct StepLayout<Content: View, Actions: View>: View {
    let title: String
    let lead: String?
    let error: String?
    let content: Content
    let actions: Actions

    init(
        title: String,
        lead: String? = nil,
        error: String? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder actions: () -> Actions
    ) {
        self.title = title
        self.lead = lead
        self.error = error
        self.content = content()
        self.actions = actions()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
                .fixedSize(horizontal: false, vertical: true)

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

/// One check, in one line. A tick when it is fine, an orange dot and the one
/// thing to do when it is not. Anything longer than the line goes in the hover
/// help, where it costs a reader with nothing to fix nothing at all.
struct CheckLine: View {
    let ok: Bool
    let text: String
    var help: String?

    @ViewBuilder
    var body: some View {
        if let help {
            line.help(help)
        } else {
            line
        }
    }

    private var line: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: ok ? "checkmark.circle.fill" : "circle.fill")
                .foregroundStyle(ok ? Color.green : Color.orange)
            Text(text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// One line of a checklist, with a sentence under it. A check that cannot be
/// read shows as unknown and blocks nothing: the user is told, and the work is
/// allowed to try.
struct CheckRow: View {
    enum Result {
        case pass
        case waiting
        case unknown
    }

    let result: Result
    let title: String
    let detail: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                if let detail {
                    Text(detail)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var symbol: String {
        switch result {
        case .pass: return "checkmark.circle.fill"
        case .waiting: return "circle"
        case .unknown: return "questionmark.circle"
        }
    }

    private var tint: Color {
        result == .pass ? .green : .secondary
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
