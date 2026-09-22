import Foundation
import Testing

/// The body the app sends to `POST /api/sign`.
///
/// The route validates that body field by field and refuses everything it does
/// not recognise, so the names in this JSON are the contract between the app
/// and `apps/web/src/lib/profile/types.ts`. These are the tests that notice
/// when one side is renamed without the other.
struct ProfileConfigTests {
    private func encoded(_ config: ProfileConfig) throws -> [String: Any] {
        let data = try JSONEncoder().encode(config)
        return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    // MARK: - The names the site validates

    @Test func theConfigCarriesEveryFieldTheSiteAsksForAndNoOther() throws {
        #expect(
            Set(try encoded(.default).keys) == [
                "allowAppStore",
                "allowPrivateBrowsing",
                "autoFilterAdult",
                "blockedApps",
                "displayName",
                "identifier",
                "lockRemoval",
                "organization",
                "webFilter",
            ]
        )
    }

    @Test func anAppIsABundleIdentifierAndAName() throws {
        let apps = try #require(try encoded(.default)["blockedApps"] as? [[String: Any]])
        #expect(apps.count == 10)
        for app in apps {
            // sellerUrl is optional on both sides, and none of the ten has one,
            // so it is left out rather than sent as null.
            #expect(Set(app.keys) == ["bundleId", "name"])
        }
        #expect(apps.first?["bundleId"] as? String == "com.zhiliaoapp.musically")
        #expect(apps.first?["name"] as? String == "TikTok")
    }

    @Test func theFilterSaysWhichModeItIsAndCarriesThatModesLists() throws {
        let filter = try #require(try encoded(.default)["webFilter"] as? [String: Any])
        #expect(Set(filter.keys) == ["deniedUrls", "mode", "permittedUrls"])
        #expect(filter["mode"] as? String == "deny")
        let denied = try #require(filter["deniedUrls"] as? [String])
        #expect(denied.count == 14)
        #expect(denied.contains("https://x.com"))
        // Signing in to YouTube on another device still has to resolve.
        #expect(filter["permittedUrls"] as? [String] == ["https://accounts.youtube.com"])
    }

    @Test func theOtherTwoModesCarryOnlyWhatBelongsToThem() throws {
        var config = ProfileConfig.default
        config.webFilter = .allow(allowedUrls: ["https://wikipedia.org"])
        let allow = try #require(try encoded(config)["webFilter"] as? [String: Any])
        #expect(Set(allow.keys) == ["allowedUrls", "mode"])
        #expect(allow["mode"] as? String == "allow")

        config.webFilter = .off
        let off = try #require(try encoded(config)["webFilter"] as? [String: Any])
        #expect(Set(off.keys) == ["mode"])
        #expect(off["mode"] as? String == "off")
    }

    // MARK: - What the default profile is

    @Test func theDefaultLocksItselfOnAndFiltersAdultSites() throws {
        let json = try encoded(.default)
        #expect(json["lockRemoval"] as? Bool == true)
        #expect(json["autoFilterAdult"] as? Bool == true)
        #expect(json["allowAppStore"] as? Bool == true)
        #expect(json["allowPrivateBrowsing"] as? Bool == true)
        #expect(json["displayName"] as? String == "attentionawareness")
        #expect(json["organization"] as? String == "attentionawareness")
    }

    @Test func aConfigSurvivesTheRoundTrip() throws {
        let data = try JSONEncoder().encode(ProfileConfig.default)
        #expect(try JSONDecoder().decode(ProfileConfig.self, from: data) == .default)
    }

    // MARK: - What comes back when the site says no

    @Test func aRefusalIsReadBackAsTheSitesOwnWords() throws {
        let body = Data(#"{"error":"too many requests"}"#.utf8)
        let refusal = try JSONDecoder().decode(ProfileSigner.ErrorBody.self, from: body)
        #expect(refusal.error == "too many requests")
        #expect(
            ProfileError.rejected("It said: \(refusal.error).").localizedDescription ==
            "The site did not sign the profile. It said: too many requests."
        )
    }

    @Test func theSiteIsProductionUnlessTheEnvironmentMovesIt() {
        #expect(ProfileSigner(environment: [:]).site.absoluteString == "https://attentionawareness.com")
        #expect(ProfileSigner(environment: [:]).trustsSelfSignedCertificate == false)

        let dev = ProfileSigner(environment: [
            ProfileSigner.siteVariable: "https://attentionawareness.localhost",
        ])
        #expect(dev.site.absoluteString == "https://attentionawareness.localhost")
        #expect(dev.trustsSelfSignedCertificate)
    }
}
