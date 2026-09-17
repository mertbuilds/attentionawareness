import CommonCrypto
import Foundation

/// The AES that an encrypted backup needs.
///
/// Finder keeps the keys of an encrypted backup in Manifest.plist. The backup
/// password unlocks the keybag there, the keybag unwraps the key of Manifest.db
/// and the key of every file, and each file is AES-256-CBC with a zero IV.
///
/// The Python tool carries its own AES, because the standard library holds
/// none, and it hands Manifest.db to the openssl binary, because that file can
/// be tens of megabytes. CommonCrypto does both jobs here: one small call for a
/// key or a small file, and a `CCCryptor` fed in chunks for Manifest.db. There
/// is no second copy of AES and no subprocess.
enum BackupCrypto {
    /// Every file in a backup is encrypted with this IV.
    static let zeroIV = Data(repeating: 0, count: 16)
    /// RFC 3394 writes this into the first block, so a wrong key shows up there.
    static let keyWrapIV = Data(repeating: 0xa6, count: 8)

    /// How much of Manifest.db is held in memory at a time.
    private static let chunkSize = 1 << 20

    // Keys

    /// One PBKDF2 pass. The keybag runs two: SHA-256 over the password, then
    /// SHA-1 over what came out of it.
    static func derivedKey(
        password: Data,
        salt: Data,
        rounds: Int,
        hash: CCPseudoRandomAlgorithm,
        length: Int = 32
    ) throws -> Data {
        var derived = [UInt8](repeating: 0, count: length)
        let status = withRawBytes(password) { passwordPointer, passwordLength in
            withRawBytes(salt) { saltPointer, saltLength in
                CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    passwordPointer.assumingMemoryBound(to: CChar.self),
                    passwordLength,
                    saltPointer.assumingMemoryBound(to: UInt8.self),
                    saltLength,
                    hash,
                    UInt32(rounds),
                    &derived,
                    length
                )
            }
        }
        guard Int(status) == kCCSuccess else { throw PatchError.cryptoFailed(status) }
        return Data(derived)
    }

    /// Undo an AES key wrap, RFC 3394. Return nil when the key is wrong.
    static func unwrapKey(wrappingKey: Data, wrapped: Data) -> Data? {
        guard wrapped.count >= 16, wrapped.count % 8 == 0 else { return nil }
        let algorithm = CCWrappingAlgorithm(kCCWRAPAES)
        var raw = [UInt8](repeating: 0, count: CCSymmetricUnwrappedSize(algorithm, wrapped.count))
        var rawLength = raw.count
        let status = withRawBytes(keyWrapIV) { ivPointer, ivLength in
            withRawBytes(wrappingKey) { keyPointer, keyLength in
                withRawBytes(wrapped) { wrappedPointer, wrappedLength in
                    CCSymmetricKeyUnwrap(
                        algorithm,
                        ivPointer.assumingMemoryBound(to: UInt8.self),
                        ivLength,
                        keyPointer.assumingMemoryBound(to: UInt8.self),
                        keyLength,
                        wrappedPointer.assumingMemoryBound(to: UInt8.self),
                        wrappedLength,
                        &raw,
                        &rawLength
                    )
                }
            }
        }
        // The wrap writes a fixed header, so a wrong key shows up here.
        guard Int(status) == kCCSuccess else { return nil }
        return Data(raw.prefix(rawLength))
    }

    // Files

    static func decrypt(_ data: Data, key: Data, iv: Data = zeroIV) throws -> Data {
        try crypt(operation: CCOperation(kCCDecrypt), data: data, key: key, iv: iv)
    }

    static func encrypt(_ data: Data, key: Data, iv: Data = zeroIV) throws -> Data {
        try crypt(operation: CCOperation(kCCEncrypt), data: data, key: key, iv: iv)
    }

    /// Decrypt a whole file without holding it in memory. Manifest.db can be
    /// tens of megabytes, which is why the Python tool calls openssl here.
    static func decryptFile(at source: URL, to target: URL, key: Data, iv: Data = zeroIV) throws {
        try cryptFile(operation: CCOperation(kCCDecrypt), from: source, to: target, key: key, iv: iv)
    }

    static func encryptFile(at source: URL, to target: URL, key: Data, iv: Data = zeroIV) throws {
        try cryptFile(operation: CCOperation(kCCEncrypt), from: source, to: target, key: key, iv: iv)
    }

    /// PKCS#7, the padding iOS writes at the end of an encrypted file.
    static func addPadding(_ data: Data) -> Data {
        let count = 16 - data.count % 16
        return data + Data(repeating: UInt8(count), count: count)
    }

    static func stripPadding(_ data: Data) -> Data {
        guard let count = data.last.map(Int.init), count >= 1, count <= 16, data.count >= count else {
            return data
        }
        guard data.suffix(count).allSatisfy({ $0 == UInt8(count) }) else { return data }
        return data.prefix(data.count - count)
    }

    // The calls into CommonCrypto

    private static func crypt(operation: CCOperation, data: Data, key: Data, iv: Data) throws -> Data {
        guard data.count % 16 == 0 else { throw PatchError.blockLengthNotAes }
        var output = [UInt8](repeating: 0, count: data.count)
        var moved = 0
        let status = withRawBytes(key) { keyPointer, keyLength in
            withRawBytes(iv) { ivPointer, _ in
                withRawBytes(data) { dataPointer, dataLength in
                    CCCrypt(
                        operation,
                        CCAlgorithm(kCCAlgorithmAES),
                        // No option bits: CBC, and the padding is ours to add.
                        0,
                        keyPointer,
                        keyLength,
                        ivPointer,
                        dataPointer,
                        dataLength,
                        &output,
                        output.count,
                        &moved
                    )
                }
            }
        }
        guard Int(status) == kCCSuccess else { throw PatchError.cryptoFailed(status) }
        return Data(output.prefix(moved))
    }

    private static func cryptFile(
        operation: CCOperation,
        from source: URL,
        to target: URL,
        key: Data,
        iv: Data
    ) throws {
        var cryptor: CCCryptorRef?
        let created = withRawBytes(key) { keyPointer, keyLength in
            withRawBytes(iv) { ivPointer, _ in
                CCCryptorCreate(
                    operation,
                    CCAlgorithm(kCCAlgorithmAES),
                    0,
                    keyPointer,
                    keyLength,
                    ivPointer,
                    &cryptor
                )
            }
        }
        guard Int(created) == kCCSuccess, let cryptor else { throw PatchError.cryptoFailed(created) }
        defer { CCCryptorRelease(cryptor) }

        guard FileManager.default.createFile(
            atPath: target.path,
            contents: nil,
            attributes: [.posixPermissions: 0o600]
        ) else {
            throw PatchError.noAccessToBackupFolder(target.deletingLastPathComponent())
        }
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        let output = try FileHandle(forWritingTo: target)
        defer { try? output.close() }

        var buffer = [UInt8](repeating: 0, count: CCCryptorGetOutputLength(cryptor, chunkSize, false))
        while let chunk = try input.read(upToCount: chunkSize), !chunk.isEmpty {
            var moved = 0
            let status = withRawBytes(chunk) { chunkPointer, chunkLength in
                CCCryptorUpdate(cryptor, chunkPointer, chunkLength, &buffer, buffer.count, &moved)
            }
            guard Int(status) == kCCSuccess else { throw PatchError.cryptoFailed(status) }
            try output.write(contentsOf: Data(buffer.prefix(moved)))
        }
        // Nothing is padded here, so the final call writes no bytes. It still
        // has to run, because it is what tells CommonCrypto the file ended.
        var moved = 0
        let finished = CCCryptorFinal(cryptor, &buffer, buffer.count, &moved)
        guard Int(finished) == kCCSuccess else { throw PatchError.cryptoFailed(finished) }
        if moved > 0 {
            try output.write(contentsOf: Data(buffer.prefix(moved)))
        }
    }

    /// CommonCrypto wants a real pointer, even for an empty buffer.
    private static func withRawBytes<T>(
        _ data: Data,
        _ body: (UnsafeRawPointer, Int) throws -> T
    ) rethrows -> T {
        let bytes = data.isEmpty ? [UInt8](repeating: 0, count: 1) : [UInt8](data)
        return try bytes.withUnsafeBytes { raw in
            try body(raw.baseAddress!, data.count)
        }
    }
}
