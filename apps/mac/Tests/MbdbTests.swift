import Foundation
import Testing

/// `Manifest.mbdb` byte for byte.
///
/// The expected bytes are worked out by hand from `to_bytes` in Nugget's
/// `src/restore/mbdb.py`, one field at a time, and none of them comes out of
/// the writer under test.
///
/// Portions adapted from Nugget (https://github.com/leminlimez/Nugget), AGPL-3.0.
struct MbdbTests {
    /// 1,789,000,000 seconds since 1970, which is 0x6aa1f940.
    private static let date = Date(timeIntervalSince1970: 1_789_000_000)

    @Test func aFolderAndAFileAreWrittenByteForByte() throws {
        let records = [
            MbdbRecord.directory(domain: "HomeDomain", path: "Library", owner: 501, group: 501, date: Self.date),
            MbdbRecord.file(
                domain: "HomeDomain",
                path: "Library/a.txt",
                contents: Data("abc".utf8),
                owner: 501,
                group: 501,
                inode: 0x0102_0304_0506_0708,
                date: Self.date
            ),
        ]

        let expected = Self.bytes(
            "6d626462", "0500", // "mbdb", version 5.0

            "000a", "486f6d65446f6d61696e", // domain, "HomeDomain"
            "0007", "4c696272617279", // filename, "Library"
            "0000", // link, empty
            "0000", // hash, empty for a folder
            "0000", // key, empty
            "41ed", // mode, 0o040755
            "0000000000000000", // inode, zero for a folder
            "000001f5", "000001f5", // owner and group, 501
            "6aa1f940", "6aa1f940", "6aa1f940", // mtime, atime, ctime
            "0000000000000000", // size
            "04", // flags
            "00", // no properties

            "000a", "486f6d65446f6d61696e", // domain, "HomeDomain"
            "000d", "4c6962726172792f612e747874", // filename, "Library/a.txt"
            "0000", // link, empty
            "0014", "a9993e364706816aba3e25717850c26c9cd0d89d", // hash, the SHA-1 of "abc"
            "0000", // key, empty
            "81ed", // mode, 0o100755
            "0102030405060708", // inode
            "000001f5", "000001f5", // owner and group, 501
            "6aa1f940", "6aa1f940", "6aa1f940", // mtime, atime, ctime
            "0000000000000003", // size
            "04", // flags
            "00" // no properties
        )
        #expect(try Mbdb.data(records: records) == expected)
    }

    @Test func aLinkAKeyAndAPropertyAreWrittenByteForByte() throws {
        let record = MbdbRecord(
            domain: "D",
            filename: "f",
            link: "t",
            key: Data([0x01, 0x02]),
            mode: 0o120755,
            inode: 1,
            userID: 0,
            groupID: 0,
            mtime: 1,
            atime: 2,
            ctime: 3,
            size: 0,
            properties: [MbdbRecord.Property(name: "n", value: "v")]
        )

        let expected = Self.bytes(
            "6d626462", "0500", // "mbdb", version 5.0
            "0001", "44", // domain, "D"
            "0001", "66", // filename, "f"
            "0001", "74", // link, "t"
            "0000", // hash, empty
            "0002", "0102", // key
            "a1ed", // mode, 0o120755
            "0000000000000001", // inode
            "00000000", "00000000", // owner and group
            "00000001", "00000002", "00000003", // mtime, atime, ctime
            "0000000000000000", // size
            "04", // flags
            "01", // one property
            "0001", "6e", "0001", "76" // "n", "v"
        )
        #expect(try Mbdb.data(records: [record]) == expected)
    }

    @Test func aFileWithNoRecordsIsTheHeaderAlone() throws {
        #expect(try Mbdb.data(records: []) == Self.bytes("6d626462", "0500"))
    }

    @Test func aFieldTheLengthCannotRecordIsRefused() throws {
        // Two bytes hold the length, and 0xFFFF means absent to a reader, so
        // 65,534 bytes is the longest name there is. The header is 6 bytes
        // and the rest of this record 51.
        let longest = String(repeating: "a", count: 0xFFFE)
        let fits = MbdbRecord.directory(domain: "D", path: longest, owner: 0, group: 0, date: Self.date)
        #expect(try Mbdb.data(records: [fits]).count == 6 + 0xFFFE + 51)

        let tooLong = MbdbRecord.directory(domain: "D", path: longest + "a", owner: 0, group: 0, date: Self.date)
        #expect(throws: SeedError.fieldTooLong(field: "filename", length: 0xFFFF)) {
            try Mbdb.data(records: [tooLong])
        }
    }

    /// Hex, a field at a time, into the bytes it spells.
    private static func bytes(_ fields: String...) -> Data {
        var data = Data()
        for field in fields {
            var rest = Substring(field)
            while let byte = UInt8(rest.prefix(2), radix: 16) {
                data.append(byte)
                rest = rest.dropFirst(2)
            }
        }
        return data
    }
}
