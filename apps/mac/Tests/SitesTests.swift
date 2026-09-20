import XCTest

/// The sites a blocked app implies.
///
/// Hiding an app leaves its website open, so every app the profile blocks has
/// to contribute its sites to the web filter. What is checked here is the two
/// halves of that: the curated table, which carries the domains Apple's single
/// developer website cannot, and the tidying that turns whatever Apple answers
/// into a url iOS will match on.
final class SitesTests: XCTestCase {
    // MARK: - The shape a url takes in a profile

    func testABareDomainGetsAScheme() {
        XCTAssertEqual(Sites.normalize("reddit.com"), "https://reddit.com")
    }

    func testASchemeAlreadyThereIsLeftAlone() {
        XCTAssertEqual(Sites.normalize("http://reddit.com"), "http://reddit.com")
        XCTAssertEqual(Sites.normalize("HTTPS://reddit.com"), "HTTPS://reddit.com")
        XCTAssertEqual(Sites.normalize("x-y+z.1://reddit.com"), "x-y+z.1://reddit.com")
    }

    func testSomethingThatOnlyLooksLikeASchemeStillGetsOne() {
        XCTAssertEqual(Sites.normalize("1abc://reddit.com"), "https://1abc://reddit.com")
        XCTAssertEqual(Sites.normalize("://reddit.com"), "https://://reddit.com")
    }

    func testATrailingSlashComesOff() {
        XCTAssertEqual(Sites.normalize("https://reddit.com/"), "https://reddit.com")
        XCTAssertEqual(Sites.normalize("reddit.com/"), "https://reddit.com")
    }

    func testAUrlComesBackTrimmed() {
        XCTAssertEqual(Sites.normalize("  reddit.com  "), "https://reddit.com")
    }

    func testNothingNormalizesToNothing() {
        XCTAssertEqual(Sites.normalize(""), "")
        XCTAssertEqual(Sites.normalize("   "), "")
    }

    // MARK: - The host behind a developer website

    func testADeveloperPageIsTheSiteItSitsOn() {
        XCTAssertEqual(
            Sites.host(fromSellerUrl: "https://www.reddit.com/mobile/download"),
            "reddit.com"
        )
        XCTAssertEqual(Sites.host(fromSellerUrl: "http://instagram.com/"), "instagram.com")
        XCTAssertEqual(Sites.host(fromSellerUrl: "instagram.com"), "instagram.com")
    }

    func testThePrefixesThatServeTheSameSiteComeOff() {
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://www.tiktok.com"), "tiktok.com")
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://m.facebook.com"), "facebook.com")
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://mobile.twitter.com"), "twitter.com")
    }

    func testOnlyTheFirstPrefixComesOff() {
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://www.m.example.com"), "m.example.com")
    }

    func testAHostComesBackLowercaseWithoutItsPortOrItsUser() {
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://WWW.Example.COM"), "example.com")
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://example.com:8080/x"), "example.com")
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://user@example.com/x"), "example.com")
    }

    func testAHyphenInsideALabelIsAFineHost() {
        XCTAssertEqual(Sites.host(fromSellerUrl: "https://my-site.co.uk/x"), "my-site.co.uk")
    }

    func testAValueThatNamesNoPublicSiteBlocksNothing() {
        XCTAssertNil(Sites.host(fromSellerUrl: nil))
        XCTAssertNil(Sites.host(fromSellerUrl: ""))
        XCTAssertNil(Sites.host(fromSellerUrl: "   "))
        XCTAssertNil(Sites.host(fromSellerUrl: "https://not a url"))
        XCTAssertNil(Sites.host(fromSellerUrl: "https://"))
    }

    func testASiteOnThePhoneItselfIsNotASiteToBlock() {
        XCTAssertNil(Sites.host(fromSellerUrl: "http://localhost:3000"))
        XCTAssertNil(Sites.host(fromSellerUrl: "https://intranet"))
    }

    func testABareAddressNamesAMachineRatherThanASite() {
        XCTAssertNil(Sites.host(fromSellerUrl: "http://127.0.0.1"))
        XCTAssertNil(Sites.host(fromSellerUrl: "http://192.168.1.1/setup"))
    }

    func testAMalformedHostIsNotASiteToBlock() {
        XCTAssertNil(Sites.host(fromSellerUrl: "https://example.com."))
        XCTAssertNil(Sites.host(fromSellerUrl: "https://-example.com"))
        XCTAssertNil(Sites.host(fromSellerUrl: "https://example-.com"))
    }

    // MARK: - What one app implies

    func testACuratedAppCarriesEverySiteApplesOneUrlCannot() {
        let sites = Sites.sites(forApp: "com.atebits.Tweetie2", sellerUrl: "https://x.com")
        XCTAssertEqual(sites.source, .curated)
        XCTAssertEqual(sites.sites, ["https://x.com", "https://twitter.com", "https://t.co"])
    }

    func testAnAppWithNoCuratedEntryFallsBackToItsDeveloperWebsite() {
        let sites = Sites.sites(
            forApp: "com.example.notcurated",
            sellerUrl: "https://www.example.com/app"
        )
        XCTAssertEqual(sites.source, .seller)
        XCTAssertEqual(sites.sites, ["https://example.com"])
    }

    func testAnAppWithNeitherImpliesNoSiteAtAll() {
        let sites = Sites.sites(forApp: "com.example.notcurated")
        XCTAssertEqual(sites.source, SiteSource.none)
        XCTAssertEqual(sites.sites, [])
        XCTAssertEqual(Sites.sites(forApp: "com.example.notcurated", sellerUrl: "localhost").sites, [])
    }

    // MARK: - What a whole blocked list implies

    func testTheSitesFollowTheOrderTheAppsWerePickedIn() {
        let sites = Sites.sites(forApps: [
            BlockedApp(bundleId: "com.burbn.instagram", name: "Instagram"),
            BlockedApp(bundleId: "tv.twitch", name: "Twitch"),
        ])
        XCTAssertEqual(sites, ["https://instagram.com", "https://twitch.tv"])
    }

    func testASiteTwoAppsShareIsListedOnce() {
        let sites = Sites.sites(forApps: [
            BlockedApp(bundleId: "com.atebits.Tweetie2", name: "X"),
            BlockedApp(bundleId: "com.example.one", name: "One", sellerUrl: "https://www.x.com"),
        ])
        XCTAssertEqual(sites, ["https://x.com", "https://twitter.com", "https://t.co"])
    }

    func testEverySiteIsWrittenTheWayTheProfileWritesIt() {
        let sites = Sites.sites(forApps: [
            BlockedApp(bundleId: "com.example.one", name: "One", sellerUrl: "www.example.com/app/"),
        ])
        XCTAssertEqual(sites, ["https://example.com"])
    }

    func testAnAppThatImpliesNothingAddsNothing() {
        XCTAssertEqual(Sites.sites(forApps: []), [])
        XCTAssertEqual(
            Sites.sites(forApps: [BlockedApp(bundleId: "com.example.one", name: "One")]),
            []
        )
    }

    // MARK: - The curated table

    func testEveryCuratedUrlIsAlreadyInTheShapeAProfileWantsIt() {
        // The profile normalizes before it writes the filter. A curated url
        // that needs normalizing is a drift, and it would reach iOS as an
        // entry the filter quietly ignores.
        for (bundleId, sites) in Sites.curated {
            XCTAssertFalse(sites.isEmpty, "\(bundleId) names no site")
            for site in sites {
                XCTAssertEqual(Sites.normalize(site), site, "\(site) is not normalized")
                XCTAssertTrue(site.hasPrefix("https://"), "\(site) is not https")
            }
        }
    }

    func testNoCuratedAppNamesTheSameSiteTwice() {
        for (bundleId, sites) in Sites.curated {
            XCTAssertEqual(Set(sites).count, sites.count, "\(bundleId) names a site twice")
        }
    }

    func testEveryAppTheDefaultProfileBlocksCarriesItsOwnSites() {
        for app in ProfileConfig.default.blockedApps {
            XCTAssertEqual(
                Sites.sites(forApp: app.bundleId).source,
                .curated,
                "\(app.name) has no curated sites"
            )
        }
    }
}
