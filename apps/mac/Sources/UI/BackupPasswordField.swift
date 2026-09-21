import SwiftUI

/// The password of an encrypted backup. It is asked for on the Ready step, and
/// again on the restore step when the patch could not open the backup with what
/// was typed the first time.
///
/// It is one row like the checks around it: the label, the field, and the one
/// thing people get wrong in the hover help.
struct BackupPasswordField: View {
    @ObservedObject var model: WizardModel

    @FocusState private var focused: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("Backup Password")
                .help("The password set for encrypted backups, not the iPhone passcode.")
            // The placeholder is a row of dots, so the field needs a spoken
            // name of its own for VoiceOver to announce anything useful.
            RingedField(focused: focused) {
                SecureField("****", text: $model.password)
                    .labelsHidden()
                    .accessibilityLabel("Backup Password")
                    .focused($focused)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
