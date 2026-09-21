import SwiftUI

/// The password of an encrypted backup. It is asked for on the checks step,
/// and again on the restore step when the patch could not open the backup with
/// what was typed the first time.
struct BackupPasswordField: View {
    @ObservedObject var model: WizardModel

    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Backup password")
            // The placeholder is a row of dots, so the field needs a spoken
            // name of its own for VoiceOver to announce anything useful.
            RingedField(focused: focused) {
                SecureField("****", text: $model.password)
                    .labelsHidden()
                    .accessibilityLabel("Backup password")
                    .focused($focused)
            }
            Text("The password you set for encrypted backups. It is not the phone passcode.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
