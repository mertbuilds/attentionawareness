import Foundation

/// One app the profile hides from the home screen. Supervised phones only.
struct BlockedApp: Codable, Equatable, Sendable {
    let bundleId: String
    let name: String
    /// Apple's developer website, kept so the app's sites can be derived.
    /// Left out of the request when it is nil, the way the site leaves it out.
    var sellerUrl: String?
}

/// What Safari is allowed to open. `off` asks for no filter payload at all;
/// the other two are the two shapes the payload comes in.
enum WebFilter: Equatable, Sendable {
    /// Everything except the listed sites, with a few holes punched in it.
    case deny(deniedUrls: [String], permittedUrls: [String])
    /// The listed sites and nothing else.
    case allow(allowedUrls: [String])
    case off
}

/// The profile the site is asked to sign.
///
/// Every field is named the way `apps/web/src/lib/profile/types.ts` names it,
/// because this struct is encoded straight into the body `POST /api/sign`
/// validates field by field. A rename on either side has to happen on both.
///
/// Three of the fields are the server's to decide and are overwritten there:
/// `displayName`, `organization` and `identifier`, which is re-minted per
/// download so a second profile stacks on the first rather than replacing it.
struct ProfileConfig: Codable, Equatable, Sendable {
    /// `allowAppInstallation`: whether the App Store stays available.
    var allowAppStore: Bool
    /// Inverse of `SafariHistoryRetentionEnabled`.
    var allowPrivateBrowsing: Bool
    /// `AutoFilterEnabled`: Apple's adult-content heuristic. Deny mode only.
    var autoFilterAdult: Bool
    /// `blockedAppBundleIDs`.
    var blockedApps: [BlockedApp]
    /// `PayloadDisplayName`.
    var displayName: String
    /// Reverse-domain `PayloadIdentifier`.
    var identifier: String
    /// `PayloadRemovalDisallowed`: keeps the profile from being deleted on the
    /// phone. Off is trial mode.
    var lockRemoval: Bool
    /// `PayloadOrganization`, shown in Settings.
    var organization: String
    var webFilter: WebFilter
}

extension ProfileConfig {
    /// What the app installs unless the two toggles say otherwise: the ten
    /// feed apps and their sites.
    ///
    /// Copied verbatim from the `mert` preset in
    /// `apps/web/src/lib/profile/presets.ts`, which is where the list is
    /// decided. The two are edited together.
    static let `default` = ProfileConfig(
        allowAppStore: true,
        allowPrivateBrowsing: true,
        autoFilterAdult: true,
        // Only apps built around a vertical feed, ordered by average time per
        // user per day (Sensor Tower State of Mobile 2026, DataReportal
        // Digital 2026).
        blockedApps: [
            BlockedApp(bundleId: "com.zhiliaoapp.musically", name: "TikTok"),
            BlockedApp(bundleId: "com.google.ios.youtube", name: "YouTube"),
            BlockedApp(bundleId: "com.burbn.instagram", name: "Instagram"),
            BlockedApp(bundleId: "com.atebits.Tweetie2", name: "X"),
            BlockedApp(bundleId: "com.facebook.Facebook", name: "Facebook"),
            BlockedApp(bundleId: "com.toyopagroup.picaboo", name: "Snapchat"),
            BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit"),
            BlockedApp(bundleId: "pinterest", name: "Pinterest"),
            BlockedApp(bundleId: "com.burbn.barcelona", name: "Threads"),
            BlockedApp(bundleId: "com.linkedin.LinkedIn", name: "LinkedIn"),
        ],
        displayName: "attentionawareness",
        identifier: "com.attentionawareness.profile",
        lockRemoval: true,
        organization: "attentionawareness",
        webFilter: .deny(
            deniedUrls: [
                "https://tiktok.com",
                "https://www.youtube.com",
                "https://m.youtube.com",
                "https://youtu.be",
                "https://instagram.com",
                "https://x.com",
                "https://twitter.com",
                "https://facebook.com",
                "https://snapchat.com",
                "https://reddit.com",
                "https://pinterest.com",
                "https://threads.net",
                "https://www.threads.com",
                "https://linkedin.com",
            ],
            // Sign-in for YouTube on other devices still has to resolve.
            permittedUrls: ["https://accounts.youtube.com"]
        )
    )
}

/// The filter is a tagged union on the wire: `mode` says which one it is, and
/// the lists that belong to that mode sit beside it.
extension WebFilter: Codable {
    private enum CodingKeys: String, CodingKey {
        case allowedUrls
        case deniedUrls
        case mode
        case permittedUrls
    }

    private enum Mode: String, Codable {
        case allow
        case deny
        case off
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Mode.self, forKey: .mode) {
        case .deny:
            self = .deny(
                deniedUrls: try container.decode([String].self, forKey: .deniedUrls),
                permittedUrls: try container.decode([String].self, forKey: .permittedUrls)
            )
        case .allow:
            self = .allow(allowedUrls: try container.decode([String].self, forKey: .allowedUrls))
        case .off:
            self = .off
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .deny(let deniedUrls, let permittedUrls):
            try container.encode(Mode.deny, forKey: .mode)
            try container.encode(deniedUrls, forKey: .deniedUrls)
            try container.encode(permittedUrls, forKey: .permittedUrls)
        case .allow(let allowedUrls):
            try container.encode(Mode.allow, forKey: .mode)
            try container.encode(allowedUrls, forKey: .allowedUrls)
        case .off:
            try container.encode(Mode.off, forKey: .mode)
        }
    }
}
