import Foundation
import Testing

/// The lookup behind the picture slot in the "i" popovers.
///
/// The picture ships inside the app, and the test bundle is not the app, so
/// what is pinned here is the answer for a name nobody has taken: nothing at
/// all, which is what leaves the popover its words. The name of the supervised
/// check goes with it, because it is what a screenshot has to be called for the
/// app to find it.
struct InfoImageTests {
    @Test func aNameNobodyTookFindsNothing() {
        #expect(InfoImage.url(named: "no-such-screenshot") == nil)
    }

    @Test func theSupervisedCheckHasAPictureName() {
        #expect(InfoImage.checking == "check-supervised")
    }
}
