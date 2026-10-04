import Foundation
import Testing

/// Which methods an iPhone is offered, from the version of iOS it reports.
///
/// The seed method erases an iPhone on iOS 27, so the rule these pin down is
/// that only a version that reads as 26 or older is ever offered it. The full
/// copy is offered on every version, and it is the default on all of them.
struct SupervisionMethodTests {
    @Test func theDefaultMethodIsTheFullCopy() {
        #expect(SupervisionMethod.defaultMethod == .fullCopy)
    }

    @Test(arguments: ["1.0", "17.6.1", "26.0", "26.4", "26.2.1", "26"])
    func iOS26AndOlderAreOfferedBothWithTheFullCopyFirst(_ version: String) {
        #expect(SupervisionMethod.fastRefusal(iosVersion: version) == nil)
        #expect(SupervisionMethod.offered(iosVersion: version) == [.fullCopy, .seed])
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
