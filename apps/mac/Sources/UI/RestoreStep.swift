import SwiftUI

/// Step five. Put the patched backup back on the iPhone, wait for it to
/// restart, then ask it what it is now.
///
/// This is where Find My is finally asked for: the iPhone refuses a restore
/// while it is on. The step waits for the phone to say it is off rather than
/// sending a restore that would be turned away.
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
            guard model.restoreGate == .allowed else {
                return """
                    The iPhone refuses a restore while Find My iPhone is on. \
                    This reads the phone every few seconds, and the button turns on by itself \
                    once the phone says Find My is off.
                    """
            }
            return [
                "The phone restarts and restores from the backup. Keep the cable connected.",
                model.restoreExpectation,
            ].compactMap { $0 }.joined(separator: " ")
        case .running:
            return running
        case .waitingForPhone:
            return "The files are back on the iPhone. It is restarting now."
        case .finished:
            return result
        }
    }

    /// What is happening while the helper has the phone.
    ///
    /// The engine moves to `.finishing` the moment the last of the bytes are
    /// across, and from there the iPhone is the one working: it opens the
    /// backup and writes it over itself, which takes longer than the copying
    /// did and which this Mac can see none of. The step used to go on saying
    /// the files were still being written, with the bar pinned at 100%, while
    /// the phone said it was still restoring. This is the sentence that says
    /// what is actually happening.
    private var running: String {
        guard model.engine.phase == .finishing else {
            return "Writing the backup back to the iPhone. Keep the cable connected."
        }
        return """
            Every file is on the iPhone now and the phone is applying them. This is the slow part, \
            and it takes longer than the copying did. This Mac cannot see how far along the phone is, \
            so watch the progress bar on the iPhone itself. Keep the cable connected.
            """
    }

    @ViewBuilder
    private var content: some View {
        switch model.restore.stage {
        case .ready:
            if model.restoreGate == .allowed {
                TransferLog(lines: model.engine.log)
            } else {
                CheckRow(
                    result: .waiting,
                    title: "Find My iPhone is on",
                    detail: WizardGate.turnFindMyOff
                )
            }
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
            PrimaryButton(title: "Restore now", enabled: model.restoreGate == .allowed) {
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
