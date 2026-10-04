import Foundation

/// Every problem the seed layer reports before anything reaches an iPhone.
enum SeedError: LocalizedError, Equatable {
    /// A field of a Manifest.mbdb record is longer than the format can record.
    /// A string or a blob has two bytes for its length, the properties of a
    /// record have one byte for their count.
    case fieldTooLong(field: String, length: Int)
    /// The UDID names something other than one folder directly inside the root.
    case notAFolderName(String)
    /// The folder the seed backup goes in is already there. Nothing is written
    /// into a folder this layer did not make, because the full copy of the
    /// same iPhone is named the same way.
    case folderInTheWay(URL)

    var errorDescription: String? {
        switch self {
        case .fieldTooLong(let field, let length):
            return "A Manifest.mbdb record has a \(field) of length \(length), more than the file can record."
        case .notAFolderName(let udid):
            return "The identifier \(udid) can't name a backup folder. Nothing was written."
        case .folderInTheWay(let url):
            return "There is already a folder at \(url.path). Nothing was written."
        }
    }
}
