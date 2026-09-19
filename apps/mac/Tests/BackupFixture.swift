import CommonCrypto
import Foundation
import SQLite3

/// A backup folder built in code, plain or encrypted, in the shape Finder
/// writes: a Manifest.plist, a Manifest.db with the Files table, and the cloud
/// configuration file under the first two characters of its name.
enum BackupFixture {
    static let udid = "00008140-000A1B2C3D4E5F60"
    static let otherUDID = "00008140-000B2C3D4E5F6071"
    static let archiveFolder = "00008140-000A1B2C3D4E5F60-20260910-162122"
    static let fileID = "3d0d7e5fb2ce288813306e4d4636395e047a3d28"
    static let password = "open sesame"
    static let otherPassword = "open barley"
    static let manifestClass = 4
    static let fileClass = 3
    /// The real keybag runs about ten million rounds. The fixture needs the
    /// shape, not the wait.
    static let rounds = 1000

    static let baseContent: [String: Any] = [
        "AllowPairing": true,
        "CloudConfigurationUIComplete": false,
        "ConfigurationSource": 0,
        "IsSupervised": false,
        "PostSetupProfileWasInstalled": true,
    ]

    enum FixtureError: Error {
        case database(String)
        case crypto(Int32)
        case blob
    }

    // Folders

    /// A plain backup. The returned URL is the backup folder itself.
    @discardableResult
    static func makeBackup(
        in root: URL,
        content: [String: Any] = baseContent,
        format: PropertyListSerialization.PropertyListFormat = .xml,
        folder: String? = nil,
        udid: String = udid
    ) throws -> URL {
        let directory = root.appendingPathComponent(folder ?? udid)
        try FileManager.default.createDirectory(
            at: directory.appendingPathComponent(String(fileID.prefix(2))),
            withIntermediateDirectories: true
        )
        try manifestPlist(udid: udid, encrypted: false)
            .write(to: directory.appendingPathComponent(BackupFolder.manifestPlistName))

        let data = try PropertyListSerialization.data(fromPropertyList: content, format: format, options: 0)
        try data.write(to: directory.appendingPathComponent(String(fileID.prefix(2))).appendingPathComponent(fileID))
        try writeManifestDatabase(
            at: directory.appendingPathComponent(BackupFolder.manifestDatabaseName),
            blob: try plainBlob(size: data.count)
        )
        return directory
    }

    /// An encrypted backup: a keybag in Manifest.plist, an encrypted
    /// Manifest.db, and an encrypted cloud configuration file.
    @discardableResult
    static func makeEncryptedBackup(
        in root: URL,
        content: [String: Any] = baseContent,
        format: PropertyListSerialization.PropertyListFormat = .xml,
        password: String = password,
        writeAheadLog: Bool = false
    ) throws -> URL {
        let directory = root.appendingPathComponent(udid)
        try FileManager.default.createDirectory(
            at: directory.appendingPathComponent(String(fileID.prefix(2))),
            withIntermediateDirectories: true
        )

        let classKeys = [fileClass: Data(repeating: 0x31, count: 32), manifestClass: Data(repeating: 0x42, count: 32)]
        let fileKey = Data(repeating: 0x5a, count: 32)
        let manifestKey = Data(repeating: 0x6b, count: 32)

        let plain = try PropertyListSerialization.data(fromPropertyList: content, format: format, options: 0)
        let encrypted = try BackupCrypto.encrypt(BackupCrypto.addPadding(plain), key: fileKey)
        try encrypted.write(
            to: directory.appendingPathComponent(String(fileID.prefix(2))).appendingPathComponent(fileID)
        )

        let wrappedFileKey = littleEndian(UInt32(fileClass)) + (try wrapKey(classKeys[fileClass]!, fileKey))
        let blob = try encryptedBlob(size: plain.count, wrappedKey: wrappedFileKey)
        let database = directory.appendingPathComponent(BackupFolder.manifestDatabaseName)
        let scratch = root.appendingPathComponent("scratch-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
        let plainDatabase = scratch.appendingPathComponent(BackupFolder.manifestDatabaseName)
        try writeManifestDatabase(at: plainDatabase, blob: blob)
        if writeAheadLog {
            try makeWriteAheadLog(at: plainDatabase)
        }
        var databaseBytes = try Data(contentsOf: plainDatabase)
        if databaseBytes.count % 16 != 0 {
            databaseBytes += Data(repeating: 0, count: 16 - databaseBytes.count % 16)
        }
        try BackupCrypto.encrypt(databaseBytes, key: manifestKey).write(to: database)
        try FileManager.default.removeItem(at: scratch)

        var manifest = try manifestDictionary(udid: udid, encrypted: true)
        manifest["BackupKeyBag"] = try keybag(password: password, classKeys: classKeys)
        manifest["ManifestKey"] = littleEndian(UInt32(manifestClass))
            + (try wrapKey(classKeys[manifestClass]!, manifestKey))
        try PropertyListSerialization
            .data(fromPropertyList: manifest, format: .binary, options: 0)
            .write(to: directory.appendingPathComponent(BackupFolder.manifestPlistName))
        return directory
    }

    // Pieces

    static func manifestDictionary(udid: String, encrypted: Bool) throws -> [String: Any] {
        [
            "IsEncrypted": encrypted,
            "Version": "10.0",
            "Date": Date(timeIntervalSince1970: 1_789_000_000),
            "Lockdown": [
                "ProductVersion": "26.6.1",
                "ProductType": "iPhone17,3",
                "DeviceName": "Test iPhone",
                "UniqueDeviceID": udid,
            ],
        ]
    }

    static func manifestPlist(udid: String, encrypted: Bool) throws -> Data {
        try PropertyListSerialization.data(
            fromPropertyList: try manifestDictionary(udid: udid, encrypted: encrypted),
            format: .binary,
            options: 0
        )
    }

    /// The MBFile archive of a file in a plain backup, with the size filled in.
    static func plainBlob(size: Int) throws -> Data {
        guard let blob = Data(base64Encoded: plainBlobBase64) else { throw FixtureError.blob }
        return try MBFileBlob.writeSize(blob, size: size)
    }

    /// The MBFile archive of a file in an encrypted backup: the size, and the
    /// wrapped key in its NSMutableData object.
    static func encryptedBlob(size: Int, wrappedKey: Data) throws -> Data {
        guard let blob = Data(base64Encoded: encryptedBlobBase64) else { throw FixtureError.blob }
        let sized = try MBFileBlob.writeSize(blob, size: size)
        guard
            var archive = try PropertyListSerialization.propertyList(from: sized, options: [], format: nil)
                as? [String: Any],
            var objects = archive["$objects"] as? [Any]
        else {
            throw FixtureError.blob
        }
        for index in objects.indices {
            guard var object = objects[index] as? [String: Any], object["NS.data"] != nil else { continue }
            object["NS.data"] = wrappedKey
            objects[index] = object
            archive["$objects"] = objects
            return try PropertyListSerialization.data(fromPropertyList: archive, format: .binary, options: 0)
        }
        throw FixtureError.blob
    }

    /// A keybag in the shape iOS writes: a header, then one record per class key.
    static func keybag(password: String, classKeys: [Int: Data]) throws -> Data {
        let salt = Data(repeating: 0x53, count: 20)
        let deviceSalt = Data(repeating: 0x44, count: 20)
        var blob = Data()
        blob += record("VERS", UInt32(4))
        blob += record("TYPE", UInt32(1))
        blob += record("UUID", Data(repeating: 0x55, count: 16))
        blob += record("HMCK", Data(repeating: 0x48, count: 40))
        blob += record("WRAP", UInt32(0))
        blob += record("SALT", salt)
        blob += record("ITER", UInt32(rounds))
        blob += record("DPWT", UInt32(1))
        blob += record("DPIC", UInt32(rounds))
        blob += record("DPSL", deviceSalt)

        let key = try passwordKey(password: password, salt: salt, deviceSalt: deviceSalt)
        for protectionClass in classKeys.keys.sorted() {
            blob += record("UUID", Data(repeating: UInt8(protectionClass), count: 16))
            blob += record("CLAS", UInt32(protectionClass))
            blob += record("WRAP", UInt32(Keybag.wrapPasscode))
            blob += record("WPKY", try wrapKey(key, classKeys[protectionClass]!))
            blob += record("KTYP", UInt32(0))
        }
        return blob
    }

    static func passwordKey(password: String, salt: Data, deviceSalt: Data) throws -> Data {
        let first = try BackupCrypto.derivedKey(
            password: Data(password.utf8),
            salt: deviceSalt,
            rounds: rounds,
            hash: CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256)
        )
        return try BackupCrypto.derivedKey(
            password: first,
            salt: salt,
            rounds: rounds,
            hash: CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1)
        )
    }

    /// The other half of RFC 3394, so the fixture can build what the keybag unwraps.
    static func wrapKey(_ wrappingKey: Data, _ plain: Data) throws -> Data {
        let algorithm = CCWrappingAlgorithm(kCCWRAPAES)
        var wrapped = [UInt8](repeating: 0, count: CCSymmetricWrappedSize(algorithm, plain.count))
        var wrappedLength = wrapped.count
        let iv = [UInt8](BackupCrypto.keyWrapIV)
        let status = CCSymmetricKeyWrap(
            algorithm,
            iv,
            iv.count,
            [UInt8](wrappingKey),
            wrappingKey.count,
            [UInt8](plain),
            plain.count,
            &wrapped,
            &wrappedLength
        )
        guard Int(status) == kCCSuccess else { throw FixtureError.crypto(status) }
        return Data(wrapped.prefix(wrappedLength))
    }

    static func record(_ tag: String, _ value: Data) -> Data {
        var record = Data(tag.utf8)
        record += bigEndian(UInt32(value.count))
        record += value
        return record
    }

    static func record(_ tag: String, _ value: UInt32) -> Data {
        record(tag, bigEndian(value))
    }

    static func bigEndian(_ value: UInt32) -> Data {
        withUnsafeBytes(of: value.bigEndian) { Data($0) }
    }

    static func littleEndian(_ value: UInt32) -> Data {
        withUnsafeBytes(of: value.littleEndian) { Data($0) }
    }

    // sqlite

    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    /// A real sqlite file with the Files table a backup carries, and one row in it.
    static func writeManifestDatabase(at url: URL, blob: Data) throws {
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, nil) == SQLITE_OK else {
            sqlite3_close(handle)
            throw FixtureError.database("open")
        }
        defer { sqlite3_close(handle) }
        let schema = """
            CREATE TABLE Files
            (fileID TEXT PRIMARY KEY, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB)
            """
        guard sqlite3_exec(handle, schema, nil, nil, nil) == SQLITE_OK else {
            throw FixtureError.database("create")
        }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "INSERT INTO Files VALUES (?, ?, ?, ?, ?)", -1, &statement, nil) == SQLITE_OK
        else {
            throw FixtureError.database("prepare")
        }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, fileID, -1, transient)
        sqlite3_bind_text(statement, 2, BackupFolder.supervisionDomain, -1, transient)
        sqlite3_bind_text(statement, 3, BackupFolder.supervisionRelativePath, -1, transient)
        sqlite3_bind_int(statement, 4, 1)
        _ = blob.withUnsafeBytes { bytes in
            sqlite3_bind_blob(statement, 5, bytes.baseAddress, Int32(blob.count), transient)
        }
        guard sqlite3_step(statement) == SQLITE_DONE else { throw FixtureError.database("insert") }
    }

    /// Put a database into WAL mode and take the side files away, which is the
    /// shape `idevicebackup2` leaves Manifest.db in. sqlite closes the WAL out
    /// on the last connection, so the removals are only there for the case
    /// where it kept them.
    static func makeWriteAheadLog(at url: URL) throws {
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_READWRITE, nil) == SQLITE_OK else {
            sqlite3_close(handle)
            throw FixtureError.database("open")
        }
        let status = sqlite3_exec(handle, "PRAGMA journal_mode=WAL", nil, nil, nil)
        sqlite3_close(handle)
        guard status == SQLITE_OK else { throw FixtureError.database("wal") }
        for suffix in ["-wal", "-shm"] {
            try? FileManager.default.removeItem(at: URL(fileURLWithPath: url.path + suffix))
        }
    }

    /// The journal mode as the header records it, without opening the file.
    /// Byte 18 is the write version and byte 19 the read version: 2 in WAL
    /// mode, 1 with a rollback journal.
    static func journalModeByte(at url: URL) throws -> UInt8 {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        try handle.seek(toOffset: 18)
        guard let header = try handle.read(upToCount: 1), let byte = header.first else {
            throw FixtureError.database("header")
        }
        return byte
    }

    // The two archives below were written by the Python plistlib, so they carry
    // real NSKeyedArchiver references. Only the size and the wrapped key are
    // filled in at run time.

    private static let plainBlobBase64 =
        "YnBsaXN0MDDUAQIDBAUGGh1ZJGFyY2hpdmVyWCRvYmplY3RzVCR0b3BYJHZlcnNpb25fEA9OU0tl" +
        "eWVkQXJjaGl2ZXKkBwgTGVUkbnVsbNUJCgsMDQ4PEBESViRjbGFzc1VGbGFnc1RNb2RlXFJlbGF0" +
        "aXZlUGF0aFRTaXplgAIQBBGBpIADEADSFBUWF1gkY2xhc3Nlc1okY2xhc3NuYW1lohcYVk1CRmls" +
        "ZVhOU09iamVjdF8QPUxpYnJhcnkvQ29uZmlndXJhdGlvblByb2ZpbGVzL0Nsb3VkQ29uZmlndXJh" +
        "dGlvbkRldGFpbHMucGxpc3TRGxxUcm9vdIABEgABhqAACAARABsAJAApADIARABJAE8AWgBhAGcA" +
        "bAB5AH4AgACCAIUAhwCJAI4AlwCiAKUArAC1APUA+AD9AP8AAAAAAAACAQAAAAAAAAAeAAAAAAAA" +
        "AAAAAAAAAAABBA=="

    private static let encryptedBlobBase64 =
        "YnBsaXN0MDDUAQIDBAUGJilZJGFyY2hpdmVyWCRvYmplY3RzVCR0b3BYJHZlcnNpb25fEA9OU0tl" +
        "eWVkQXJjaGl2ZXKmBwgXHR4iVSRudWxs1wkKCwwNDg8QERITFBUWViRjbGFzc11FbmNyeXB0aW9u" +
        "S2V5VUZsYWdzVE1vZGVfEA9Qcm90ZWN0aW9uQ2xhc3NcUmVsYXRpdmVQYXRoVFNpemWAAoAEEAQR" +
        "gaQQA4ADEADSGBkaG1gkY2xhc3Nlc1okY2xhc3NuYW1lohscVk1CRmlsZVhOU09iamVjdF8QPUxp" +
        "YnJhcnkvQ29uZmlndXJhdGlvblByb2ZpbGVzL0Nsb3VkQ29uZmlndXJhdGlvbkRldGFpbHMucGxp" +
        "c3TSCR8gIVdOUy5kYXRhgAVPECwDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
        "AAAAAAAAANIYGSMkoyQlHF1OU011dGFibGVEYXRhVk5TRGF0YdEnKFRyb290gAESAAGGoAAIABEA" +
        "GwAkACkAMgBEAEsAUQBgAGcAdQB7AIAAkgCfAKQApgCoAKoArQCvALEAswC4AMEAzADPANYA3wEf" +
        "ASQBLAEuAV0BYgFmAXQBewF+AYMBhQAAAAAAAAIBAAAAAAAAACoAAAAAAAAAAAAAAAAAAAGK"
}
