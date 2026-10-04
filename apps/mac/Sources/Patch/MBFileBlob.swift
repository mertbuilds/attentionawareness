import Foundation

/// The `MBFile` record that Manifest.db keeps in the `file` column of a Files
/// row. It is an NSKeyedArchiver plist: an object table plus references into
/// it. This tool reads two things out of it, the recorded size of the file and,
/// on an encrypted backup, the wrapped key of the file, and writes one thing
/// back, the new recorded size.
enum MBFileBlob {
    /// The file size that Manifest.db records for the supervision file.
    static func readSize(_ blob: Data) throws -> Int {
        for item in try objects(in: blob) {
            if let object = item as? [String: Any], let size = (object["Size"] as? NSNumber)?.intValue {
                return size
            }
        }
        throw PatchError.noRecordedSize
    }

    /// Return a new blob with the recorded file size replaced.
    static func writeSize(_ blob: Data, size: Int) throws -> Data {
        var archive = try archive(in: blob)
        var objects = archive["$objects"] as? [Any] ?? []
        for index in objects.indices {
            guard var object = objects[index] as? [String: Any], object["Size"] != nil else { continue }
            object["Size"] = size
            // The archive is a table of objects that reference each other by
            // index, so the changed object goes back where it came from.
            objects[index] = object
            archive["$objects"] = objects
            return try PropertyListSerialization.data(fromPropertyList: archive, format: .binary, options: 0)
        }
        throw PatchError.noRecordedSize
    }

    /// The protection class and the wrapped key of an encrypted file.
    static func readFileKey(_ blob: Data) throws -> (protectionClass: Int, wrappedKey: Data) {
        let objects = try objects(in: blob)
        for item in objects {
            guard let object = item as? [String: Any], let reference = object["EncryptionKey"] else { continue }
            let protectionClass = (object["ProtectionClass"] as? NSNumber)?.intValue ?? 0
            guard let data = keyData(reference, protectionClass: protectionClass, in: objects) else { continue }
            // The key repeats the protection class in its first four bytes.
            return (protectionClass, Data(data.dropFirst(4)))
        }
        throw PatchError.noEncryptionKey
    }

    /// Foundation reads an NSKeyedArchiver reference as an opaque
    /// CoreFoundation object and hands out no index, so the Python's hop from
    /// `EncryptionKey` into `$objects` cannot be made here. The archive of one
    /// file holds one wrapped key, and that key repeats its protection class in
    /// the first four bytes, which is enough to find it. A key stored inline,
    /// which the Python also accepts, is taken as it is.
    private static func keyData(_ reference: Any, protectionClass: Int, in objects: [Any]) -> Data? {
        if let data = reference as? Data { return data }
        if let holder = reference as? [String: Any], let data = holder["NS.data"] as? Data { return data }
        let candidates = objects.compactMap { ($0 as? [String: Any])?["NS.data"] as? Data }
        let match = candidates.first { candidate in
            candidate.count > 4 && Int(Bytes.integer(littleEndian: [UInt8](candidate.prefix(4)))) == protectionClass
        }
        return match ?? (candidates.count == 1 ? candidates[0] : nil)
    }

    private static func archive(in blob: Data) throws -> [String: Any] {
        guard
            let archive = try PropertyListSerialization.propertyList(
                from: blob,
                options: [],
                format: nil
            ) as? [String: Any]
        else {
            throw PatchError.noRecordedSize
        }
        return archive
    }

    private static func objects(in blob: Data) throws -> [Any] {
        try archive(in: blob)["$objects"] as? [Any] ?? []
    }
}
