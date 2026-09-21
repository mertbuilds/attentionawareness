import XCTest

/// The lookup behind the picture slot in the "i" popovers.
///
/// The picture ships inside the app, and the test bundle is not the app, so
/// what is pinned here is the answer for a name nobody has taken: nothing at
/// all, which is what leaves the popover its words. The names go with it,
/// because one is what a screenshot has to be called for the app to find it
/// and the other is the run that has no picture to show.
final class InfoImageTests: XCTestCase {
    func testANameNobodyTookFindsNothing() {
        XCTAssertNil(InfoImage.url(named: "no-such-screenshot"))
    }

    func testOnlySupervisingHasAPicture() {
        XCTAssertEqual(InfoImage.checking(.supervise), "check-supervised")
        XCTAssertNil(InfoImage.checking(.unsupervise))
    }
}
