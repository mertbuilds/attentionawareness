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
            content
        } actions: {
            actions
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.devices.count > 1 {
            DevicePicker(
                devices: model.devices,
                selectedUdid: model.device?.udid,
                pick: { model.select($0) }
            )
        } else if let device = model.device {
            if device.pairingState == .paired {
                DeviceCard(device: device)
            }
        } else {
            // Nothing is plugged in and the app is watching for one. A
            // spinner says that on its own: naming what it is waiting for
            // would repeat the line above it.
            ProgressView()
                .controlSize(.small)
        }
    }

    @ViewBuilder
    private var actions: some View {
        if let device = model.device, device.pairingState == .paired {
            // Which button shows is the only thing that says whether the
            // phone is supervised already, so the card carries no such row.
            if model.isSupervised == true {
                Button("Unsupervise iPhone") {
                    model.start(.unsupervise)
                }
                .controlSize(.large)
            } else {
                PrimaryButton(title: "Continue") {
                    model.start(.supervise)
                }
            }
        }
    }

    /// The sentence under the title says what to do next. With more than one
    /// phone on the cable it asks for a choice; with one it changes with how
    /// far that phone has got with trusting this Mac. A phone that is trusted
    /// needs no sentence at all: the card under it is the answer.
    private var lead: String? {
        if model.devices.count > 1 {
            return "Choose the iPhone to supervise."
        }
        guard let device = model.device else {
            return "Use a USB cable. Unlock iPhone and tap Trust if asked."
        }
        switch device.pairingState {
        case .trustPending:
            return "Tap Trust on iPhone, then enter its passcode."
        case .untrusted:
            return "Unplug iPhone, plug it back in, then tap Trust."
        case .paired:
            return nil
        }
    }
}
