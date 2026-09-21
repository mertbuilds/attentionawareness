import SwiftUI

/// What the iPhone on the cable says about itself: the card the first step
/// shows once a phone has trusted this Mac.
///
/// Three rows, and nothing the run is about to change. Whether the phone is
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
            return "Reading"
        }
    }
}
