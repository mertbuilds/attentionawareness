import SwiftUI

/// The last screen. What the run set up, the one thing left to do, two things
/// somebody can do next, and the way back to the start.
///
/// It says nothing about the copy. The copy was scaffolding the app put up and
/// took down again, so naming it would only send somebody back to thinking
/// about work already done. The one exception is a folder that would not go,
/// because then a copy of the iPhone really is still here.
struct DoneStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            symbol: .done,
            title: WizardStep.done.title,
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 6) {
                Text(result)
                Text(DoneCopy.disconnect)
                    .foregroundStyle(.secondary)
                if let failure = model.backupRemovalFailure {
                    leftover(failure)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)

            next
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

    /// The one line this screen ever says about a leftover, with the path and what
    /// macOS said behind the "i". It is here and nowhere else in the run,
    /// because this is the one thing somebody has to act on: the folder is
    /// still on this Mac and they may want to take it off themselves.
    private func leftover(_ failure: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("A leftover folder is still on this Mac.")
            InfoButton(text: failure)
        }
        .foregroundStyle(.secondary)
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
