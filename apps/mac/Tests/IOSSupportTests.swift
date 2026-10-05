import Foundation
import Testing

/// Which iPhones the app runs on, from the version of iOS they report.
///
/// On iOS 27 the restore erased the iPhone, so the rule these pin down is that
/// only a version that reads as 26 or earlier ever gets a run. Everything else,
/// a version that does not read included, gets the manual guide.
struct IOSSupportTests {
    @Test(arguments: ["1.0", "9.3", "17.6.1", "26.0", "26.4", "26.2.1", "26.4.1", "26"])
    func iOS26AndOlderRunTheFastMethod(_ version: String) {
        #expect(IOSSupport.refusal(iosVersion: version) == nil)
    }

    @Test(arguments: ["27", "27.0", "27.1", "27.2", "30", "100.1"])
    func iOS27AndLaterAreNotSupportedYet(_ version: String) {
        #expect(IOSSupport.refusal(iosVersion: version) == .iosNotSupportedYet)
    }

    @Test(arguments: [nil, "", "abc"] as [String?])
    func aVersionThatCannotBeReadIsTreatedLikeIOS27(_ version: String?) {
        #expect(IOSSupport.refusal(iosVersion: version) == .iosVersionUnknown)
    }

    @Test(arguments: ["26.x", "26.", ".26", " 26.0", "-26.0", "+26.0", "0.1", "iOS 26.0", "99999999999999999999.0"])
    func aVersionThatOnlyLooksLikeOneIsNeverGuessedAt(_ version: String) {
        #expect(IOSSupport.refusal(iosVersion: version) == .iosVersionUnknown)
    }

    /// The first number is compared as a number, so 9 is older than 26 and
    /// 100 is newer than 27, which a comparison of the text would get wrong.
    @Test func theMajorVersionIsReadAsANumber() {
        #expect(IOSSupport.majorVersion(of: "26.4.1") == 26)
        #expect(IOSSupport.majorVersion(of: "27") == 27)
        #expect(IOSSupport.majorVersion(of: "27.0") == 27)
        #expect(IOSSupport.majorVersion(of: "27.2") == 27)
        #expect(IOSSupport.majorVersion(of: "9.3") == 9)
        #expect(IOSSupport.majorVersion(of: nil) == nil)
    }

    /// iOS 27 ignores the restored configuration, so a run there sends it
    /// live as well. A version that does not read gets the run iOS 26 gets.
    @Test(arguments: [
        ("27.2", true), ("27.0.1", true), ("27", true), ("30.1", true),
        ("26.4", false), ("17.6.1", false), (nil, false), ("abc", false), ("", false), ("27.x", false),
    ] as [(String?, Bool)])
    func onlyIOS27AndLaterNeedTheLiveConfiguration(_ version: String?, _ needed: Bool) {
        #expect(IOSSupport.needsLiveConfiguration(iosVersion: version) == needed)
    }

    /// `allowsAnyIOS` is the debug `--debug-fast-ios27` value.
    @Test(arguments: ["27.0", "27.2", "27", nil, "", "abc"] as [String?])
    func theDebugValueLetsEveryVersionThrough(_ version: String?) {
        #expect(IOSSupport.refusal(iosVersion: version, allowsAnyIOS: true) == nil)
        #expect(IOSSupport.refusal(iosVersion: version, allowsAnyIOS: false) != nil)
    }

    @Test(arguments: ["26.0", "26.6.2", "17.6.1"])
    func theDebugValueChangesNothingOnIOS26(_ version: String) {
        for allows in [false, true] {
            #expect(IOSSupport.refusal(iosVersion: version, allowsAnyIOS: allows) == nil)
        }
    }

    @Test func aRefusalSaysWhyInPlainWords() {
        #expect(IOSSupport.Refusal.iosNotSupportedYet.message
            == "This app cannot supervise iOS 27 or later yet.")
        #expect(IOSSupport.Refusal.iosVersionUnknown.message
            == "This app could not read the iOS version of this iPhone.")
    }

    @Test func theGuideScreenSaysWhatToDoInstead() {
        #expect(IOSSupport.Refusal.iosNotSupportedYet.title == "iOS 27 Is Not Supported Yet")
        #expect(IOSSupport.Refusal.iosNotSupportedYet.guide == """
            This app cannot supervise an iPhone on iOS 27 yet. You can still supervise it by hand \
            with Apple Configurator. That way erases iPhone, so back up first. You do not need to make \
            the profile in Configurator. The profile builder on the site makes it for you, for free.
            """)
        #expect(IOSSupport.Refusal.iosVersionUnknown.title == "Couldn't Read the iOS Version")
        #expect(IOSSupport.Refusal.iosVersionUnknown.guide == """
            This app could not read the iOS version of this iPhone, so it does not supervise it. \
            On iOS 27, a run can erase iPhone. To read it again, unplug iPhone and plug it back in. \
            You can still supervise it by hand with Apple Configurator. That way erases iPhone, so \
            back up first. You do not need to make the profile in Configurator. The profile builder \
            on the site makes it for you, for free.
            """)
    }

    @Test func theGuideLinkCarriesItsCampaign() {
        #expect(SiteLink.guide?.absoluteString == "https://attentionawareness.com/guide"
            + "?utm_source=mac-app&utm_medium=referral&utm_campaign=ios27_guide")
    }

    @Test(arguments: [IOSSupport.Refusal.iosNotSupportedYet, .iosVersionUnknown])
    func bothGuideScreensPointToTheGuideAndTheProfileBuilder(_ refusal: IOSSupport.Refusal) {
        #expect(refusal.guide.contains("by hand with Apple Configurator"))
        #expect(refusal.guide.hasSuffix(
            "The profile builder on the site makes it for you, for free."
        ))
        #expect(SiteLink.guide != nil)
        #expect(SiteLink.profileBuilder != nil)
    }

    @Test func theProfileBuilderLinkCarriesItsCampaign() {
        #expect(SiteLink.profileBuilder?.absoluteString == "https://attentionawareness.com/build"
            + "?utm_source=mac-app&utm_medium=referral&utm_campaign=ios27_builder")
    }
}
