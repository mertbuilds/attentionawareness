import Foundation

/// A hidden command line path for checking the device layer without opening the
/// window: `attention awareness --probe` prints what lockdown and MCInstall say
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
                entry["cloudBackupOn"] = device.cloudBackupOn ?? NSNull()
                // The probe is read by a person, so the last iCloud backup is
                // printed as a date rather than as the count of seconds the
                // phone answered with.
                entry["lastCloudBackup"] = device.lastCloudBackup.map(stamp) ?? NSNull()
                entry["dataCapacity"] = device.dataCapacity ?? NSNull()
                entry["dataAvailable"] = device.dataAvailable ?? NSNull()
                entry["pairingState"] = device.pairingState.rawValue

                if device.pairingState == .paired {
                    let mcInstall = try MCInstall(udid: udid)
                    let configuration = try mcInstall.cloudConfiguration()
                    var cloud: [String: Any] = [
                        "isSupervised": configuration.isSupervised,
                        "raw": configuration.raw,
                    ]
                    cloud["organizationName"] = configuration.organizationName ?? NSNull()
                    entry["cloudConfiguration"] = cloud
                    entry["installedProfiles"] = try mcInstall.profileList().map { profile in
                        var listed: [String: Any] = [
                            "id": profile.id,
                            "displayName": profile.displayName,
                            "isActive": profile.isActive,
                            "removalDisallowed": profile.removalDisallowed,
                            "isOurs": profile.isOurs,
                        ]
                        listed["organization"] = profile.organization ?? NSNull()
                        listed["description"] = profile.description ?? NSNull()
                        listed["uuid"] = profile.uuid ?? NSNull()
                        return listed
                    }
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

    /// One date in a form that sorts and parses anywhere.
    private static func stamp(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }
}
