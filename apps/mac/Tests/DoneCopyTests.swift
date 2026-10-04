import Foundation
import Testing

/// The body of the last screen, in each of the things it can say.
///
/// The line under the title of that screen is worked out from the profile the
/// person built. So the counts are worth a table of their own: the two clauses
/// together, one on its own, and the plain line a stripped-down profile falls
/// back to. None of it reads an iPhone or builds a view.
struct DoneCopyTests {
    // MARK: - The result line

    @Test func aProfileThatHidesAppsAndBlocksSitesCountsBoth() {
        #expect(DoneCopy.result(apps: 9, sites: 20) == "9 apps and 20 websites are blocked.")
    }

    @Test func oneOfEachReadsInTheSingular() {
        #expect(DoneCopy.result(apps: 1, sites: 1) == "1 app and 1 website are blocked.")
    }

    @Test func noSitesDropsTheWebsiteClause() {
        #expect(DoneCopy.result(apps: 6, sites: 0) == "6 apps are blocked.")
        #expect(DoneCopy.result(apps: 1, sites: 0) == "1 app is blocked.")
    }

    @Test func noAppsSaysOnlyTheWebsites() {
        #expect(DoneCopy.result(apps: 0, sites: 5) == "5 websites are blocked.")
        #expect(DoneCopy.result(apps: 0, sites: 1) == "1 website is blocked.")
    }

    @Test func aStrippedProfileFallsBackToAPlainLine() {
        #expect(DoneCopy.result(apps: 0, sites: 0) == "Your restrictions are on.")
    }

    @Test func theOneThingLeftToDoIsToDisconnect() {
        #expect(DoneCopy.disconnect == "You can disconnect iPhone.")
    }

    // MARK: - What to do next

    @Test func theFirstRowOffersTheBrowserExtension() {
        #expect(DoneCopy.next == "Next")
        #expect(DoneCopy.browserExtension == "Block the same feeds on your computer")
        #expect(DoneCopy.getBrowserExtension == "Get the browser extension")
    }

    @Test func theSecondRowSaysTheAppIsFreeAndOffersSupportAndAShare() {
        #expect(DoneCopy.support == "The app is free. If it helps you, you can support the work.")
        #expect(DoneCopy.supportThisProject == "Support this project")
        #expect(DoneCopy.share == "Share")
    }

    @Test func theExtensionLinkOpensTheStoreListingWithItsCampaign() throws {
        let url = try #require(SiteLink.browserExtension)
        #expect(
            url.absoluteString
                == "https://chromewebstore.google.com/detail/attention-awareness/"
                + "lgcijcijcndmggjiioibfcmppndfakee"
                + "?utm_source=mac-app&utm_medium=referral&utm_campaign=done"
        )
    }

    @Test func theSupportLinkOpensThePayWhatYouWantPageWithItsCampaign() throws {
        let url = try #require(SiteLink.support)
        #expect(
            url.absoluteString
                == "https://buy.polar.sh/polar_cl_ftX1jafCvlNQXeQZRhjMjBLd2ChzzBp1LTIY63l0MBh"
                + "?utm_source=mac_app&utm_medium=app&utm_campaign=supervision_done"
        )
    }

    @Test func theShareLinkIsTheSiteWithItsCampaign() throws {
        let url = try #require(SiteLink.share)
        #expect(
            url.absoluteString
                == "https://attentionawareness.com/"
                + "?utm_source=share&utm_medium=mac_app&utm_campaign=supervision_done"
        )
    }

    // MARK: - The note behind the popover

    @Test func theNoteSaysWhereToLookForWhatTheRunSetUp() {
        #expect(
            DoneCopy.note == "Settings shows 'This iPhone is supervised' at the top."
        )
    }
}
