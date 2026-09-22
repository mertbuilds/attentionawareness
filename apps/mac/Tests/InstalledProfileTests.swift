import Foundation
import Testing

/// The one rule the profile carries: whether it is one the app put there.
///
/// The Profiles screen names ours by our name and everyone else's by the name
/// Settings shows, and the check that decides which is the identifier prefix,
/// which reaches no iPhone, so it runs here.
struct InstalledProfileTests {
    @Test func aProfileWithOurPrefixIsOurs() {
        #expect(
            profile(id: "com.attentionawareness.4f1c9d6a-8f2e-4f0b-9f5c-2a6d0b3e7c11").isOurs
        )
    }

    @Test func aProfileWithAnotherPrefixIsNotOurs() {
        #expect(profile(id: "com.example.mdm.enrollment").isOurs == false)
        // A prefix that only looks like ours is not ours: the dot after the
        // name is part of the test.
        #expect(profile(id: "com.attentionawarenessX.something").isOurs == false)
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
