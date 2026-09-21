import Foundation

/// One line of the website list: the url the filter will carry, the app that
/// brought it, and whether that app named it or this app guessed.
struct DraftSite: Equatable, Identifiable {
    /// The url as the profile writes it, which is also what makes a row
    /// unique.
    let url: String
    /// The blocked app the site belongs to, or nothing when the reader typed
    /// it themselves.
    let app: String?
    /// True when the site came from the App Store developer link rather than
    /// from the curated table. It is the row that can name the wrong site, so
    /// it is the one the window marks.
    let guessed: Bool

    var id: String { url }

    /// The url without its scheme, which is all a row has room for.
    var host: String {
        guard let separator = url.range(of: "://") else { return url }
        return String(url[separator.upperBound...])
    }
}

/// What the Profile step is building: the apps the profile hides, the sites
/// its filter carries, and the four switches it writes.
///
/// It is a value and it reaches nothing, so the step hands it around and the
/// tests run it without a window. `config` is the only way out of it: the
/// profile the site is asked to sign.
struct ProfileDraft: Equatable {
    var blockedApps: [BlockedApp]
    /// Sites the reader typed. They are kept apart from the derived ones so a
    /// site never leaves with an app that happened to imply it as well.
    var typedSites: [String]
    /// Derived sites the reader took off the list, by url, so one that was
    /// turned down does not come back on the next keystroke.
    var droppedSites: [String]
    /// The artwork of the apps on the list, by bundle id. The profile carries
    /// none of it: a row this knows no icon for is drawn by its initial.
    var icons: [String: String]
    var allowAppStore: Bool
    var allowPrivateBrowsing: Bool
    var autoFilterAdult: Bool
    /// Trial mode: the profile can be deleted on the phone.
    var allowsRemoval: Bool
}

extension ProfileDraft {
    /// What the step starts on, which is the profile this app has always
    /// installed: the feed apps, their sites and the two locks.
    static let recommended = ProfileDraft(
        blockedApps: ProfileConfig.default.blockedApps,
        typedSites: [],
        droppedSites: [],
        icons: [:],
        allowAppStore: ProfileConfig.default.allowAppStore,
        allowPrivateBrowsing: ProfileConfig.default.allowPrivateBrowsing,
        autoFilterAdult: ProfileConfig.default.autoFilterAdult,
        allowsRemoval: !ProfileConfig.default.lockRemoval
    )

    /// The holes the filter keeps open whatever else is blocked. They are the
    /// default profile's, which is where that list is decided.
    static let permittedUrls: [String] = {
        guard case .deny(_, let permitted) = ProfileConfig.default.webFilter else { return [] }
        return permitted
    }()

    /// Every site the filter will carry: the ones the blocked apps imply, in
    /// the order the apps were picked, then the ones the reader typed. A site
    /// taken off the list is left out and no url is listed twice.
    var sites: [DraftSite] {
        let dropped = Set(droppedSites)
        var seen = Set<String>()
        var rows: [DraftSite] = []
        for app in blockedApps {
            let found = Sites.sites(forApp: app.bundleId, sellerUrl: app.sellerUrl)
            for site in found.sites {
                let url = Sites.normalize(site)
                guard !url.isEmpty, !dropped.contains(url), seen.insert(url).inserted else {
                    continue
                }
                rows.append(DraftSite(url: url, app: app.name, guessed: found.source == .seller))
            }
        }
        for typed in typedSites {
            let url = Sites.normalize(typed)
            guard !url.isEmpty, seen.insert(url).inserted else { continue }
            rows.append(DraftSite(url: url, app: nil, guessed: false))
        }
        return rows
    }

    /// The profile the site is asked to sign.
    var config: ProfileConfig {
        var config = ProfileConfig.default
        config.blockedApps = blockedApps
        config.allowAppStore = allowAppStore
        config.allowPrivateBrowsing = allowPrivateBrowsing
        config.autoFilterAdult = autoFilterAdult
        config.lockRemoval = !allowsRemoval
        let urls = sites.map(\.url)
        // A filter with nothing in it filters nothing, so the payload is left
        // out rather than written empty.
        config.webFilter = urls.isEmpty
            ? .off
            : .deny(deniedUrls: urls, permittedUrls: Self.permittedUrls)
        return config
    }

    /// True while the lists are the ones the app recommends, which is what the
    /// step reads before it offers to put them back.
    var isRecommended: Bool {
        blockedApps == Self.recommended.blockedApps
            && typedSites.isEmpty
            && droppedSites.isEmpty
    }

    /// How many sites the filter carries, as the heading says it.
    var siteSummary: String {
        let count = sites.count
        return count == 0 ? "no sites" : Self.count(count, "site")
    }

    /// Whether an app is already on the list.
    func blocks(_ bundleId: String) -> Bool {
        blockedApps.contains { $0.bundleId == bundleId }
    }

    /// Put one App Store row on the list. An app already on it changes
    /// nothing, and neither does one of Apple's own.
    mutating func add(_ result: AppResult) {
        guard Self.canBlock(result), !blocks(result.bundleId) else { return }
        if !result.iconUrl.isEmpty {
            icons[result.bundleId] = result.iconUrl
        }
        // The stored name is the short one: a row has no room for the App
        // Store tagline, and the seller url rides along because the sites of
        // an app the table does not carry come from it.
        blockedApps.append(
            BlockedApp(
                bundleId: result.bundleId,
                name: AppSearch.shortName(result.name),
                sellerUrl: result.sellerUrl
            )
        )
    }

    /// Take one app off the list. Its sites go with it, because they were only
    /// ever there to cover it.
    mutating func remove(_ bundleId: String) {
        blockedApps.removeAll { $0.bundleId == bundleId }
    }

    /// Put a site the reader typed on the list. It answers whether the list
    /// carries it now, which is when the field empties itself.
    @discardableResult
    mutating func addSite(_ typed: String) -> Bool {
        let url = Sites.normalize(typed)
        guard !url.isEmpty else { return false }
        // A site that was taken off and typed back is the row it was, not a
        // second one beside it.
        droppedSites.removeAll { $0 == url }
        guard !sites.contains(where: { $0.url == url }) else { return true }
        typedSites.append(url)
        return true
    }

    /// Take one site off the list. A typed site is forgotten; one an app
    /// implies is remembered as turned down, so the app keeps its other sites.
    mutating func removeSite(_ url: String) {
        let normalized = Sites.normalize(url)
        typedSites.removeAll { Sites.normalize($0) == normalized }
        guard sites.contains(where: { $0.url == normalized }),
            !droppedSites.contains(normalized)
        else {
            return
        }
        droppedSites.append(normalized)
    }

    /// Put the recommended lists back, and nothing else: the switches are the
    /// reader's own and are left where they are.
    mutating func resetLists() {
        blockedApps = Self.recommended.blockedApps
        typedSites = []
        droppedSites = []
    }

    /// Whether an App Store row is something a profile can hide. Apple's own
    /// apps are not: `blockedAppBundleIDs` leaves them alone, Safari is the
    /// web filter's job, and the phone has to keep answering calls.
    static func canBlock(_ result: AppResult) -> Bool {
        !result.bundleId.lowercased().hasPrefix("com.apple.")
            && KnownApps.known(AppSearch.shortName(result.name))?.system != true
    }

    /// The rows out of one search that are worth offering.
    static func offerable(_ results: [AppResult]) -> [AppResult] {
        results.filter(canBlock)
    }

    /// A number and the thing it counts, in whole words, because the copy
    /// never abbreviates a unit.
    private static func count(_ value: Int, _ unit: String) -> String {
        "\(value) \(unit)\(value == 1 ? "" : "s")"
    }
}
