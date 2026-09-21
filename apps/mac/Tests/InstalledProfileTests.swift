import XCTest

/// The one rule the profile carries: whether it is one the app put there.
///
/// The Profiles screen names ours by our name and everyone else's by the name
/// Settings shows, and the check that decides which is the identifier prefix,
/// which reaches no iPhone, so it runs here.
final class InstalledProfileTests: XCTestCase {
    func testAProfileWithOurPrefixIsOurs() {
        XCTAssertTrue(
            profile(id: "com.attentionawareness.4f1c9d6a-8f2e-4f0b-9f5c-2a6d0b3e7c11").isOurs
        )
    }

    func testAProfileWithAnotherPrefixIsNotOurs() {
        XCTAssertFalse(profile(id: "com.example.mdm.enrollment").isOurs)
        // A prefix that only looks like ours is not ours: the dot after the
        // name is part of the test.
        XCTAssertFalse(profile(id: "com.attentionawarenessX.something").isOurs)
    }

    private func profile(id: String) -> InstalledProfile {
        InstalledProfile(
            id: id,
            displayName: "attentionawareness",
            organization: "attentionawareness",
            description: nil,
            isActive: true,
            removalDisallowed: true,
            uuid: nil
        )
    }
}
