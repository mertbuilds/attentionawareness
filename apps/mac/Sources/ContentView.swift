import SwiftUI

/// The one window: one step at a time, a Back button where stepping back is
/// safe, and the site underneath.
struct ContentView: View {
    // The model is handed in by one initialiser or the other rather than
    // written here with a default, so the demo's window cannot build a wizard
    // that watches the real bus on its way to the one it was given.
    @StateObject private var model: WizardModel

    /// The window as the app opens it, against the iPhones on the cable.
    init() {
        _model = StateObject(wrappedValue: WizardModel())
    }

    /// The window drawn from a model that was made somewhere else, which is
    /// the hidden `--demo` path: the same views and the same wizard, against a
    /// phone that is not there.
    init(demo model: WizardModel) {
        _model = StateObject(wrappedValue: model)
    }

    /// Whether this step offers a way back. Nothing steps back out of work
    /// that is already running.
    private var showsBack: Bool {
        model.step.allowsBack && !model.isBusy
    }

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
                // The button keeps its place on every step, visible only where
                // stepping back is safe. Laying it out either way is what keeps
                // the bar one height from the first step to the last, at any
                // text size, rather than a number that would have to be guessed.
                Button("Back") {
                    model.back()
                }
                .buttonStyle(TextButton())
                .opacity(showsBack ? 1 : 0)
                .disabled(!showsBack)
                .accessibilityHidden(!showsBack)
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
        // macOS rings whatever holds the keyboard in the system accent, which
        // is blue on most Macs. The window tints itself instead, and the
        // controls that are meant to be loud carry the full accent of their
        // own, so only the ring takes the softer tone.
        .tint(WizardStyle.accentSoft)
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

    /// Whether this step offers a way back. Nothing steps back out of work
    /// that is already running.
    private var showsBack: Bool {
        model.step.allowsBack && !model.isBusy
    }

    var body: some View {
        switch step {
        case .connect:
            ConnectStep(model: model)
        case .ready:
            ReadyStep(model: model)
        case .job:
            // The copy and the restore are one screen with one title, and
            // still two views: the copy until it is on this Mac, the restore
            // from then on. One view of their own takes both over.
            if model.jobShowsRestore {
                RestoreStep(model: model)
            } else {
                BackupStep(model: model)
            }
        case .restrictions:
            ProfileStep(model: model)
        case .done:
            DoneStep(model: model)
        }
    }
}
