import SwiftUI

/// The Profiles screen for a phone that is already supervised.
///
/// It is reached from Connect, not walked to: the phone is supervised, so
/// there is no run to make. It lists the restrictions on the phone now and
/// carries the same builder the run's last step does, so another can be built
/// and installed over the cable without erasing anything.
struct ProfilesStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(title: title) {
            content
        } actions: {
            actions
        }
        // Reaching the screen fixes the phone and reads its list, but a person
        // may leave it open while they change the phone, so it reads again on
        // the way in.
        .task {
            model.refreshInstalledProfiles()
        }
    }

    /// An install that did not take carries a heading of its own, the way the
    /// Restrictions step does.
    private var title: String {
        failure == nil
            ? WizardStep.profiles.title
            : "Restrictions Didn't Install"
    }

    /// What the signer or the iPhone said, once something has gone wrong. Nil
    /// on every ordinary pass through the screen.
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

    // MARK: - What is on the phone, and what to add

    /// The list of what is installed now, then the builder and the card that
    /// reads back whatever it was left at.
    private var ready: some View {
        VStack(alignment: .leading, spacing: 16) {
            installed
            RestrictionsBuilder(model: model)
            summary
        }
    }

    /// The profiles the phone lists, ours named as ours and anything else by
    /// the name Settings shows. The "i" says, once and quietly, that what is
    /// installed here is locked.
    private var installed: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("Installed")
                    .font(.headline)
                InfoButton(text: "Restrictions installed here are locked. Removing them means erasing iPhone.")
            }
            if model.installedProfiles.isEmpty {
                Text("No restrictions yet.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Card {
                    ForEach(model.installedProfiles) { profile in
                        installedRow(profile)
                    }
                }
            }
        }
    }

    /// One profile on the phone. Ours reads as our name, with whatever summary
    /// it carries beside it; anyone else's by the name Settings shows.
    private func installedRow(_ profile: InstalledProfile) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(profile.isOurs ? "attentionawareness" : profile.displayName)
                .font(.callout)
            if let detail = Self.detail(for: profile) {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// A short line to say beside our name, where the profile carries one that
    /// adds to it. A description that only repeats the name says nothing.
    private static func detail(for profile: InstalledProfile) -> String? {
        guard profile.isOurs,
              let description = profile.description,
              !description.isEmpty,
              description != profile.displayName
        else { return nil }
        return description
    }

    /// The whole draft in one card, one line each, the way the Restrictions
    /// step shows it.
    private var summary: some View {
        Card {
            ForEach(RestrictionsSummary.lines(for: model.draft)) { line in
                Text(line.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .help(line.help)
            }
        }
    }

    // MARK: - Putting it there

    /// Signing and installing are one wait for the person watching, so they are
    /// one bar and one line.
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
                model.installMoreProfile()
            }
            Button("Cancel") {
                model.forgetProfileFailure()
            }
            .controlSize(.large)
        } else if !model.profile.isRunning {
            PrimaryButton(title: "Install") {
                model.installMoreProfile()
            }
            Button("Done") {
                model.closeProfiles()
            }
            .controlSize(.large)
        }
    }
}
