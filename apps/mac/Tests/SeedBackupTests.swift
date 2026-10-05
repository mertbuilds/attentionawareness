import CryptoKit
import Foundation
import Testing

/// The folder the seed method restores, written into a temporary directory
/// and read back off the disk.
final class SeedBackupTests {
    private let root: URL

    private static let date = Date(timeIntervalSince1970: 1_789_000_000)
    private static let inode: UInt64 = 0x0102_0304_0506_0708
    /// `shasum` of the domain, a dash and the path, worked out outside the app.
    private static let contentFileName = "1e6c0783f9b33d00b152067a0661c8fc8841073f"
    private static let setupFileName = "eb25d9cd0f9fa7b7f648596a1652163bbf4771de"

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("seed-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: root)
    }

    // The folder

    @Test func theFolderHoldsTwoPayloadsAndTheFourFilesOfABackup() throws {
        let content = try Self.supervisedContent()
        let folder = try SeedBackup.write(in: root, udid: BackupFixture.udid, content: content)

        #expect(folder.path == root.appendingPathComponent(BackupFixture.udid).path)
        #expect(SeedBackup.contentFileName == Self.contentFileName)
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        #expect(Set(names) == [
            Self.contentFileName,
            Self.setupFileName,
            "Info.plist",
            "Manifest.mbdb",
            "Manifest.plist",
            "Status.plist",
        ])
        // The file lies flat in the folder, not under the first two
        // characters of its name the way Manifest.db backups keep it.
        #expect(try Data(contentsOf: folder.appendingPathComponent(Self.contentFileName)) == content)
    }

    @Test func theStoredFileReadsBackAsSupervised() throws {
        let folder = try SeedBackup.write(in: root, udid: BackupFixture.udid, content: try Self.supervisedContent())

        let stored = try Self.dictionary(at: folder.appendingPathComponent(Self.contentFileName))
        #expect(CloudConfigurationEdit.boolean(stored["IsSupervised"]) == true)
        #expect(CloudConfigurationEdit.boolean(stored["CloudConfigurationUIComplete"]) == true)
        #expect(CloudConfigurationEdit.boolean(stored["ConfigurationWasApplied"]) == true)
    }

    @Test func theStatusSaysAFinishedBackupThatIsNotAFullOne() throws {
        let folder = try SeedBackup.write(in: root, udid: BackupFixture.udid, content: try Self.supervisedContent())

        let status = try #require(BackupStatus.read(inBackupFolder: folder))
        #expect(status.isFullBackup == false)
        #expect(status.isFinished)
        #expect(status.backupState == "new")
        #expect(status.uuid == "00000000-0000-0000-0000-000000000000")
        #expect(status.date == Date(timeIntervalSince1970: 0))
        let raw = try Self.dictionary(at: folder.appendingPathComponent("Status.plist"))
        #expect(raw["Version"] as? String == "2.4")
        #expect(raw.count == 6)
    }

    @Test func theManifestPlistCarriesNuggetsKeybagAndNoApps() throws {
        let folder = try SeedBackup.write(in: root, udid: BackupFixture.udid, content: try Self.supervisedContent())

        let manifest = try Self.dictionary(at: folder.appendingPathComponent("Manifest.plist"))
        #expect(Set(manifest.keys) == ["BackupKeyBag", "Lockdown", "SystemDomainsVersion", "Version"])
        #expect((manifest["Lockdown"] as? [String: Any])?.isEmpty == true)
        #expect(manifest["SystemDomainsVersion"] as? String == "20.0")
        #expect(manifest["Version"] as? String == "9.1")

        // The length and the SHA-256 of the blob in Nugget's `backup.py`,
        // decoded by Python.
        let keybag = try #require(manifest["BackupKeyBag"] as? Data)
        #expect(keybag.count == 1336)
        #expect(
            SHA256.hash(data: keybag).map { String(format: "%02x", $0) }.joined()
                == "66ef3284ba61014d5943f135c258e288128dc01e2d69deb717aa411e45141045"
        )
    }

    @Test func theInfoPlistIsAnEmptyDictionary() throws {
        let folder = try SeedBackup.write(in: root, udid: BackupFixture.udid, content: try Self.supervisedContent())

        #expect(try Self.dictionary(at: folder.appendingPathComponent("Info.plist")).isEmpty)
    }

    // Manifest.mbdb

    @Test(arguments: [true, false])
    func theManifestListsBothPayloadsAndTheirDirectories(_ supervised: Bool) throws {
        let content = try CloudConfigurationEdit.plan(current: [:], supervised: supervised).plistData()
        let folder = try SeedBackup.write(
            in: root, udid: BackupFixture.udid, content: content, date: Self.date, inode: Self.inode
        )
        let records = try Self.records(in: Data(contentsOf: folder.appendingPathComponent("Manifest.mbdb")))
        #expect(records.map { "\($0.domain)-\($0.filename)" } == [
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-",
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-Library",
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-Library/ConfigurationProfiles",
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-Library/ConfigurationProfiles/CloudConfigurationDetails.plist",
            "ManagedPreferencesDomain-",
            "ManagedPreferencesDomain-mobile",
            "ManagedPreferencesDomain-mobile/com.apple.purplebuddy.plist",
        ])
        for record in records {
            #expect(record.userID == 501)
            #expect(record.groupID == 501)
            #expect(record.flags == 4)
            #expect(record.mtime == 1_789_000_000)
            #expect(record.link.isEmpty)
            #expect(record.key.isEmpty)
            #expect(record.properties.isEmpty)
        }
        let directories = records.filter { $0.mode == 0o040755 }
        #expect(directories.count == 5)
        for directory in directories {
            #expect(directory.inode == 0)
            #expect(directory.size == 0)
            #expect(directory.hash.isEmpty)
        }
        let files = records.filter { $0.mode == 0o100755 }
        #expect(files.count == 2)
        #expect(files.map(\.inode) == [Self.inode, Self.inode + 1])
        for file in files {
            let storageName = Insecure.SHA1.hash(data: Data("\(file.domain)-\(file.filename)".utf8))
                .map { String(format: "%02x", $0) }.joined()
            let stored = try Data(contentsOf: folder.appendingPathComponent(storageName))
            #expect(file.size == UInt64(stored.count))
            #expect(file.hash == Data(Insecure.SHA1.hash(data: stored)))
        }
        #expect(SeedBackup.setupFileName == Self.setupFileName)
        let cloud = try Self.dictionary(at: folder.appendingPathComponent(Self.contentFileName))
        #expect(CloudConfigurationEdit.boolean(cloud["IsSupervised"]) == supervised)
        #expect((cloud["SkipSetup"] as? [String])?.contains("RestoreCompleted") == true)
        let setup = try Self.dictionary(at: folder.appendingPathComponent(Self.setupFileName))
        #expect(Set(setup.keys) == ["SetupDone", "SetupFinishedAllSteps", "UserChoseLanguage"])
        #expect(setup.values.allSatisfy { CloudConfigurationEdit.boolean($0) == true })
    }

    @Test func theLiveSeedHoldsTheSupervisionDomainAlone() throws {
        let content = try Self.supervisedContent()
        let folder = try SeedBackup.write(
            in: root, udid: BackupFixture.udid, content: content, mode: .live, date: Self.date, inode: Self.inode
        )
        let records = try Self.records(in: Data(contentsOf: folder.appendingPathComponent("Manifest.mbdb")))
        #expect(records.map { "\($0.domain)-\($0.filename)" } == [
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-",
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-Library",
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-Library/ConfigurationProfiles",
            "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles-Library/ConfigurationProfiles/CloudConfigurationDetails.plist",
        ])
        #expect(records.last?.inode == Self.inode)
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        #expect(Set(names) == [
            Self.contentFileName,
            "Info.plist",
            "Manifest.mbdb",
            "Manifest.plist",
            "Status.plist",
        ])
        #expect(try Data(contentsOf: folder.appendingPathComponent(Self.contentFileName)) == content)
    }

    @Test func fileInodesRemainDistinctWhenTheFirstIsUInt64Max() throws {
        let folder = try SeedBackup.write(
            in: root, udid: BackupFixture.udid, content: try Self.supervisedContent(),
            date: Self.date, inode: UInt64.max
        )
        let records = try Self.records(in: Data(contentsOf: folder.appendingPathComponent("Manifest.mbdb")))
        #expect(records.filter { $0.mode == 0o100755 }.map(\.inode) == [UInt64.max, 0])
    }

    @Test func theCloudPayloadRecordsMatchTheIndependentNuggetByteReference() throws {
        // The original independently generated cloud-file fixture still pins
        // this portion of the two-payload manifest byte for byte.
        let expected = try #require(Data(base64Encoded: Self.nuggetManifestBase64))
        let records = SeedBackup.records(content: Data("abc".utf8), date: Self.date, inode: Self.inode)
        #expect(try Mbdb.data(records: records) == expected)
    }

    // Refusals

    @Test func aFolderThatIsAlreadyThereIsLeftAlone() throws {
        // A folder this write did not make, with a Manifest.plist of its own,
        // which is the one thing this would write over.
        let existing = root.appendingPathComponent(BackupFixture.udid)
        try FileManager.default.createDirectory(at: existing, withIntermediateDirectories: true)
        let manifestBefore = Data("someone else's manifest".utf8)
        try manifestBefore.write(to: existing.appendingPathComponent(SeedBackup.manifestPlistName))

        let error = try #require(throws: SeedError.self) {
            try SeedBackup.write(in: root, udid: BackupFixture.udid, content: try Self.supervisedContent())
        }
        guard case .folderInTheWay(let url) = error else {
            Issue.record("expected a folder in the way, got \(error)")
            return
        }
        #expect(url.path == existing.path)
        #expect(try Data(contentsOf: existing.appendingPathComponent(SeedBackup.manifestPlistName)) == manifestBefore)
        #expect(FileManager.default.fileExists(atPath: existing.appendingPathComponent("Manifest.mbdb").path) == false)
    }

    @Test(arguments: ["", ".", "..", "../elsewhere", "a/b"])
    func aUDIDThatIsNotOneFolderNameIsRefused(_ udid: String) throws {
        #expect(throws: SeedError.notAFolderName(udid)) {
            try SeedBackup.write(in: root, udid: udid, content: try Self.supervisedContent())
        }
        #expect(try FileManager.default.contentsOfDirectory(atPath: root.path).isEmpty)
    }

    // Reading it back

    private static func supervisedContent() throws -> Data {
        try CloudConfigurationEdit.plan(current: BackupFixture.baseContent, supervised: true).plistData()
    }

    private static func dictionary(at url: URL) throws -> [String: Any] {
        let plist = try PropertyListSerialization.propertyList(from: try Data(contentsOf: url), options: [], format: nil)
        return try #require(plist as? [String: Any])
    }

    /// Nugget's `MbdbRecord.from_stream`, ported for the tests alone, so what
    /// is on disk is read by something other than the code that wrote it.
    ///
    /// Portions adapted from Nugget (https://github.com/leminlimez/Nugget),
    /// AGPL-3.0. Nugget has this reader from TrollRestore
    /// (https://github.com/JJTech0130/TrollRestore), MIT, Copyright 2024 James
    /// Gill (JJTech0130).
    private static func records(in data: Data) throws -> [MbdbRecord] {
        var bytes = [UInt8](data)[...]
        #expect(Array(bytes.prefix(6)) == Array("mbdb".utf8) + [0x05, 0x00])
        bytes = bytes.dropFirst(6)

        func take(_ count: Int) throws -> [UInt8] {
            try #require(bytes.count >= count)
            defer { bytes = bytes.dropFirst(count) }
            return Array(bytes.prefix(count))
        }
        func number<Value: FixedWidthInteger>(_: Value.Type) throws -> Value {
            try take(MemoryLayout<Value>.size).reduce(Value(0)) { $0 << 8 | Value($1) }
        }
        func blob() throws -> Data {
            let length = try number(UInt16.self)
            return length == .max ? Data() : Data(try take(Int(length)))
        }
        func string() throws -> String {
            String(decoding: try blob(), as: UTF8.self)
        }

        var records: [MbdbRecord] = []
        while !bytes.isEmpty {
            var record = MbdbRecord(
                domain: try string(),
                filename: try string(),
                link: try string(),
                hash: try blob(),
                key: try blob(),
                mode: try number(UInt16.self),
                inode: try number(UInt64.self),
                userID: try number(UInt32.self),
                groupID: try number(UInt32.self),
                mtime: try number(UInt32.self),
                atime: try number(UInt32.self),
                ctime: try number(UInt32.self),
                size: try number(UInt64.self),
                flags: try number(UInt8.self)
            )
            for _ in 0..<(try number(UInt8.self)) {
                record.properties.append(MbdbRecord.Property(name: try string(), value: try string()))
            }
            records.append(record)
        }
        return records
    }

    /// Portions adapted from Nugget (https://github.com/leminlimez/Nugget),
    /// AGPL-3.0: a byte reference for its `Manifest.mbdb` layout.
    private static let nuggetManifestBase64 =
        "bWJkYgUAAERTeXNTaGFyZWRDb250YWluZXJEb21haW4tc3lzdGVtZ3JvdXAuY29tLmFwcGxlLmNv" +
        "bmZpZ3VyYXRpb25wcm9maWxlcwAAAAAAAAAAQe0AAAAAAAAAAAAAAfUAAAH1aqH5QGqh+UBqoflA" +
        "AAAAAAAAAAAEAABEU3lzU2hhcmVkQ29udGFpbmVyRG9tYWluLXN5c3RlbWdyb3VwLmNvbS5hcHBs" +
        "ZS5jb25maWd1cmF0aW9ucHJvZmlsZXMAB0xpYnJhcnkAAAAAAABB7QAAAAAAAAAAAAAB9QAAAfVq" +
        "oflAaqH5QGqh+UAAAAAAAAAAAAQAAERTeXNTaGFyZWRDb250YWluZXJEb21haW4tc3lzdGVtZ3Jv" +
        "dXAuY29tLmFwcGxlLmNvbmZpZ3VyYXRpb25wcm9maWxlcwAdTGlicmFyeS9Db25maWd1cmF0aW9u" +
        "UHJvZmlsZXMAAAAAAABB7QAAAAAAAAAAAAAB9QAAAfVqoflAaqH5QGqh+UAAAAAAAAAAAAQAAERT" +
        "eXNTaGFyZWRDb250YWluZXJEb21haW4tc3lzdGVtZ3JvdXAuY29tLmFwcGxlLmNvbmZpZ3VyYXRp" +
        "b25wcm9maWxlcwA9TGlicmFyeS9Db25maWd1cmF0aW9uUHJvZmlsZXMvQ2xvdWRDb25maWd1cmF0" +
        "aW9uRGV0YWlscy5wbGlzdAAAABSpmT42RwaBaro+JXF4UMJsnNDYnQAAge0BAgMEBQYHCAAAAfUA" +
        "AAH1aqH5QGqh+UBqoflAAAAAAAAAAAMEAA=="
}
