import XCTest

/// The profile the Restrictions screen builds.
///
/// It is the step without its window: the apps a reader picks, the sites those
/// apps imply, the ones the reader types, and what all of it turns into on the
/// way to the signer. What is checked here is the parts that decide what ends
/// up on the phone.
final class ProfileDraftTests: XCTestCase {
    // MARK: - What the step starts on

    func testTheRecommendedDraftIsTheProfileTheAppHasAlwaysInstalled() {
        let draft = ProfileDraft.recommended
        XCTAssertEqual(draft.blockedApps, ProfileConfig.default.blockedApps)
        XCTAssertEqual(draft.allowAppStore, ProfileConfig.default.allowAppStore)
        XCTAssertEqual(draft.allowPrivateBrowsing, ProfileConfig.default.allowPrivateBrowsing)
        XCTAssertEqual(draft.autoFilterAdult, ProfileConfig.default.autoFilterAdult)
        XCTAssertEqual(draft.config.lockRemoval, ProfileConfig.default.lockRemoval)
        XCTAssertTrue(draft.isRecommended)
    }

    func testTheRecommendedSitesAreTheOnesItsAppsImply() {
        XCTAssertEqual(
            ProfileDraft.recommended.sites.map(\.url),
            Sites.sites(forApps: ProfileConfig.default.blockedApps)
        )
    }

    // MARK: - Where a site came from

    func testASiteTheTableNamesIsNotAGuess() {
        let draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        let reddit = draft.sites.first { $0.url == "https://reddit.com" }
        XCTAssertEqual(reddit?.app, "Reddit")
        XCTAssertEqual(reddit?.guessed, false)
    }

    func testASiteFromTheDeveloperLinkIsMarkedAsAGuess() {
        let draft = draft(apps: [
            BlockedApp(
                bundleId: "com.duolingo.DuolingoMobile",
                name: "Duolingo",
                sellerUrl: "https://www.duolingo.com"
            ),
        ])
        XCTAssertEqual(draft.sites.map(\.url), ["https://duolingo.com"])
        XCTAssertEqual(draft.sites.first?.guessed, true)
    }

    func testAnAppWithNoTableEntryAndNoDeveloperLinkImpliesNoSites() {
        let draft = draft(apps: [BlockedApp(bundleId: "com.example.game", name: "Game")])
        XCTAssertTrue(draft.sites.isEmpty)
    }

    func testTheHostIsTheUrlWithoutItsScheme() {
        XCTAssertEqual(DraftSite(url: "https://reddit.com", app: nil, guessed: false).host, "reddit.com")
        XCTAssertEqual(DraftSite(url: "reddit.com", app: nil, guessed: false).host, "reddit.com")
    }

    // MARK: - Picking apps

    func testAddingAnAppKeepsItsShortNameAndItsDeveloperLink() {
        var draft = draft(apps: [])
        draft.add(
            result("com.spotify.client", "Spotify: Music and Podcasts", sellerUrl: "https://www.spotify.com")
        )
        XCTAssertEqual(draft.blockedApps.map(\.name), ["Spotify"])
        XCTAssertEqual(draft.blockedApps.first?.sellerUrl, "https://www.spotify.com")
        XCTAssertEqual(draft.sites.map(\.url), ["https://spotify.com"])
    }

    func testAddingAnAppRemembersItsArtwork() {
        var draft = draft(apps: [])
        draft.add(result("com.reddit.Reddit", "Reddit", iconUrl: "https://example.com/reddit.png"))
        XCTAssertEqual(draft.icons["com.reddit.Reddit"], "https://example.com/reddit.png")
    }

    func testAnAppAlreadyOnTheListIsNotAddedTwice() {
        var draft = ProfileDraft.recommended
        let before = draft.blockedApps.count
        draft.add(result("com.reddit.Reddit", "Reddit"))
        XCTAssertEqual(draft.blockedApps.count, before)
    }

    func testApplesOwnAppsAreNeverOffered() {
        let rows = [
            result("com.apple.store.Jolly", "Apple Store"),
            result("com.apple.MobileSMS", "Messages"),
            // Apple's own by name rather than by bundle id, which is how an
            // app that only carries the name reads.
            result("com.example.safari", "Safari"),
            result("com.reddit.Reddit", "Reddit"),
        ]
        XCTAssertEqual(ProfileDraft.offerable(rows).map(\.bundleId), ["com.reddit.Reddit"])
    }

    func testAnAppleAppIsNotAddedEvenWhenItIsAskedFor() {
        var draft = draft(apps: [])
        draft.add(result("com.apple.store.Jolly", "Apple Store"))
        XCTAssertTrue(draft.blockedApps.isEmpty)
    }

    func testRemovingAnAppTakesItsSitesWithIt() {
        var draft = draft(apps: [
            BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit"),
            BlockedApp(bundleId: "com.burbn.instagram", name: "Instagram"),
        ])
        draft.remove("com.reddit.Reddit")
        XCTAssertEqual(draft.blockedApps.map(\.name), ["Instagram"])
        XCTAssertEqual(draft.sites.map(\.url), ["https://instagram.com"])
    }

    // MARK: - Typing sites

    func testATypedSiteGetsASchemeAndGoesAfterTheDerivedOnes() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.burbn.instagram", name: "Instagram")])
        XCTAssertTrue(draft.addSite("news.ycombinator.com"))
        XCTAssertEqual(
            draft.sites.map(\.url),
            ["https://instagram.com", "https://news.ycombinator.com"]
        )
        XCTAssertNil(draft.sites.last?.app)
    }

    func testNothingTypedAddsNothing() {
        var draft = draft(apps: [])
        XCTAssertFalse(draft.addSite("   "))
        XCTAssertTrue(draft.sites.isEmpty)
    }

    func testASiteAnAppAlreadyImpliesIsNotListedTwice() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        XCTAssertTrue(draft.addSite("reddit.com"))
        XCTAssertEqual(draft.sites.filter { $0.url == "https://reddit.com" }.count, 1)
    }

    func testASiteTakenOffStaysOffWhileItsAppIsBlocked() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeSite("https://reddit.com")
        XCTAssertFalse(draft.sites.contains { $0.url == "https://reddit.com" })
        // The app's other sites are untouched.
        XCTAssertTrue(draft.sites.contains { $0.url == "https://redd.it" })
    }

    func testTypingBackASiteThatWasTakenOffBringsItBackOnce() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeSite("https://reddit.com")
        XCTAssertTrue(draft.addSite("reddit.com"))
        XCTAssertEqual(draft.sites.filter { $0.url == "https://reddit.com" }.count, 1)
    }

    func testTakingOffATypedSiteForgetsIt() {
        var draft = draft(apps: [])
        draft.addSite("news.ycombinator.com")
        draft.removeSite("https://news.ycombinator.com")
        XCTAssertTrue(draft.sites.isEmpty)
        XCTAssertTrue(draft.typedSites.isEmpty)
        XCTAssertTrue(draft.droppedSites.isEmpty)
    }

    // MARK: - What gets signed

    func testTheConfigCarriesTheAppsTheSitesAndTheSwitches() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.allowsRemoval = true
        draft.autoFilterAdult = false
        draft.allowAppStore = false
        draft.allowPrivateBrowsing = false
        let config = draft.config
        XCTAssertEqual(config.blockedApps.map(\.bundleId), ["com.reddit.Reddit"])
        XCTAssertFalse(config.lockRemoval)
        XCTAssertFalse(config.autoFilterAdult)
        XCTAssertFalse(config.allowAppStore)
        XCTAssertFalse(config.allowPrivateBrowsing)
        guard case .deny(let denied, let permitted) = config.webFilter else {
            return XCTFail("The filter should be a deny list.")
        }
        XCTAssertEqual(denied, draft.sites.map(\.url))
        XCTAssertEqual(permitted, ProfileDraft.permittedUrls)
    }

    func testTrialModeOffIsAProfileThatCannotBeRemoved() {
        var draft = ProfileDraft.recommended
        draft.allowsRemoval = false
        XCTAssertTrue(draft.config.lockRemoval)
    }

    func testAFilterWithNothingInItIsLeftOut() {
        let draft = draft(apps: [])
        XCTAssertEqual(draft.config.webFilter, .off)
    }

    func testThePermittedUrlsAreTheDefaultProfilesOwn() {
        guard case .deny(_, let permitted) = ProfileConfig.default.webFilter else {
            return XCTFail("The default profile should carry a deny list.")
        }
        XCTAssertEqual(ProfileDraft.permittedUrls, permitted)
    }

    func testThePermittedSitesAreTheKeptOpenHostsWithoutTheirScheme() {
        XCTAssertTrue(
            ProfileDraft.recommended.permittedSites.contains { $0.host == "accounts.youtube.com" }
        )
    }

    // MARK: - Keeping sites open for sign-in

    func testAddingAnExceptionPutsItInTheConfigsPermittedUrls() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        XCTAssertTrue(draft.addException("accounts.google.com"))
        guard case .deny(_, let permitted) = draft.config.webFilter else {
            return XCTFail("The filter should be a deny list.")
        }
        XCTAssertTrue(permitted.contains("https://accounts.google.com"))
        // The default hole is still there beside the typed one.
        XCTAssertTrue(permitted.contains("https://accounts.youtube.com"))
    }

    func testRemovingTheDefaultExceptionDropsItFromTheConfig() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeException("https://accounts.youtube.com")
        XCTAssertFalse(draft.permittedSites.contains { $0.url == "https://accounts.youtube.com" })
        guard case .deny(_, let permitted) = draft.config.webFilter else {
            return XCTFail("The filter should be a deny list.")
        }
        XCTAssertFalse(permitted.contains("https://accounts.youtube.com"))
    }

    func testResettingPutsTheKeptOpenListBack() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.removeException("https://accounts.youtube.com")
        draft.addException("accounts.google.com")
        draft.resetLists()
        XCTAssertEqual(
            draft.permittedSites.map(\.url),
            ProfileDraft.recommended.permittedSites.map(\.url)
        )
    }

    func testEditingTheKeptOpenListIsNotRecommended() {
        var draft = ProfileDraft.recommended
        draft.addException("accounts.google.com")
        XCTAssertFalse(draft.isRecommended)
    }

    // MARK: - What the step reads out

    func testTheSiteCountIsWrittenInWholeWords() {
        var draft = draft(apps: [])
        XCTAssertEqual(draft.siteSummary, "no sites")
        draft.addSite("reddit.com")
        XCTAssertEqual(draft.siteSummary, "1 site")
        draft.addSite("news.ycombinator.com")
        XCTAssertEqual(draft.siteSummary, "2 sites")
    }

    // MARK: - Starting over

    func testResettingPutsTheListsBackAndLeavesTheSwitchesAlone() {
        var draft = ProfileDraft.recommended
        draft.remove("com.reddit.Reddit")
        draft.addSite("news.ycombinator.com")
        draft.allowsRemoval = true
        XCTAssertFalse(draft.isRecommended)
        draft.resetLists()
        XCTAssertTrue(draft.isRecommended)
        XCTAssertEqual(draft.sites.map(\.url), ProfileDraft.recommended.sites.map(\.url))
        XCTAssertTrue(draft.allowsRemoval)
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
