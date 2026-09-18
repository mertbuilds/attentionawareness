import SwiftUI

/// Step seven. What the iPhone is now, and where the backup is if it is ever
/// needed again.
struct DoneStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.done.position(in: model.direction),
            title: "Done",
            lead: lead,
            error: model.errorMessage
        ) {
            Card {
                if let device = model.device {
                    CardRow(name: "iPhone", value: device.name ?? "iPhone")
                    CardRow(name: "Model", value: DeviceCard.model(device))
                }
                CardRow(name: "State", value: DeviceCard.state(model.restore.supervisedAfterwards))
                CardRow(name: "Profiles", value: DeviceCard.profileNames(model.installedProfiles))
                if let folder = model.backupFolder {
                    CardRow(name: "Backup", value: folder.path)
                    HStack {
                        Spacer()
                        Button("Show in Finder") {
                            model.revealBackupFolder()
                        }
                    }
                }
            }
        } actions: {
            PrimaryButton(title: "Start over") {
                model.startOver()
            }
        }
    }

    private var lead: String {
        guard model.restore.supervisedAfterwards == model.direction.target else {
            return "The iPhone did not end up the way this run asked for."
        }
        return model.direction == .supervise
            ? "The iPhone is supervised and everything on it stayed where it was."
            : "The iPhone is no longer supervised and everything on it stayed where it was."
    }
}
