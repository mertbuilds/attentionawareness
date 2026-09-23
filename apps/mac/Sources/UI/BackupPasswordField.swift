import SwiftUI

/// The password of the encrypted copy. The copy is always encrypted now, so
/// this row is always on the Ready screen, and it comes back on the job screen
/// when the patch could not open the backup with what was typed the first time.
///
/// It is one row like the checks around it: the label, the field, and the one
/// thing people get wrong in the hover help. The help changes with the iPhone:
/// choosing a password when encryption is still off, or entering the one
/// already set when it is on.
struct BackupPasswordField: View {
    @ObservedObject var model: WizardModel

    @FocusState private var focused: Bool

    var body: some View {
        // The label sits above its own full-width field, so the input reads as
        // a block of its own rather than one more of the one-line checks it sits
        // among.
        VStack(alignment: .leading, spacing: 6) {
            Text("Backup password")
                .help(help)
            // The placeholder is a row of dots, so the field needs a spoken
            // name of its own for VoiceOver to announce anything useful.
            RingedField(focused: focused) {
                SecureField("****", text: $model.password)
                    .labelsHidden()
                    .accessibilityLabel("Backup password")
                    .focused($focused)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The help behind the label, in the words of the state the iPhone is in.
    private var help: String {
        model.device?.backupEncrypted == true
            ? "Enter the password you set for encrypted backups. It is not the iPhone passcode."
            : "Choose a password for the encrypted copy and keep it. You'll need it to turn encryption off or restore later."
    }
}
