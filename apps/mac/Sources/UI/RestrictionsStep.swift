import SwiftUI

/// The one screen after the iPhone is supervised: what the profile will
/// restrict, and the button that puts it there.
///
/// A supervised iPhone takes the profile without asking and an unsupervised
/// one refuses it, which is why this screen comes last. Everything that can be
/// changed about the profile is on the screen, and the card under it reads
/// back whatever it was left at, because the profile as it comes is the answer
/// for almost everyone.
struct RestrictionsStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(title: title) {
            content
        } actions: {
            actions
        }
    }

    /// An install that did not take carries a heading of its own, the way the
    /// job screen's failures do.
    private var title: String {
        failure == nil
            ? WizardStep.restrictions.title
            : "Restrictions Didn't Install"
    }

    /// What the signer or the iPhone said, once something has gone wrong. Nil
    /// on every ordinary pass through the screen, because a confirmed install
    /// moves to the last step by itself.
    private var failure: String? { model.errorMessage }

    @ViewBuilder
    private var content: some View {
        if let failure {
            didNotInstall(failure)
        } else if model.profile.isRunning {
            installing
        } else {
            ready
        }
    }

    // MARK: - What the profile does

    /// The builder, and under it the card that reads back whatever it was left
    /// at. The window scrolls, so a long list of apps costs the card nothing.
    private var ready: some View {
        VStack(alignment: .leading, spacing: 16) {
            RestrictionsBuilder(model: model)
            summary
        }
    }

    /// The whole profile in one card, one line each, with the names and the
    /// longer answers in the hover help.
    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Card {
                ForEach(RestrictionsSummary.lines(for: model.draft)) { line in
                    Text(line.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .help(line.help)
                }
            }
            if let already = Self.alreadyOnIPhone(model.ourProfiles) {
                Text(already)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// The line under the card when the app has already put a profile on the
    /// iPhone. A second install stacks on the first: a new profile can add to
    /// what is blocked, never loosen it.
    private static func alreadyOnIPhone(_ profiles: [InstalledProfile]) -> String? {
        guard !profiles.isEmpty else { return nil }
        let names = profiles.map(\.displayName).joined(separator: ", ")
        return "Already on iPhone: \(names). Installing another adds to it."
    }

    // MARK: - Putting it there

    /// Signing and installing are one wait for the person watching, so they
    /// are one bar and one line rather than two states to read.
    private var installing: some View {
        VStack(alignment: .leading, spacing: 12) {
            ProgressView()
                .progressViewStyle(.linear)
                .tint(WizardStyle.accent)
            Text("Installing on iPhone")
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The one fix, with what the layer underneath said behind the "i".
    private func didNotInstall(_ raw: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("Unlock iPhone, then try again.")
                .fixedSize(horizontal: false, vertical: true)
            InfoButton(text: raw)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - The buttons

    @ViewBuilder
    private var actions: some View {
        if failure != nil {
            PrimaryButton(title: "Try Again") {
                model.signAndInstallProfile()
            }
            Button("Cancel") {
                model.forgetProfileFailure()
            }
            .controlSize(.large)
        } else if !model.profile.isRunning {
            // Installing is the only way on. A run that walked past the
            // profile would leave a supervised iPhone with nothing blocked,
            // which is the whole point walked past.
            PrimaryButton(title: "Install") {
                model.signAndInstallProfile()
            }
        }
    }
}
