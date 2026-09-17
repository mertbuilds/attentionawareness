import Foundation

/// A hidden command line path for checking the device layer without opening the
/// window: `Attention Awareness --probe` prints what lockdown and MCInstall say
/// about every connected iPhone as JSON, then exits. It is a development aid,
/// not a feature, so nothing in the UI mentions it.
enum DeviceReport {
    static func printJSON() {
        var entries: [[String: Any]] = []

        for udid in ConnectedDevice.usbUdids() {
            var entry: [String: Any] = ["udid": udid]
            do {
                let device = try ConnectedDevice.read(udid: udid)
                entry["name"] = device.name ?? NSNull()
                entry["productType"] = device.productType ?? NSNull()
                entry["marketingName"] = device.marketingName ?? NSNull()
                entry["iosVersion"] = device.iosVersion ?? NSNull()
                entry["findMyOn"] = device.findMyOn ?? NSNull()
                entry["backupEncrypted"] = device.backupEncrypted ?? NSNull()
                entry["dataCapacity"] = device.dataCapacity ?? NSNull()
                entry["dataAvailable"] = device.dataAvailable ?? NSNull()
                entry["pairingState"] = device.pairingState.rawValue

                if device.pairingState == .paired {
                    let configuration = try MCInstall(udid: udid).cloudConfiguration()
                    var cloud: [String: Any] = [
                        "isSupervised": configuration.isSupervised,
                        "raw": configuration.raw,
                    ]
                    cloud["organizationName"] = configuration.organizationName ?? NSNull()
                    entry["cloudConfiguration"] = cloud
                }
            } catch {
                entry["error"] = error.localizedDescription
            }
            entries.append(entry)
        }

        guard let data = try? JSONSerialization.data(
            withJSONObject: entries,
            options: [.prettyPrinted, .sortedKeys]
        ), let json = String(data: data, encoding: .utf8) else {
            print("[]")
            return
        }
        print(json)
    }
}
