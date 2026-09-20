import SwiftUI

/// Step four. Set the supervision flag inside the backup that is now on this
/// Mac. Nothing here touches the iPhone.
struct PatchStep: View {
    @ObservedObject var model: WizardModel

    @State private var showsDetails = false

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

                if model.patch.pristinePath != nil {
                    Text("The backup this iPhone made was copied first, so nothing it holds was written over.")
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // The flag names and the path are the engine talking. They are
                // the truth of what happened and worth keeping, but nobody
                // needs to read a property list to know the step worked.
                if !model.patch.changes.isEmpty || model.patch.pristinePath != nil {
                    DisclosureGroup(isExpanded: $showsDetails) {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(model.patch.changes, id: \.self) { change in
                                Text(Self.arrow(change))
                                    .font(.caption)
                                    .monospaced()
                                    .textSelection(.enabled)
                            }
                            if let pristine = model.patch.pristinePath {
                                Text("Untouched copy: \(pristine)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .textSelection(.enabled)
                            }
                        }
                        .padding(.top, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } label: {
                        Text("Details")
                            .font(.callout)
                            .contentShape(Rectangle())
                            .onTapGesture { showsDetails.toggle() }
                    }
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
            } else if hasResult {
                PrimaryButton(title: "Continue") {
                    model.advance()
                }
            }
        }
    }

    /// Whether the patch has something to show. Until it has, there is nothing
    /// to continue from.
    private var hasResult: Bool {
        !model.patch.isRunning && (!model.patch.changes.isEmpty || model.patch.alreadyCorrect)
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
        return model.direction == .supervise
            ? "The backup now says this iPhone is supervised."
            : "The backup now says this iPhone is not supervised."
    }

    /// The layers write their change lines with a plain arrow. The window
    /// draws the real one.
    static func arrow(_ change: String) -> String {
        change.replacingOccurrences(of: " -> ", with: " → ")
    }
}
