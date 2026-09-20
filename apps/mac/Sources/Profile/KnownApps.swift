import Foundation

/// An app the table names, and the id it is blocked by. Apple's own carry none.
struct KnownApp: Equatable, Sendable {
    let bundleId: String?
    let name: String
    let system: Bool
}

/// The apps this app can name without asking the App Store.
///
/// A hit here costs no request, and it names the app the way the profile does,
/// which is what keeps a reader's blocked list spelled the same as the default
/// one. Everything else is searched for.
enum KnownApps {
    /// Apple's own apps. They have no App Store entry, and
    /// `blockedAppBundleIDs` does not hide them, so one is never offered as
    /// something to block: Safari is the web filter's job, and the phone has
    /// to keep answering calls.
    static let systemApps = [
        "Safari",
        "Messages",
        "Mail",
        "Phone",
        "Settings",
        "Maps",
        "Photos",
        "Camera",
        "Clock",
        "Calendar",
    ]

    /// The apps a Screen Time list is usually topped by, and every app the
    /// recommended profile blocks. Written as pairs rather than a dictionary
    /// because `names` lists them in this order and a Swift dictionary keeps
    /// none.
    static let storeApps: KeyValuePairs<String, String> = [
        "Discord": "com.hammerandchisel.discord",
        "Facebook": "com.facebook.Facebook",
        "Instagram": "com.burbn.instagram",
        "LinkedIn": "com.linkedin.LinkedIn",
        "Messenger": "com.facebook.Messenger",
        "Pinterest": "pinterest",
        "Reddit": "com.reddit.Reddit",
        "Snapchat": "com.toyopagroup.picaboo",
        "Telegram": "ph.telegra.Telegraph",
        "Threads": "com.burbn.barcelona",
        "TikTok": "com.zhiliaoapp.musically",
        "Twitch": "tv.twitch",
        "Twitter": "com.atebits.Tweetie2",
        "WhatsApp": "net.whatsapp.WhatsApp",
        "X": "com.atebits.Tweetie2",
        "YouTube": "com.google.ios.youtube",
    ]

    /// Apps the window lists but leaves unticked: the ones a day actually
    /// needs. The reader can still tick them, and the Apple ones among them
    /// are `system` anyway, which the picker says more plainly.
    static let keepApps = [
        "WhatsApp",
        "Messages",
        "Telegram",
        "Mail",
        "Maps",
        "Phone",
    ]

    /// Every app this table names.
    static let names: [String] = storeApps.map(\.key) + systemApps

    /// One name as a lookup key: no case, no diacritics, no punctuation. It is
    /// what makes "TikTok", "tiktok" and "Tik Tok" the same app.
    static func fold(_ name: String) -> String {
        // Compatibility decomposition first, so a composed "ö" becomes an "o"
        // and a mark the next step drops.
        let decomposed = name.decomposedStringWithCompatibilityMapping
        var withoutMarks = String.UnicodeScalarView()
        for scalar in decomposed.unicodeScalars where !isMark(scalar) {
            withoutMarks.append(scalar)
        }
        // The dotless Turkish i decomposes to nothing of its own, so it is
        // named here rather than left to the decomposition.
        let latin = String(withoutMarks).replacingOccurrences(of: "ı", with: "i").lowercased()
        var folded = String.UnicodeScalarView()
        for scalar in latin.unicodeScalars where isLetterOrNumber(scalar) {
            folded.append(scalar)
        }
        return String(folded)
    }

    /// What this table knows about a name, or nothing when it has never heard
    /// of it.
    static func known(_ name: String) -> KnownApp? {
        let key = fold(name)
        if let system = systemKeys[key] {
            return KnownApp(bundleId: nil, name: system, system: true)
        }
        guard let store = storeKeys[key] else {
            return nil
        }
        return KnownApp(bundleId: store.bundleId, name: store.name, system: false)
    }

    /// Whether an app is one the window lists but does not tick for the reader.
    static func keepByDefault(_ name: String) -> Bool {
        keepKeys.contains(fold(name))
    }

    private static let systemKeys: [String: String] = Dictionary(
        uniqueKeysWithValues: systemApps.map { (fold($0), $0) }
    )

    private static let storeKeys: [String: (bundleId: String, name: String)] = Dictionary(
        uniqueKeysWithValues: storeApps.map { (fold($0.key), (bundleId: $0.value, name: $0.key)) }
    )

    private static let keepKeys = Set(keepApps.map(fold))

    /// The combining marks a diacritic decomposes into, which is `\p{M}` on
    /// the site.
    private static func isMark(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.properties.generalCategory {
        case .nonspacingMark, .spacingMark, .enclosingMark:
            return true
        default:
            return false
        }
    }

    /// Everything a folded name keeps, which is `\p{L}` and `\p{N}` on the
    /// site. Spaces, dots and ampersands are what it drops.
    private static func isLetterOrNumber(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
            .decimalNumber, .letterNumber, .otherNumber:
            return true
        default:
            return false
        }
    }
}
