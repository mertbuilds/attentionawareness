import SwiftUI

/// The last screen. What the run set up, the one thing left to do, two things
/// somebody can do next, and the way back to the start.
struct DoneStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            symbol: .done,
            title: model.supervises ? WizardStep.done.title : DoneCopy.unsupervisedTitle,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 6) {
                // A run that took supervision off installed no profile, so
                // there is nothing to count and nothing to offer next.
                if model.supervises {
                    Text(result)
                }
                // A run that took supervision off on iOS 27 or later ends
                // here with iPhone still on the Restore Completed screen.
                if !model.supervises, model.liveConfigurationApplied {
                    Text(JobPhase.continueOnIPhone)
                }
                Text(DoneCopy.disconnect)
                    .foregroundStyle(.secondary)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)

            if model.supervises {
                next
            }
        } actions: {
            PrimaryButton(title: "Done") {
                model.startOver()
            }
            .keyboardShortcut(.defaultAction)
        }
    }

    /// The result line, worked out from the profile the person built: how many
    /// apps it hides and how many websites it blocks.
    private var result: String {
        DoneCopy.result(apps: model.draft.blockedApps.count, sites: model.draft.sites.count)
    }

    /// The two things somebody can do after the run, in one box and one row
    /// style. The second is the one thing the app ever asks for, at the one
    /// moment somebody has a supervised iPhone in their hand and a reason to
    /// mean it. It blocks nothing: Done and closing the window work the same
    /// with or without it, and no later launch brings it back.
    private var next: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(DoneCopy.next)
                .font(.headline)
            Card {
                DoneRow(symbol: "desktopcomputer", text: DoneCopy.browserExtension) {
                    if let url = SiteLink.browserExtension {
                        Link(DoneCopy.getBrowserExtension, destination: url)
                    }
                }
                Divider()
                    .padding(.vertical, 4)
                DoneRow(symbol: "heart", text: DoneCopy.support) {
                    if let url = SiteLink.support {
                        Link(DoneCopy.supportThisProject, destination: url)
                    }
                    if let url = SiteLink.share {
                        ShareLink(DoneCopy.share, item: url)
                    }
                }
            }
        }
    }
}
