import SwiftUI

/// Step four. Mark the copy on this Mac as supervised, put it back on the
/// iPhone, wait for it to restart, then ask it what it is now.
///
/// The patch runs on the way in rather than on a step of its own. It changes
/// one flag in a folder on this Mac and there is nothing to decide about it,
/// so what it wrote belongs over the button that sends the copy back rather
/// than on a screen with no button at all.
///
/// This is also where Find My is finally asked for: the iPhone refuses a
/// restore while it is on. The step waits for the phone to say it is off
/// rather than sending a restore that would be turned away.
struct RestoreStep: View {
    @ObservedObject var model: WizardModel

    /// Whether the raw change lines are unfolded. It is handed in so the
    /// hidden `--ui-smoke` path can draw the step with them open; everything
    /// that builds the step for a reader takes the default.
    @State private var showsDetails: Bool

    init(model: WizardModel, showsDetails: Bool = false) {
        _model = ObservedObject(wrappedValue: model)
        _showsDetails = State(initialValue: showsDetails)
    }

    /// Where the patch is, which is what the step says and offers before
    /// anything is sent to the phone.
    private enum Arrival {
        case patching
        case failed
        case patched
    }

    private var arrival: Arrival {
        if model.patch.isRunning { return .patching }
        return model.patch.hasResult ? .patched : .failed
    }

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
            return ready
        case .running:
            return running
        case .waitingForPhone:
            return "The files are back on the iPhone. It is restarting now."
        case .finished:
            return result
        }
    }

    /// What the step says before anything is sent to the phone: the patch
    /// while it runs, then what it wrote, and beside that either why the
    /// button is off or what pressing it will do.
    private var ready: String {
        switch arrival {
        case .patching:
            return model.direction == .supervise
                ? "Marking the copy as supervised…"
                : "Marking the copy as not supervised…"
        case .failed:
            return "The copy was not changed."
        case .patched:
            return [patched, sending].joined(separator: " ")
        }
    }

    /// What the patch wrote, which is the whole point of the run.
    private var patched: String {
        model.direction == .supervise
            ? "The copy now says this iPhone is supervised."
            : "The copy now says this iPhone is not supervised."
    }

    /// Why the button is off, or what pressing it will do.
    private var sending: String {
        guard model.restoreGate == .allowed else {
            return """
                The iPhone refuses a restore while Find My iPhone is on. \
                This reads the phone every few seconds, and the button turns on by itself \
                once the phone says Find My is off.
                """
        }
        return [
            "The phone restarts and restores from the copy. Keep the cable connected.",
            model.restoreExpectation,
        ].compactMap { $0 }.joined(separator: " ")
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
            return "Writing the copy back to the iPhone. Keep the cable connected."
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
            waiting
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

    /// The step before the restore is sent: the patch running, the patch
    /// refused, or the copy patched and waiting on Find My or on the button.
    @ViewBuilder
    private var waiting: some View {
        switch arrival {
        case .patching:
            HStack(spacing: 10) {
                ProgressView()
                    .controlSize(.small)
                if let status = model.patch.status {
                    Text(status)
                        .foregroundStyle(.secondary)
                }
            }
        case .failed:
            // An encrypted copy the patch could not open is the one failure a
            // reader can do something about, and this is where they do it.
            if model.needsPassword {
                BackupPasswordField(model: model)
            }
        case .patched:
            VStack(alignment: .leading, spacing: 12) {
                if model.restoreGate == .blockedByFindMy {
                    CheckRow(
                        result: .waiting,
                        title: "Find My iPhone is on",
                        detail: WizardGate.turnFindMyOff
                    )
                }
                details
            }
        }
    }

    /// The flag names and the path, folded away. They are the patch talking:
    /// the truth of what happened and worth keeping, but nobody needs to read
    /// a property list to know the copy is ready to go back.
    @ViewBuilder
    private var details: some View {
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
                        Text("An untouched version was kept first, so nothing in the copy was written over.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
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
    }

    @ViewBuilder
    private var actions: some View {
        switch model.restore.stage {
        case .ready:
            switch arrival {
            case .patching:
                EmptyView()
            case .failed:
                PrimaryButton(title: "Try again") {
                    model.runPatch()
                }
            case .patched:
                PrimaryButton(title: "Restore now", enabled: model.restoreGate == .allowed) {
                    model.startRestore()
                }
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

    /// The layers write their change lines with a plain arrow. The window
    /// draws the real one.
    static func arrow(_ change: String) -> String {
        change.replacingOccurrences(of: " -> ", with: " → ")
    }
}
