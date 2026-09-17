import CommonCrypto
import Foundation

/// The class keys of a backup, read from the `BackupKeyBag` in Manifest.plist.
///
/// The blob is a run of tag, length and value records. Every UUID after the
/// first one starts a class key, so the first one closes the header.
struct Keybag {
    /// One class key: the protection class, how it is wrapped, the wrapped
    /// bytes, and, after `unlock`, the key itself.
    struct ClassKey {
        var protectionClass: Int
        var wrap: Int
        var wrappedKey: Data?
        var key: Data?
    }

    /// `WRAP` says how a class key is wrapped. This bit means the backup password.
    static let wrapPasscode = 2
    /// The records that belong to a class key. Anything else inside one is skipped.
    static let classKeyTags: Set<String> = ["CLAS", "WRAP", "WPKY", "KTYP", "PBKY"]

    private(set) var attributes: [String: Data] = [:]
    private(set) var classKeys: [Int: ClassKey] = [:]

    init(blob: Data) {
        read(blob)
    }

    /// A class key while it is being read. The Python holds one dictionary and
    /// keeps writing into it after it is registered; a struct is copied, so the
    /// finished record goes into `classKeys` when the next UUID closes it.
    private struct PendingClassKey {
        var protectionClass: Int?
        var wrap = 0
        var wrappedKey: Data?
    }

    private mutating func read(_ blob: Data) {
        let bytes = [UInt8](blob)
        var current: PendingClassKey?
        var offset = 0
        while offset + 8 <= bytes.count {
            let tag = String(decoding: bytes[offset ..< offset + 4], as: UTF8.self)
            let length = Int(Bytes.integer(bigEndian: bytes[offset + 4 ..< offset + 8]))
            let end = min(offset + 8 + length, bytes.count)
            let value = Data(bytes[min(offset + 8, end) ..< end])
            offset += 8 + length
            if tag == "UUID", attributes["UUID"] == nil {
                attributes[tag] = value
            } else if tag == "UUID" {
                close(&current)
                current = PendingClassKey()
            } else if current == nil {
                attributes[tag] = value
            } else if Self.classKeyTags.contains(tag) {
                switch tag {
                case "CLAS":
                    current?.protectionClass = Int(Bytes.integer(bigEndian: [UInt8](value)))
                case "WRAP":
                    current?.wrap = Int(Bytes.integer(bigEndian: [UInt8](value)))
                case "WPKY":
                    current?.wrappedKey = value
                default:
                    break
                }
            }
        }
        close(&current)
    }

    private mutating func close(_ pending: inout PendingClassKey?) {
        defer { pending = nil }
        guard let pending, let protectionClass = pending.protectionClass else { return }
        classKeys[protectionClass] = ClassKey(
            protectionClass: protectionClass,
            wrap: pending.wrap,
            wrappedKey: pending.wrappedKey
        )
    }

    /// Turn the password into the class keys. This is the slow step: the real
    /// keybag runs about ten million rounds and takes a few seconds.
    mutating func unlock(password: String) throws {
        guard
            let deviceSalt = attributes["DPSL"], !deviceSalt.isEmpty,
            let salt = attributes["SALT"], !salt.isEmpty,
            let deviceRounds = number("DPIC"), deviceRounds > 0,
            let rounds = number("ITER"), rounds > 0
        else {
            throw PatchError.oldKeybag
        }
        let passwordBytes = Data(password.utf8)
        // An empty password unlocks no backup, and CommonCrypto refuses an
        // empty buffer here, so it is answered as the wrong password.
        guard !passwordBytes.isEmpty else { throw PatchError.wrongPassword }

        let first = try BackupCrypto.derivedKey(
            password: passwordBytes,
            salt: deviceSalt,
            rounds: deviceRounds,
            hash: CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256)
        )
        let passwordKey = try BackupCrypto.derivedKey(
            password: first,
            salt: salt,
            rounds: rounds,
            hash: CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1)
        )
        for (protectionClass, entry) in classKeys {
            guard let wrapped = entry.wrappedKey, entry.wrap & Self.wrapPasscode != 0 else { continue }
            guard let key = BackupCrypto.unwrapKey(wrappingKey: passwordKey, wrapped: wrapped) else {
                throw PatchError.wrongPassword
            }
            classKeys[protectionClass]?.key = key
        }
    }

    /// The key of one file, unwrapped with the class key it was wrapped with.
    func unwrapForClass(_ protectionClass: Int, wrapped: Data) throws -> Data {
        guard let classKey = classKeys[protectionClass]?.key else {
            throw PatchError.noClassKey(protectionClass)
        }
        guard let key = BackupCrypto.unwrapKey(wrappingKey: classKey, wrapped: wrapped) else {
            throw PatchError.wrongPassword
        }
        return key
    }

    /// A header record that holds one big endian number, such as `ITER`.
    func number(_ tag: String) -> Int? {
        guard let value = attributes[tag], value.count == 4 else { return nil }
        return Int(Bytes.integer(bigEndian: [UInt8](value)))
    }
}

/// The keys of one encrypted backup. They stay in memory and reach no file.
struct BackupKeys {
    var keybag: Keybag
    /// The key of Manifest.db.
    let manifest: Data
    /// The key of the one file this tool patches, once the row has been read.
    var file: Data?

    /// Read the keybag out of Manifest.plist and unwrap the key of Manifest.db.
    static func unlock(manifest: [String: Any], password: String) throws -> BackupKeys {
        guard
            let blob = manifest["BackupKeyBag"] as? Data, !blob.isEmpty,
            let manifestKey = manifest["ManifestKey"] as? Data, manifestKey.count > 4
        else {
            throw PatchError.noKeybag
        }
        var keybag = Keybag(blob: blob)
        try keybag.unlock(password: password)
        // Four bytes of protection class, then the wrapped key.
        let protectionClass = Int(Bytes.integer(littleEndian: [UInt8](manifestKey.prefix(4))))
        return BackupKeys(
            keybag: keybag,
            manifest: try keybag.unwrapForClass(protectionClass, wrapped: Data(manifestKey.dropFirst(4)))
        )
    }
}

/// The two byte orders this layer reads. The keybag is big endian, the
/// protection class in front of a wrapped key is little endian.
enum Bytes {
    static func integer(bigEndian bytes: some Sequence<UInt8>) -> UInt32 {
        bytes.reduce(UInt32(0)) { $0 << 8 | UInt32($1) }
    }

    static func integer(littleEndian bytes: some Sequence<UInt8>) -> UInt32 {
        bytes.reversed().reduce(UInt32(0)) { $0 << 8 | UInt32($1) }
    }
}
