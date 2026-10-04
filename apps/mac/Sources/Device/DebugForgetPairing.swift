#if DEBUG
import CImobileDevice
import Foundation

/// `--debug-forget-pairing` (Debug builds only) puts this Mac's pairing with
/// the iPhone on the cable into the state the fast method's restore leaves
/// it in, without erasing or restoring anything: it writes a new, unknown
/// HostID into the Mac's own pair record through usbmuxd. The iPhone then
/// answers InvalidHostID, as after the restore, and since macOS only pairs
/// when the iPhone is plugged in, only the app's own Pair can recover. The
/// iPhone itself is not touched. A replug lets macOS pair again.
enum DebugForgetPairing {
    static func runIfAsked() {
        guard CommandLine.arguments.contains("--debug-forget-pairing") else { return }
        guard let udids = ConnectedDevice.usbListing(), !udids.isEmpty else {
            report("debug-forget-pairing: no iPhone on the cable, nothing changed")
            return
        }
        for udid in udids {
            report("debug-forget-pairing: \(forget(udid))")
        }
    }

    private static func forget(_ udid: String) -> String {
        var device: idevice_t?
        guard idevice_new_with_options(&device, udid, IDEVICE_LOOKUP_USBMUX) == IDEVICE_E_SUCCESS, let device else {
            return "could not open the iPhone, nothing changed"
        }
        defer { idevice_free(device) }
        var handle: UInt32 = 0
        idevice_get_handle(device, &handle)

        var data: UnsafeMutablePointer<CChar>?
        var size: UInt32 = 0
        guard usbmuxd_read_pair_record(udid, &data, &size) == 0, let data else {
            return "this Mac has no pair record for the iPhone, nothing changed"
        }
        defer { free(data) }
        var record: plist_t?
        plist_from_memory(data, size, &record, nil)
        guard let record, plist_get_node_type(record) == PLIST_DICT else {
            return "the pair record did not read, nothing changed"
        }
        defer { plist_free(record) }
        plist_dict_set_item(record, "HostID", plist_new_string(UUID().uuidString))

        var bin: UnsafeMutablePointer<CChar>?
        var binSize: UInt32 = 0
        plist_to_bin(record, &bin, &binSize)
        guard let bin else { return "the pair record did not write, nothing changed" }
        defer { free(bin) }
        let saved = usbmuxd_save_pair_record_with_device_id(udid, handle, bin, binSize)
        return saved == 0
            ? "the Mac's pair record now carries a HostID the iPhone does not know"
            : "usbmuxd refused the record (\(saved)), nothing changed"
    }

    private static func report(_ line: String) {
        print(line)
        DeviceLog.logger.notice("\(line, privacy: .public)")
    }
}
#endif
