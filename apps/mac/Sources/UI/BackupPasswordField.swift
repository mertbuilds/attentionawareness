import SwiftUI

/// The password of an encrypted backup. It is asked for on the checks step,
/// and again on the patch step when the patch could not open the backup with
/// what was typed the first time.
struct BackupPasswordField: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Backup password")
            SecureField("Backup password", text: $model.password)
                .textFieldStyle(.roundedBorder)
                .labelsHidden()
            Text("The password you set for encrypted backups. It is not the phone passcode.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
