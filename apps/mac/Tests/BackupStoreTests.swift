import Foundation
import Testing

/// Measuring a backup folder, and taking one off the disk for good.
///
/// The fixtures are folders in a temporary directory: a real Manifest.plist
/// and Info.plist with a few files of content, one folder that a run stopped
/// part way through and left unreadable, and the folder that holds the
/// untouched copies.
final class BackupStoreTests {
    /// The two live beside each other, so a folder outside the backups folder
    /// is always somewhere the store must refuse.
    private let base: URL
    private let root: URL

    private static let udid = "00008140-0006284A3CA2801C"
    private static let otherUdid = "00008140-000B2C3D4E5F6071"
    private static let made = Date(timeIntervalSince1970: 1_789_300_000)
    private static let contentFileBytes = 4096

    init() throws {
        // The system temporary directory sits under /var, which is a symlink
        // to /private/var. Resolving it once here keeps every URL built from it
        // comparable with the ones the store works with, including after a
        // folder has gone and can no longer be resolved on its own.
        base = FileManager.default.temporaryDirectory
            .resolvingSymlinksInPath()
            .appendingPathComponent("backup-store-tests-\(UUID().uuidString)")
        root = base.appendingPathComponent("Backups")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: base)
    }

    // MARK: - Measuring

    @Test func theSizeAddsUpTheFilesInTheFolder() throws {
        let folder = try makeBackup(udid: Self.udid, contentFiles: 3)

        let bytes = try #require(BackupStore.size(of: folder))

        let written = UInt64(3 * Self.contentFileBytes)
        // The walk asks for the room each file takes rather than the length of
        // its contents, so the number is the written bytes rounded up a block
        // at a time, over the three content files and the two plists.
        #expect(bytes >= written)
        #expect(bytes < written + UInt64(5 * 65_536))
    }

    @Test func aBiggerFolderMeasuresBigger() throws {
        let big = try makeBackup(udid: Self.udid, contentFiles: 12)
        let small = try makeBackup(udid: Self.otherUdid, contentFiles: 3)

        #expect(try #require(BackupStore.size(of: big)) > #require(BackupStore.size(of: small)))
    }

    @Test func aFolderWithNothingReadableInItIsStillMeasured() throws {
        let folder = try makeHalfWrittenBackup(udid: Self.udid)

        #expect(try #require(BackupStore.size(of: folder)) > 0)
    }

    @Test func aCancelledWalkGivesNoNumberAtAll() throws {
        let folder = try makeBackup(udid: Self.udid)

        // Half a number is worse than none.
        #expect(BackupStore.size(of: folder, isCancelled: { true }) == nil)
    }

    @Test func aFolderThatIsNotThereMeasuresNothing() {
        #expect(BackupStore.size(of: root.appendingPathComponent("nowhere")) == 0)
    }

    // MARK: - Deleting

    @Test func deletingTakesTheFolderAndLeavesEveryOtherPhoneWhereItIs() throws {
        let folder = try makeBackup(udid: Self.udid)
        let otherPhone = try makeBackup(udid: Self.otherUdid)
        let removals = Removals(in: base)

        let took = try BackupStore.delete(udid: Self.udid, root: root, remove: removals.action)

        #expect(took)
        #expect(removals.taken.map(resolved) == [folder].map(resolved))
        #expect(FileManager.default.fileExists(atPath: folder.path) == false)
        #expect(FileManager.default.fileExists(atPath: otherPhone.path))
    }

    @Test func everySavedCopyOfThatPhoneGoesWithIt() throws {
        let folder = try makeBackup(udid: Self.udid)
        try makeBackup(udid: Self.otherUdid)
        let older = try makePristineCopy(udid: Self.udid, stamp: "20260917-101500")
        let newer = try makePristineCopy(udid: Self.udid, stamp: "20260918-090000")
        let otherPhone = try makePristineCopy(udid: Self.otherUdid, stamp: "20260918-090000")
        let removals = Removals(in: base)

        try BackupStore.delete(udid: Self.udid, root: root, remove: removals.action)

        // Every copy of this phone goes, because the backup they are a way
        // back to is gone. The other phone's copy stays.
        #expect(removals.taken.map(resolved) == [folder, older, newer].map(resolved))
        #expect(FileManager.default.fileExists(atPath: otherPhone.path))
    }

    @Test func aFolderARunLeftHalfWrittenIsTakenAsWell() throws {
        // It holds no readable Manifest.plist, which is how a backup that
        // stopped part way looks, and it is the same 63 GB as a whole one.
        let folder = try makeHalfWrittenBackup(udid: Self.udid)
        let removals = Removals(in: base)

        #expect(try BackupStore.delete(udid: Self.udid, root: root, remove: removals.action))
        #expect(FileManager.default.fileExists(atPath: folder.path) == false)
    }

    @Test func aPhoneThisMacHoldsNothingForTakesNothing() throws {
        try makeBackup(udid: Self.otherUdid)
        let removals = Removals(in: base)

        #expect(try BackupStore.delete(udid: Self.udid, root: root, remove: removals.action) == false)
        #expect(removals.taken == [])
    }

    @Test func theSavedCopiesGoEvenWhenTheBackupItselfIsAlreadyGone() throws {
        let copy = try makePristineCopy(udid: Self.udid, stamp: "20260918-090000")
        let removals = Removals(in: base)

        #expect(try BackupStore.delete(udid: Self.udid, root: root, remove: removals.action))
        #expect(FileManager.default.fileExists(atPath: copy.path) == false)
    }

    // MARK: - What is never deleted

    @Test func aNameThatMeansSomewhereElseIsRefused() throws {
        let removals = Removals(in: base)
        let outside = try makeBackup(udid: Self.udid)

        for name in ["", ".", "..", "../Backups", "\(Self.udid)/3d"] {
            let error = try #require(throws: BackupStoreError.self) {
                try BackupStore.delete(udid: name, root: root, remove: removals.action)
            }
            guard case .outsideBackupsFolder = error else {
                Issue.record("expected outsideBackupsFolder for \(name), got \(error)")
                continue
            }
        }
        #expect(removals.taken == [])
        #expect(FileManager.default.fileExists(atPath: outside.path))
        #expect(FileManager.default.fileExists(atPath: base.path))
    }

    @Test func theFolderOfSavedCopiesIsRefused() throws {
        let pristine = SupervisionPatch.pristineRoot(forBackupRoot: root)
        try makePristineCopy(udid: Self.udid, stamp: "20260918-090000")
        let removals = Removals(in: base)

        let error = try #require(throws: BackupStoreError.self) {
            try BackupStore.delete(
                udid: SupervisionPatch.pristineDirectoryName,
                root: root,
                remove: removals.action
            )
        }
        guard case .outsideBackupsFolder = error else {
            Issue.record("expected outsideBackupsFolder, got \(error)")
            return
        }
        #expect(removals.taken == [])
        #expect(FileManager.default.fileExists(atPath: pristine.path))
    }

    @Test func aRefusedDeleteIsReportedInOneSentenceThatNamesTheFolder() throws {
        struct Refused: LocalizedError {
            var errorDescription: String? { "The volume is read only." }
        }
        let folder = try makeBackup(udid: Self.udid)

        let error = try #require(throws: BackupStoreError.self) {
            try BackupStore.delete(udid: Self.udid, root: root, remove: { _ in throw Refused() })
        }
        guard case .removeFailed = error else {
            Issue.record("expected removeFailed, got \(error)")
            return
        }
        // The path is in the sentence because somebody has to go and look.
        #expect(
            (error as? LocalizedError)?.errorDescription
                == "The copy at \(folder.path) could not be deleted, so it is still on this Mac. "
                    + "macOS reported: The volume is read only."
        )
        #expect(FileManager.default.fileExists(atPath: folder.path))
    }

    // MARK: - The default

    /// Every other delete test hands in a stub. This one uses the default the
    /// app runs with, which has to take the folder off the disk rather than
    /// move it to the Trash: the Trash would hold on to all 63 GB of somebody's
    /// iPhone until they emptied it.
    @Test func theDefaultTakesTheFolderOffTheDiskRatherThanToTheTrash() throws {
        let folder = try makeBackup(udid: Self.udid)
        let copy = try makePristineCopy(udid: Self.udid, stamp: "20260918-090000")

        try BackupStore.delete(udid: Self.udid, root: root)

        #expect(FileManager.default.fileExists(atPath: folder.path) == false)
        #expect(FileManager.default.fileExists(atPath: copy.path) == false)
        #expect(try namesInTrash(startingWith: Self.udid) == [])
    }

    // MARK: - Helpers

    /// `/var` is a symlink to `/private/var` and a directory URL may or may not
    /// keep its trailing slash, so two file URLs are compared by the path they
    /// both resolve to rather than by the string each was built from.
    private func resolved(_ url: URL?) -> String? {
        guard let path = url?.resolvingSymlinksInPath().standardizedFileURL.path else {
            return nil
        }
        return path.hasPrefix("/private/") ? String(path.dropFirst("/private".count)) : path
    }

    private var trashDirectory: URL {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".Trash")
    }

    /// What the Trash holds under a name, or nothing at all when this process
    /// may not read it. A runner that cannot list the Trash cannot have put
    /// anything there either.
    private func namesInTrash(startingWith prefix: String) throws -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: trashDirectory.path)) ?? []
        return names.filter { $0.hasPrefix(prefix) }.sorted()
    }

    // MARK: - Fixtures

    /// A backup folder in the shape the app writes: Manifest.plist, Info.plist
    /// and the content files under the first two characters of their name.
    @discardableResult
    private func makeBackup(udid: String, contentFiles: Int = 3) throws -> URL {
        let folder = root.appendingPathComponent(udid)
        let content = folder.appendingPathComponent("3d")
        try FileManager.default.createDirectory(at: content, withIntermediateDirectories: true)

        var manifest = try BackupFixture.manifestDictionary(udid: udid, encrypted: false)
        manifest["Date"] = Self.made
        manifest["Lockdown"] = [
            "DeviceName": "Test iPhone",
            "ProductType": "iPhone17,5",
            "ProductVersion": "26.6.1",
            "UniqueDeviceID": udid,
        ]
        try PropertyListSerialization
            .data(fromPropertyList: manifest, format: .binary, options: 0)
            .write(to: folder.appendingPathComponent(BackupFolder.manifestPlistName))
        try Data(repeating: 0x61, count: Self.contentFileBytes)
            .write(to: folder.appendingPathComponent("Info.plist"))
        for index in 0..<contentFiles {
            try Data(repeating: 0x61, count: Self.contentFileBytes)
                .write(to: content.appendingPathComponent("3d0d7e5fb2ce288813306e4d4636395e047a3d\(index)"))
        }
        return folder
    }

    /// A folder the iPhone never finished writing: files in it and nothing
    /// readable saying what they are. It is what a run that stopped part way
    /// leaves behind.
    @discardableResult
    private func makeHalfWrittenBackup(udid: String) throws -> URL {
        let folder = root.appendingPathComponent(udid)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data(repeating: 0xff, count: 512)
            .write(to: folder.appendingPathComponent(BackupFolder.manifestPlistName))
        try Data(repeating: 0x61, count: Self.contentFileBytes)
            .write(to: folder.appendingPathComponent("Info.plist"))
        return folder
    }

    /// One untouched copy, in the shape `SupervisionPatch.savePristine` writes.
    @discardableResult
    private func makePristineCopy(udid: String, stamp: String, bytes: Int = 2048) throws -> URL {
        let directory = SupervisionPatch.pristineRoot(forBackupRoot: root)
            .appendingPathComponent("\(udid)-\(stamp)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data(repeating: 0x62, count: bytes)
            .write(to: directory.appendingPathComponent(BackupFolder.manifestDatabaseName))
        try Data("{}\n".utf8)
            .write(to: directory.appendingPathComponent(SupervisionPatch.pristineMetadataName))
        return directory
    }

    /// Stands in for the delete: it records what it was handed and moves it
    /// aside, so a test can see what would have gone and in what order.
    private final class Removals {
        private(set) var taken: [URL] = []
        private let directory: URL

        init(in base: URL) {
            directory = base.appendingPathComponent("removed")
        }

        var action: BackupStore.Remove {
            { url in
                try FileManager.default.createDirectory(
                    at: self.directory,
                    withIntermediateDirectories: true
                )
                self.taken.append(url)
                try FileManager.default.moveItem(
                    at: url,
                    to: self.directory.appendingPathComponent("\(self.taken.count)-\(url.lastPathComponent)")
                )
            }
        }
    }
}
