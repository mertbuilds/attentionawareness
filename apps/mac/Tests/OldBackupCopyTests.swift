import Foundation
import Testing

/// The launch move to the Trash of the copy of iPhone that versions 0.4.0 to
/// 0.4.2 kept. Every test works in a temporary folder of its own and hands it
/// in, with a mover that moves into a temporary "Trash" folder, so the real
/// Application Support folder and the real Trash are never touched.
final class OldBackupCopyTests {
    private let base: URL
    private let appFolder: URL
    private let folder: URL
    private let trash: URL
    private var moved: [URL] = []

    private struct MoveFailed: Error {}

    init() throws {
        base = FileManager.default.temporaryDirectory
            .appendingPathComponent("old-backup-copy-tests-\(UUID().uuidString)")
        appFolder = base.appendingPathComponent("attention awareness")
        folder = appFolder.appendingPathComponent("Backups")
        trash = base.appendingPathComponent("Trash")
        try FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: trash, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: base)
    }

    private func write(_ text: String, to url: URL) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(text.utf8).write(to: url)
    }

    private func exists(_ url: URL) -> Bool {
        FileManager.default.fileExists(atPath: url.path)
    }

    private func trashFolder(_ folder: URL) -> OldBackupCopy.Outcome {
        OldBackupCopy.trashFolder(folder, appFolder: appFolder) { url in
            self.moved.append(url)
            try FileManager.default.moveItem(at: url, to: self.trash.appendingPathComponent(url.lastPathComponent))
        }
    }

    @Test func theRealFolderIsBackupsInTheAppsApplicationSupportFolder() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        #expect(OldBackupCopy.folder.path == home + "/Library/Application Support/attention awareness/Backups")
    }

    @Test func theFolderGoesToTheTrashWithEverythingInIt() throws {
        try write("manifest", to: folder.appendingPathComponent("00008101-000000000000001B/Manifest.plist"))
        try write("copy", to: folder.appendingPathComponent("attentionawareness-pristine/x-20261001-120000/a"))
        try write("log", to: appFolder.appendingPathComponent("Logs/backup.log"))

        #expect(trashFolder(folder) == .trashed)
        #expect(moved == [folder])
        #expect(!exists(folder))
        #expect(exists(trash.appendingPathComponent("Backups/00008101-000000000000001B/Manifest.plist")))
        #expect(exists(appFolder.appendingPathComponent("Logs/backup.log")))
    }

    @Test func noFolderIsFine() {
        #expect(trashFolder(folder) == .nothingThere)
        #expect(moved.isEmpty)
        #expect(exists(appFolder))
    }

    @Test func aFailedMoveLeavesTheFolderWhereItIs() throws {
        let manifest = folder.appendingPathComponent("00008101-000000000000001B/Manifest.plist")
        try write("manifest", to: manifest)
        var calls = 0

        let outcome = OldBackupCopy.trashFolder(folder, appFolder: appFolder) { _ in
            calls += 1
            throw MoveFailed()
        }

        #expect(outcome == .failed)
        #expect(calls == 1)
        #expect(try String(contentsOf: manifest, encoding: .utf8) == "manifest")
    }

    @Test func aLinkInsideIsNotFollowed() throws {
        let outside = base.appendingPathComponent("outside")
        let secret = outside.appendingPathComponent("secret.txt")
        try write("keep", to: secret)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(
            at: folder.appendingPathComponent("folder-link"),
            withDestinationURL: outside
        )
        try FileManager.default.createSymbolicLink(
            at: folder.appendingPathComponent("file-link"),
            withDestinationURL: secret
        )

        #expect(trashFolder(folder) == .trashed)
        #expect(!exists(folder))
        #expect(try String(contentsOf: secret, encoding: .utf8) == "keep")
    }

    @Test func aBackupsFolderThatIsALinkIsRefused() throws {
        let outside = base.appendingPathComponent("outside")
        let secret = outside.appendingPathComponent("secret.txt")
        try write("keep", to: secret)
        try FileManager.default.createSymbolicLink(at: folder, withDestinationURL: outside)

        #expect(trashFolder(folder) == .refused)
        #expect(moved.isEmpty)
        #expect(exists(secret))
    }

    @Test func aFolderOutsideTheAppFolderIsRefused() throws {
        let other = base.appendingPathComponent("MobileSync/Backups")
        let file = other.appendingPathComponent("00008101-000000000000001B/Manifest.plist")
        try write("theirs", to: file)

        #expect(trashFolder(other) == .refused)
        #expect(moved.isEmpty)
        #expect(exists(file))
    }

    @Test func aFolderWithAnotherNameIsRefused() throws {
        let logs = appFolder.appendingPathComponent("Logs")
        try write("log", to: logs.appendingPathComponent("backup.log"))

        #expect(trashFolder(logs) == .refused)
        #expect(moved.isEmpty)
        #expect(exists(logs))
    }

    @Test func theTwoTransferRatesGoAndOtherKeysStay() throws {
        let suite = "old-backup-copy-tests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(30_000_000.0, forKey: "transferRate.backup")
        defaults.set(20_000_000.0, forKey: "transferRate.restore")
        defaults.set("kept", forKey: "somethingElse")

        OldBackupCopy.removeDefaults(from: defaults)

        #expect(defaults.object(forKey: "transferRate.backup") == nil)
        #expect(defaults.object(forKey: "transferRate.restore") == nil)
        #expect(defaults.string(forKey: "somethingElse") == "kept")
    }
}
