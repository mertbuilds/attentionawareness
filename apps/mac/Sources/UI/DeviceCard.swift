import SwiftUI

/// What the iPhone on the cable says about itself: the card the first step
/// shows once a phone has trusted this Mac.
///
/// Three rows, and nothing the run is about to change. Whether the iPhone is
/// supervised already is said by the button under the card, not by a row.
struct DeviceCard: View {
    let device: ConnectedDevice

    var body: some View {
        Card {
            CardRow(name: "Name", value: device.name ?? "iPhone")
            CardRow(name: "Model", value: Self.model(device))
            CardRow(name: "iOS", value: device.iosVersion ?? "Reading")
        }
    }

    /// The marketing name, and the model identifier in its place when the
    /// iPhone gave no marketing name. The identifier is what `--probe` prints
    /// for a reader who needs it; the card names the phone the way its owner
    /// does.
    static func model(_ device: ConnectedDevice) -> String {
        device.marketingName ?? device.productType ?? "Reading"
    }
}
