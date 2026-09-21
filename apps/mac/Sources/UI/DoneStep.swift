import SwiftUI

/// Step seven. What the iPhone is now, and the way back to the start.
///
/// It says nothing about the backup. The backup was scaffolding this app put
/// up and took down again, and telling somebody their scaffolding is gone
/// still leaves them thinking about scaffolding. The one exception is a folder
/// that would not go, because then a copy of the phone really is still here.
struct DoneStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: WizardStep.done.title(for: model.direction),
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
                }

                // The path is here and nowhere else in the run, because this is
                // the one line somebody has to act on: the folder is still on
                // this Mac and they may want to take it off themselves.
                if let failure = model.backupRemovalFailure {
                    ErrorText(failure)
                }
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
