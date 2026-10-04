import Foundation
import Testing

/// The sites a blocked app implies.
///
/// Hiding an app leaves its website open, so every app the profile blocks has
/// to contribute its sites to the web filter. What is checked here is the two
/// halves of that: the curated table, which carries the domains Apple's single
/// developer website cannot, and the tidying that turns whatever Apple answers
/// into a url iOS will match on.
struct SitesTests {
    // MARK: - The shape a url takes in a profile

    @Test func aBareDomainGetsAScheme() {
        #expect(Sites.normalize("reddit.com") == "https://reddit.com")
    }

    @Test func aSchemeAlreadyThereIsLeftAlone() {
        #expect(Sites.normalize("http://reddit.com") == "http://reddit.com")
        #expect(Sites.normalize("HTTPS://reddit.com") == "HTTPS://reddit.com")
        #expect(Sites.normalize("x-y+z.1://reddit.com") == "x-y+z.1://reddit.com")
    }

    @Test func somethingThatOnlyLooksLikeASchemeStillGetsOne() {
        #expect(Sites.normalize("1abc://reddit.com") == "https://1abc://reddit.com")
        #expect(Sites.normalize("://reddit.com") == "https://://reddit.com")
    }

    @Test func aTrailingSlashComesOff() {
        #expect(Sites.normalize("https://reddit.com/") == "https://reddit.com")
        #expect(Sites.normalize("reddit.com/") == "https://reddit.com")
    }

    @Test func aUrlComesBackTrimmed() {
        #expect(Sites.normalize("  reddit.com  ") == "https://reddit.com")
    }

    @Test func nothingNormalizesToNothing() {
        #expect(Sites.normalize("") == "")
        #expect(Sites.normalize("   ") == "")
    }

    // MARK: - The host behind a developer website

    @Test func aDeveloperPageIsTheSiteItSitsOn() {
        #expect(
            Sites.host(fromSellerUrl: "https://www.reddit.com/mobile/download")
                == "reddit.com"
        )
        #expect(Sites.host(fromSellerUrl: "http://instagram.com/") == "instagram.com")
        #expect(Sites.host(fromSellerUrl: "instagram.com") == "instagram.com")
    }

    @Test func thePrefixesThatServeTheSameSiteComeOff() {
        #expect(Sites.host(fromSellerUrl: "https://www.tiktok.com") == "tiktok.com")
        #expect(Sites.host(fromSellerUrl: "https://m.facebook.com") == "facebook.com")
        #expect(Sites.host(fromSellerUrl: "https://mobile.twitter.com") == "twitter.com")
    }

    @Test func onlyTheFirstPrefixComesOff() {
        #expect(Sites.host(fromSellerUrl: "https://www.m.example.com") == "m.example.com")
    }

    @Test func aHostComesBackLowercaseWithoutItsPortOrItsUser() {
        #expect(Sites.host(fromSellerUrl: "https://WWW.Example.COM") == "example.com")
        #expect(Sites.host(fromSellerUrl: "https://example.com:8080/x") == "example.com")
        #expect(Sites.host(fromSellerUrl: "https://user@example.com/x") == "example.com")
    }

    @Test func aHyphenInsideALabelIsAFineHost() {
        #expect(Sites.host(fromSellerUrl: "https://my-site.co.uk/x") == "my-site.co.uk")
    }

    @Test func aValueThatNamesNoPublicSiteBlocksNothing() {
        #expect(Sites.host(fromSellerUrl: nil) == nil)
        #expect(Sites.host(fromSellerUrl: "") == nil)
        #expect(Sites.host(fromSellerUrl: "   ") == nil)
        #expect(Sites.host(fromSellerUrl: "https://not a url") == nil)
        #expect(Sites.host(fromSellerUrl: "https://") == nil)
    }

    @Test func aSiteOnThePhoneItselfIsNotASiteToBlock() {
        #expect(Sites.host(fromSellerUrl: "http://localhost:3000") == nil)
        #expect(Sites.host(fromSellerUrl: "https://intranet") == nil)
    }

    @Test func aBareAddressNamesAMachineRatherThanASite() {
        #expect(Sites.host(fromSellerUrl: "http://127.0.0.1") == nil)
        #expect(Sites.host(fromSellerUrl: "http://192.168.1.1/setup") == nil)
    }

    @Test func aMalformedHostIsNotASiteToBlock() {
        #expect(Sites.host(fromSellerUrl: "https://example.com.") == nil)
        #expect(Sites.host(fromSellerUrl: "https://-example.com") == nil)
        #expect(Sites.host(fromSellerUrl: "https://example-.com") == nil)
    }

    // MARK: - What one app implies

    @Test func aCuratedAppCarriesEverySiteApplesOneUrlCannot() {
        let sites = Sites.sites(forApp: "com.atebits.Tweetie2", sellerUrl: "https://x.com")
        #expect(sites.source == .curated)
        #expect(sites.sites == ["https://x.com", "https://twitter.com", "https://t.co"])
    }

    @Test func anAppWithNoCuratedEntryFallsBackToItsDeveloperWebsite() {
        let sites = Sites.sites(
            forApp: "com.example.notcurated",
            sellerUrl: "https://www.example.com/app"
        )
        #expect(sites.source == .seller)
        #expect(sites.sites == ["https://example.com"])
    }

    @Test func anAppWithNeitherImpliesNoSiteAtAll() {
        let sites = Sites.sites(forApp: "com.example.notcurated")
        #expect(sites.source == SiteSource.none)
        #expect(sites.sites == [])
        #expect(Sites.sites(forApp: "com.example.notcurated", sellerUrl: "localhost").sites == [])
    }

    // MARK: - What a whole blocked list implies

    @Test func theSitesFollowTheOrderTheAppsWerePickedIn() {
        let sites = Sites.sites(forApps: [
            BlockedApp(bundleId: "com.burbn.instagram", name: "Instagram"),
            BlockedApp(bundleId: "tv.twitch", name: "Twitch"),
        ])
        #expect(sites == ["https://instagram.com", "https://twitch.tv"])
    }

    @Test func aSiteTwoAppsShareIsListedOnce() {
        let sites = Sites.sites(forApps: [
            BlockedApp(bundleId: "com.atebits.Tweetie2", name: "X"),
            BlockedApp(bundleId: "com.example.one", name: "One", sellerUrl: "https://www.x.com"),
        ])
        #expect(sites == ["https://x.com", "https://twitter.com", "https://t.co"])
    }

    @Test func everySiteIsWrittenTheWayTheProfileWritesIt() {
        let sites = Sites.sites(forApps: [
            BlockedApp(bundleId: "com.example.one", name: "One", sellerUrl: "www.example.com/app/"),
        ])
        #expect(sites == ["https://example.com"])
    }

    @Test func anAppThatImpliesNothingAddsNothing() {
        #expect(Sites.sites(forApps: []) == [])
        #expect(
            Sites.sites(forApps: [BlockedApp(bundleId: "com.example.one", name: "One")]) == []
        )
    }

    // MARK: - The curated table

    @Test func everyCuratedUrlIsAlreadyInTheShapeAProfileWantsIt() {
        // The profile normalizes before it writes the filter. A curated url
        // that needs normalizing is a drift, and it would reach iOS as an
        // entry the filter quietly ignores.
        for (bundleId, sites) in Sites.curated {
            #expect(sites.isEmpty == false, "\(bundleId) names no site")
            for site in sites {
                #expect(Sites.normalize(site) == site, "\(site) is not normalized")
                #expect(site.hasPrefix("https://"), "\(site) is not https")
            }
        }
    }

    @Test func noCuratedAppNamesTheSameSiteTwice() {
        for (bundleId, sites) in Sites.curated {
            #expect(Set(sites).count == sites.count, "\(bundleId) names a site twice")
        }
    }

    @Test func everyAppTheDefaultProfileBlocksCarriesItsOwnSites() {
        for app in ProfileConfig.default.blockedApps {
            #expect(
                Sites.sites(forApp: app.bundleId).source == .curated,
                "\(app.name) has no curated sites"
            )
        }
    }
}
