import Foundation
import Testing

/// The apps this app can name without asking Apple.
///
/// The table is what keeps a reader's blocked list spelled the way the default
/// profile spells it, and the folding is what makes a name typed by hand match
/// it. Nothing here reaches the network.
struct KnownAppsTests {
    // MARK: - One name as a lookup key

    @Test func foldingDropsTheCase() {
        #expect(KnownApps.fold("TikTok") == "tiktok")
        #expect(KnownApps.fold("TIKTOK") == "tiktok")
    }

    @Test func foldingDropsEverythingThatIsNotALetterOrADigit() {
        #expect(KnownApps.fold("Tik Tok") == "tiktok")
        #expect(KnownApps.fold("Tik-Tok") == "tiktok")
        #expect(KnownApps.fold(" tik.tok! ") == "tiktok")
        #expect(KnownApps.fold("AT&T") == "att")
    }

    @Test func foldingDropsDiacritics() {
        #expect(KnownApps.fold("Gösteri") == "gosteri")
        #expect(KnownApps.fold("Café") == "cafe")
    }

    @Test func foldingKeepsDigits() {
        #expect(KnownApps.fold("9GAG") == "9gag")
        #expect(KnownApps.fold("Threads 2") == "threads2")
    }

    @Test func aNameOfNothingButPunctuationFoldsToNothing() {
        #expect(KnownApps.fold("") == "")
        #expect(KnownApps.fold("  -  ") == "")
    }

    // MARK: - What the table knows

    @Test func aStoreAppIsFoundHoweverItsNameIsTyped() {
        for typed in ["TikTok", "tiktok", "Tik Tok", " TIK-TOK "] {
            #expect(
                KnownApps.known(typed)
                    == KnownApp(bundleId: "com.zhiliaoapp.musically", name: "TikTok", system: false),
                "\(typed) was not read as TikTok"
            )
        }
    }

    @Test func theTableNamesAnAppTheWayTheProfileNamesIt() {
        #expect(KnownApps.known("youtube")?.name == "YouTube")
        #expect(KnownApps.known("linkedin")?.name == "LinkedIn")
    }

    @Test func applesOwnAppsCarryNoBundleIdBecauseNothingHidesThem() {
        #expect(
            KnownApps.known("safari")
                == KnownApp(bundleId: nil, name: "Safari", system: true)
        )
        #expect(KnownApps.known("Messages")?.system == true)
        #expect(KnownApps.known("Messages")?.bundleId == nil)
    }

    @Test func aNameTheTableHasNeverHeardOfIsNothing() {
        #expect(KnownApps.known("Duolingo") == nil)
        #expect(KnownApps.known("") == nil)
    }

    @Test func bothOfTwittersNamesReachTheSameApp() {
        #expect(KnownApps.known("X")?.bundleId == "com.atebits.Tweetie2")
        #expect(KnownApps.known("Twitter")?.bundleId == "com.atebits.Tweetie2")
    }

    // MARK: - What a scan leaves unticked

    @Test func theAppsADayNeedsAreNotTickedForTheReader() {
        #expect(KnownApps.keepByDefault("WhatsApp"))
        #expect(KnownApps.keepByDefault("messages"))
        #expect(KnownApps.keepByDefault(" tele gram "))
    }

    @Test func aFeedAppIsNotOneADayNeeds() {
        #expect(KnownApps.keepByDefault("TikTok") == false)
        #expect(KnownApps.keepByDefault("Duolingo") == false)
    }

    // MARK: - The table itself

    @Test func theTableListsTheStoreAppsFirstAndApplesOwnAfterThem() {
        #expect(KnownApps.names.count == KnownApps.storeApps.count + KnownApps.systemApps.count)
        #expect(KnownApps.names.first == "Discord")
        #expect(Array(KnownApps.names.suffix(KnownApps.systemApps.count)) == KnownApps.systemApps)
    }

    @Test func noAppIsNamedTwice() {
        #expect(Set(KnownApps.names).count == KnownApps.names.count)
        #expect(Set(KnownApps.names.map(KnownApps.fold)).count == KnownApps.names.count)
    }

    @Test func everyNameInTheTableFindsItselfInIt() {
        for name in KnownApps.names {
            #expect(KnownApps.known(name)?.name == name, "\(name) does not find itself")
        }
    }

    @Test func everyAppTheDefaultProfileBlocksIsInTheTable() {
        let ids = Set(KnownApps.storeApps.map(\.value))
        for app in ProfileConfig.default.blockedApps {
            #expect(ids.contains(app.bundleId), "\(app.name) is not in the table")
        }
    }

    @Test func everyAppTheTableKeepsByDefaultIsAnAppItNames() {
        for name in KnownApps.keepApps {
            #expect(KnownApps.known(name) != nil, "\(name) is kept but not named")
        }
    }
}
