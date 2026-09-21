import XCTest

/// The lookup behind the picture slot in the "i" popovers.
///
/// The picture ships inside the app, and the test bundle is not the app, so
/// what is pinned here is the answer for a name nobody has taken: nothing at
/// all, which is what leaves the popover its words. The name of the supervised
/// check goes with it, because it is what a screenshot has to be called for the
/// app to find it.
final class InfoImageTests: XCTestCase {
    func testANameNobodyTookFindsNothing() {
        XCTAssertNil(InfoImage.url(named: "no-such-screenshot"))
    }

    func testTheSupervisedCheckHasAPictureName() {
        XCTAssertEqual(InfoImage.checking, "check-supervised")
    }
}
