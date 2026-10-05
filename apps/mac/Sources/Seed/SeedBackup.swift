import CryptoKit
import Foundation

/// The small backup the seed method restores: the cloud configuration and
/// Setup Assistant completion preferences, plus the files that identify it
/// as a non-full backup. Its payloads follow Nugget's add_skip_setup.
///
/// Payload files lie flat in the folder under their domain-and-path SHA-1,
/// with Manifest.mbdb listing each domain's directories before its file.
/// Restore behavior is still controlled by iOS; these setup preferences do
/// not establish that other phone data will be preserved.
///
/// Nothing here reaches an iPhone. It writes a folder for the restore layer.
///
/// Portions adapted from Nugget (https://github.com/leminlimez/Nugget), AGPL-3.0:
/// the setup payload, the `Status.plist` and `Manifest.plist` values and the
/// keybag. Nugget has the last three from TrollRestore
/// (https://github.com/JJTech0130/TrollRestore), MIT, Copyright 2024 James
/// Gill (JJTech0130). See THIRD_PARTY_NOTICES.md.
enum SeedBackup {
    static let infoPlistName = "Info.plist"
    static let manifestPlistName = "Manifest.plist"
    /// Where the cloud configuration lives on the iPhone: its backup domain
    /// and its path inside that domain.
    static let supervisionDomain = "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles"
    static let supervisionRelativePath = "Library/ConfigurationProfiles/CloudConfigurationDetails.plist"
    /// `mobile`, the owner and the group Nugget gives every record.
    static let owner: UInt32 = 501
    static let group: UInt32 = 501

    /// The name the cloud configuration file has in the folder: the SHA-1 of
    /// its domain, a dash and its path.
    static let contentFileName = Insecure.SHA1
        .hash(data: Data("\(supervisionDomain)-\(supervisionRelativePath)".utf8))
        .map { String(format: "%02x", $0) }
        .joined()

    static let setupDomain = "ManagedPreferencesDomain"
    static let setupRelativePath = "mobile/com.apple.purplebuddy.plist"
    static let setupConfiguration: [String: Any] = [
        "SetupDone": true,
        "SetupFinishedAllSteps": true,
        "UserChoseLanguage": true,
    ]
    static let setupFileName = Insecure.SHA1
        .hash(data: Data("\(setupDomain)-\(setupRelativePath)".utf8))
        .map { String(format: "%02x", $0) }
        .joined()

    /// The cloud payload records, also kept as an independent byte reference.
    /// The records of Manifest.mbdb in the order a restore takes them: the
    /// root of the domain, each folder on the way down, then the file.
    static func records(content: Data, date: Date, inode: UInt64) -> [MbdbRecord] {
        let domain = supervisionDomain
        var records = [MbdbRecord.directory(domain: domain, path: "", owner: owner, group: group, date: date)]
        var parent = ""
        for component in supervisionRelativePath.split(separator: "/").dropLast() {
            parent = parent.isEmpty ? String(component) : "\(parent)/\(component)"
            records.append(.directory(domain: domain, path: parent, owner: owner, group: group, date: date))
        }
        records.append(
            .file(
                domain: domain,
                path: supervisionRelativePath,
                contents: content,
                owner: owner,
                group: group,
                inode: inode,
                date: date
            )
        )
        return records
    }

    /// `Status.plist`, with the values Nugget writes: a finished backup that
    /// is not a full one.
    static let status: [String: Any] = [
        "BackupState": "new",
        "Date": Date(timeIntervalSince1970: 0),
        "IsFullBackup": false,
        "SnapshotState": BackupStatus.finishedSnapshot,
        "UUID": "00000000-0000-0000-0000-000000000000",
        "Version": "2.4",
    ]

    /// `Manifest.plist`. It names no apps, because the backup holds none.
    static let manifest: [String: Any] = [
        "BackupKeyBag": keybag,
        "Lockdown": [String: Any](),
        "SystemDomainsVersion": "20.0",
        "Version": "9.1",
    ]

    /// Write the folder for one iPhone under `root` and return it.
    ///
    /// `content` is the cloud configuration file as it goes to the iPhone.
    /// The date and the inode are handed in so the tests can fix them: Nugget
    /// stamps every record with the time it runs at and gives the file a
    /// random inode. The setup file gets the next inode with wrapping addition,
    /// so even UInt64.max produces two distinct file inodes.
    ///
    /// The folder has to be new. A folder that is already there is not one
    /// this write made, so it is refused and never cleared. A write that
    /// fails part way takes its own folder away again.
    @discardableResult
    static func write(
        in root: URL,
        udid: String,
        content: Data,
        date: Date = Date(),
        inode: UInt64 = .random(in: .min ... .max)
    ) throws -> URL {
        // A UDID names one folder directly inside the root and nothing else.
        guard !udid.isEmpty, !udid.contains("/"), udid != ".", udid != ".." else {
            throw SeedError.notAFolderName(udid)
        }
        let folder = root.appendingPathComponent(udid)
        guard !FileManager.default.fileExists(atPath: folder.path) else {
            throw SeedError.folderInTheWay(folder)
        }
        let setupContent = try plist(setupConfiguration)
        let setupRecords: [MbdbRecord] = [
            .directory(domain: setupDomain, path: "", owner: owner, group: group, date: date),
            .directory(domain: setupDomain, path: "mobile", owner: owner, group: group, date: date),
            .file(
                domain: setupDomain, path: setupRelativePath, contents: setupContent,
                owner: owner, group: group, inode: inode &+ 1, date: date
            ),
        ]
        let manifestRecords = records(content: content, date: date, inode: inode) + setupRecords
        let files = [
            contentFileName: content,
            setupFileName: setupContent,
            Mbdb.fileName: try Mbdb.data(records: manifestRecords),
            BackupStatus.fileName: try plist(status),
            manifestPlistName: try plist(manifest),
            infoPlistName: try plist([String: Any]()),
        ]
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        do {
            for (name, data) in files {
                try data.write(to: folder.appendingPathComponent(name))
            }
        } catch {
            try? FileManager.default.removeItem(at: folder)
            throw error
        }
        return folder
    }

    /// An XML property list, the format Nugget writes these files in.
    private static func plist(_ dictionary: [String: Any]) throws -> Data {
        try PropertyListSerialization.data(fromPropertyList: dictionary, format: .xml, options: 0)
    }

    /// The keybag Nugget puts in every Manifest.plist it writes, byte for
    /// byte, from `generate_manifest` in its `src/restore/backup.py`. The
    /// backup is not encrypted, so no file in it is read with a key from here.
    static let keybag = Data(base64Encoded: keybagBase64)!

    private static let keybagBase64 =
        "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" +
        "Z8FDgd7YoALY1g=="
}
