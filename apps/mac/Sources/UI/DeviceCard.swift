import SwiftUI

/// The iPhone glyph beside its name and its quiet meta line: the inside of the
/// phone card, without the box.
///
/// The card wraps this in a `Card`; the picker wraps one per phone in a
/// tappable box of its own. Both draw the same thing, so a phone reads as the
/// same card whether it is the only one on the cable or one of several. The
/// name is the one loud thing on it; the model and iOS are the quiet line
/// under it. `extraLine`, when a phone has one, is a third quiet line under
/// that, saying what the phone still needs before it can be picked.
struct DeviceIdentity: View {
    let device: ConnectedDevice
    var extraLine: String?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "iphone")
                .font(.system(size: 30))
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(device.name ?? "iPhone")
                    .font(.title3)
                    .fontWeight(.semibold)
                Group {
                    Text(DeviceCard.hardwareLine(device))
                    if let extraLine {
                        Text(extraLine)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
    }
}

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
            DeviceIdentity(device: device)
        }
    }

    /// The quiet line under the name: the model and the iOS version, joined
    /// with a middot. A piece the iPhone has not named yet drops out, so the
    /// line never carries a dangling separator; with neither named it reads
    /// "Reading" on its own. The picker draws the same line from here, so the
    /// card and the list read identically.
    static func hardwareLine(_ device: ConnectedDevice) -> String {
        var parts: [String] = []
        if device.marketingName != nil || device.productType != nil {
            parts.append(model(device))
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
