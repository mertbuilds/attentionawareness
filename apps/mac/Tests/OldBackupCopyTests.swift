import Foundation
import Testing

/// The launch removal of the copy of iPhone that versions 0.4.0 to 0.4.2 kept.
/// Every test works in a temporary folder of its own and hands it in, so the
/// real Application Support folder is never touched.
final class OldBackupCopyTests {
    private let base: URL
    private let appFolder: URL
    private let folder: URL

    init() throws {
        base = FileManager.default.temporaryDirectory
            .appendingPathComponent("old-backup-copy-tests-\(UUID().uuidString)")
        appFolder = base.appendingPathComponent("attention awareness")
        folder = appFolder.appendingPathComponent("Backups")
        try FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
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

    @Test func theRealFolderIsBackupsInTheAppsApplicationSupportFolder() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        #expect(OldBackupCopy.folder.path == home + "/Library/Application Support/attention awareness/Backups")
    }

    @Test func theFolderGoesWithEverythingInIt() throws {
        try write("manifest", to: folder.appendingPathComponent("00008101-000000000000001B/Manifest.plist"))
        try write("copy", to: folder.appendingPathComponent("attentionawareness-pristine/x-20261001-120000/a"))
        try write("log", to: appFolder.appendingPathComponent("Logs/backup.log"))

        #expect(OldBackupCopy.removeFolder(folder, appFolder: appFolder) == .removed)
        #expect(!exists(folder))
        #expect(exists(appFolder.appendingPathComponent("Logs/backup.log")))
    }

    @Test func noFolderIsFine() {
        #expect(OldBackupCopy.removeFolder(folder, appFolder: appFolder) == .nothingThere)
        #expect(exists(appFolder))
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

        #expect(OldBackupCopy.removeFolder(folder, appFolder: appFolder) == .removed)
        #expect(!exists(folder))
        #expect(try String(contentsOf: secret, encoding: .utf8) == "keep")
    }

    @Test func aBackupsFolderThatIsALinkIsRefused() throws {
        let outside = base.appendingPathComponent("outside")
        let secret = outside.appendingPathComponent("secret.txt")
        try write("keep", to: secret)
        try FileManager.default.createSymbolicLink(at: folder, withDestinationURL: outside)

        #expect(OldBackupCopy.removeFolder(folder, appFolder: appFolder) == .refused)
        #expect(exists(secret))
    }

    @Test func aFolderOutsideTheAppFolderIsRefused() throws {
        let other = base.appendingPathComponent("MobileSync/Backups")
        let file = other.appendingPathComponent("00008101-000000000000001B/Manifest.plist")
        try write("theirs", to: file)

        #expect(OldBackupCopy.removeFolder(other, appFolder: appFolder) == .refused)
        #expect(exists(file))
    }

    @Test func aFolderWithAnotherNameIsRefused() throws {
        let logs = appFolder.appendingPathComponent("Logs")
        try write("log", to: logs.appendingPathComponent("backup.log"))

        #expect(OldBackupCopy.removeFolder(logs, appFolder: appFolder) == .refused)
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
