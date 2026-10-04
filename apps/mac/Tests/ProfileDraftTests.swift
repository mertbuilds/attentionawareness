import Foundation
import Testing

/// The profile the Restrictions screen builds.
///
/// It is the step without its window: the apps a reader picks, the sites those
/// apps imply, the ones the reader types, and what all of it turns into on the
/// way to the signer. What is checked here is the parts that decide what ends
/// up on the phone.
struct ProfileDraftTests {
    // MARK: - What the step starts on

    @Test func theRecommendedDraftIsTheProfileTheAppHasAlwaysInstalled() {
        let draft = ProfileDraft.recommended
        #expect(draft.blockedApps == ProfileConfig.default.blockedApps)
        #expect(draft.allowAppStore == ProfileConfig.default.allowAppStore)
        #expect(draft.allowPrivateBrowsing == ProfileConfig.default.allowPrivateBrowsing)
        #expect(draft.autoFilterAdult == ProfileConfig.default.autoFilterAdult)
        #expect(draft.config.lockRemoval == ProfileConfig.default.lockRemoval)
        #expect(draft.isRecommended)
    }

    @Test func theRecommendedSitesAreTheOnesItsAppsImply() {
        #expect(
            ProfileDraft.recommended.sites.map(\.url) == Sites.sites(forApps: ProfileConfig.default.blockedApps)
        )
    }

    // MARK: - Where a site came from

    @Test func aSiteTheTableNamesIsNotAGuess() {
        let draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        let reddit = draft.sites.first { $0.url == "https://reddit.com" }
        #expect(reddit?.app == "Reddit")
        #expect(reddit?.guessed == false)
    }

    @Test func aSiteFromTheDeveloperLinkIsMarkedAsAGuess() {
        let draft = draft(apps: [
            BlockedApp(
                bundleId: "com.duolingo.DuolingoMobile",
                name: "Duolingo",
                sellerUrl: "https://www.duolingo.com"
            ),
        ])
        #expect(draft.sites.map(\.url) == ["https://duolingo.com"])
        #expect(draft.sites.first?.guessed == true)
    }

    @Test func anAppWithNoTableEntryAndNoDeveloperLinkImpliesNoSites() {
        let draft = draft(apps: [BlockedApp(bundleId: "com.example.game", name: "Game")])
        #expect(draft.sites.isEmpty)
    }

    @Test func theHostIsTheUrlWithoutItsScheme() {
        #expect(DraftSite(url: "https://reddit.com", app: nil, guessed: false).host == "reddit.com")
        #expect(DraftSite(url: "reddit.com", app: nil, guessed: false).host == "reddit.com")
    }

    // MARK: - Picking apps

    @Test func addingAnAppKeepsItsShortNameAndItsDeveloperLink() {
        var draft = draft(apps: [])
        draft.add(
            result("com.spotify.client", "Spotify: Music and Podcasts", sellerUrl: "https://www.spotify.com")
        )
        #expect(draft.blockedApps.map(\.name) == ["Spotify"])
        #expect(draft.blockedApps.first?.sellerUrl == "https://www.spotify.com")
        #expect(draft.sites.map(\.url) == ["https://spotify.com"])
    }

    @Test func addingAnAppRemembersItsArtwork() {
        var draft = draft(apps: [])
        draft.add(result("com.reddit.Reddit", "Reddit", iconUrl: "https://example.com/reddit.png"))
        #expect(draft.icons["com.reddit.Reddit"] == "https://example.com/reddit.png")
    }

    @Test func anAppAlreadyOnTheListIsNotAddedTwice() {
        var draft = ProfileDraft.recommended
        let before = draft.blockedApps.count
        draft.add(result("com.reddit.Reddit", "Reddit"))
        #expect(draft.blockedApps.count == before)
    }

    @Test func applesOwnAppsAreNeverOffered() {
        let rows = [
            result("com.apple.store.Jolly", "Apple Store"),
            result("com.apple.MobileSMS", "Messages"),
            // Apple's own by name rather than by bundle id, which is how an
            // app that only carries the name reads.
            result("com.example.safari", "Safari"),
            result("com.reddit.Reddit", "Reddit"),
        ]
        #expect(ProfileDraft.offerable(rows).map(\.bundleId) == ["com.reddit.Reddit"])
    }

    @Test func anAppleAppIsNotAddedEvenWhenItIsAskedFor() {
        var draft = draft(apps: [])
        draft.add(result("com.apple.store.Jolly", "Apple Store"))
        #expect(draft.blockedApps.isEmpty)
    }

    @Test func removingAnAppTakesItsSitesWithIt() {
        var draft = draft(apps: [
            BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit"),
            BlockedApp(bundleId: "com.burbn.instagram", name: "Instagram"),
        ])
        draft.remove("com.reddit.Reddit")
        #expect(draft.blockedApps.map(\.name) == ["Instagram"])
        #expect(draft.sites.map(\.url) == ["https://instagram.com"])
    }

    // MARK: - Typing sites

    @Test func aTypedSiteGetsASchemeAndGoesAfterTheDerivedOnes() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.burbn.instagram", name: "Instagram")])
        let added = draft.addSite("news.ycombinator.com")
        #expect(added)
        #expect(
            draft.sites.map(\.url) == ["https://instagram.com", "https://news.ycombinator.com"]
        )
        #expect(draft.sites.last?.app == nil)
    }

    @Test func nothingTypedAddsNothing() {
        var draft = draft(apps: [])
        let added = draft.addSite("   ")
        #expect(added == false)
        #expect(draft.sites.isEmpty)
    }

    @Test func aSiteAnAppAlreadyImpliesIsNotListedTwice() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        let added = draft.addSite("reddit.com")
        #expect(added)
        #expect(draft.sites.filter { $0.url == "https://reddit.com" }.count == 1)
    }

    @Test func aSiteTakenOffStaysOffWhileItsAppIsBlocked() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeSite("https://reddit.com")
        #expect(draft.sites.contains { $0.url == "https://reddit.com" } == false)
        // The app's other sites are untouched.
        #expect(draft.sites.contains { $0.url == "https://redd.it" })
    }

    @Test func typingBackASiteThatWasTakenOffBringsItBackOnce() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeSite("https://reddit.com")
        let added = draft.addSite("reddit.com")
        #expect(added)
        #expect(draft.sites.filter { $0.url == "https://reddit.com" }.count == 1)
    }

    @Test func takingOffATypedSiteForgetsIt() {
        var draft = draft(apps: [])
        draft.addSite("news.ycombinator.com")
        draft.removeSite("https://news.ycombinator.com")
        #expect(draft.sites.isEmpty)
        #expect(draft.typedSites.isEmpty)
        #expect(draft.droppedSites.isEmpty)
    }

    // MARK: - What gets signed

    @Test func theConfigCarriesTheAppsTheSitesAndTheSwitches() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.allowsRemoval = true
        draft.autoFilterAdult = false
        draft.allowAppStore = false
        draft.allowPrivateBrowsing = false
        let config = draft.config
        #expect(config.blockedApps.map(\.bundleId) == ["com.reddit.Reddit"])
        #expect(config.lockRemoval == false)
        #expect(config.autoFilterAdult == false)
        #expect(config.allowAppStore == false)
        #expect(config.allowPrivateBrowsing == false)
        guard case .deny(let denied, let permitted) = config.webFilter else {
            Issue.record("The filter should be a deny list.")
            return
        }
        #expect(denied == draft.sites.map(\.url))
        #expect(permitted == ProfileDraft.permittedUrls)
    }

    @Test func trialModeOffIsAProfileThatCannotBeRemoved() {
        var draft = ProfileDraft.recommended
        draft.allowsRemoval = false
        #expect(draft.config.lockRemoval)
    }

    @Test func aFilterWithNothingInItIsLeftOut() {
        let draft = draft(apps: [])
        #expect(draft.config.webFilter == .off)
    }

    @Test func thePermittedUrlsAreTheDefaultProfilesOwn() {
        guard case .deny(_, let permitted) = ProfileConfig.default.webFilter else {
            Issue.record("The default profile should carry a deny list.")
            return
        }
        #expect(ProfileDraft.permittedUrls == permitted)
    }

    @Test func thePermittedSitesAreTheKeptOpenHostsWithoutTheirScheme() {
        #expect(
            ProfileDraft.recommended.permittedSites.contains { $0.host == "accounts.youtube.com" }
        )
    }

    // MARK: - Keeping sites open for sign-in

    @Test func addingAnExceptionPutsItInTheConfigsPermittedUrls() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        let added = draft.addException("accounts.google.com")
        #expect(added)
        guard case .deny(_, let permitted) = draft.config.webFilter else {
            Issue.record("The filter should be a deny list.")
            return
        }
        #expect(permitted.contains("https://accounts.google.com"))
        // The default hole is still there beside the typed one.
        #expect(permitted.contains("https://accounts.youtube.com"))
    }

    @Test func removingTheDefaultExceptionDropsItFromTheConfig() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeException("https://accounts.youtube.com")
        #expect(draft.permittedSites.contains { $0.url == "https://accounts.youtube.com" } == false)
        guard case .deny(_, let permitted) = draft.config.webFilter else {
            Issue.record("The filter should be a deny list.")
            return
        }
        #expect(permitted.contains("https://accounts.youtube.com") == false)
    }

    @Test func resettingPutsTheKeptOpenListBack() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeException("https://accounts.youtube.com")
        draft.addException("accounts.google.com")
        draft.resetLists()
        #expect(
            draft.permittedSites.map(\.url) == ProfileDraft.recommended.permittedSites.map(\.url)
        )
    }

    @Test func editingTheKeptOpenListIsNotRecommended() {
        var draft = ProfileDraft.recommended
        draft.addException("accounts.google.com")
        #expect(draft.isRecommended == false)
    }

    // MARK: - What the step reads out

    @Test func theSiteCountIsWrittenInWholeWords() {
        var draft = draft(apps: [])
        #expect(draft.siteSummary == "no sites")
        draft.addSite("reddit.com")
        #expect(draft.siteSummary == "1 site")
        draft.addSite("news.ycombinator.com")
        #expect(draft.siteSummary == "2 sites")
    }

    // MARK: - Starting over

    @Test func resettingPutsTheListsBackAndLeavesTheSwitchesAlone() {
        var draft = ProfileDraft.recommended
        draft.remove("com.reddit.Reddit")
        draft.addSite("news.ycombinator.com")
        draft.allowsRemoval = true
        #expect(draft.isRecommended == false)
        draft.resetLists()
        #expect(draft.isRecommended)
        #expect(draft.sites.map(\.url) == ProfileDraft.recommended.sites.map(\.url))
        #expect(draft.allowsRemoval)
    }

    // MARK: - Helpers

    /// A draft holding nothing but the apps handed in, so a test says what it
    /// is about and no more.
    private func draft(apps: [BlockedApp]) -> ProfileDraft {
        var draft = ProfileDraft.recommended
        draft.blockedApps = apps
        return draft
    }

    /// One App Store row, as the search hands it over.
    private func result(
        _ bundleId: String,
        _ name: String,
        iconUrl: String = "",
        sellerUrl: String? = nil
    ) -> AppResult {
        AppResult(
            bundleId: bundleId,
            developer: "Example",
            iconUrl: iconUrl,
            id: 0,
            name: name,
            sellerUrl: sellerUrl
        )
    }
}
