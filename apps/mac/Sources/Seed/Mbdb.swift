import CryptoKit
import Foundation

/// One record of `Manifest.mbdb`: a folder or a file in the backup, with the
/// owner, the mode and the dates the iPhone gives it on a restore.
///
/// Portions adapted from Nugget (https://github.com/leminlimez/Nugget), AGPL-3.0:
/// the fields and their defaults. See THIRD_PARTY_NOTICES.md.
struct MbdbRecord: Equatable {
    /// A name and a value that ride along with a record. Nothing this app
    /// writes carries one.
    struct Property: Equatable {
        let name: String
        let value: String
    }

    /// The bits of `mode` that say what a record is.
    static let directoryType: UInt16 = 0o040000
    static let regularFileType: UInt16 = 0o100000
    /// rwxr-xr-x, which Nugget gives everything it restores.
    static let defaultPermissions: UInt16 = 0o755
    /// Nugget writes this into every record it makes.
    static let defaultFlags: UInt8 = 4

    var domain: String
    var filename: String
    /// Where a symbolic link points. Empty for a folder and for a file.
    var link = ""
    /// The SHA-1 of the contents of a file. Empty for a folder.
    var hash = Data()
    /// The wrapped key of an encrypted file. Empty here, because nothing is.
    var key = Data()
    var mode: UInt16
    var inode: UInt64
    var userID: UInt32
    var groupID: UInt32
    var mtime: UInt32
    var atime: UInt32
    var ctime: UInt32
    var size: UInt64
    var flags = defaultFlags
    var properties: [Property] = []

    /// A folder. The inode is zero, because a restore does not respect one
    /// for a folder.
    static func directory(
        domain: String,
        path: String,
        owner: UInt32,
        group: UInt32,
        permissions: UInt16 = defaultPermissions,
        date: Date
    ) -> MbdbRecord {
        let stamp = seconds(date)
        return MbdbRecord(
            domain: domain,
            filename: path,
            mode: permissions | directoryType,
            inode: 0,
            userID: owner,
            groupID: group,
            mtime: stamp,
            atime: stamp,
            ctime: stamp,
            size: 0
        )
    }

    /// A regular file, with the SHA-1 and the length of its contents.
    static func file(
        domain: String,
        path: String,
        contents: Data,
        owner: UInt32,
        group: UInt32,
        permissions: UInt16 = defaultPermissions,
        inode: UInt64,
        date: Date
    ) -> MbdbRecord {
        let stamp = seconds(date)
        return MbdbRecord(
            domain: domain,
            filename: path,
            hash: Data(Insecure.SHA1.hash(data: contents)),
            mode: permissions | regularFileType,
            inode: inode,
            userID: owner,
            groupID: group,
            mtime: stamp,
            atime: stamp,
            ctime: stamp,
            size: UInt64(contents.count)
        )
    }

    /// A date as the four bytes a record has for it: whole seconds since 1970.
    private static func seconds(_ date: Date) -> UInt32 {
        UInt32(clamping: Int64(date.timeIntervalSince1970))
    }
}

/// `Manifest.mbdb`, the list of files in a backup as backups were laid out
/// before Manifest.db. Nugget writes this one for the small backups it
/// restores, and the seed method does the same.
///
/// The layout is ported from Nugget's `src/restore/mbdb.py` and matches it byte
/// for byte: six bytes of header, then one record after another. Every number
/// is big endian. A string or a blob is its length in two bytes and then its
/// bytes, and an empty one is a length of zero with nothing after it. A reader
/// also takes a length of 0xFFFF for an empty field. Nugget never writes that,
/// so neither does this.
///
/// Portions adapted from Nugget (https://github.com/leminlimez/Nugget), AGPL-3.0.
/// Nugget has this file from TrollRestore
/// (https://github.com/JJTech0130/TrollRestore), MIT, Copyright 2024 James
/// Gill (JJTech0130). See THIRD_PARTY_NOTICES.md.
enum Mbdb {
    static let fileName = "Manifest.mbdb"
    /// `mbdb`, then the version, 5.0.
    static let header = Data("mbdb".utf8) + Data([0x05, 0x00])

    /// The bytes of the file: the header, then every record in the order given.
    static func data(records: [MbdbRecord]) throws -> Data {
        var data = header
        for record in records {
            try append(record, to: &data)
        }
        return data
    }

    private static func append(_ record: MbdbRecord, to data: inout Data) throws {
        try append(Data(record.domain.utf8), named: "domain", to: &data)
        try append(Data(record.filename.utf8), named: "filename", to: &data)
        try append(Data(record.link.utf8), named: "link", to: &data)
        try append(record.hash, named: "hash", to: &data)
        try append(record.key, named: "key", to: &data)
        data += bigEndian(record.mode)
        data += bigEndian(record.inode)
        data += bigEndian(record.userID)
        data += bigEndian(record.groupID)
        data += bigEndian(record.mtime)
        data += bigEndian(record.atime)
        data += bigEndian(record.ctime)
        data += bigEndian(record.size)
        data += bigEndian(record.flags)
        guard let count = UInt8(exactly: record.properties.count) else {
            throw SeedError.fieldTooLong(field: "properties", length: record.properties.count)
        }
        data += bigEndian(count)
        for property in record.properties {
            try append(Data(property.name.utf8), named: "property name", to: &data)
            try append(Data(property.value.utf8), named: "property value", to: &data)
        }
    }

    /// A length in two bytes, then the bytes. Nugget counts the characters of
    /// a string where this counts its bytes, which is the same number for
    /// every name a backup uses and the right one for any other.
    private static func append(_ field: Data, named name: String, to data: inout Data) throws {
        // 0xFFFF is how a reader is told a field is absent, so the longest
        // field is one byte short of it.
        guard let length = UInt16(exactly: field.count), length != .max else {
            throw SeedError.fieldTooLong(field: name, length: field.count)
        }
        data += bigEndian(length)
        data += field
    }

    private static func bigEndian<Value: FixedWidthInteger>(_ value: Value) -> Data {
        withUnsafeBytes(of: value.bigEndian) { Data($0) }
    }
}
