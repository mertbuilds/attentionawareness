import XCTest

/// The apps this app can name without asking Apple.
///
/// The table is what keeps a reader's blocked list spelled the way the default
/// profile spells it, and the folding is what makes a name typed by hand match
/// it. Nothing here reaches the network.
final class KnownAppsTests: XCTestCase {
    // MARK: - One name as a lookup key

    func testFoldingDropsTheCase() {
        XCTAssertEqual(KnownApps.fold("TikTok"), "tiktok")
        XCTAssertEqual(KnownApps.fold("TIKTOK"), "tiktok")
    }

    func testFoldingDropsEverythingThatIsNotALetterOrADigit() {
        XCTAssertEqual(KnownApps.fold("Tik Tok"), "tiktok")
        XCTAssertEqual(KnownApps.fold("Tik-Tok"), "tiktok")
        XCTAssertEqual(KnownApps.fold(" tik.tok! "), "tiktok")
        XCTAssertEqual(KnownApps.fold("AT&T"), "att")
    }

    func testFoldingDropsDiacritics() {
        XCTAssertEqual(KnownApps.fold("Gösteri"), "gosteri")
        XCTAssertEqual(KnownApps.fold("Café"), "cafe")
    }

    func testFoldingKeepsDigits() {
        XCTAssertEqual(KnownApps.fold("9GAG"), "9gag")
        XCTAssertEqual(KnownApps.fold("Threads 2"), "threads2")
    }

    func testANameOfNothingButPunctuationFoldsToNothing() {
        XCTAssertEqual(KnownApps.fold(""), "")
        XCTAssertEqual(KnownApps.fold("  -  "), "")
    }

    // MARK: - What the table knows

    func testAStoreAppIsFoundHoweverItsNameIsTyped() {
        for typed in ["TikTok", "tiktok", "Tik Tok", " TIK-TOK "] {
            XCTAssertEqual(
                KnownApps.known(typed),
                KnownApp(bundleId: "com.zhiliaoapp.musically", name: "TikTok", system: false),
                "\(typed) was not read as TikTok"
            )
        }
    }

    func testTheTableNamesAnAppTheWayTheProfileNamesIt() {
        XCTAssertEqual(KnownApps.known("youtube")?.name, "YouTube")
        XCTAssertEqual(KnownApps.known("linkedin")?.name, "LinkedIn")
    }

    func testApplesOwnAppsCarryNoBundleIdBecauseNothingHidesThem() {
        XCTAssertEqual(
            KnownApps.known("safari"),
            KnownApp(bundleId: nil, name: "Safari", system: true)
        )
        XCTAssertEqual(KnownApps.known("Messages")?.system, true)
        XCTAssertNil(KnownApps.known("Messages")?.bundleId)
    }

    func testANameTheTableHasNeverHeardOfIsNothing() {
        XCTAssertNil(KnownApps.known("Duolingo"))
        XCTAssertNil(KnownApps.known(""))
    }

    func testBothOfTwittersNamesReachTheSameApp() {
        XCTAssertEqual(KnownApps.known("X")?.bundleId, "com.atebits.Tweetie2")
        XCTAssertEqual(KnownApps.known("Twitter")?.bundleId, "com.atebits.Tweetie2")
    }

    // MARK: - What a scan leaves unticked

    func testTheAppsADayNeedsAreNotTickedForTheReader() {
        XCTAssertTrue(KnownApps.keepByDefault("WhatsApp"))
        XCTAssertTrue(KnownApps.keepByDefault("messages"))
        XCTAssertTrue(KnownApps.keepByDefault(" tele gram "))
    }

    func testAFeedAppIsNotOneADayNeeds() {
        XCTAssertFalse(KnownApps.keepByDefault("TikTok"))
        XCTAssertFalse(KnownApps.keepByDefault("Duolingo"))
    }

    // MARK: - The table itself

    func testTheTableListsTheStoreAppsFirstAndApplesOwnAfterThem() {
        XCTAssertEqual(KnownApps.names.count, KnownApps.storeApps.count + KnownApps.systemApps.count)
        XCTAssertEqual(KnownApps.names.first, "Discord")
        XCTAssertEqual(Array(KnownApps.names.suffix(KnownApps.systemApps.count)), KnownApps.systemApps)
    }

    func testNoAppIsNamedTwice() {
        XCTAssertEqual(Set(KnownApps.names).count, KnownApps.names.count)
        XCTAssertEqual(Set(KnownApps.names.map(KnownApps.fold)).count, KnownApps.names.count)
    }

    func testEveryNameInTheTableFindsItselfInIt() {
        for name in KnownApps.names {
            XCTAssertEqual(KnownApps.known(name)?.name, name, "\(name) does not find itself")
        }
    }

    func testEveryAppTheDefaultProfileBlocksIsInTheTable() {
        let ids = Set(KnownApps.storeApps.map(\.value))
        for app in ProfileConfig.default.blockedApps {
            XCTAssertTrue(ids.contains(app.bundleId), "\(app.name) is not in the table")
        }
    }

    func testEveryAppTheTableKeepsByDefaultIsAnAppItNames() {
        for name in KnownApps.keepApps {
            XCTAssertNotNil(KnownApps.known(name), "\(name) is kept but not named")
        }
    }
}
