import SwiftUI

/// The backups this Mac holds, kept for the last step.
///
/// Listing is cheap: one Manifest.plist per folder. Measuring is not, because
/// a 63 GB backup is 69,445 files to walk, so the rows are published first and
/// every size lands on its own afterwards. One task does all the walking, and
/// cancelling it stops the walk wherever it has got to.
@MainActor
final class BackupsList: ObservableObject {
    /// Every backup under the root, newest first, with the sizes that have
    /// come in so far.
    @Published private(set) var backups: [StoredBackup] = []
    /// What went wrong last, as a sentence the section shows. It is shown
    /// where it happened, never in a modal alert.
    @Published private(set) var errorMessage: String?

    private let root: URL
    /// False for the list the smoke hands its rows to, which reads no disk
    /// and deletes nothing.
    private let readsDisk: Bool
    /// The phone whose folder is walked before the others, because a step is
    /// waiting on that one number. Nil walks them in the order they are
    /// listed.
    private var measureFirst: String?
    private var work: Task<Void, Never>?

    init(root: URL = BackupFolder.applicationSupportRoot) {
        self.root = root
        readsDisk = true
    }

    /// A list that reads nothing: it publishes the backups it is handed, sizes
    /// and all. The hidden `--ui-smoke` path uses it to draw the section with
    /// no backup on this Mac.
    init(sample backups: [StoredBackup]) {
        root = BackupFolder.applicationSupportRoot
        readsDisk = false
        self.backups = backups
    }

    /// Hand a sample list another set of rows, so the hidden `--demo` path can
    /// say this Mac holds a whole backup, a folder that cannot be used, or
    /// nothing at all, while the window is open. It does nothing on a list
    /// that reads the disk, which is the only kind the app itself ever makes.
    func show(_ backups: [StoredBackup]) {
        guard !readsDisk else { return }
        self.backups = backups
        errorMessage = nil
    }

    /// Read the folder, then measure what is in it. Calling it again replaces
    /// both: a walk that is still going is cancelled first.
    ///
    /// `measuringFirst` names the iPhone a step is waiting on, so a 63 GB walk
    /// for some other phone does not hold up the one number on screen.
    func load(measuringFirst udid: String? = nil) {
        guard readsDisk else { return }
        measureFirst = udid
        work?.cancel()
        work = Task { [weak self] in
            await self?.reload()
        }
    }

    /// Stop measuring. The section calls this when it goes away and the wizard
    /// calls it when a run starts over, so nothing walks a folder that nobody
    /// is looking at any more.
    func cancel() {
        work?.cancel()
        work = nil
    }

    /// Move one backup to the Trash, and every untouched copy of it only when
    /// the caller asks for that by name. The folder is read again afterwards,
    /// so the list and the total are what is left.
    ///
    /// The Trash is on the same volume as the backups, so the move is a rename
    /// however large the folder is and the window does not wait on a copy.
    func delete(_ backup: StoredBackup, includingPristineCopy: Bool) {
        guard readsDisk else { return }
        do {
            try BackupStore.delete(backup, includingPristineCopy: includingPristineCopy, root: root)
        } catch {
            errorMessage = error.localizedDescription
            return
        }
        errorMessage = nil
        load()
    }

    /// List the folder, keep the sizes that are already in, then walk the rest.
    private func reload() async {
        let root = self.root
        let known = Dictionary(backups.map { ($0.url, $0) }, uniquingKeysWith: { first, _ in first })
        let listed: [StoredBackup]
        do {
            listed = try await Task.detached(priority: .utility) {
                try BackupStore.list(root: root)
            }.value
        } catch {
            guard !Task.isCancelled else { return }
            backups = []
            errorMessage = error.localizedDescription
            return
        }
        guard !Task.isCancelled else { return }
        // A folder nothing writes to any more is the same size it was, so a
        // number already in hand is carried over rather than walked again.
        backups = listed.map { backup in
            var carried = backup
            carried.sizeInBytes = known[backup.url]?.sizeInBytes
            carried.pristineSizeInBytes = known[backup.url]?.pristineSizeInBytes
            return carried
        }
        errorMessage = nil
        await measureWhatIsMissing()
    }

    /// Walk the backups whose size is not in yet, one at a time, and publish
    /// each number as it lands, so a row stops waiting on its own folder
    /// rather than on the last one in the list.
    private func measureWhatIsMissing() async {
        for backup in measurementOrder where backup.sizeInBytes == nil {
            let measured = await BackupStore.measured(backup)
            guard !Task.isCancelled else { return }
            guard let index = backups.firstIndex(where: { $0.id == measured.id }) else { continue }
            backups[index] = measured
        }
    }

    /// The rows in the order they are walked: the one a step is waiting on
    /// first, then the rest as they are listed.
    private var measurementOrder: [StoredBackup] {
        guard let measureFirst else { return backups }
        return backups.filter { $0.udid == measureFirst } + backups.filter { $0.udid != measureFirst }
    }
}

/// The backups this Mac holds, under the summary on the last step: what each
/// one came from, what it takes, and the way to take it off the disk again.
struct BackupsSection: View {
    @ObservedObject var list: BackupsList
    /// The backup this run made, which is the one the summary above is about.
    let current: URL?
    /// True once the restore has put the current backup back on the iPhone.
    /// Before that, deleting it would leave the run with nothing to restore
    /// from, so that one row is offered no button.
    let currentIsRestored: Bool

    /// The folder waiting for an answer. The backup itself is read out of the
    /// list every time the dialog draws, so the question carries the size from
    /// the moment it lands rather than the size at the click.
    @State private var pendingURL: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Backups on this Mac")
                .font(.headline)

            Card {
                if list.backups.isEmpty {
                    Text("No backups on this Mac.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(Array(list.backups.enumerated()), id: \.element.id) { index, backup in
                        if index > 0 {
                            Divider()
                        }
                        row(backup)
                    }
                    Divider()
                    CardRow(name: "Total", value: total)
                }
            }

            if let errorMessage = list.errorMessage {
                ErrorText(errorMessage)
            }
        }
        .task {
            list.load()
        }
        .onDisappear {
            list.cancel()
        }
        .confirmationDialog(
            pending.map { "Delete the backup of \(Self.name($0))?" } ?? "",
            isPresented: Binding(
                get: { pending != nil },
                set: { presented in
                    if !presented { pendingURL = nil }
                }
            ),
            titleVisibility: .visible,
            presenting: pending
        ) { backup in
            // Two buttons rather than one with a tick beside it: the untouched
            // copy is the only way back to the backup the iPhone made, so it
            // only ever goes when a person asks for it in as many words.
            Button("Delete backup", role: .destructive) {
                pendingURL = nil
                list.delete(backup, includingPristineCopy: false)
            }
            if backup.pristineURL != nil {
                Button("Delete backup and the untouched copy", role: .destructive) {
                    pendingURL = nil
                    list.delete(backup, includingPristineCopy: true)
                }
            }
            Button("Cancel", role: .cancel) {
                pendingURL = nil
            }
        } message: { backup in
            Text(confirmation(backup))
        }
    }

    /// One backup: the phone on the first line with what it takes, the rest of
    /// what could be read under it, and the button that takes it away.
    private func row(_ backup: StoredBackup) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(Self.name(backup))
                if isCurrent(backup) {
                    Text("This run")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 12)
                size(of: backup)
            }
            .font(.callout)

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(Self.details(backup))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 12)
                deleteButton(backup)
            }
        }
    }

    /// What the backup takes, or a quiet line while its folder is still being
    /// walked. A 63 GB backup is 69,445 files, so the wait is a real one.
    @ViewBuilder
    private func size(of backup: StoredBackup) -> some View {
        if let bytes = backup.sizeInBytes {
            Text(Self.size(bytes))
                .monospacedDigit()
        } else {
            Text("Measuring")
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func deleteButton(_ backup: StoredBackup) -> some View {
        if isCurrent(backup), !currentIsRestored {
            Text("Kept until the restore is done")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else {
            Button("Delete") {
                pendingURL = backup.url
            }
            .controlSize(.small)
        }
    }

    /// The backup the question is about, as the list has it now.
    private var pending: StoredBackup? {
        guard let pendingURL else { return nil }
        return list.backups.first { $0.url == pendingURL }
    }

    /// What the measured backups take together. It only counts the numbers
    /// that have come in, so it says as much while a walk is still going.
    private var total: String {
        let measured = Self.size(BackupStore.totalSize(of: list.backups))
        return list.backups.contains { $0.sizeInBytes == nil } ? "\(measured) so far" : measured
    }

    /// The sentence under the question: which phone, how much room the folder
    /// gives back, where it goes, and what the second button would take as
    /// well.
    private func confirmation(_ backup: StoredBackup) -> String {
        var sentences: [String] = []
        if let bytes = backup.sizeInBytes {
            sentences.append("The backup of \(Self.name(backup)) takes \(Self.size(bytes)).")
        } else {
            sentences.append("The backup of \(Self.name(backup)) has not been measured yet.")
        }
        sentences.append("The whole folder goes to the Trash, so you can put it back until the Trash is emptied.")
        if backup.pristineURL != nil {
            let takes = backup.pristineSizeInBytes.map { " takes another \(Self.size($0)) and" } ?? ""
            sentences.append(
                "The untouched copy the patch saved\(takes) stays where it is unless you ask for it, "
                    + "because it is the only way back to the backup the iPhone made."
            )
        }
        if isCurrent(backup) {
            sentences.append("This is the backup this run restored from.")
        }
        return sentences.joined(separator: " ")
    }

    /// True for the folder this run wrote.
    private func isCurrent(_ backup: StoredBackup) -> Bool {
        guard let current else { return false }
        return current.standardizedFileURL.path == backup.url.standardizedFileURL.path
    }

    /// The phone a backup came from. A backup whose Manifest.plist could not
    /// be read gives no name, and then the folder name on the line below is
    /// what tells one row from another.
    private static func name(_ backup: StoredBackup) -> String {
        backup.deviceName ?? "Unknown iPhone"
    }

    /// The model, the iOS version, the date and the untouched copy, and only
    /// the ones that could be read.
    private static func details(_ backup: StoredBackup) -> String {
        var parts: [String] = []
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
        if let date = backup.date {
            parts.append(WizardStyle.date(date))
        }
        if backup.deviceName == nil {
            parts.append(backup.udid)
        }
        if let pristine = backup.pristineSizeInBytes {
            parts.append("untouched copy \(size(pristine))")
        }
        return parts.isEmpty ? "Nothing in this folder could be read." : parts.joined(separator: ", ")
    }

    /// The window counts in whole bytes and the copy speaks in gigabytes. A
    /// size that somehow reads below zero is shown as nothing rather than as a
    /// number with a minus in front of it.
    private static func size(_ bytes: Int64) -> String {
        WizardStyle.size(UInt64(max(0, bytes)))
    }
}
