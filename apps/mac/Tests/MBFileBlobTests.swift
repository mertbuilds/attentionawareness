import Foundation
import Testing

/// The `MBFile` bookkeeping: the recorded size in, the recorded size out, and
/// the wrapped key of an encrypted file.
struct MBFileBlobTests {
    @Test func theRecordedSizeIsReadBack() throws {
        #expect(try MBFileBlob.readSize(try BackupFixture.plainBlob(size: 209)) == 209)
    }

    @Test func writingTheSizeLeavesTheRestOfTheArchiveAlone() throws {
        let blob = try BackupFixture.plainBlob(size: 209)
        let rewritten = try MBFileBlob.writeSize(blob, size: 512)
        #expect(try MBFileBlob.readSize(rewritten) == 512)

        let before = try Self.objects(in: blob)
        let after = try Self.objects(in: rewritten)
        #expect(after.count == before.count)
        // The object table still holds the class record and the path, and the
        // references into it are still references.
        #expect(after.compactMap { $0 as? String } == before.compactMap { $0 as? String })
        let file = try #require(after.compactMap { $0 as? [String: Any] }.first { $0["Size"] != nil })
        #expect(file["$class"] != nil)
        #expect(file["RelativePath"] != nil)
        #expect((file["Mode"] as? NSNumber)?.intValue == 33188)
    }

    @Test func aBlobWithNoSizeIsRefused() throws {
        let blob = try! PropertyListSerialization.data(
            fromPropertyList: ["$objects": ["$null"]],
            format: .binary,
            options: 0
        )
        let error = try #require(throws: PatchError.self) {
            try MBFileBlob.readSize(blob)
        }
        guard case .noRecordedSize = error else {
            Issue.record("expected a missing size, got \(error)")
            return
        }
    }

    @Test func theWrappedFileKeyIsReadWithItsProtectionClass() throws {
        let wrapped = Data(repeating: 0x77, count: 40)
        let blob = try BackupFixture.encryptedBlob(
            size: 209,
            wrappedKey: BackupFixture.littleEndian(UInt32(BackupFixture.fileClass)) + wrapped
        )

        let key = try MBFileBlob.readFileKey(blob)
        #expect(key.protectionClass == BackupFixture.fileClass)
        #expect(key.wrappedKey == wrapped)
        #expect(try MBFileBlob.readSize(blob) == 209)
    }

    @Test func aPlainBlobHoldsNoFileKey() throws {
        let error = try #require(throws: PatchError.self) {
            try MBFileBlob.readFileKey(try BackupFixture.plainBlob(size: 209))
        }
        guard case .noEncryptionKey = error else {
            Issue.record("expected a missing encryption key, got \(error)")
            return
        }
    }

    private static func objects(in blob: Data) throws -> [Any] {
        let archive = try PropertyListSerialization.propertyList(from: blob, options: [], format: nil)
        return (archive as? [String: Any])?["$objects"] as? [Any] ?? []
    }
}
