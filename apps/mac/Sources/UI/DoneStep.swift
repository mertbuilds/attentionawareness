import SwiftUI

/// The last screen. What the iPhone is now, whatever is left to do with it,
/// and the way back to the start.
///
/// It says nothing about the copy. The copy was scaffolding this app put up
/// and took down again, and telling somebody their scaffolding is gone still
/// leaves them thinking about scaffolding. The one exception is a folder that
/// would not go, because then a copy of the phone really is still here.
struct DoneStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: WizardStep.done.title(for: model.direction),
            note: DoneCopy.note(direction: model.direction),
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(lines, id: \.self) { line in
                    Text(line)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let failure = model.backupRemovalFailure {
                    leftover(failure)
                }

                share
            }
        } actions: {
            PrimaryButton(title: "Done") {
                model.startOver()
            }
        }
    }

    /// The body, worked out from the three things it turns on.
    private var lines: [String] {
        DoneCopy.lines(
            direction: model.direction,
            findMyOff: model.device?.findMyOn == false,
            matched: model.restore.supervisedAfterwards == model.direction.target
        )
    }

    /// The one line this screen ever says about a copy, with the path and what
    /// macOS said behind the "i". It is here and nowhere else in the run,
    /// because this is the one thing somebody has to act on: the folder is
    /// still on this Mac and they may want to take it off themselves.
    private func leftover(_ failure: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("A leftover copy is still on this Mac.")
                .fixedSize(horizontal: false, vertical: true)
            InfoButton(text: failure)
        }
        .font(.callout)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The one thing the app ever asks for, at the one moment somebody has a
    /// supervised phone in their hand and a reason to mean it.
    private var share: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("Know someone who needs this?")
                .foregroundStyle(.secondary)
            if let url = SiteLink.done {
                Link("attentionawareness.com", destination: url)
                    .foregroundStyle(WizardStyle.accent)
            }
        }
        .font(.callout)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
