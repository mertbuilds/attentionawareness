import SwiftUI

/// The few looks the window does not get from the system.
///
/// Everything else is system: system font, system colours, native controls,
/// light and dark. The one colour of our own is the accent, and it is only
/// ever the primary button and the progress bar.
enum WizardStyle {
    /// The accent of the site and the extension, #ff4f00.
    static let accent = Color(.sRGB, red: 1, green: 0.310, blue: 0, opacity: 1)
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
    static var help: URL? { url(path: "/supervise", campaign: "help") }
    static var build: URL? { url(path: "/build", campaign: "profile") }

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
