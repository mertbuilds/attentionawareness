import SwiftUI

/// The last screen. A word of congratulations, what the run set up, the one
/// notice that asks for support and offers sharing, and the way back to the
/// start.
///
/// It says nothing about the copy or about supervision. The copy was
/// scaffolding the app put up and took down again, and supervision was
/// confirmed on the screen before this one, so repeating either would only send
/// somebody back to thinking about work already done. The one exception is a
/// folder that would not go, because then a copy of the iPhone really is still
/// here.
struct DoneStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(
            title: "Congrats!",
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(lines, id: \.self) { line in
                    Text(line)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let failure = model.backupRemovalFailure {
                    leftover(failure)
                }

                extensionPromo

                closing

                support
            }
        } actions: {
            PrimaryButton(title: "Done") {
                model.startOver()
            }
        }
    }

    /// The two plain lines, worked out from the profile the person built: how
    /// many apps it hides and how many websites it blocks.
    private var lines: [String] {
        DoneCopy.lines(apps: model.draft.blockedApps.count, sites: model.draft.sites.count)
    }

    /// The one line this screen ever says about a leftover, with the path and what
    /// macOS said behind the "i". It is here and nowhere else in the run,
    /// because this is the one thing somebody has to act on: the folder is
    /// still on this Mac and they may want to take it off themselves.
    private func leftover(_ failure: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("A leftover folder is still on this Mac.")
                .fixedSize(horizontal: false, vertical: true)
            InfoButton(text: failure)
        }
        .font(.callout)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Block the same feeds on the computer too. It carries the same campaign
    /// every link from the app to one of ours does.
    private var extensionPromo: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("Block the same feeds on your computer with the")
                .foregroundStyle(.secondary)
            if let url = Self.extensionURL {
                Link("browser extension", destination: url)
                    .foregroundStyle(WizardStyle.accent)
            }
        }
        .font(.callout)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The one thing the app ever asks for, at the one moment somebody has a
    /// supervised iPhone in their hand and a reason to mean it. It is part of
    /// the screen and blocks nothing: Done and closing the window work the
    /// same with or without it, and no later launch brings it back.
    private var support: some View {
        Card {
            Text(DoneCopy.support)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 16) {
                if let url = SiteLink.support {
                    Link(destination: url) {
                        Label("Support this project", systemImage: "heart.fill")
                    }
                    .buttonStyle(.bordered)
                }
                if let url = SiteLink.share {
                    ShareLink(item: url) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
            .padding(.top, 4)
        }
    }

    /// The closing line, in the primary colour and a touch of weight so it
    /// reads as the last word rather than one more grey practical line.
    private var closing: some View {
        Text(DoneCopy.closing)
            .fontWeight(.medium)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The browser extension in the Chrome Web Store, with a campaign of its
    /// own, because it is a link from the app to one of our own.
    private static let extensionURL = URL(
        string: "https://chromewebstore.google.com/detail/attention-awareness/"
            + "lgcijcijcndmggjiioibfcmppndfakee"
            + "?utm_source=mac-app&utm_medium=referral&utm_campaign=done"
    )
}
