import XCTest

/// The body the app sends to `POST /api/sign`.
///
/// The route validates that body field by field and refuses everything it does
/// not recognise, so the names in this JSON are the contract between the app
/// and `apps/web/src/lib/profile/types.ts`. These are the tests that notice
/// when one side is renamed without the other.
final class ProfileConfigTests: XCTestCase {
    private func encoded(_ config: ProfileConfig) throws -> [String: Any] {
        let data = try JSONEncoder().encode(config)
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    // MARK: - The names the site validates

    func testTheConfigCarriesEveryFieldTheSiteAsksForAndNoOther() throws {
        XCTAssertEqual(
            Set(try encoded(.default).keys),
            [
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

    func testAnAppIsABundleIdentifierAndAName() throws {
        let apps = try XCTUnwrap(try encoded(.default)["blockedApps"] as? [[String: Any]])
        XCTAssertEqual(apps.count, 10)
        for app in apps {
            // sellerUrl is optional on both sides, and none of the ten has one,
            // so it is left out rather than sent as null.
            XCTAssertEqual(Set(app.keys), ["bundleId", "name"])
        }
        XCTAssertEqual(apps.first?["bundleId"] as? String, "com.zhiliaoapp.musically")
        XCTAssertEqual(apps.first?["name"] as? String, "TikTok")
    }

    func testTheFilterSaysWhichModeItIsAndCarriesThatModesLists() throws {
        let filter = try XCTUnwrap(try encoded(.default)["webFilter"] as? [String: Any])
        XCTAssertEqual(Set(filter.keys), ["deniedUrls", "mode", "permittedUrls"])
        XCTAssertEqual(filter["mode"] as? String, "deny")
        let denied = try XCTUnwrap(filter["deniedUrls"] as? [String])
        XCTAssertEqual(denied.count, 14)
        XCTAssertTrue(denied.contains("https://x.com"))
        // Signing in to YouTube on another device still has to resolve.
        XCTAssertEqual(filter["permittedUrls"] as? [String], ["https://accounts.youtube.com"])
    }

    func testTheOtherTwoModesCarryOnlyWhatBelongsToThem() throws {
        var config = ProfileConfig.default
        config.webFilter = .allow(allowedUrls: ["https://wikipedia.org"])
        let allow = try XCTUnwrap(try encoded(config)["webFilter"] as? [String: Any])
        XCTAssertEqual(Set(allow.keys), ["allowedUrls", "mode"])
        XCTAssertEqual(allow["mode"] as? String, "allow")

        config.webFilter = .off
        let off = try XCTUnwrap(try encoded(config)["webFilter"] as? [String: Any])
        XCTAssertEqual(Set(off.keys), ["mode"])
        XCTAssertEqual(off["mode"] as? String, "off")
    }

    // MARK: - What the default profile is

    func testTheDefaultLocksItselfOnAndFiltersAdultSites() throws {
        let json = try encoded(.default)
        XCTAssertEqual(json["lockRemoval"] as? Bool, true)
        XCTAssertEqual(json["autoFilterAdult"] as? Bool, true)
        XCTAssertEqual(json["allowAppStore"] as? Bool, true)
        XCTAssertEqual(json["allowPrivateBrowsing"] as? Bool, true)
        XCTAssertEqual(json["displayName"] as? String, "attentionawareness")
        XCTAssertEqual(json["organization"] as? String, "attentionawareness")
    }

    func testAConfigSurvivesTheRoundTrip() throws {
        let data = try JSONEncoder().encode(ProfileConfig.default)
        XCTAssertEqual(try JSONDecoder().decode(ProfileConfig.self, from: data), .default)
    }

    // MARK: - What comes back when the site says no

    func testARefusalIsReadBackAsTheSitesOwnWords() throws {
        let body = Data(#"{"error":"too many requests"}"#.utf8)
        let refusal = try JSONDecoder().decode(ProfileSigner.ErrorBody.self, from: body)
        XCTAssertEqual(refusal.error, "too many requests")
        XCTAssertEqual(
            ProfileError.rejected("It said: \(refusal.error).").localizedDescription,
            "The site did not sign the profile. It said: too many requests."
        )
    }

    func testTheSiteIsProductionUnlessTheEnvironmentMovesIt() {
        XCTAssertEqual(
            ProfileSigner(environment: [:]).site.absoluteString,
            "https://attentionawareness.com"
        )
        XCTAssertFalse(ProfileSigner(environment: [:]).trustsSelfSignedCertificate)

        let dev = ProfileSigner(environment: [
            ProfileSigner.siteVariable: "https://attentionawareness.localhost",
        ])
        XCTAssertEqual(dev.site.absoluteString, "https://attentionawareness.localhost")
        XCTAssertTrue(dev.trustsSelfSignedCertificate)
    }
}
