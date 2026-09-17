import SwiftUI

/// Step four. Set the supervision flag inside the backup that is now on this
/// Mac. Nothing here touches the iPhone.
struct PatchStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.patch.position(in: model.direction),
            title: "Patch",
            lead: lead,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if model.patch.isRunning, let status = model.patch.status {
                    HStack(spacing: 10) {
                        ProgressView()
                            .controlSize(.small)
                        Text(status)
                            .foregroundStyle(.secondary)
                    }
                }

                if !model.patch.changes.isEmpty {
                    Card {
                        ForEach(model.patch.changes, id: \.self) { change in
                            Text(Self.arrow(change))
                                .font(.callout)
                                .monospaced()
                        }
                    }
                }

                if let pristine = model.patch.pristinePath {
                    Text("An untouched copy of the backup is at \(pristine).")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }

                if model.errorMessage != nil, model.needsPassword {
                    BackupPasswordField(model: model)
                }
            }
        } actions: {
            if model.errorMessage != nil {
                PrimaryButton(title: "Try again") {
                    model.runPatch()
                }
            } else if model.patch.alreadyCorrect {
                PrimaryButton(title: "Continue") {
                    model.advance()
                }
            }
        }
    }

    private var lead: String {
        if model.errorMessage != nil {
            return "The backup was not changed."
        }
        if model.patch.alreadyCorrect {
            return "The backup already says \(model.direction == .supervise ? "supervised" : "not supervised")."
        }
        if model.patch.isRunning {
            return "Setting the supervision flag in the backup on this Mac."
        }
        return "The backup now says what it should."
    }

    /// The layers write their change lines with a plain arrow. The window
    /// draws the real one.
    static func arrow(_ change: String) -> String {
        change.replacingOccurrences(of: " -> ", with: " → ")
    }
}
