import SwiftUI

/// What the iPhone on the cable says about itself: the card the first step and
/// the last step both show.
struct DeviceCard: View {
    let device: ConnectedDevice
    /// What MCInstall said. Nil when the phone has not answered yet.
    let supervised: Bool?
    /// The configuration profiles on the phone, in the order it lists them.
    let profiles: [InstalledProfile]

    var body: some View {
        Card {
            CardRow(name: "Name", value: device.name ?? "iPhone")
            CardRow(name: "Model", value: Self.model(device))
            CardRow(name: "iOS", value: device.iosVersion ?? "Not read yet")
            CardRow(name: "State", value: Self.state(supervised))
            CardRow(name: "Profiles", value: Self.profileNames(profiles))
        }
    }

    /// The marketing name with the model identifier after it, and whichever
    /// one of the two the phone gave when it only gave one.
    static func model(_ device: ConnectedDevice) -> String {
        switch (device.marketingName, device.productType) {
        case (.some(let marketing), .some(let product)):
            return "\(marketing) (\(product))"
        case (.some(let marketing), .none):
            return marketing
        case (.none, .some(let product)):
            return product
        case (.none, .none):
            return "Not read yet"
        }
    }

    /// Every profile the phone lists, one per line: the name Settings shows,
    /// then whether this app put it there and whether it can be deleted on the
    /// phone.
    static func profileNames(_ profiles: [InstalledProfile]) -> String {
        guard !profiles.isEmpty else { return "None" }
        return profiles.map { profile in
            let marks = [profile.isOurs ? "ours" : nil, profile.removalDisallowed ? "locked" : nil]
                .compactMap { $0 }
            guard !marks.isEmpty else { return profile.displayName }
            return "\(profile.displayName) (\(marks.joined(separator: ", ")))"
        }
        .joined(separator: "\n")
    }

    /// Supervision in the two words the phone's own Settings uses.
    static func state(_ supervised: Bool?) -> String {
        switch supervised {
        case true: return "Supervised"
        case false: return "Not supervised"
        case nil: return "Not read yet"
        }
    }
}
