import SwiftUI

/// The screen before the hour of work: what has to be true, one line each.
///
/// Every row says the one thing to do about it and nothing more. The longer
/// how-to sits in the hover help, so a reader with nothing to fix reads five
/// short lines and presses the button.
struct ReadyStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: WizardStep.ready.title,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                findMyRow
                spaceRow
                backupRow
                BackupPasswordField(model: model)
                if model.clearedLeftoverBackup {
                    CheckLine(ok: true, text: "Leftover from an unfinished run was cleared.")
                }
                Text(TransferRate.howLong(.backup, bytes: model.backupBytes))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } actions: {
            PrimaryButton(title: verb, enabled: model.checksPass) {
                model.startJob()
            }
        }
    }

    /// What the run is called, which the button says and nothing else does.
    private var verb: String { "Supervise" }

    /// Find My has to be off for the restore and for nothing else, so the row
    /// is work to do rather than a wall: the job starts while it is still on
    /// and waits for it later, which lets the hour it can cost run alongside
    /// the copying.
    private var findMyRow: CheckLine {
        switch model.device?.findMyOn {
        case false:
            return CheckLine(ok: true, text: "Find My iPhone is off", help: WizardGate.turnFindMyOff)
        case true:
            return CheckLine(
                ok: false,
                text: "Turn off Find My iPhone in Settings.",
                help: WizardGate.turnFindMyOff
            )
        case nil:
            return CheckLine(
                ok: false,
                text: "Couldn't read Find My iPhone. Unlock iPhone.",
                help: WizardGate.turnFindMyOff
            )
        }
    }

    /// The only row that blocks on its own. The figure is what is missing
    /// rather than what the copy needs, because that is the number a person
    /// acts on.
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
    /// The button beside it is the whole of what an app can do about Full Disk
    /// Access: macOS offers no way to ask for it, so the list is opened and the
    /// hover help says the rest.
    private var backupRow: some View {
        let row = model.safetyNet
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            CheckLine(ok: row.ok, text: row.line, help: row.help)
            if model.finderBackup == .refused {
                Button("Allow") {
                    model.openFullDiskAccessSettings()
                }
                .font(.callout)
            }
        }
    }
}
