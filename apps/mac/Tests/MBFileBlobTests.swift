import XCTest

/// The `MBFile` bookkeeping: the recorded size in, the recorded size out, and
/// the wrapped key of an encrypted file.
final class MBFileBlobTests: XCTestCase {
    func testTheRecordedSizeIsReadBack() throws {
        XCTAssertEqual(try MBFileBlob.readSize(try BackupFixture.plainBlob(size: 209)), 209)
    }

    func testWritingTheSizeLeavesTheRestOfTheArchiveAlone() throws {
        let blob = try BackupFixture.plainBlob(size: 209)
        let rewritten = try MBFileBlob.writeSize(blob, size: 512)
        XCTAssertEqual(try MBFileBlob.readSize(rewritten), 512)

        let before = try Self.objects(in: blob)
        let after = try Self.objects(in: rewritten)
        XCTAssertEqual(after.count, before.count)
        // The object table still holds the class record and the path, and the
        // references into it are still references.
        XCTAssertEqual(after.compactMap { $0 as? String }, before.compactMap { $0 as? String })
        let file = try XCTUnwrap(after.compactMap { $0 as? [String: Any] }.first { $0["Size"] != nil })
        XCTAssertNotNil(file["$class"])
        XCTAssertNotNil(file["RelativePath"])
        XCTAssertEqual((file["Mode"] as? NSNumber)?.intValue, 33188)
    }

    func testABlobWithNoSizeIsRefused() {
        let blob = try! PropertyListSerialization.data(
            fromPropertyList: ["$objects": ["$null"]],
            format: .binary,
            options: 0
        )
        XCTAssertThrowsError(try MBFileBlob.readSize(blob)) { error in
            guard case PatchError.noRecordedSize = error else {
                return XCTFail("expected a missing size, got \(error)")
            }
        }
    }

    func testTheWrappedFileKeyIsReadWithItsProtectionClass() throws {
        let wrapped = Data(repeating: 0x77, count: 40)
        let blob = try BackupFixture.encryptedBlob(
            size: 209,
            wrappedKey: BackupFixture.littleEndian(UInt32(BackupFixture.fileClass)) + wrapped
        )

        let key = try MBFileBlob.readFileKey(blob)
        XCTAssertEqual(key.protectionClass, BackupFixture.fileClass)
        XCTAssertEqual(key.wrappedKey, wrapped)
        XCTAssertEqual(try MBFileBlob.readSize(blob), 209)
    }

    func testAPlainBlobHoldsNoFileKey() throws {
        XCTAssertThrowsError(try MBFileBlob.readFileKey(try BackupFixture.plainBlob(size: 209))) { error in
            guard case PatchError.noEncryptionKey = error else {
                return XCTFail("expected a missing encryption key, got \(error)")
            }
        }
    }

    private static func objects(in blob: Data) throws -> [Any] {
        let archive = try PropertyListSerialization.propertyList(from: blob, options: [], format: nil)
        return (archive as? [String: Any])?["$objects"] as? [Any] ?? []
    }
}
