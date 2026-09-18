import SwiftUI

/// Step five. Put the patched backup back on the iPhone, wait for it to
/// restart, then ask it what it is now.
struct RestoreStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.restore.position(in: model.direction),
            title: "Restore",
            lead: lead,
            error: model.errorMessage
        ) {
            content
        } actions: {
            actions
        }
    }

    private var lead: String {
        switch model.restore.stage {
        case .ready:
            return """
                The phone restarts and restores from the backup. Keep the cable connected. \
                This takes about as long as the backup did.
                """
        case .running:
            return "Writing the backup back to the iPhone. Keep the cable connected."
        case .waitingForPhone:
            return "The files are back on the iPhone. It is restarting now."
        case .finished:
            return result
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.restore.stage {
        case .ready:
            TransferLog(lines: model.engine.log)
        case .running:
            TransferProgress(model: model)
        case .waitingForPhone:
            HStack(spacing: 10) {
                ProgressView()
                    .controlSize(.small)
                Text("Waiting for the phone to restart.")
                    .foregroundStyle(.secondary)
            }
        case .finished:
            if let device = model.device {
                DeviceCard(
                    device: device,
                    supervised: model.restore.supervisedAfterwards,
                    profiles: model.installedProfiles
                )
            }
        }
    }

    @ViewBuilder
    private var actions: some View {
        switch model.restore.stage {
        case .ready:
            PrimaryButton(title: "Restore now") {
                model.startRestore()
            }
        case .running:
            Button("Cancel") {
                model.cancelTransfer()
            }
            .controlSize(.large)
        case .waitingForPhone:
            EmptyView()
        case .finished:
            if model.restore.supervisedAfterwards == model.direction.target {
                PrimaryButton(title: "Continue") {
                    model.advance()
                }
            } else {
                PrimaryButton(title: "Restore again") {
                    model.startRestore()
                }
            }
        }
    }

    /// What the phone says about itself now that it is back.
    private var result: String {
        switch model.restore.supervisedAfterwards {
        case true:
            return model.direction == .supervise
                ? "This iPhone is now supervised."
                : "This iPhone still says it is supervised."
        case false:
            return model.direction == .supervise
                ? "This iPhone still says it is not supervised."
                : "This iPhone is no longer supervised."
        case nil:
            return """
                The iPhone did not come back on the cable, so this Mac cannot say what it is now. \
                Unlock the phone, keep the cable in, and look at the top of Settings.
                """
        }
    }
}
