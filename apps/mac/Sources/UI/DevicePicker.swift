import SwiftUI

/// Every iPhone on the cable, one row each, for the reader to pick from.
///
/// The Connect step shows it only when more than one phone is plugged in. With
/// a single phone there is nothing to choose, so that case stays the plain
/// card. A phone that has not trusted this Mac is listed like any other, with
/// its own line saying so, which is the only thing a row ever says beyond the
/// name and the model.
struct DevicePicker: View {
    let devices: [ConnectedDevice]
    /// The udid of the row that is picked right now.
    let selectedUdid: String?
    let pick: (ConnectedDevice) -> Void

    var body: some View {
        Card {
            ForEach(devices) { device in
                Button {
                    pick(device)
                } label: {
                    row(device)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func row(_ device: ConnectedDevice) -> some View {
        let picked = device.udid == selectedUdid
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: picked ? "largecircle.fill.circle" : "circle")
                .foregroundStyle(picked ? WizardStyle.accent : Color.secondary)
            VStack(alignment: .leading, spacing: 2) {
                // The filled circle is what says which phone is picked. Weight
                // stays put, so the rows do not reflow as the choice moves.
                Text(device.name ?? "iPhone")
                Group {
                    Text(Self.hardware(device))
                    if let state = Self.state(device) {
                        Text(state)
                    }
                }
                .font(.callout)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
        .padding(.vertical, 4)
    }

    /// The model and the iOS version on one line, in the same words the card
    /// uses when the phone has not said what it is.
    static func hardware(_ device: ConnectedDevice) -> String {
        guard let version = device.iosVersion else { return DeviceCard.model(device) }
        return "\(DeviceCard.model(device)), iOS \(version)"
    }

    /// What this phone needs before it can be picked, or nil when it needs
    /// nothing. A row says nothing about supervision: that is what the button
    /// under the list says, once a phone is chosen.
    static func state(_ device: ConnectedDevice) -> String? {
        switch device.pairingState {
        case .trustPending:
            return "Tap Trust on this iPhone"
        case .untrusted:
            return "Unplug it and plug it back in"
        case .paired:
            return nil
        }
    }
}
