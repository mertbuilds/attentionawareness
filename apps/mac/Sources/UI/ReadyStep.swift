import SwiftUI

/// Check what the run needs before starting.
///
/// Every row says the one thing to do about it and nothing more. The longer
/// how-to sits in the hover help, so a reader with nothing to fix reads a few
/// short lines and presses the button.
struct ReadyStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: WizardStep.ready.title,
            lead: Self.whatHappens,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    SectionHeading("Checks")
                    findMyRow
                    // Connect sends an iPhone the app does not run on to the
                    // guide, so this only shows when the version changed or
                    // went unread after that.
                    if let refusal = model.iosRefusal {
                        CheckLine(ok: false, text: refusal.message)
                    }
                    backupRow
                }
                VStack(alignment: .leading, spacing: 6) {
                    SectionHeading("Backup")
                    Text(BackupSafetyNet.notice)
                        .fixedSize(horizontal: false, vertical: true)
                    Toggle(BackupSafetyNet.confirmation, isOn: Binding(
                        get: { model.backupConfirmed },
                        set: { model.confirmBackup($0) }
                    ))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(SupervisionFinishedEvent.disclosure)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        } actions: {
            // Back to Connect, to pick another iPhone. Nothing has been sent to
            // this one yet, so there is nothing to undo.
            Button("Back") {
                model.back()
            }
            PrimaryButton(title: verb, enabled: model.checksPass) {
                model.startJob()
            }
        }
    }

    /// What the run does, in one line under the title.
    static let whatHappens = "The app sends a small configuration to iPhone, then restarts it."

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

    /// Whether the reader already has a backup of their own, which is the one
    /// thing worth having before an app changes a phone. It never blocks: the
    /// app keeps no copy of the iPhone, so the way back has to be theirs, but
    /// somebody who knows that is allowed to go on.
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
            .controlSize(.small)
        }
    }
}
