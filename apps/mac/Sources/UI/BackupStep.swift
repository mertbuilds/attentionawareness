import SwiftUI

/// Step three. Copy everything off the iPhone onto this Mac, or use the copy
/// this Mac is already holding for it.
struct BackupStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.backUp.position(in: model.direction),
            title: "Back up",
            lead: lead,
            error: model.errorMessage
        ) {
            content
        } actions: {
            actions
        }
    }

    private var lead: String {
        switch model.engine.phase {
        case .idle:
            if case .usable(let backup) = model.existingBackup, let date = backup.date {
                return "This Mac already holds a backup of this iPhone, \(ExistingBackup.age(of: date)). "
                    + "Use it, or copy everything off again."
            }
            return [
                "This copies everything on the iPhone to this Mac. Keep the cable connected.",
                model.backupExpectation,
            ].compactMap { $0 }.joined(separator: " ")
        case .starting:
            return "Starting the backup. The iPhone takes a moment to answer."
        case .transferring:
            return "Copying the iPhone to this Mac. Keep the cable connected."
        case .finishing:
            return "The iPhone is closing the snapshot. This is the slow part."
        case .done:
            return "The backup is on this Mac."
        case .cancelled:
            return "The backup was cancelled. Nothing on the iPhone changed."
        case .failed:
            return "The backup stopped."
        }
    }

    /// The offer is only ever drawn before a transfer. Once one has started,
    /// the folder on the disk is the one being written, whatever the listing
    /// behind the offer still says about it.
    @ViewBuilder
    private var content: some View {
        if model.engine.phase.isRunning {
            TransferProgress(model: model)
        } else if model.engine.phase == .idle, case .usable(let backup) = model.existingBackup {
            ExistingBackupCard(backup: backup)
        } else if model.engine.phase == .idle, case .unusable(_, let reason) = model.existingBackup {
            Text(reason.sentence)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            TransferLog(lines: model.engine.log)
        }
    }

    @ViewBuilder
    private var actions: some View {
        switch model.engine.phase {
        case .starting, .transferring, .finishing:
            Button("Cancel") {
                model.cancelTransfer()
            }
            .controlSize(.large)
        case .done:
            PrimaryButton(title: "Continue") {
                model.advance()
            }
            Button("Back up again") {
                model.startBackup()
            }
            .controlSize(.large)
        case .cancelled, .failed:
            PrimaryButton(title: "Try again") {
                model.startBackup()
            }
        case .idle:
            // Neither of the two is taken for the reader: using a copy of the
            // iPhone from another day and spending another hour on the cable
            // are both choices only the reader can make.
            if case .usable(let backup) = model.existingBackup {
                PrimaryButton(title: "Use this backup") {
                    model.useExistingBackup(backup)
                }
                Button("Back up again") {
                    model.startBackup()
                }
                .controlSize(.large)
            } else {
                PrimaryButton(title: "Back up") {
                    model.startBackup()
                }
            }
        }
    }
}

/// The backup this Mac already holds for the iPhone on the cable: which phone
/// it came from, when it was made, what it takes and whether it is encrypted,
/// so the choice between using it and making another is made on what is in it.
struct ExistingBackupCard: View {
    let backup: StoredBackup

    var body: some View {
        Card {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(backup.deviceName ?? "Unknown iPhone")
                Spacer(minLength: 12)
                size
            }
            .font(.callout)

            Text(details)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if let date = backup.date, ExistingBackup.isStale(date) {
                Text(ExistingBackup.stalenessSentence)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// What the backup takes, or a quiet line while its folder is still being
    /// walked. A 63 GB backup is 69,445 files, so the wait is a real one.
    @ViewBuilder
    private var size: some View {
        if let bytes = backup.sizeInBytes {
            Text(WizardStyle.size(UInt64(max(0, bytes))))
                .monospacedDigit()
        } else {
            Text("Measuring")
                .foregroundStyle(.secondary)
        }
    }

    /// The day and time the backup carries, the phone it came from, and
    /// whether the patch will need a password. How long ago that was is in the
    /// sentence above the card, where it belongs to the choice.
    private var details: String {
        var parts: [String] = []
        if let date = backup.date {
            parts.append(WizardStyle.date(date))
        }
        switch (backup.productType, backup.iosVersion) {
        case let (product?, version?):
            parts.append("\(product) on iOS \(version)")
        case let (product?, nil):
            parts.append(product)
        case let (nil, version?):
            parts.append("iOS \(version)")
        case (nil, nil):
            break
        }
        parts.append(backup.isEncrypted ? "encrypted" : "not encrypted")
        return parts.joined(separator: ", ")
    }
}
