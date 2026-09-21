import SwiftUI

/// Step three. Copy everything off the iPhone onto this Mac.
struct BackupStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: WizardStep.job.title(for: model.direction),
            lead: lead,
            error: model.errorMessage
        ) {
            content
        } actions: {
            actions
        }
    }

    private var lead: String {
        switch model.engine.phase {
        case .idle:
            return [
                "This copies everything on the iPhone to this Mac. Keep the cable connected.",
                model.backupExpectation,
            ].compactMap { $0 }.joined(separator: " ")
        case .starting:
            return "Starting the copy. The iPhone takes a moment to answer."
        case .transferring:
            return "Copying the iPhone to this Mac. Keep the cable connected."
        case .finishing:
            return "The iPhone is closing the snapshot. This is the slow part."
        case .done:
            return "The copy is on this Mac."
        case .cancelled:
            return "The copy was cancelled. Nothing on the iPhone changed."
        case .failed:
            return "The copy stopped."
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.engine.phase.isRunning {
            TransferProgress(model: model)
        } else {
            TransferLog(lines: model.engine.log)
        }
    }

    @ViewBuilder
    private var actions: some View {
        switch model.engine.phase {
        case .starting, .transferring, .finishing:
            Button("Cancel") {
                model.cancelTransfer()
            }
            .controlSize(.large)
        case .done:
            PrimaryButton(title: "Continue") {
                model.showRestore()
            }
            Button("Copy again") {
                model.startBackup()
            }
            .controlSize(.large)
        case .cancelled, .failed:
            PrimaryButton(title: "Try again") {
                model.startBackup()
            }
        case .idle:
            PrimaryButton(title: "Copy") {
                model.startBackup()
            }
        }
    }
}
