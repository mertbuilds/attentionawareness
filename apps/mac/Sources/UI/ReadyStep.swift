import SwiftUI

/// Choose the supervision method and check what it needs before starting.
///
/// Every row says the one thing to do about it and nothing more. The longer
/// how-to sits in the hover help, so a reader with nothing to fix reads a few
/// short lines and presses the button.
struct ReadyStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: WizardStep.ready.title,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Supervision method", selection: Binding(
                    get: { model.supervisionMethod },
                    set: { model.selectSupervisionMethod($0) }
                )) {
                    Text("Full copy and restore").tag(SupervisionMethod.fullCopy)
                    Text("Fast (experimental)").tag(SupervisionMethod.seed)
                }
                .disabled(model.fastRefusal != nil && model.requiresFullCopy)
                if let refusal = model.fastRefusal {
                    Text(refusal)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                findMyRow
                if model.requiresFullCopy { spaceRow }
                backupRow
                Text(BackupSafetyNet.notice)
                    .fixedSize(horizontal: false, vertical: true)
                Toggle(BackupSafetyNet.confirmation, isOn: Binding(
                    get: { model.backupConfirmed },
                    set: { model.confirmBackup($0) }
                ))
                if model.requiresFullCopy { BackupPasswordField(model: model) }
                if model.clearedLeftoverBackup {
                    CheckLine(ok: true, text: "Leftover from an unfinished run was cleared.")
                }
                Text(model.requiresFullCopy
                    ? TransferRate.howLong(.backup, bytes: model.backupBytes)
                    : Self.fastWarning)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(SupervisionFinishedEvent.disclosure)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } actions: {
            PrimaryButton(title: verb, enabled: model.checksPass) {
                model.startJob()
            }
            // Back to Connect, to pick another iPhone. Nothing has been sent to
            // this one yet, so there is nothing to undo.
            Button("Back") {
                model.back()
            }
            .controlSize(.large)
        }
    }

    /// What the fast method is, said while it is the one picked.
    static let fastWarning = """
        Fast is experimental. It is not tested enough on real iPhones yet. It restores a small \
        configuration and restarts iPhone.
        """

    /// What the run is called, which the button says and nothing else does.
    private var verb: String { "Supervise" }

    /// Find My has to be off before the run starts, because the restore at
    /// the end of it is refused while it is on. While the iPhone says it is
    /// on, the how-to sits under the row rather than only in the hover help,
    /// the hour Stolen Device Protection can add included, because this is the
    /// one row that can keep the button off for longer than it takes to read.
    /// The screen reads Find My again every few seconds, so the row turns
    /// green and the button turns on without anything to press.
    @ViewBuilder
    private var findMyRow: some View {
        switch model.device?.findMyOn {
        case false:
            CheckLine(ok: true, text: "Find My iPhone is off", help: WizardGate.turnFindMyOff)
        case true:
            VStack(alignment: .leading, spacing: 6) {
                CheckLine(ok: false, text: "Turn off Find My iPhone to continue.")
                Text("\(WizardGate.turnFindMyOff) \(verb) turns on once iPhone says it's off.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        case nil:
            CheckLine(
                ok: false,
                text: "Couldn't read Find My iPhone. Unlock iPhone.",
                help: WizardGate.turnFindMyOff
            )
        }
    }

    /// A row that blocks on its own, the way Find My does. The figure is what
    /// is missing rather than what the copy needs, because that is the number
    /// a person acts on.
    private var spaceRow: CheckLine {
        let space = model.diskSpace
        switch space.passes {
        case true:
            return CheckLine(ok: true, text: "Enough space on this Mac")
        case false:
            let missing = space.needed - (space.free ?? 0)
            return CheckLine(ok: false, text: "Free up about \(WizardStyle.size(missing)) on this Mac.")
        case nil:
            return CheckLine(ok: false, text: "Couldn't read free space on this Mac.")
        }
    }

    /// Whether the reader already has a backup of their own, which is the one
    /// thing worth having before an app copies a phone. It never blocks: the
    /// copy the app makes comes down at the end of the run, so the way back
    /// has to be theirs, but somebody who knows that is allowed to go on.
    ///
    /// While Finder's folder is refused the row asks for Full Disk Access, and
    /// the button beside it is the whole of what an app can do about that:
    /// macOS offers no way to ask for it, so the list is opened, the app looks
    /// again when it is back in front, and where the switch has not counted
    /// yet a second button reopens the app. The hover help says the rest.
    private var backupRow: some View {
        let row = model.safetyNet
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            CheckLine(ok: row.ok, text: row.line, help: row.help)
            ForEach(row.actions, id: \.self) { action in
                switch action {
                case .openFullDiskAccess:
                    // The iPhone has a Settings app of its own, which this
                    // screen names too, so the Mac's is named in full.
                    Button("Open System Settings") {
                        model.openFullDiskAccessSettings()
                    }
                case .reopen:
                    Button("Reopen") {
                        model.reopenApp()
                    }
                }
            }
            .font(.callout)
        }
    }
}
