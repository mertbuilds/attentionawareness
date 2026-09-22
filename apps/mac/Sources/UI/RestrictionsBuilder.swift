import SwiftUI

/// Everything the summary card folds away: the apps the profile hides, the
/// sites its filter carries and the four switches.
///
/// It is drawn on the Restrictions screen itself, above the card that reads
/// back whatever it was left at. What a reader usually wants no part of is
/// folded away rather than left to scroll past.
struct RestrictionsBuilder: View {
    @ObservedObject var model: WizardModel
    /// The site list and the last two settings are folded away: the profile as
    /// it comes is the answer for almost everyone.
    @State private var showsSites = false
    @State private var showsMoreSettings = false
    /// The site in the add field, until it is added.
    @State private var typedSite = ""
    /// The hole in the kept-open add field, until it is added.
    @State private var typedException = ""
    @State private var storefrontPickerShown = false
    @FocusState private var searchFocused: Bool
    @FocusState private var siteFocused: Bool
    @FocusState private var exceptionFocused: Bool

    init(model: WizardModel, sitesExpanded: Bool = false) {
        _model = ObservedObject(wrappedValue: model)
        _showsSites = State(initialValue: sitesExpanded)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            apps
            sites
            restrictions
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // The recommended apps carry no artwork, so the store is asked for
        // theirs once, when the builder comes up.
        .task {
            model.loadAppIcons()
        }
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
            Button {
                storefrontPickerShown = true
            } label: {
                Text(Self.storefrontLabel(model.appSearch.storefront))
            }
            // The one button that is a label for what it opens rather than an
            // action of its own, so it keeps the plain text colour.
            .buttonStyle(.borderless)
            .foregroundStyle(.primary)
            .fixedSize()
            .help("The App Store country the results come from")
            // A flat menu of 175 countries is a scroll, so the list is
            // searchable. A country is easier to type than to hunt for.
            .popover(isPresented: $storefrontPickerShown, arrowEdge: .bottom) {
                StorefrontPicker(selected: model.appSearch.storefront) { code in
                    model.chooseStorefront(code)
                    storefrontPickerShown = false
                }
            }

            RingedField(focused: searchFocused) {
                TextField(
                    "Search apps to block",
                    text: Binding(
                        get: { model.appSearch.term },
                        set: { model.searchApps(for: $0) }
                    )
                )
                .focused($searchFocused)
            }

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

    /// Two even columns, as on the website. They fall to one when the window
    /// is too narrow to hold a name without cutting it.
    private static let appColumns = [
        GridItem(.adaptive(minimum: 180), spacing: 12, alignment: .leading)
    ]

    /// The list itself, and the way back to the one the app recommends.
    @ViewBuilder
    private var blockedApps: some View {
        if model.draft.blockedApps.isEmpty {
            Text("No apps blocked yet. Search above to add some.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Card {
                // Two columns, the way the website laid them out. A blocked
                // app is an icon and a short name, so a full width row wastes
                // most of itself and a list of ten reads as a long scroll.
                LazyVGrid(columns: Self.appColumns, alignment: .leading, spacing: 8) {
                    ForEach(model.draft.blockedApps, id: \.bundleId) { app in
                        HStack(spacing: 10) {
                            AppIcon(url: model.draft.icons[app.bundleId] ?? "", name: app.name)
                            Text(app.name)
                                .font(.callout)
                                .lineLimit(1)
                                .truncationMode(.tail)
                            Spacer(minLength: 4)
                            RemoveButton(what: app.name) {
                                model.draft.remove(app.bundleId)
                            }
                        }
                    }
                }
            }
        }
        if !model.draft.isRecommended {
            Button("Reset to Recommended") {
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
                keptOpenSites
            }
            .padding(.top, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        } label: {
            // Only the arrow folds a DisclosureGroup on macOS. The title is
            // the bigger target and the one people aim at.
            SectionHeading("Websites", detail: model.draft.siteSummary)
                .contentShape(Rectangle())
                .onTapGesture { showsSites.toggle() }
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
            RingedField(focused: siteFocused) {
                TextField("Add a site, like reddit.com", text: $typedSite)
                    .focused($siteFocused)
                    .onSubmit(addTypedSite)
            }
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

    /// The holes the filter keeps open so sign-in still resolves. They edit the
    /// same way the blocked sites do: a row to take one off, a field to add
    /// one. The open padlock marks them as let through rather than crossed off.
    private var keptOpenSites: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kept open for sign-in")
                .font(.caption)
                .foregroundStyle(.secondary)
            ForEach(model.draft.permittedSites) { exception in
                exceptionRow(exception)
            }
            addExceptionField
        }
        .padding(.top, 4)
    }

    private func exceptionRow(_ site: DraftSite) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "lock.open")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(site.host)
                .font(.callout)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 8)
            RemoveButton(what: site.host) {
                model.draft.removeException(site.url)
            }
        }
    }

    private var addExceptionField: some View {
        HStack(spacing: 8) {
            RingedField(focused: exceptionFocused) {
                TextField("Add a site to keep open, like accounts.google.com", text: $typedException)
                    .focused($exceptionFocused)
                    .onSubmit(addTypedException)
            }
            Button("Add", action: addTypedException)
                .controlSize(.small)
                .disabled(typedException.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private func addTypedException() {
        if model.draft.addException(typedException) {
            typedException = ""
        }
    }

    // MARK: - The restrictions

    private var restrictions: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeading("Restrictions")
            Toggle("Filter adult websites", isOn: $model.draft.autoFilterAdult)
            Toggle("Allow removal (trial mode)", isOn: $model.draft.allowsRemoval)
            DisclosureGroup(isExpanded: $showsMoreSettings) {
                VStack(alignment: .leading, spacing: 8) {
                    Toggle("Keep the App Store", isOn: $model.draft.allowAppStore)
                    Toggle("Allow private tabs and clearing history", isOn: $model.draft.allowPrivateBrowsing)
                }
                .padding(.top, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
            } label: {
                Text("More settings")
                    .contentShape(Rectangle())
                    .onTapGesture { showsMoreSettings.toggle() }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // A checkbox takes the system accent, which is blue on most Macs.
        // Everything the app switches on is orange.
        .tint(WizardStyle.accent)
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

/// The name of one part of the builder, with whatever it counts beside it.
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
    /// How long the question waits for an answer before it withdraws it.
    private static let armedFor = Duration.seconds(4)

    let what: String
    let action: () -> Void

    @State private var armed = false

    var body: some View {
        Button {
            if armed {
                action()
            } else {
                armed = true
            }
        } label: {
            if armed {
                Text("Sure?")
                    .font(.caption)
            } else {
                Image(systemName: "xmark")
                    .font(.caption)
            }
        }
        .buttonStyle(.borderless)
        .foregroundStyle(armed ? WizardStyle.accent : Color.secondary)
        .accessibilityLabel(armed ? "Remove \(what), tap again to confirm" : "Remove \(what)")
        .help(armed ? "Click again to remove \(what)" : "Remove \(what)")
        // A question left standing is a question nobody answered, so it takes
        // itself back rather than waiting to be clicked by accident later.
        .task(id: armed) {
            guard armed else { return }
            try? await Task.sleep(for: Self.armedFor)
            guard !Task.isCancelled else { return }
            armed = false
        }
    }
}

/// The App Store country to search, with a search of its own: 175 of them is
/// a list nobody scrolls, and a country is easier to type than to hunt for.
struct StorefrontPicker: View {
    let selected: String
    let choose: (String) -> Void

    @State private var query = ""
    @FocusState private var queryFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            RingedField(focused: queryFocused) {
                TextField("Search countries", text: $query)
                    .focused($queryFocused)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(matches, id: \.code) { storefront in
                        Button {
                            choose(storefront.code)
                        } label: {
                            HStack(spacing: 8) {
                                Text(storefront.flag)
                                Text(storefront.label)
                                Spacer(minLength: 0)
                                if storefront.code == selected {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(WizardStyle.accent)
                                }
                            }
                            .contentShape(Rectangle())
                            .padding(.vertical, 4)
                            .padding(.horizontal, 6)
                        }
                        .buttonStyle(.plain)
                    }
                    if matches.isEmpty {
                        Text("No country by that name.")
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 6)
                    }
                }
            }
        }
        .padding(12)
        .frame(width: 260, height: 320)
    }

    /// Matches on the country name or its two letter code. The comparison is
    /// the forgiving one, so "turkiye" finds Türkiye.
    private var matches: [Storefront] {
        let term = query.trimmingCharacters(in: .whitespaces)
        guard !term.isEmpty else { return Storefronts.all }
        return Storefronts.all.filter {
            $0.label.localizedStandardContains(term) || $0.code.localizedStandardContains(term)
        }
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
