import SwiftUI

/// One line of the checklist. A check that cannot be read shows as unknown and
/// blocks nothing: the user is told, and the backup is allowed to try.
struct CheckRow: View {
    enum Result {
        case pass
        case waiting
        case unknown
    }

    let result: Result
    let title: String
    let detail: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                if let detail {
                    Text(detail)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var symbol: String {
        switch result {
        case .pass: return "checkmark.circle.fill"
        case .waiting: return "circle"
        case .unknown: return "questionmark.circle"
        }
    }

    private var tint: Color {
        result == .pass ? .green : .secondary
    }
}

/// Step two. Everything that has to be true before a backup is worth starting.
struct ChecksStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.checks.position(in: model.direction),
            title: "Checks",
            lead: "The restore only works if these are right. The list reads the iPhone again while you change them.",
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 14) {
                findMyRow
                spaceRow
                if model.needsPassword {
                    BackupPasswordField(model: model)
                }
            }
        } actions: {
            PrimaryButton(title: buttonTitle, enabled: model.checksPass) {
                model.continueFromChecks()
            }
        }
    }

    /// The button says what pressing it does. A phone whose folder is already
    /// on this Mac gets a choice on the next step rather than an hour of
    /// copying, so it does not promise a backup here.
    private var buttonTitle: String {
        model.existingBackup == .nothing ? "Back up" : "Continue"
    }

    /// Find My has to be off for the restore and for nothing else, so the row
    /// is work to do rather than a wall: the backup starts while it is still
    /// on, and the hour it can cost is waited out while the copying runs.
    private var findMyRow: CheckRow {
        switch model.device?.findMyOn {
        case false:
            return CheckRow(result: .pass, title: "Find My iPhone is off", detail: nil)
        case true:
            return CheckRow(
                result: .waiting,
                title: "Find My iPhone is on, and has to be off before the restore",
                // The title already says the restore needs it off, so the detail
                // only has to say when to do it and how.
                detail: """
                    The backup does not need it off, so start the backup now and turn it off while \
                    the copying runs. \(WizardGate.turnFindMyOff)
                    """
            )
        case nil:
            return CheckRow(
                result: .unknown,
                title: "Find My iPhone could not be read",
                detail: "Unlock the iPhone and keep the cable in. Find My has to be off for the restore."
            )
        }
    }

    private var spaceRow: CheckRow {
        let space = model.diskSpace
        let needed = WizardStyle.size(space.needed)
        let phone = space.assumed
            ? "The iPhone did not say how much it holds, so this asks for \(needed)."
            : "The backup of this iPhone needs about \(needed)."
        switch space.passes {
        case true:
            return CheckRow(
                result: .pass,
                title: "This Mac has \(WizardStyle.size(space.free ?? 0)) free",
                detail: phone
            )
        case false:
            return CheckRow(
                result: .waiting,
                title: "This Mac has \(WizardStyle.size(space.free ?? 0)) free",
                detail: "\(phone) Make room on this Mac, then try again."
            )
        case nil:
            return CheckRow(
                result: .unknown,
                title: "The free space on this Mac could not be read",
                detail: phone
            )
        }
    }
}
