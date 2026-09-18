import SwiftUI

/// Step one. Wait for an iPhone on the cable, show what it is, and let the
/// user choose which way this run goes.
struct ConnectStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.connect.position(in: model.direction),
            title: "Connect",
            lead: lead,
            error: model.watcher.lastError
        ) {
            if let device = model.device, device.pairingState == .paired {
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

    /// The sentence under the title says what to do next, and it changes with
    /// how far the phone has got with trusting this Mac.
    private var lead: String {
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
