import Foundation
import Testing

/// Which methods an iPhone is offered, from the version of iOS it reports.
///
/// The seed method erases an iPhone on iOS 27, so the rule these pin down is
/// that only a version that reads as 26 or older is ever offered it. There it
/// is the default and is recommended; everywhere else the full copy is the
/// default and fast is tagged experimental.
struct SupervisionMethodTests {
    @Test(arguments: ["1.0", "9.3", "17.6.1", "26.0", "26.4", "26.2.1", "26.4.1", "26"])
    func iOS26AndOlderAreOfferedBothWithFastFirst(_ version: String) {
        #expect(SupervisionMethod.fastRefusal(iosVersion: version) == nil)
        #expect(SupervisionMethod.offered(iosVersion: version) == [.seed, .fullCopy])
    }

    @Test(arguments: ["9.3", "26.0", "26.4.1", "26"])
    func iOS26AndOlderDefaultToFastAndRecommendIt(_ version: String) {
        #expect(SupervisionMethod.defaultMethod(iosVersion: version) == .seed)
        #expect(SupervisionMethod.tag(of: .seed, iosVersion: version) == "recommended")
        #expect(SupervisionMethod.tag(of: .fullCopy, iosVersion: version) == nil)
        #expect(SupervisionMethod.label(of: .seed, iosVersion: version) == "Fast (recommended)")
        #expect(SupervisionMethod.label(of: .fullCopy, iosVersion: version) == "Full copy and restore")
    }

    @Test(arguments: ["27.0", "27.1", "27", "30", nil, "", "abc"] as [String?])
    func iOS27AndLaterAndUnknownDefaultToTheFullCopyWithFastExperimental(_ version: String?) {
        #expect(SupervisionMethod.defaultMethod(iosVersion: version) == .fullCopy)
        #expect(SupervisionMethod.tag(of: .seed, iosVersion: version) == "experimental")
        #expect(SupervisionMethod.tag(of: .fullCopy, iosVersion: version) == nil)
        #expect(SupervisionMethod.label(of: .seed, iosVersion: version) == "Fast (experimental)")
        #expect(SupervisionMethod.label(of: .fullCopy, iosVersion: version) == "Full copy and restore")
    }

    @Test func theMajorVersionIsReadAsANumber() {
        #expect(SupervisionMethod.majorVersion(of: "26.4.1") == 26)
        #expect(SupervisionMethod.majorVersion(of: "27") == 27)
        #expect(SupervisionMethod.majorVersion(of: "27.0") == 27)
        #expect(SupervisionMethod.majorVersion(of: "9.3") == 9)
    }

    @Test func aPickByHandHoldsWhileTheVersionStillOffersIt() {
        #expect(SupervisionMethod.method(pickedByHand: nil, iosVersion: "26.4.1") == .seed)
        #expect(SupervisionMethod.method(pickedByHand: .fullCopy, iosVersion: "26.4.1") == .fullCopy)
        #expect(SupervisionMethod.method(pickedByHand: .seed, iosVersion: "26.4.1") == .seed)
        #expect(SupervisionMethod.method(pickedByHand: nil, iosVersion: "27.0") == .fullCopy)
        #expect(SupervisionMethod.method(pickedByHand: .seed, iosVersion: "27.0") == .fullCopy)
        #expect(SupervisionMethod.method(pickedByHand: .seed, iosVersion: nil) == .fullCopy)
    }

    @Test(arguments: ["27.0", "27.1", "30"])
    func iOS27AndLaterAreOfferedOnlyTheFullCopy(_ version: String) {
        #expect(SupervisionMethod.fastRefusal(iosVersion: version) == .iosNotSupportedYet)
        #expect(SupervisionMethod.offered(iosVersion: version) == [.fullCopy])
    }

    @Test(arguments: [nil, "", "abc"] as [String?])
    func aVersionThatCannotBeReadIsOfferedOnlyTheFullCopy(_ version: String?) {
        #expect(SupervisionMethod.fastRefusal(iosVersion: version) == .iosVersionUnknown)
        #expect(SupervisionMethod.offered(iosVersion: version) == [.fullCopy])
    }

    @Test(arguments: ["26.x", "26.", ".26", " 26.0", "-26.0", "+26.0", "0.1", "iOS 26.0", "99999999999999999999.0"])
    func aVersionThatOnlyLooksLikeOneIsNeverGuessedAt(_ version: String) {
        #expect(SupervisionMethod.fastRefusal(iosVersion: version) == .iosVersionUnknown)
    }

    @Test func aRefusalSaysWhyFastIsOffAndWhatToUse() {
        #expect(SupervisionMethod.Refusal.iosNotSupportedYet.message
            == "Fast does not work on iOS 27 or later yet. Use full copy.")
        #expect(SupervisionMethod.Refusal.iosVersionUnknown.message
            == "Fast needs the iOS version, and this iPhone did not give it. Use full copy.")
    }
}
