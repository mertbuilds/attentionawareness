import SwiftUI

/// Step one. Wait for an iPhone on the cable, show what it is, and let the
/// user choose which way this run goes.
///
/// With one phone there is nothing to choose, so it is the plain card. With
/// more than one it is a list of every phone on the cable, and the row the
/// user picks is the phone the whole run is about.
struct ConnectStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: WizardStep.connect.title(for: model.direction),
            lead: lead,
            error: model.watcher.lastError
        ) {
            if model.devices.count > 1 {
                DevicePicker(
                    devices: model.devices,
                    selectedUdid: model.device?.udid,
                    cloudConfigurations: model.watcher.cloudConfigurations,
                    pick: { model.select($0) }
                )
            } else if let device = model.device, device.pairingState == .paired {
                DeviceCard(
                    device: device,
                    supervised: model.isSupervised,
                    profiles: model.installedProfiles
                )
            } else {
                HStack(spacing: 10) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Looking for an iPhone on the cable.")
                        .foregroundStyle(.secondary)
                }
            }
        } actions: {
            if let device = model.device, device.pairingState == .paired {
                if model.isSupervised == true {
                    Button("Unsupervise this iPhone") {
                        model.start(.unsupervise)
                    }
                    .controlSize(.large)
                } else {
                    PrimaryButton(title: "Supervise this iPhone") {
                        model.start(.supervise)
                    }
                }
            }
        }
    }

    /// The sentence under the title says what to do next. With more than one
    /// phone on the cable it asks for a choice; with one it changes with how
    /// far that phone has got with trusting this Mac.
    private var lead: String {
        if model.devices.count > 1 {
            return "More than one iPhone is connected. Pick the one to work on."
        }
        guard let device = model.device else {
            return "Plug in your iPhone with a cable."
        }
        switch device.pairingState {
        case .trustPending:
            return "Tap Trust on the phone, then enter its passcode."
        case .untrusted:
            return "Unplug the iPhone, plug it back in, and tap Trust."
        case .paired:
            return "This is the iPhone this run is about."
        }
    }
}
