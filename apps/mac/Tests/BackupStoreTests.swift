import XCTest

/// The list of backups the app keeps, and taking one off the disk again.
///
/// The fixtures are folders in a temporary directory: a real Manifest.plist
/// and Info.plist, a few files of content, one folder whose Manifest.plist is
/// nonsense, one folder that is no backup at all, and the folder that holds
/// the untouched copies.
final class BackupStoreTests: XCTestCase {
    /// The two live beside each other, so the stand-in Trash is never itself
    /// one of the backups.
    private var base: URL!
    private var root: URL!

    private static let newest = Date(timeIntervalSince1970: 1_789_300_000)
    private static let middle = Date(timeIntervalSince1970: 1_789_200_000)
    private static let oldest = Date(timeIntervalSince1970: 1_789_100_000)
    private static let contentFileBytes = 4096

    override func setUpWithError() throws {
        // The system temporary directory sits under /var, which is a symlink
        // to /private/var. Resolving it once here keeps every URL built from it
        // comparable with the ones the store hands back, including after a
        // folder has been trashed and can no longer be resolved on its own.
        base = FileManager.default.temporaryDirectory
            .resolvingSymlinksInPath()
            .appendingPathComponent("backup-store-tests-\(UUID().uuidString)")
        root = base.appendingPathComponent("Backups")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: base)
    }

    // MARK: - Listing

    func testTheNewestBackupIsListedFirstAndOneWithNoDateIsListedLast() throws {
        try makeBackup(udid: "udid-middle", date: Self.middle)
        try makeBackup(udid: "udid-newest", date: Self.newest)
        try makeBackup(udid: "udid-oldest", date: Self.oldest)
        try makeUnreadableBackup(udid: "udid-unreadable")

        let listed = try BackupStore.list(root: root)

        XCTAssertEqual(
            listed.map(\.udid),
            ["udid-newest", "udid-middle", "udid-oldest", "udid-unreadable"]
        )
    }

    func testABackupCarriesWhatManifestPlistSaysAboutThePhone() throws {
        try makeBackup(
            udid: "udid-newest",
            deviceName: "Misskoc’un Telsizi",
            productType: "iPhone17,5",
            iosVersion: "26.6.1",
            date: Self.newest
        )

        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        XCTAssertEqual(backup.udid, "udid-newest")
        XCTAssertEqual(resolved(backup.url), resolved(root.appendingPathComponent("udid-newest")))
        XCTAssertEqual(backup.id, backup.url)
        XCTAssertEqual(backup.deviceName, "Misskoc’un Telsizi")
        XCTAssertEqual(backup.productType, "iPhone17,5")
        XCTAssertEqual(backup.iosVersion, "26.6.1")
        XCTAssertEqual(backup.date, Self.newest)
        XCTAssertFalse(backup.isEncrypted)
        XCTAssertNil(backup.sizeInBytes)
        XCTAssertNil(backup.pristineURL)
        XCTAssertNil(backup.pristineSizeInBytes)
    }

    func testAnEncryptedBackupSaysSo() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest, encrypted: true)

        XCTAssertEqual(try BackupStore.list(root: root).first?.isEncrypted, true)
    }

    func testAFolderWithNoReadableManifestIsStillListed() throws {
        try makeUnreadableBackup(udid: "udid-unreadable")

        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        // Everything but the folder name is unknown, and the folder is listed
        // all the same: an unreadable 63 GB folder is the one a person most
        // needs to get rid of.
        XCTAssertEqual(backup.udid, "udid-unreadable")
        XCTAssertNil(backup.deviceName)
        XCTAssertNil(backup.productType)
        XCTAssertNil(backup.iosVersion)
        XCTAssertNil(backup.date)
        XCTAssertFalse(backup.isEncrypted)
    }

    func testAFolderThatIsNoBackupAndTheSavedCopiesAreLeftOut() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        let stray = root.appendingPathComponent("not-a-backup")
        try FileManager.default.createDirectory(at: stray, withIntermediateDirectories: true)
        try Data("nothing to see".utf8).write(to: stray.appendingPathComponent("readme.txt"))
        try makePristineCopy(udid: "udid-newest", stamp: "20260918-090000")

        XCTAssertEqual(try BackupStore.list(root: root).map(\.udid), ["udid-newest"])
    }

    func testThePristineFolderIsLeftOutEvenIfItLooksLikeABackup() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        // Nothing writes a Manifest.plist there today. The name is the rule,
        // so the folder that holds the way back is never offered for deletion
        // whatever ends up inside it.
        let pristine = SupervisionPatch.pristineRoot(forBackupRoot: root)
        try FileManager.default.createDirectory(at: pristine, withIntermediateDirectories: true)
        try BackupFixture.manifestPlist(udid: "udid-newest", encrypted: false)
            .write(to: pristine.appendingPathComponent(BackupFolder.manifestPlistName))

        XCTAssertEqual(try BackupStore.list(root: root).map(\.udid), ["udid-newest"])
    }

    func testTheNewestSavedCopyIsAttachedToItsOwnBackup() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        try makeBackup(udid: "udid-oldest", date: Self.oldest)
        try makePristineCopy(udid: "udid-newest", stamp: "20260917-101500")
        let newestCopy = try makePristineCopy(udid: "udid-newest", stamp: "20260918-090000")

        let listed = try BackupStore.list(root: root)

        XCTAssertEqual(resolved(listed.first?.pristineURL), resolved(newestCopy))
        XCTAssertNil(listed.last?.pristineURL)
    }

    func testAFolderWithNoBackupsInItListsNothing() throws {
        XCTAssertEqual(try BackupStore.list(root: root).count, 0)
        XCTAssertEqual(try BackupStore.list(root: base.appendingPathComponent("nowhere")).count, 0)
    }

    // MARK: - Measuring

    func testMeasuringAddsUpTheFilesInTheFolder() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest, contentFiles: 3)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        let measured = BackupStore.measure(backup)

        let written = Int64(3 * Self.contentFileBytes)
        // The walk asks for the room each file takes rather than the length of
        // its contents, so the number is the written bytes rounded up a block
        // at a time, over the three content files and the two plists.
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(measured.sizeInBytes), written)
        XCTAssertLessThan(try XCTUnwrap(measured.sizeInBytes), written + Int64(5 * 65_536))
        XCTAssertNil(measured.pristineSizeInBytes)
        // Nothing else about the backup moves.
        XCTAssertEqual(measured.url, backup.url)
        XCTAssertEqual(measured.date, backup.date)
    }

    func testABiggerFolderMeasuresBigger() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest, contentFiles: 12)
        try makeBackup(udid: "udid-oldest", date: Self.oldest, contentFiles: 3)

        let measured = try BackupStore.list(root: root).map { BackupStore.measure($0) }

        XCTAssertGreaterThan(
            try XCTUnwrap(measured.first?.sizeInBytes),
            try XCTUnwrap(measured.last?.sizeInBytes)
        )
    }

    func testAFolderWithNoReadableManifestIsStillMeasured() throws {
        try makeUnreadableBackup(udid: "udid-unreadable")
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        XCTAssertGreaterThan(try XCTUnwrap(BackupStore.measure(backup).sizeInBytes), 0)
    }

    func testEverySavedCopyOfThePhoneIsMeasuredTogether() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        try makePristineCopy(udid: "udid-newest", stamp: "20260917-101500", bytes: 8192)
        try makePristineCopy(udid: "udid-newest", stamp: "20260918-090000", bytes: 8192)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        let measured = BackupStore.measure(backup)

        // Both copies, not only the newest one, because deleting the backup
        // takes both.
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(measured.pristineSizeInBytes), 16_384)
        XCTAssertLessThan(try XCTUnwrap(measured.pristineSizeInBytes), 16_384 + Int64(4 * 65_536))
    }

    func testMeasuringOffTheMainThreadGivesTheSameNumber() async throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        let measured = await BackupStore.measured(backup)

        XCTAssertEqual(measured, BackupStore.measure(backup))
    }

    func testACancelledMeasurementGivesNoNumberAtAll() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        let measured = BackupStore.measure(backup, isCancelled: { true })

        // Half a number is worse than none.
        XCTAssertNil(measured.sizeInBytes)
        XCTAssertEqual(measured, backup)
    }

    func testTheTotalCountsTheBackupsAndTheirSavedCopiesAndNothingElse() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        try makeBackup(udid: "udid-oldest", date: Self.oldest)
        try makePristineCopy(udid: "udid-newest", stamp: "20260918-090000", bytes: 8192)
        let measured = try BackupStore.list(root: root).map { BackupStore.measure($0) }

        let expected = measured.reduce(into: Int64(0)) { total, backup in
            total += (backup.sizeInBytes ?? 0) + (backup.pristineSizeInBytes ?? 0)
        }

        XCTAssertEqual(BackupStore.totalSize(of: measured), expected)
        XCTAssertGreaterThan(BackupStore.totalSize(of: measured), 0)
        // What has not been measured counts as nothing.
        XCTAssertEqual(BackupStore.totalSize(of: try BackupStore.list(root: root)), 0)
        XCTAssertEqual(BackupStore.totalSize(of: []), 0)
    }

    // MARK: - Deleting

    func testDeletingTakesTheFolderAndLeavesEveryOtherOneWhereItIs() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        try makeBackup(udid: "udid-oldest", date: Self.oldest)
        let copy = try makePristineCopy(udid: "udid-newest", stamp: "20260918-090000")
        let trash = try FakeTrash(in: base)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        try BackupStore.delete(backup, includingPristineCopy: false, root: root, trash: trash.action)

        XCTAssertEqual(trash.taken, [backup.url])
        XCTAssertFalse(FileManager.default.fileExists(atPath: backup.url.path))
        XCTAssertEqual(try BackupStore.list(root: root).map(\.udid), ["udid-oldest"])
        // The untouched copy is the only way back to the backup the iPhone
        // made, so nothing takes it without being asked.
        XCTAssertTrue(FileManager.default.fileExists(atPath: copy.path))
    }

    func testTheSavedCopiesGoOnlyWhenTheCallerAsksForThem() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        try makeBackup(udid: "udid-oldest", date: Self.oldest)
        let older = try makePristineCopy(udid: "udid-newest", stamp: "20260917-101500")
        let newer = try makePristineCopy(udid: "udid-newest", stamp: "20260918-090000")
        let otherPhone = try makePristineCopy(udid: "udid-oldest", stamp: "20260918-090000")
        let trash = try FakeTrash(in: base)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        try BackupStore.delete(backup, includingPristineCopy: true, root: root, trash: trash.action)

        // Every copy of this phone goes, because a copy of a backup that is
        // gone can no longer be put back over anything. The other phone's copy
        // stays.
        XCTAssertEqual(trash.taken.map(resolved), [backup.url, older, newer].map(resolved))
        XCTAssertTrue(FileManager.default.fileExists(atPath: otherPhone.path))
    }

    func testAFolderOutsideTheBackupsFolderIsRefused() throws {
        let outside = base.appendingPathComponent("elsewhere")
        try FileManager.default.createDirectory(at: outside, withIntermediateDirectories: true)
        try BackupFixture.manifestPlist(udid: "udid-newest", encrypted: false)
            .write(to: outside.appendingPathComponent(BackupFolder.manifestPlistName))
        let trash = try FakeTrash(in: base)

        XCTAssertThrowsError(
            try BackupStore.delete(
                storedBackup(at: outside),
                includingPristineCopy: true,
                root: root,
                trash: trash.action
            )
        ) { error in
            guard case BackupStoreError.outsideBackupsFolder = error else {
                return XCTFail("expected outsideBackupsFolder, got \(error)")
            }
        }
        XCTAssertEqual(trash.taken, [])
        XCTAssertTrue(FileManager.default.fileExists(atPath: outside.path))
    }

    func testAFolderDeeperInsideTheBackupsFolderIsRefused() throws {
        try makeBackup(udid: "udid-newest", date: Self.newest)
        let nested = root.appendingPathComponent("udid-newest").appendingPathComponent("3d")
        let trash = try FakeTrash(in: base)

        XCTAssertThrowsError(
            try BackupStore.delete(
                storedBackup(at: nested),
                includingPristineCopy: false,
                root: root,
                trash: trash.action
            )
        )
        XCTAssertEqual(trash.taken, [])
        XCTAssertTrue(FileManager.default.fileExists(atPath: nested.path))
    }

    func testTheFolderOfSavedCopiesItselfIsRefused() throws {
        let pristine = SupervisionPatch.pristineRoot(forBackupRoot: root)
        try makePristineCopy(udid: "udid-newest", stamp: "20260918-090000")
        try BackupFixture.manifestPlist(udid: "udid-newest", encrypted: false)
            .write(to: pristine.appendingPathComponent(BackupFolder.manifestPlistName))
        let trash = try FakeTrash(in: base)

        XCTAssertThrowsError(
            try BackupStore.delete(
                storedBackup(at: pristine),
                includingPristineCopy: false,
                root: root,
                trash: trash.action
            )
        )
        XCTAssertEqual(trash.taken, [])
        XCTAssertTrue(FileManager.default.fileExists(atPath: pristine.path))
    }

    func testAFolderThatHoldsNoBackupIsRefused() throws {
        let stray = root.appendingPathComponent("not-a-backup")
        try FileManager.default.createDirectory(at: stray, withIntermediateDirectories: true)
        let trash = try FakeTrash(in: base)

        XCTAssertThrowsError(
            try BackupStore.delete(
                storedBackup(at: stray),
                includingPristineCopy: false,
                root: root,
                trash: trash.action
            )
        ) { error in
            guard case BackupStoreError.notABackupFolder = error else {
                return XCTFail("expected notABackupFolder, got \(error)")
            }
        }
        XCTAssertEqual(trash.taken, [])
    }

    func testARefusedTrashIsReportedInOneSentence() throws {
        struct Refused: LocalizedError {
            var errorDescription: String? { "The volume is read only." }
        }
        try makeBackup(udid: "udid-newest", date: Self.newest)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first)

        XCTAssertThrowsError(
            try BackupStore.delete(backup, includingPristineCopy: false, root: root, trash: { _ in
                throw Refused()
            })
        ) { error in
            guard case BackupStoreError.trashFailed = error else {
                return XCTFail("expected trashFailed, got \(error)")
            }
            XCTAssertEqual(
                (error as? LocalizedError)?.errorDescription,
                "The folder at \(backup.url.path) could not be moved to the Trash. "
                    + "macOS reported: The volume is read only."
            )
        }
        XCTAssertTrue(FileManager.default.fileExists(atPath: backup.url.path))
    }

    /// The real Trash, so the default that the window uses is the one under
    /// test. The folder is named after a fresh UUID, which is how it is found
    /// again in the Trash and taken out at the end.
    func testTheDefaultMovesTheFolderToTheTrash() throws {
        // Every other delete test hands in a stub. This one uses the real
        // Trash, which a test runner is not always allowed to reach.
        try XCTSkipUnless(canReachTrash(), "The Trash is not reachable from here.")
        let udid = "udid-\(UUID().uuidString)"
        try makeBackup(udid: udid, date: Self.newest)
        try makeBackup(udid: "udid-oldest", date: Self.oldest)
        let backup = try XCTUnwrap(try BackupStore.list(root: root).first { $0.udid == udid })
        defer { emptyFromTrash(named: udid) }

        try BackupStore.delete(backup, includingPristineCopy: false, root: root)

        XCTAssertFalse(FileManager.default.fileExists(atPath: backup.url.path))
        XCTAssertEqual(try BackupStore.list(root: root).map(\.udid), ["udid-oldest"])
        XCTAssertEqual(try namesInTrash(startingWith: udid), [udid])
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

    /// Whether this process may move a file to the Trash and read it back.
    /// Writing and listing are governed separately, so both are probed.
    private func canReachTrash() -> Bool {
        guard (try? FileManager.default.contentsOfDirectory(atPath: trashDirectory.path)) != nil
        else { return false }
        let probe = base.appendingPathComponent("trash-probe-\(UUID().uuidString)")
        guard (try? Data().write(to: probe)) != nil else { return false }
        var moved: NSURL?
        do {
            try FileManager.default.trashItem(at: probe, resultingItemURL: &moved)
        } catch {
            try? FileManager.default.removeItem(at: probe)
            return false
        }
        if let landed = moved as URL? {
            try? FileManager.default.removeItem(at: landed)
        }
        return true
    }

    // MARK: - Fixtures

    /// A backup folder in the shape the app writes: Manifest.plist, Info.plist
    /// and the content files under the first two characters of their name.
    @discardableResult
    private func makeBackup(
        udid: String,
        deviceName: String = "Test iPhone",
        productType: String = "iPhone17,5",
        iosVersion: String = "26.6.1",
        date: Date,
        encrypted: Bool = false,
        contentFiles: Int = 3
    ) throws -> URL {
        let folder = root.appendingPathComponent(udid)
        let content = folder.appendingPathComponent("3d")
        try FileManager.default.createDirectory(at: content, withIntermediateDirectories: true)

        var manifest = try BackupFixture.manifestDictionary(udid: udid, encrypted: encrypted)
        manifest["Date"] = date
        manifest["Lockdown"] = [
            "DeviceName": deviceName,
            "ProductType": productType,
            "ProductVersion": iosVersion,
            "UniqueDeviceID": udid,
        ]
        try PropertyListSerialization
            .data(fromPropertyList: manifest, format: .binary, options: 0)
            .write(to: folder.appendingPathComponent(BackupFolder.manifestPlistName))
        try PropertyListSerialization
            .data(
                fromPropertyList: [
                    "Device Name": deviceName,
                    "Product Type": productType,
                    "Product Version": iosVersion,
                    "Target Identifier": udid,
                ],
                format: .binary,
                options: 0
            )
            .write(to: folder.appendingPathComponent("Info.plist"))
        for index in 0..<contentFiles {
            try Data(repeating: 0x61, count: Self.contentFileBytes)
                .write(to: content.appendingPathComponent("3d0d7e5fb2ce288813306e4d4636395e047a3d\(index)"))
        }
        return folder
    }

    /// A folder that is a backup as far as the disk is concerned and holds
    /// nothing readable, which is how a half written or damaged backup looks.
    @discardableResult
    private func makeUnreadableBackup(udid: String) throws -> URL {
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

    /// A backup that points at a folder of the test's choosing, for the checks
    /// that nothing outside the backups folder is ever deleted.
    private func storedBackup(at url: URL) -> StoredBackup {
        StoredBackup(
            url: url,
            udid: url.lastPathComponent,
            deviceName: nil,
            productType: nil,
            iosVersion: nil,
            date: nil,
            isEncrypted: false,
            snapshotState: nil,
            sizeInBytes: nil,
            pristineURL: nil,
            pristineSizeInBytes: nil
        )
    }

    /// Stands in for the Trash: it records what it was handed and moves it
    /// aside, which is what the Trash does to the folder it takes.
    private final class FakeTrash {
        private(set) var taken: [URL] = []
        private let directory: URL

        init(in base: URL) throws {
            directory = base.appendingPathComponent("trash")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }

        var action: BackupStore.Trash {
            { url in
                self.taken.append(url)
                try FileManager.default.moveItem(
                    at: url,
                    to: self.directory.appendingPathComponent("\(self.taken.count)-\(url.lastPathComponent)")
                )
            }
        }
    }

    private var trashDirectory: URL {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".Trash")
    }

    private func namesInTrash(startingWith prefix: String) throws -> [String] {
        try FileManager.default
            .contentsOfDirectory(atPath: trashDirectory.path)
            .filter { $0.hasPrefix(prefix) }
            .sorted()
    }

    private func emptyFromTrash(named prefix: String) {
        for name in (try? namesInTrash(startingWith: prefix)) ?? [] {
            try? FileManager.default.removeItem(at: trashDirectory.appendingPathComponent(name))
        }
    }
}
