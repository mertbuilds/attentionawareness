import Foundation

/// Where the sites of one app came from, so the window can say how sure it is.
enum SiteSource: String, Equatable, Sendable {
    case curated
    case seller
    case none
}

/// The sites one app implies, and how they were arrived at.
struct AppSites: Equatable, Sendable {
    let sites: [String]
    let source: SiteSource
}

/// The sites a blocked app implies, and the shape a url takes in a profile.
///
/// Hiding an app does nothing about its website, so every app the profile
/// blocks contributes its sites to the web filter.
enum Sites {
    /// The sites that belong to an app, for the apps whose developer website
    /// does not name them all: short links (t.co, youtu.be), alternate domains
    /// and the mobile hosts. iOS's BuiltIn filter matches by host and covers a
    /// host's subdomains, so an entry is one registrable domain, plus the
    /// mobile hosts that are worth naming even though the domain already
    /// covers them, because they are what a phone actually opens.
    static let curated: [String: [String]] = [
        "AlexisBarreyat.BeReal": ["https://bereal.com"],
        "com.9gag.ios.mobile": ["https://9gag.com"],
        "com.amazon.aiv.AIVApp": ["https://primevideo.com"],
        "com.atebits.Tweetie2": ["https://x.com", "https://twitter.com", "https://t.co"],
        "com.burbn.barcelona": ["https://threads.net", "https://threads.com"],
        "com.burbn.instagram": ["https://instagram.com"],
        "com.disney.disneyplus": ["https://disneyplus.com"],
        "com.facebook.Facebook": [
            "https://facebook.com",
            "https://fb.com",
            "https://m.facebook.com",
            "https://fb.watch",
        ],
        "com.facebook.Messenger": ["https://messenger.com"],
        "com.google.ios.youtube": [
            "https://youtube.com",
            "https://m.youtube.com",
            "https://youtu.be",
        ],
        "com.google.ios.youtubekids": ["https://youtubekids.com"],
        "com.google.ios.youtubemusic": ["https://music.youtube.com"],
        "com.hammerandchisel.discord": ["https://discord.com", "https://discord.gg"],
        "com.hulu.plus": ["https://hulu.com"],
        "com.kick.mobile": ["https://kick.com"],
        "com.linkedin.LinkedIn": ["https://linkedin.com"],
        "com.netflix.Netflix": ["https://netflix.com"],
        "com.reddit.Reddit": [
            "https://reddit.com",
            "https://redd.it",
            "https://old.reddit.com",
        ],
        "com.toyopagroup.picaboo": ["https://snapchat.com"],
        "com.tumblr.tumblr": ["https://tumblr.com"],
        "com.zhiliaoapp.musically": ["https://tiktok.com", "https://vm.tiktok.com"],
        "imgurmobile": ["https://imgur.com"],
        "pinterest": ["https://pinterest.com", "https://pin.it"],
        "tv.twitch": ["https://twitch.tv"],
    ]

    /// The shape a url takes inside a profile: a scheme in front, no trailing
    /// slash. The site normalizes the same way before it writes the filter, so
    /// a drift between the two shows up as a filter entry iOS quietly ignores.
    static func normalize(_ url: String) -> String {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return ""
        }
        let withScheme = hasScheme(trimmed) ? trimmed : "https://\(trimmed)"
        return withScheme.hasSuffix("/") ? String(withScheme.dropLast()) : withScheme
    }

    /// The blockable host behind an App Store developer website:
    /// `https://www.reddit.com/mobile/download` is reddit.com. Path, query and
    /// the `www.`, `m.` and `mobile.` prefixes all name the same site the bare
    /// domain does. A value that names no public site (empty, malformed,
    /// localhost, a bare IP) blocks nothing, so it is nil.
    static func host(fromSellerUrl url: String?) -> String? {
        let trimmed = url?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if trimmed.isEmpty {
            return nil
        }
        let withScheme = hasScheme(trimmed) ? trimmed : "https://\(trimmed)"
        guard let hostname = URL(string: withScheme)?.host?.lowercased() else {
            return nil
        }
        let host = withoutPrefix(hostname)
        guard !isIPv4(host), isPublicHost(host) else {
            return nil
        }
        return host
    }

    /// The sites one blocked app implies. A curated entry wins: it carries the
    /// domains Apple's single `sellerUrl` cannot. Everything else falls back to
    /// that seller url, which names the right site often enough to beat
    /// blocking nothing, and says so through `source` so the window can mark
    /// it as a guess.
    static func sites(forApp bundleId: String, sellerUrl: String? = nil) -> AppSites {
        if let curated = curated[bundleId] {
            return AppSites(sites: curated, source: .curated)
        }
        guard let host = host(fromSellerUrl: sellerUrl) else {
            return AppSites(sites: [], source: .none)
        }
        return AppSites(sites: ["https://\(host)"], source: .seller)
    }

    /// Every site the blocked apps imply, in the order the apps were picked,
    /// normalized the way the profile writes them and listed once each.
    static func sites(forApps apps: [BlockedApp]) -> [String] {
        var seen = Set<String>()
        var sites: [String] = []
        for app in apps {
            for site in self.sites(forApp: app.bundleId, sellerUrl: app.sellerUrl).sites {
                let url = normalize(site)
                if !url.isEmpty, seen.insert(url).inserted {
                    sites.append(url)
                }
            }
        }
        return sites
    }

    /// Whether a url already carries a scheme, e.g. `http://`. This app has no
    /// regular expressions, so `^[a-z][a-z0-9+.-]*://` is spelled out: a
    /// letter, then letters, digits and `+-.`, up to the first `://`.
    private static func hasScheme(_ url: String) -> Bool {
        guard let separator = url.range(of: "://") else {
            return false
        }
        let scheme = url[..<separator.lowerBound]
        guard let first = scheme.first, first.isASCII, first.isLetter else {
            return false
        }
        return scheme.dropFirst().allSatisfy { character in
            character.isASCII
                && (character.isLetter || character.isNumber || "+-.".contains(character))
        }
    }

    /// A host without the prefix that serves the same site as the bare domain.
    /// Only the first one is taken off, the way the site's own `^(?:www|m|
    /// mobile)\.` does, so `www.m.example.com` keeps its `m.`.
    private static func withoutPrefix(_ host: String) -> String {
        for prefix in ["www.", "m.", "mobile."] where host.hasPrefix(prefix) {
            return String(host.dropFirst(prefix.count))
        }
        return host
    }

    /// A public domain name: two or more dot separated labels, each starting
    /// and ending on a letter or a digit, hyphens allowed in between. It is
    /// what rules out `localhost`, which names a site on the phone itself.
    private static func isPublicHost(_ host: String) -> Bool {
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        return labels.count >= 2 && labels.allSatisfy(isHostLabel)
    }

    private static func isHostLabel(_ label: Substring) -> Bool {
        guard let first = label.first, let last = label.last else {
            return false
        }
        guard isHostCharacter(first), isHostCharacter(last) else {
            return false
        }
        return label.allSatisfy { isHostCharacter($0) || $0 == "-" }
    }

    private static func isHostCharacter(_ character: Character) -> Bool {
        ("a"..."z").contains(character) || ("0"..."9").contains(character)
    }

    /// A bare IPv4 address, which names a machine rather than a site.
    private static func isIPv4(_ host: String) -> Bool {
        let parts = host.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 4 else {
            return false
        }
        return parts.allSatisfy { part in
            (1...3).contains(part.count) && part.allSatisfy { ("0"..."9").contains($0) }
        }
    }
}
