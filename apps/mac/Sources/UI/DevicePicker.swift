import SwiftUI

/// Every iPhone on the cable, one row each, for the reader to pick from.
///
/// The Connect step shows it only when more than one phone is plugged in. With
/// a single phone there is nothing to choose, so that case stays the plain
/// card. A phone that has not trusted this Mac is listed like any other, with
/// its own state line, so the reader can tell which one needs the Trust tap.
struct DevicePicker: View {
    let devices: [ConnectedDevice]
    /// The udid of the row that is picked right now.
    let selectedUdid: String?
    /// What MCInstall said about each phone, keyed by udid. A phone that has
    /// not been trusted yet has no entry.
    let cloudConfigurations: [String: CloudConfiguration]
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
                    Text(Self.state(device, cloudConfigurations[device.udid]?.isSupervised))
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

    /// Where this phone stands, in one line. A phone that has not trusted this
    /// Mac says so here rather than dropping off the list.
    static func state(_ device: ConnectedDevice, _ supervised: Bool?) -> String {
        switch device.pairingState {
        case .trustPending:
            return "Tap Trust on this iPhone"
        case .untrusted:
            return "Not trusted, unplug it and plug it back in"
        case .paired:
            return DeviceCard.state(supervised)
        }
    }
}
