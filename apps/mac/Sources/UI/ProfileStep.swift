import SwiftUI

/// Step six, in the supervise direction only. The app builds the profile, the
/// site signs it, and it goes onto the phone over the cable. A supervised
/// phone takes it without asking; an unsupervised one refuses it, which is why
/// this step comes last.
struct ProfileStep: View {
    @ObservedObject var model: WizardModel
    /// The two settings are folded away: the profile as it comes is the answer
    /// for almost everyone.
    @State private var showsMoreSettings = false

    var body: some View {
        StepLayout(
            position: WizardStep.profile.position(in: model.direction),
            title: "Profile",
            lead: model.allowsRemoval
                ? "The profile blocks the feed apps and their sites. It installs over the cable. "
                    + "In trial mode you can remove it from the phone."
                : "The profile blocks the feed apps and their sites. It installs over the cable "
                    + "and cannot be removed from the phone.",
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                switch model.profile.stage {
                case .ready:
                    if let already = Self.alreadyOnThePhone(model.ourProfiles) {
                        Text(already)
                            .font(.callout)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    blocked
                    settings
                case .signing:
                    working("Signing the profile")
                case .installing:
                    working("Installing on the phone")
                case .installed:
                    Card {
                        CheckRow(result: .pass, title: "Installed", detail: Self.whereItShows)
                        if let name = model.profile.fileName {
                            CardRow(name: "Profile", value: name)
                        }
                    }
                }
            }
        } actions: {
            switch model.profile.stage {
            case .ready:
                if model.ourProfiles.isEmpty {
                    PrimaryButton(title: "Install profile") {
                        model.signAndInstallProfile()
                    }
                    Button("Pick a file instead") {
                        model.chooseAndInstallProfile()
                    }
                    .controlSize(.large)
                    Button("Skip") {
                        model.advance()
                    }
                    .controlSize(.large)
                } else {
                    // The phone is already covered, so moving on is the answer
                    // for almost everyone. Skip would do the same as Continue,
                    // so it is left out here.
                    PrimaryButton(title: "Continue") {
                        model.advance()
                    }
                    Button("Install another") {
                        model.signAndInstallProfile()
                    }
                    .controlSize(.large)
                    Button("Pick a file instead") {
                        model.chooseAndInstallProfile()
                    }
                    .controlSize(.large)
                }
            case .signing, .installing:
                EmptyView()
            case .installed:
                PrimaryButton(title: "Continue") {
                    model.advance()
                }
            }
        }
    }

    /// Where iOS puts an installed profile, which is not where most people
    /// look for it.
    private static let whereItShows = """
        Open Settings on the iPhone, tap General, then VPN and Device Management. \
        attentionawareness is there.
        """

    /// The line above the buttons when this app has already put a profile on
    /// the phone. A second install stacks on the first: a new profile can add
    /// to what is blocked, never loosen it.
    private static func alreadyOnThePhone(_ profiles: [InstalledProfile]) -> String? {
        guard !profiles.isEmpty else { return nil }
        let names = profiles
            .map { $0.removalDisallowed ? "\($0.displayName) (locked)" : $0.displayName }
            .joined(separator: ", ")
        return "Already on the phone: \(names). Installing another adds to what is already blocked."
    }

    /// What the profile takes away. Two columns, so ten names stay one glance.
    private var blocked: some View {
        let names = model.profileConfig.blockedApps.map(\.name)
        let half = (names.count + 1) / 2
        return Card {
            HStack(alignment: .top, spacing: 16) {
                column(Array(names.prefix(half)))
                column(Array(names.dropFirst(half)))
            }
            Text("and their websites")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private func column(_ names: [String]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(names, id: \.self) { name in
                Text(name)
                    .font(.callout)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var settings: some View {
        DisclosureGroup("More settings", isExpanded: $showsMoreSettings) {
            VStack(alignment: .leading, spacing: 8) {
                Toggle("Allow removal (trial mode)", isOn: $model.allowsRemoval)
                Toggle("Filter adult websites", isOn: $model.filtersAdultWebsites)
            }
            .padding(.top, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func working(_ line: String) -> some View {
        HStack(spacing: 10) {
            ProgressView()
                .controlSize(.small)
            Text(line)
                .foregroundStyle(.secondary)
        }
    }
}
