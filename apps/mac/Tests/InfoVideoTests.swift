import XCTest

/// The lookup behind the film slot in the "i" popovers.
///
/// No film ships yet, so the answer worth pinning is the one for a name nobody
/// has recorded: nothing at all, which is what leaves the popover its words.
/// The two names are pinned with it, because they are what a recording has to
/// be called for the app to find it.
final class InfoVideoTests: XCTestCase {
    func testANameNobodyRecordedFindsNothing() {
        XCTAssertNil(InfoVideo.url(named: "no-such-recording"))
    }

    func testEachDirectionHasItsOwnName() {
        XCTAssertEqual(InfoVideo.checking(.supervise), "check-supervised")
        XCTAssertEqual(InfoVideo.checking(.unsupervise), "check-unsupervised")
    }
}
