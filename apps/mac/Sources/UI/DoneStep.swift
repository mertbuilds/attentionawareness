import SwiftUI

/// Step seven. What the iPhone is now, where the backup is if it is ever
/// needed again, and what every backup on this Mac is taking up.
struct DoneStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.done.position(in: model.direction),
            title: "Done",
            lead: lead,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 16) {
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

                BackupsSection(
                    list: model.backups,
                    current: model.backupFolder,
                    // The run is only safe to take its backup away from once
                    // the phone has it back and has said so itself. A phone
                    // that never came back on the cable may still need it.
                    currentIsRestored: model.restore.stage == .finished
                        && model.restore.supervisedAfterwards != nil
                )
            }
        } actions: {
            PrimaryButton(title: "Start over") {
                model.startOver()
            }
        }
    }

    private var lead: String {
        [outcome, findMyReminder].compactMap { $0 }.joined(separator: " ")
    }

    /// Whether the iPhone ended up the way the run asked for.
    private var outcome: String {
        guard model.restore.supervisedAfterwards == model.direction.target else {
            return "The iPhone did not end up the way this run asked for."
        }
        return model.direction == .supervise
            ? "The iPhone is supervised and everything on it stayed where it was."
            : "The iPhone is no longer supervised and everything on it stayed where it was."
    }

    /// The run asked for Find My to be off so the restore would go through, and
    /// nothing puts it back. A phone that already says it is on again is left
    /// alone, and so is one that will not say, because the last step is no
    /// place to argue about a value nobody can read.
    private var findMyReminder: String? {
        model.device?.findMyOn == false ? "Turn Find My iPhone back on in Settings." : nil
    }
}
