import Foundation
import Testing

/// The card the Restrictions screen shows: every line it can carry, and the
/// longer answer each one holds in its hover help.
///
/// It is the screen without its window. What is checked here is that the six
/// lines say what the profile will actually do: the counts in whole words, a
/// switch named only where it takes something away, and the one line people
/// ask about first, which is whether the profile can be taken off again.
struct RestrictionsSummaryTests {
    // MARK: - The counts

    @Test func theCardCountsTheAppsAndTheWebsitesItHides() {
        let draft = ProfileDraft.recommended
        let lines = RestrictionsSummary.lines(for: draft)

        #expect(lines.first?.text == "10 apps hidden")
        #expect(lines.first?.help == draft.blockedApps.map(\.name).joined(separator: ", "))
        #expect(lines[1].text == "\(draft.sites.count) websites blocked")
        #expect(lines[1].help == draft.sites.map(\.host).joined(separator: ", "))
    }

    @Test func oneAppIsOneApp() {
        let lines = RestrictionsSummary.lines(
            for: draft(apps: [BlockedApp(bundleId: "com.example.game", name: "Game")])
        )

        #expect(lines.first?.text == "1 app hidden")
        #expect(lines.first?.help == "Game")
    }

    @Test func oneWebsiteIsOneWebsite() {
        var draft = draft(apps: [])
        draft.addSite("reddit.com")

        #expect(RestrictionsSummary.lines(for: draft)[1].text == "1 website blocked")
        #expect(RestrictionsSummary.lines(for: draft)[1].help == "reddit.com")
    }

    @Test func anEmptyListSaysSoInTheHoverHelp() {
        let lines = RestrictionsSummary.lines(for: draft(apps: []))

        #expect(lines.first?.text == "0 apps hidden")
        #expect(lines.first?.help == "No apps yet")
    }

    @Test func noWebsitesSaysWhatSafariDoesInstead() {
        let lines = RestrictionsSummary.lines(for: draft(apps: []))

        #expect(lines[1].text == "No websites blocked")
        #expect(lines[1].help == "Safari opens every website, whichever apps are hidden.")
    }

    // MARK: - The switches

    @Test func theAdultFilterIsNamedWhileItIsOn() {
        var draft = draft(apps: [BlockedApp(bundleId: "com.reddit.Reddit", name: "Reddit")])
        draft.autoFilterAdult = true

        #expect(texts(draft).contains("Adult websites filtered"))

        draft.autoFilterAdult = false
        #expect(texts(draft).contains("Adult websites filtered") == false)
    }

    @Test func theAdultFilterIsLeftOutWhereThereIsNoListToCarryIt() {
        // Apple's heuristic is written into the deny payload, and a profile
        // with nothing to deny carries no payload at all.
        var draft = draft(apps: [])
        draft.autoFilterAdult = true

        #expect(texts(draft).contains("Adult websites filtered") == false)
    }

    @Test func theAppStoreIsNamedOnlyWhereItIsHidden() {
        var draft = ProfileDraft.recommended
        draft.allowAppStore = true
        #expect(texts(draft).contains("App Store hidden") == false)

        draft.allowAppStore = false
        #expect(texts(draft).contains("App Store hidden"))
        #expect(help(draft, for: "App Store hidden") == "No new apps and no app updates on iPhone.")
    }

    @Test func privateBrowsingIsNamedOnlyWhereItIsOff() {
        var draft = ProfileDraft.recommended
        draft.allowPrivateBrowsing = true
        #expect(texts(draft).contains("Private browsing off") == false)

        draft.allowPrivateBrowsing = false
        #expect(texts(draft).contains("Private browsing off"))
        #expect(
            help(draft, for: "Private browsing off") == "No private tabs, and history can't be cleared."
        )
    }

    // MARK: - Getting it off again

    @Test func aLockedProfileSaysItCannotBeRemoved() {
        var draft = ProfileDraft.recommended
        draft.allowsRemoval = false
        let lines = RestrictionsSummary.lines(for: draft)

        #expect(lines.last?.text == "Can't be removed from iPhone")
        #expect(lines.last?.help == "Only erasing iPhone removes it.")
    }

    @Test func trialModeSaysItCanBeRemoved() {
        var draft = ProfileDraft.recommended
        draft.allowsRemoval = true
        let lines = RestrictionsSummary.lines(for: draft)

        #expect(lines.last?.text == "Can be removed from iPhone")
        #expect(lines.last?.help == "Trial mode: you can remove it in Settings.")
    }

    // MARK: - How much the card ever says

    @Test func theProfileAsItComesIsFourLines() {
        #expect(
            texts(ProfileDraft.recommended) == [
                "10 apps hidden",
                "\(ProfileDraft.recommended.sites.count) websites blocked",
                "Adult websites filtered",
                "Can't be removed from iPhone",
            ]
        )
    }

    @Test func theCardNeverGrowsPastSixLines() {
        var draft = ProfileDraft.recommended
        draft.autoFilterAdult = true
        draft.allowAppStore = false
        draft.allowPrivateBrowsing = false
        draft.allowsRemoval = true

        #expect(RestrictionsSummary.lines(for: draft).count == 6)
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
