import SwiftUI

/// Step one. Wait for an iPhone on the cable, show what it is, and start the
/// run.
///
/// With one phone there is nothing to choose, so it is the plain card. With
/// more than one it is a list of every phone on the cable, and the row the
/// user picks is the iPhone the whole run is about.
///
/// An iPhone the app does not supervise, iOS 27 and later or one whose
/// version could not be read, gets the manual guide here in place of
/// Continue, so no run can start on it.
struct ConnectStep: View {
    @ObservedObject var model: WizardModel

    @Environment(\.openURL) private var openURL

    var body: some View {
        StepLayout(
            title: refusal?.title ?? WizardStep.connect.title,
            lead: lead,
            error: model.watcher.lastError
        ) {
            content
        } actions: {
            actions
        }
    }

    /// Why the iPhone picked here gets the manual guide, or nil when it does
    /// not.
    private var refusal: IOSSupport.Refusal? {
        model.showsManualGuide ? model.iosRefusal : nil
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
        if let refusal {
            Text(refusal.guide)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var actions: some View {
        if let device = model.device, device.pairingState == .paired {
            // Which button shows is the only thing that says whether the
            // phone is supervised already, so the card carries no such row.
            if model.offersManageRestrictions {
                Button("Manage Restrictions") {
                    model.manageRestrictions()
                }
            } else if model.readsSupervisionFirst {
                // Whether it is supervised decides between the guide and
                // Manage Restrictions, and the next read says.
                ProgressView()
                    .controlSize(.small)
            } else if refusal != nil {
                PrimaryButton(title: "Open the Guide") {
                    if let url = SiteLink.guide { openURL(url) }
                }
            } else {
                // Continue only moves to the checks, which send nothing to
                // the iPhone, so Return can press it.
                PrimaryButton(title: "Continue") {
                    model.start()
                }
                .keyboardShortcut(.defaultAction)
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
        case .trustPending, .locked:
            return "Tap Trust on iPhone, then enter its passcode."
        case .untrusted, .needsReplug:
            return "Unplug iPhone, plug it back in, then tap Trust."
        case .paired:
            return nil
        }
    }
}
