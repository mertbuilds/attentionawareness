import CImobileDevice

/// Thin read-only wrapper over libimobiledevice, here only to prove the C
/// module and the vendored dylibs are wired up. The real device layer lands in
/// `Device/` in the next step.
enum DeviceProbe {
    static func connectedDeviceCount() -> Int {
        var udids: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?
        var count: Int32 = 0
        guard idevice_get_device_list(&udids, &count) == IDEVICE_E_SUCCESS else {
            return 0
        }
        defer { idevice_device_list_free(udids) }
        return Int(count)
    }
}
