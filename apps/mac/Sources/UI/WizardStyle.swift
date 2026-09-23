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
/// It is the slot the pictures go in: name one and it shows here, and where
/// there is none the button holds the words alone. Hover help carries the
/// one-line fixes; this is for the places where somebody has to look at their
/// phone and a picture of it would settle the question.
struct InfoButton: View {
    let text: String
    /// The screenshot to show above the words, by name. See `InfoImage`.
    var image: String?

    @State private var shown = false

    var body: some View {
        Button {
            shown = true
        } label: {
            Image(systemName: "info.circle")
                .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .help("More")
        .accessibilityLabel("More")
        .popover(isPresented: $shown, arrowEdge: .bottom) {
            InfoPopoverContent(text: text, image: image)
        }
    }
}

/// The words the "Finish on iPhone" guide shows on the Restrictions step and
/// the Profiles screen both.
///
/// The profile is not real MDM, so `InstallProfile` only downloads it over the
/// cable: the person turns it on in Settings by hand. These tell them how, and
/// when a check comes back short, what is left to do. They live here so the two
/// screens that show the guide read from one place.
enum ProfileGuideCopy {
    /// The how-to, shown the moment the profile is downloaded and kept on
    /// screen behind every retry.
    static let steps =
        "The profile is on iPhone. To turn it on: open Settings, tap Profile "
        + "Downloaded near the top, tap Install at the top right, then enter the "
        + "passcode. Keep iPhone unlocked."

    /// The line above the steps once a check has come back short, or nil the
    /// first time through, where the steps say it all.
    static func reason(for guide: WizardModel.Guide) -> String? {
        switch guide {
        case .downloaded:
            return nil
        case .locked:
            return "Unlock iPhone, then check again."
        case .notInstalled:
            return "Not installed yet. Finish it in Settings, then check again."
        }
    }

    /// What the button that runs the check says: the first time it owns up to
    /// finishing, and after a short check it is a plain retry.
    static func confirmTitle(for guide: WizardModel.Guide) -> String {
        guide == .downloaded ? "I've Installed It" : "Check Again"
    }
}

/// Links from the app to the site. Every one of them carries its own campaign,
/// which is the house rule for links between our own sites.
enum SiteLink {
    static var home: URL? { url(path: "/", campaign: "footer") }
    static var help: URL? { url(path: "/", campaign: "help") }
    /// The share line on the last step, which is the one place the app asks
    /// for anything.
    static var done: URL? { url(path: "/", campaign: "done") }

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
    /// What the "i" beside the title holds, where the title is a claim about
    /// the iPhone somebody may want to see for themselves. Nil takes the
    /// button off the screen, which is every step but the last.
    let note: String?
    /// The screenshot that "i" shows above those words, by name.
    let noteImage: String?
    let error: String?
    let content: Content
    let actions: Actions

    init(
        title: String,
        lead: String? = nil,
        note: String? = nil,
        noteImage: String? = nil,
        error: String? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder actions: () -> Actions
    ) {
        self.title = title
        self.lead = lead
        self.note = note
        self.noteImage = noteImage
        self.error = error
        self.content = content()
        self.actions = actions()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .fixedSize(horizontal: false, vertical: true)
                if let note {
                    InfoButton(text: note, image: noteImage)
                }
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
                .foregroundStyle(ok ? Color.green : WizardStyle.accent)
            Text(text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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

/// The ring macOS draws around whatever holds the keyboard, in the same soft
/// orange the fields use, in place of the system blue. The system effect is
/// turned off so only this one shows, and the ring sits just outside the fill
/// the way the blue one did. It shows only while the view is focused and
/// enabled, so a disabled button never rings.
private struct AccentFocusRing<S: InsettableShape>: ViewModifier {
    let shape: S
    @Environment(\.isEnabled) private var enabled
    @FocusState private var focused: Bool

    func body(content: Content) -> some View {
        content
            .focused($focused)
            .focusEffectDisabled()
            .overlay {
                if focused && enabled {
                    shape
                        .strokeBorder(WizardStyle.accentSoft, lineWidth: 3)
                        .padding(-3)
                }
            }
    }
}

extension View {
    /// Draw our own focus ring in `shape` and leave the system's off.
    func accentFocusRing(_ shape: some InsettableShape) -> some View {
        modifier(AccentFocusRing(shape: shape))
    }
}

/// A button that is only its words. A step has at most one filled button, so
/// everything beside it would otherwise be grey system furniture. The orange
/// is what says these are the things you can press.
struct TextButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        RingedLabel(configuration: configuration)
    }

    /// A `ButtonStyle` cannot hold the focus state a ring needs, so the label
    /// is its own view. It draws the same orange ring the filled button does,
    /// in the rounded-rect shape a text button rings in.
    struct RingedLabel: View {
        let configuration: ButtonStyleConfiguration
        @Environment(\.isEnabled) private var enabled

        var body: some View {
            configuration.label
                .foregroundStyle(configuration.isPressed ? WizardStyle.accentSoft : WizardStyle.accent)
                .opacity(enabled ? 1 : 0.4)
                .contentShape(Rectangle())
                .accentFocusRing(RoundedRectangle(cornerRadius: 6))
        }
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
            .accentFocusRing(Capsule())
            .disabled(!enabled)
    }
}
