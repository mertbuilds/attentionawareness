import SwiftUI

/// Step six, in the supervise direction only. The reader builds the profile
/// here: the apps it hides, the sites its filter carries and the four
/// switches. The site signs it, and it goes onto the phone over the cable. A
/// supervised phone takes it without asking; an unsupervised one refuses it,
/// which is why this step comes last.
struct ProfileStep: View {
    @ObservedObject var model: WizardModel
    /// The site list and the last two settings are folded away: the profile as
    /// it comes is the answer for almost everyone.
    @State private var showsSites = false
    @State private var showsMoreSettings = false
    /// The site in the add field, until it is added.
    @State private var typedSite = ""

    var body: some View {
        StepLayout(
            position: WizardStep.profile.position(in: model.direction),
            title: "Profile",
            lead: model.draft.allowsRemoval
                ? "The profile hides the apps you pick and blocks their sites. It installs over "
                    + "the cable. In trial mode you can remove it from the phone."
                : "The profile hides the apps you pick and blocks their sites. It installs over "
                    + "the cable and cannot be removed from the phone.",
            error: model.errorMessage
        ) {
            VStack(alignment: .leading, spacing: 16) {
                switch model.profile.stage {
                case .ready:
                    if let already = Self.alreadyOnThePhone(model.ourProfiles) {
                        Text(already)
                            .font(.callout)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    apps
                    sites
                    restrictions
                    preview
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
        // The recommended apps carry no artwork, so the store is asked for
        // theirs once, when the step comes up.
        .task {
            model.loadAppIcons()
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

    // MARK: - The apps

    /// What the profile hides: the search that finds an app, and the list it
    /// goes on.
    private var apps: some View {
        let count = model.draft.blockedApps.count
        return VStack(alignment: .leading, spacing: 8) {
            SectionHeading("Apps", detail: count == 0 ? nil : "\(count)")
            searchBar
            searchResults
            blockedApps
        }
    }

    /// The store to search and the term to search it for.
    private var searchBar: some View {
        HStack(spacing: 8) {
            Menu {
                ForEach(Storefronts.all, id: \.code) { storefront in
                    Button("\(storefront.flag) \(storefront.label)") {
                        model.chooseStorefront(storefront.code)
                    }
                }
            } label: {
                Text(Self.storefrontLabel(model.appSearch.storefront))
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .help("The App Store country the results come from")

            TextField(
                "Search apps to block",
                text: Binding(
                    get: { model.appSearch.term },
                    set: { model.searchApps(for: $0) }
                )
            )
            .textFieldStyle(.roundedBorder)

            if !model.appSearch.term.isEmpty {
                Button {
                    model.clearAppSearch()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Clear search")
            }
        }
    }

    /// What the last term found, or what there is to say instead.
    @ViewBuilder
    private var searchResults: some View {
        if model.appSearch.isSearching {
            working("Searching the App Store")
        } else if let message = model.appSearch.message {
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        } else if !model.appSearch.results.isEmpty {
            Card {
                ForEach(model.appSearch.results, id: \.bundleId) { result in
                    resultRow(result)
                }
            }
        }
    }

    private func resultRow(_ result: AppResult) -> some View {
        let name = AppSearch.shortName(result.name)
        return HStack(spacing: 10) {
            AppIcon(url: result.iconUrl, name: name)
            VStack(alignment: .leading, spacing: 1) {
                Text(name)
                    .font(.callout)
                    .lineLimit(1)
                Text(result.developer)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if model.draft.blocks(result.bundleId) {
                Text("Added")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Button("Add") {
                    model.draft.add(result)
                }
                .controlSize(.small)
            }
        }
    }

    /// The list itself, and the way back to the one this app recommends.
    @ViewBuilder
    private var blockedApps: some View {
        if model.draft.blockedApps.isEmpty {
            Text("No apps blocked yet. Search above to add some.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Card {
                ForEach(model.draft.blockedApps, id: \.bundleId) { app in
                    HStack(spacing: 10) {
                        AppIcon(url: model.draft.icons[app.bundleId] ?? "", name: app.name)
                        Text(app.name)
                            .font(.callout)
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        RemoveButton(what: app.name) {
                            model.draft.remove(app.bundleId)
                        }
                    }
                }
            }
        }
        if !model.draft.isRecommended {
            Button("Reset to recommended") {
                model.draft.resetLists()
            }
            .buttonStyle(.link)
            .font(.callout)
        }
    }

    // MARK: - The sites

    /// The web filter: every site the blocked apps imply, and whatever the
    /// reader adds to them. Folded away, because it is a long list that is
    /// usually right.
    private var sites: some View {
        DisclosureGroup(isExpanded: $showsSites) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(model.draft.sites) { site in
                    siteRow(site)
                }
                addSiteField
            }
            .padding(.top, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        } label: {
            SectionHeading("Websites", detail: model.draft.siteSummary)
        }
    }

    private func siteRow(_ site: DraftSite) -> some View {
        HStack(spacing: 8) {
            Text(site.host)
                .font(.callout)
                .lineLimit(1)
                .truncationMode(.middle)
            if site.guessed {
                // The curated table names an app's sites; everything else is
                // read off the developer link, which is the guess that can be
                // wrong, so the row says so.
                Text("from the developer link")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            RemoveButton(what: site.host) {
                model.draft.removeSite(site.url)
            }
        }
    }

    private var addSiteField: some View {
        HStack(spacing: 8) {
            TextField("Add a site, like reddit.com", text: $typedSite)
                .textFieldStyle(.roundedBorder)
                .onSubmit(addTypedSite)
            Button("Add", action: addTypedSite)
                .controlSize(.small)
                .disabled(typedSite.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private func addTypedSite() {
        if model.draft.addSite(typedSite) {
            typedSite = ""
        }
    }

    // MARK: - The restrictions

    private var restrictions: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeading("Restrictions")
            Toggle("Filter adult websites", isOn: $model.draft.autoFilterAdult)
            Toggle("Allow removal (trial mode)", isOn: $model.draft.allowsRemoval)
            DisclosureGroup("More settings", isExpanded: $showsMoreSettings) {
                VStack(alignment: .leading, spacing: 8) {
                    Toggle("Keep the App Store", isOn: $model.draft.allowAppStore)
                    Toggle("Allow private tabs and clearing history", isOn: $model.draft.allowPrivateBrowsing)
                }
                .padding(.top, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // A checkbox takes the system accent, which is blue on most Macs.
        // Everything this app switches on is orange.
        .tint(WizardStyle.accent)
    }

    // MARK: - What it will do

    /// The profile in a few lines, read out before it goes on the phone.
    private var preview: some View {
        Card {
            Text("What this profile does")
                .font(.callout)
                .foregroundStyle(.secondary)
            ForEach(model.draft.preview, id: \.self) { line in
                Text(line)
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// One storefront as the menu names it, which is the flag and the country.
    private static func storefrontLabel(_ code: String) -> String {
        "\(Storefronts.flag(for: code)) \(Storefronts.label(for: code))"
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

/// The name of one part of the step, with whatever it counts beside it.
struct SectionHeading: View {
    let title: String
    /// Whatever the part counts, or nothing where it counts nothing.
    let detail: String?

    init(_ title: String, detail: String? = nil) {
        self.title = title
        self.detail = detail
    }

    var body: some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.headline)
            if let detail {
                Text(detail)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// The cross at the end of a row. It says what it takes off, because a cross
/// on its own says nothing to a reader who cannot see the row.
struct RemoveButton: View {
    let what: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.caption)
        }
        .buttonStyle(.borderless)
        .foregroundStyle(.secondary)
        .accessibilityLabel("Remove \(what)")
        .help("Remove \(what)")
    }
}

/// One app's artwork: Apple's own icon, a neutral tile while it is on its way,
/// and the first letters of the name when it never comes. The square is the
/// same size in all three, so a row never moves as an icon lands.
///
/// It is drawn the way the site drew it: the icon the App Store answered with,
/// cornered the way iOS corners an icon, over a hairline so a white icon still
/// reads as a tile.
struct AppIcon: View {
    /// Apple's `artworkUrl100`, as the search row carried it. Empty is an app
    /// nothing is known about yet.
    let url: String
    let name: String

    private static let side: CGFloat = 28
    /// What iOS takes off the corner of an icon, which is a little under a
    /// quarter of its side.
    private static let radius: CGFloat = 6
    private static let shape = RoundedRectangle(cornerRadius: AppIcon.radius, style: .continuous)

    var body: some View {
        Group {
            if let source = URL(string: url), !url.isEmpty {
                AsyncImage(url: source) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        initials
                    case .empty:
                        pending
                    @unknown default:
                        pending
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: Self.side, height: Self.side)
        .clipShape(Self.shape)
        .overlay(Self.shape.strokeBorder(Color(nsColor: .separatorColor)))
        .accessibilityHidden(true)
    }

    /// The tile an icon is still on its way to. It says nothing, because a
    /// letter that is about to be replaced by an icon is a flicker.
    private var pending: some View {
        Color(nsColor: .controlBackgroundColor)
    }

    /// The name where there is no icon, which is what a store that does not
    /// carry the app leaves behind.
    private var initials: some View {
        ZStack {
            Color(nsColor: .controlBackgroundColor)
            Text(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(2).uppercased())
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
