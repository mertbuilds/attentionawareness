import Foundation

/// Every write in this layer lands in a temporary file beside the target and
/// then takes its place in one step, so a failure leaves the backup as it was.
/// `Data.write(to:options:.atomic)` already works this way; these are the same
/// promise for the files that are streamed or copied instead.
enum AtomicFile {
    static func temporaryURL(beside target: URL, prefix: String) -> URL {
        target
            .deletingLastPathComponent()
            .appendingPathComponent("\(prefix)-\(UUID().uuidString).tmp")
    }

    /// Put a file in place of another. The replaced file keeps its own
    /// permissions and dates, which is what a safe save does.
    static func replace(_ temporary: URL, onto target: URL) throws {
        if FileManager.default.fileExists(atPath: target.path) {
            _ = try FileManager.default.replaceItemAt(target, withItemAt: temporary)
        } else {
            try FileManager.default.moveItem(at: temporary, to: target)
        }
    }

    /// Copy a file over another one. `FileManager` refuses a destination that
    /// is already there, so the copy lands beside it first.
    static func copy(_ source: URL, onto target: URL) throws {
        let temporary = temporaryURL(beside: target, prefix: "copy")
        try FileManager.default.copyItem(at: source, to: temporary)
        do {
            try replace(temporary, onto: target)
        } catch {
            try? FileManager.default.removeItem(at: temporary)
            throw error
        }
    }
}
