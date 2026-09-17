import SwiftUI

/// Step six, in the supervise direction only. Push the signed profile onto the
/// phone over the cable. A supervised phone takes it without asking; an
/// unsupervised one refuses it, which is why this step comes last.
struct ProfileStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            position: WizardStep.profile.position(in: model.direction),
            title: "Profile",
            lead: "Install the configuration profile from attentionawareness.com/build. Save the file, then pick it here.",
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if let url = SiteLink.build {
                    Link("Open attentionawareness.com/build", destination: url)
                        .focusable(false)
                }

                switch model.profile.stage {
                case .ready:
                    EmptyView()
                case .installing:
                    HStack(spacing: 10) {
                        ProgressView()
                            .controlSize(.small)
                        Text("Sending the profile to the iPhone.")
                            .foregroundStyle(.secondary)
                    }
                case .installed:
                    Card {
                        CardRow(name: "Profile", value: model.profile.fileName ?? "Profile")
                        CardRow(name: "The iPhone said", value: "Acknowledged")
                    }
                }
            }
        } actions: {
            switch model.profile.stage {
            case .ready:
                PrimaryButton(title: "Choose profile") {
                    model.chooseAndInstallProfile()
                }
                Button("Skip") {
                    model.advance()
                }
                .controlSize(.large)
            case .installing:
                EmptyView()
            case .installed:
                PrimaryButton(title: "Continue") {
                    model.advance()
                }
            }
        }
    }
}
