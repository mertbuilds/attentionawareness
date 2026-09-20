import Foundation

/// One App Store country, as the picker lists it.
struct Storefront: Equatable, Sendable {
    /// The ISO 3166-1 alpha-2 code Apple's `country` parameter takes.
    let code: String
    /// The English name of the country.
    let label: String

    /// The country's flag, or nothing when the code names no country.
    var flag: String { Storefronts.flag(for: code) }
}

/// Every country the App Store ships to.
///
/// Results are storefront-scoped: an app missing from one country's store is
/// absent from its results, so the user picks the store they actually install
/// from rather than the one this Mac happens to be set to.
enum Storefronts {
    /// The store a search asks when the user has not picked one.
    static let fallback = "us"

    /// Every storefront, as ISO 3166-1 alpha-2 codes.
    static let codes: [String] = """
        af al dz ao ai ag ar am au at az bs bh bb by be
        bz bj bm bt bo ba bw br vg bn bg bf kh cm ca cv
        ky td cl cn co cr ci hr cy cz dk dm do ec eg sv
        gq ee sz et fj fi fr ga gm ge de gh gr gd gt gw
        gy hn hk hu is in id iq ie il it jm jp jo kz ke
        kr xk kw kg la lv lb lr ly lt lu mo mg mw my mv
        ml mt mr mu mx fm md mn me ms ma mz mm na np nl
        nz ni ne ng mk no om pk pw pa pg py pe ph pl pt
        qa ro ru rw kn lc vc ws sa sn rs sc sl sg sk si
        sb za es lk sr se ch st tw tj tz th to tt tn tr
        tm tc ug ua ae gb us uy uz vu ve vn ye zm zw
        """
        .split(whereSeparator: \.isWhitespace)
        .map(String.init)

    /// The storefronts as the picker lists them: named, and sorted by name.
    static let all: [Storefront] = codes
        .map { Storefront(code: $0, label: label(for: $0)) }
        .sorted { left, right in
            left.label.compare(right.label, options: [], range: nil, locale: english)
                == .orderedAscending
        }

    /// Storefront to search first, taken from the region of the Mac's locale
    /// (`tr-TR` gives `tr`). A locale that names no region (`en`) falls back to
    /// the US store.
    static func current(_ locale: Locale = .current) -> String {
        guard let region = locale.region?.identifier, !region.isEmpty else {
            return fallback
        }
        return region.lowercased()
    }

    /// The English name of a storefront: `tr` is Türkiye. A code the system
    /// cannot name, and anything that is not a region code at all, is its own
    /// label, uppercased, so the picker never renders a blank row.
    static func label(for code: String) -> String {
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let known = overrides[normalized] {
            return known
        }
        let upper = normalized.uppercased()
        return english.localizedString(forRegionCode: upper) ?? upper
    }

    /// An ISO 3166-1 alpha-2 country code as its flag emoji: `tr` is the pair
    /// of regional indicator symbols fonts draw as 🇹🇷. Anything that is not
    /// two letters names no country, so it gets no flag.
    static func flag(for code: String) -> String {
        let letters = Array(
            code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().unicodeScalars
        )
        guard letters.count == 2, letters.allSatisfy({ ("A"..."Z").contains($0) }) else {
            return ""
        }
        var flag = String.UnicodeScalarView()
        for letter in letters {
            guard
                let indicator = Unicode.Scalar(letter.value - uppercaseA + regionalIndicatorA)
            else {
                return ""
            }
            flag.append(indicator)
        }
        return String(flag)
    }

    /// Storefronts the system carries no region name for, or names
    /// differently. Kept even where a given macOS does name one, so the picker
    /// reads the same on every machine.
    private static let overrides = ["xk": "Kosovo"]

    /// The labels are English on every Mac, because they are matched against
    /// what a reader types, not against the system language.
    private static let english = Locale(identifier: "en")

    /// Code point of 🇦, the regional indicator symbol the letter A maps to.
    private static let regionalIndicatorA: UInt32 = 127_462
    /// Code point of the ASCII letter A.
    private static let uppercaseA: UInt32 = 65
}
