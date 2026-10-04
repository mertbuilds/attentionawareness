import SwiftUI

/// Every iPhone on the cable, one phone card each, for the reader to pick from.
///
/// The Connect step shows it only when more than one phone is plugged in. With
/// a single phone there is nothing to choose, so that case stays the plain
/// card. Each phone here is the same card the single-phone step draws, so the
/// list reads as a stack of those cards rather than a control of its own. The
/// picked one is marked by an accent border and a checkmark, never by a change
/// in the text. A phone that has not trusted this Mac is listed like any other,
/// with its own line saying so, which is the only thing a card ever says beyond
/// the name and the model.
struct DevicePicker: View {
    let devices: [ConnectedDevice]
    /// The udid of the card that is picked right now.
    let selectedUdid: String?
    let pick: (ConnectedDevice) -> Void

    var body: some View {
        VStack(spacing: 10) {
            ForEach(devices) { device in
                card(device)
            }
        }
    }

    private func card(_ device: ConnectedDevice) -> some View {
        let picked = device.udid == selectedUdid
        return Button {
            pick(device)
        } label: {
            HStack(spacing: 12) {
                DeviceIdentity(device: device, extraLine: Self.state(device))
                Spacer(minLength: 0)
                // The checkmark, with the border, is what says which phone is
                // picked. The name is the hero on every card and its weight
                // stays put, so the cards do not reflow and the choice never
                // shows as a bolder label.
                if picked {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(WizardStyle.accent)
                }
            }
            // The same fill, radius and border as `Card`, so a card here and
            // the single-phone card are the same box. Picked swaps the quiet
            // separator for the accent at two points.
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(
                Color(nsColor: .controlBackgroundColor),
                in: RoundedRectangle(cornerRadius: WizardStyle.cardRadius)
            )
            .overlay(
                RoundedRectangle(cornerRadius: WizardStyle.cardRadius)
                    .strokeBorder(
                        picked ? WizardStyle.accent : Color(nsColor: .separatorColor),
                        lineWidth: picked ? 2 : 1
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// What the iPhone needs before it can be picked, or nil when it needs
    /// nothing. A card says nothing about supervision: that is what the button
    /// under the list says, once a phone is chosen.
    static func state(_ device: ConnectedDevice) -> String? {
        switch device.pairingState {
        case .trustPending:
            return "Tap Trust on it"
        case .untrusted:
            return "Unplug it and plug it back in"
        case .paired:
            return nil
        }
    }
}
