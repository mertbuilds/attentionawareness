import SwiftUI

/// What the iPhone on the cable says about itself: the card the first step
/// shows once a phone has trusted this Mac.
///
/// The phone's name is the one loud thing on it; its model and iOS are the
/// quiet line under it, and nothing here is a state the run is about to
/// change. Whether the iPhone is supervised already is said by the button
/// under the card, not by a row.
struct DeviceCard: View {
    let device: ConnectedDevice

    var body: some View {
        Card {
            HStack(spacing: 12) {
                Image(systemName: "iphone")
                    .font(.system(size: 30))
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(device.name ?? "iPhone")
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text(meta)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    /// The quiet line under the name: the model and the iOS version, joined
    /// with a middot. A piece the iPhone has not named yet drops out, so the
    /// line never carries a dangling separator; with neither named it reads
    /// "Reading" on its own.
    private var meta: String {
        var parts: [String] = []
        if device.marketingName != nil || device.productType != nil {
            parts.append(Self.model(device))
        }
        if let iosVersion = device.iosVersion {
            parts.append("iOS \(iosVersion)")
        }
        return parts.isEmpty ? "Reading" : parts.joined(separator: " · ")
    }

    /// The marketing name, and the model identifier in its place when the
    /// iPhone gave no marketing name. The identifier is what `--probe` prints
    /// for a reader who needs it; the card names the phone the way its owner
    /// does.
    static func model(_ device: ConnectedDevice) -> String {
        device.marketingName ?? device.productType ?? "Reading"
    }
}
