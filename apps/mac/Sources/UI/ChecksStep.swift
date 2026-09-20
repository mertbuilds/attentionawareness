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
            lead: """
                What to get right before an hour of copying starts. The list reads the iPhone \
                again while you change them.
                """,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 14) {
                safetyNetRow
                if model.finderBackup == .refused {
                    fullDiskAccessLine
                }
                findMyRow
                spaceRow
                if model.needsPassword {
                    BackupPasswordField(model: model)
                }
                if model.clearedLeftoverBackup {
                    leftoverLine
                }
            }
        } actions: {
            PrimaryButton(title: "Back up", enabled: model.checksPass) {
                model.startBackup()
            }
        }
    }

    /// A folder that size going away deserves a word. It was left behind by a
    /// run that stopped part way, and no run ever uses one that an earlier run
    /// made, so it was rubbish rather than a way back.
    private var leftoverLine: some View {
        Text("A backup left over from a run that did not finish was cleared.")
            .font(.callout)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Whether the reader already has a backup of their own, which is the one
    /// thing worth having before an app copies a phone. It is first because it
    /// is what to do first, and it never blocks: the backup this app makes is
    /// scaffolding that comes down at the end of the run, so the way back has
    /// to be theirs, but somebody who knows that is allowed to go on.
    private var safetyNetRow: CheckRow {
        let row = model.safetyNet
        return CheckRow(result: Self.result(of: row.standing), title: row.title, detail: row.detail)
    }

    private static func result(of standing: BackupSafetyNet.Row.Standing) -> CheckRow.Result {
        switch standing {
        case .covered: return .pass
        case .thin: return .waiting
        case .unknown: return .unknown
        }
    }

    /// What Full Disk Access would buy, shown only once macOS has refused.
    ///
    /// There is no way to ask for that permission, so this is the whole of
    /// what an app can do about it: say what it is for, open the list, and say
    /// that it takes a new launch. A refusal costs the run nothing, which is
    /// why this is a line under the row rather than a row of its own.
    private var fullDiskAccessLine: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(
                "Full Disk Access would let this app check whether Finder already has a backup of "
                    + "this iPhone on this Mac. Nothing else in the run needs it, and the run goes "
                    + "on without it."
            )
            .fixedSize(horizontal: false, vertical: true)
            Button("Open Full Disk Access") {
                model.openFullDiskAccessSettings()
            }
            Text(
                "Turn the switch on for attention awareness, then quit this app and open it again. "
                    + "The change only takes effect on a new launch."
            )
            .fixedSize(horizontal: false, vertical: true)
        }
        .font(.callout)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
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

    /// What the backup will take on this Mac, and how long the copying will
    /// take. Both are about the same backup, so they are said together.
    private var spaceRow: CheckRow {
        let space = model.diskSpace
        let needed = WizardStyle.size(space.needed)
        let size = space.assumed
            ? "The iPhone did not say how much it holds, so this asks for \(needed)."
            : "The backup of this iPhone needs about \(needed)."
        let phone = [size, model.backupExpectation].compactMap { $0 }.joined(separator: " ")
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
