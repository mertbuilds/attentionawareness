import SwiftUI

/// The one window: one step at a time, a Back button where stepping back is
/// safe, and the site underneath.
struct ContentView: View {
    @StateObject private var model = WizardModel()

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                WizardStepContent(step: model.step, model: model)
                    .frame(maxWidth: WizardStyle.contentWidth, alignment: .leading)
                    .padding(28)
                    .frame(maxWidth: .infinity)
            }

            Divider()

            HStack {
                if model.step.allowsBack, !model.isBusy {
                    Button("Back") {
                        model.back()
                    }
                }
                Spacer()
                if let url = SiteLink.home {
                    Link("attentionawareness.com", destination: url)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        // A quiet footer line, not a control: while a step has
                        // nothing to focus, AppKit would otherwise land the
                        // keyboard focus ring on it.
                        .focusable(false)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

/// The step on screen.
///
/// It takes the step rather than reading it off the model, so the hidden
/// `--ui-smoke` flag can build every one of them in turn without walking the
/// wizard through a real iPhone.
struct WizardStepContent: View {
    let step: WizardStep
    @ObservedObject var model: WizardModel

    var body: some View {
        switch step {
        case .connect:
            ConnectStep(model: model)
        case .checks:
            ChecksStep(model: model)
        case .backUp:
            BackupStep(model: model)
        case .patch:
            PatchStep(model: model)
        case .restore:
            RestoreStep(model: model)
        case .profile:
            ProfileStep(model: model)
        case .done:
            DoneStep(model: model)
        }
    }
}
