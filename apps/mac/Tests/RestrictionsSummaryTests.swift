import XCTest

/// The card the Restrictions screen shows: every line it can carry, and the
/// longer answer each one holds in its hover help.
///
/// It is the screen without its window. What is checked here is that the six
/// lines say what the profile will actually do: the counts in whole words, a
/// switch named only where it takes something away, and the one line people
/// ask about first, which is whether the profile can be taken off again.
final class RestrictionsSummaryTests: XCTestCase {
    // MARK: - The counts

    func testTheCardCountsTheAppsAndTheWebsitesItHides() {
        let draft = ProfileDraft.recommended
        let lines = RestrictionsSummary.lines(for: draft)

        XCTAssertEqual(lines.first?.text, "10 apps hidden")
        XCTAssertEqual(lines.first?.help, draft.blockedApps.map(\.name).joined(separator: ", "))
        XCTAssertEqual(lines[1].text, "\(draft.sites.count) websites blocked")
        XCTAssertEqual(lines[1].help, draft.sites.map(\.host).joined(separator: ", "))
    }

    func testOneAppIsOneApp() {
        let lines = RestrictionsSummary.lines(
            for: draft(apps: [BlockedApp(bundleId: "com.example.game", name: "Game")])
        )

        XCTAssertEqual(lines.first?.text, "1 app hidden")
        XCTAssertEqual(lines.first?.help, "Game")
    }

    func testOneWebsiteIsOneWebsite() {
        var draft = draft(apps: [])
        draft.addSite("reddit.com")

        XCTAssertEqual(RestrictionsSummary.lines(for: draft)[1].text, "1 website blocked")
        XCTAssertEqual(RestrictionsSummary.lines(for: draft)[1].help, "reddit.com")
    }

    func testAnEmptyListSaysSoInTheHoverHelp() {
        let lines = RestrictionsSummary.lines(for: draft(apps: []))

        XCTAssertEqual(lines.first?.text, "0 apps hidden")
        XCTAssertEqual(lines.first?.help, "No apps yet")
    }

    func testNoWebsitesSaysWhatSafariDoesInstead() {
        let lines = RestrictionsSummary.lines(for: draft(apps: []))

        XCTAssertEqual(lines[1].text, "No websites blocked")
        XCTAssertEqual(lines[1].help, "Safari opens every website, whichever apps are hidden.")
    }

    // MARK: - The switches

    func testTheAdultFilterIsNamedWhileItIsOn() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.autoFilterAdult = true

        XCTAssertTrue(texts(draft).contains("Adult websites filtered"))

        draft.autoFilterAdult = false
        XCTAssertFalse(texts(draft).contains("Adult websites filtered"))
    }

    func testTheAdultFilterIsLeftOutWhereThereIsNoListToCarryIt() {
        // Apple's heuristic is written into the deny payload, and a profile
        // with nothing to deny carries no payload at all.
        var draft = draft(apps: [])
        draft.autoFilterAdult = true

        XCTAssertFalse(texts(draft).contains("Adult websites filtered"))
    }

    func testTheAppStoreIsNamedOnlyWhereItIsHidden() {
        var draft = ProfileDraft.recommended
        draft.allowAppStore = true
        XCTAssertFalse(texts(draft).contains("App Store hidden"))

        draft.allowAppStore = false
        XCTAssertTrue(texts(draft).contains("App Store hidden"))
        XCTAssertEqual(help(draft, for: "App Store hidden"), "No new apps and no app updates on iPhone.")
    }

    func testPrivateBrowsingIsNamedOnlyWhereItIsOff() {
        var draft = ProfileDraft.recommended
        draft.allowPrivateBrowsing = true
        XCTAssertFalse(texts(draft).contains("Private browsing off"))

        draft.allowPrivateBrowsing = false
        XCTAssertTrue(texts(draft).contains("Private browsing off"))
        XCTAssertEqual(
            help(draft, for: "Private browsing off"),
            "No private tabs, and history can't be cleared."
        )
    }

    // MARK: - Getting it off again

    func testALockedProfileSaysItCannotBeRemoved() {
        var draft = ProfileDraft.recommended
        draft.allowsRemoval = false
        let lines = RestrictionsSummary.lines(for: draft)

        XCTAssertEqual(lines.last?.text, "Can't be removed from iPhone")
        XCTAssertEqual(lines.last?.help, "Only erasing iPhone removes it.")
    }

    func testTrialModeSaysItCanBeRemoved() {
        var draft = ProfileDraft.recommended
        draft.allowsRemoval = true
        let lines = RestrictionsSummary.lines(for: draft)

        XCTAssertEqual(lines.last?.text, "Can be removed from iPhone")
        XCTAssertEqual(lines.last?.help, "Trial mode: you can remove it in Settings.")
    }

    // MARK: - How much the card ever says

    func testTheProfileAsItComesIsFourLines() {
        XCTAssertEqual(
            texts(ProfileDraft.recommended),
            [
                "10 apps hidden",
                "\(ProfileDraft.recommended.sites.count) websites blocked",
                "Adult websites filtered",
                "Can't be removed from iPhone",
            ]
        )
    }

    func testTheCardNeverGrowsPastSixLines() {
        var draft = ProfileDraft.recommended
        draft.autoFilterAdult = true
        draft.allowAppStore = false
        draft.allowPrivateBrowsing = false
        draft.allowsRemoval = true

        XCTAssertEqual(RestrictionsSummary.lines(for: draft).count, 6)
    }

    // MARK: - Helpers

    private func texts(_ draft: ProfileDraft) -> [String] {
        RestrictionsSummary.lines(for: draft).map(\.text)
    }

    private func help(_ draft: ProfileDraft, for text: String) -> String? {
        RestrictionsSummary.lines(for: draft).first { $0.text == text }?.help
    }

    private func draft(apps: [BlockedApp]) -> ProfileDraft {
        var draft = ProfileDraft.recommended
        draft.blockedApps = apps
        return draft
    }
}
