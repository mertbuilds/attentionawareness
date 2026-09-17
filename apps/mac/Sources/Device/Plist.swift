import CImobileDevice
import Foundation

/// Small conversions between libplist nodes and Swift values. Every reader
/// checks the node type first, so a missing or unexpected value reads as nil
/// instead of returning garbage. None of these take ownership of the node: the
/// caller still has to free what it allocated.
enum Plist {
    /// Returns the text of a string node.
    static func string(_ node: plist_t?) -> String? {
        guard let node, plist_get_node_type(node) == PLIST_STRING else { return nil }
        var length: UInt64 = 0
        guard let pointer = plist_get_string_ptr(node, &length) else { return nil }
        return String(cString: pointer)
    }

    /// Returns the value of a boolean node.
    static func bool(_ node: plist_t?) -> Bool? {
        guard let node, plist_get_node_type(node) == PLIST_BOOLEAN else { return nil }
        var value: UInt8 = 0
        plist_get_bool_val(node, &value)
        return value != 0
    }

    /// Returns the value of an integer node as an unsigned number. The disk
    /// usage values the wizard reads are all sizes in bytes.
    static func integer(_ node: plist_t?) -> UInt64? {
        guard let node, plist_get_node_type(node) == PLIST_INT else { return nil }
        var value: UInt64 = 0
        plist_get_uint_val(node, &value)
        return value
    }

    /// Returns a child of a dictionary node, or nil when the node is not a
    /// dictionary or the key is absent.
    static func item(_ node: plist_t?, _ key: String) -> plist_t? {
        guard let node, plist_get_node_type(node) == PLIST_DICT else { return nil }
        return plist_dict_get_item(node, key)
    }

    /// Renders a node as an XML property list. Used to show a whole answer from
    /// the phone without picking it apart key by key.
    static func xml(_ node: plist_t?) -> String? {
        guard let node else { return nil }
        var buffer: UnsafeMutablePointer<CChar>?
        var length: UInt32 = 0
        guard plist_to_xml(node, &buffer, &length) == PLIST_ERR_SUCCESS, let buffer else { return nil }
        defer { plist_mem_free(buffer) }
        return String(cString: buffer)
    }
}
