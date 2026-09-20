import XCTest

/// What the iPhone has to say about the profile before the run counts as done.
///
/// The phone answering Acknowledged only means it took the bytes, so the list
/// it gives afterwards is read again and weighed here. It is the last thing
/// between a run and the delete that takes the backup away, which is why every
/// way of failing it has a test of its own: each one keeps a whole copy of
/// somebody's iPhone on the Mac.
final class ProfileCheckTests: XCTestCase {
    // MARK: - The profile the run asked for

    func testAProfileOfOursThatIsOnAndLockedIsTheOneALockedRunAskedFor() {
        XCTAssertNil(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: true)], removalDisallowed: true)
        )
    }

    func testAProfileThatCanBeRemovedIsTheOneATrialRunAskedFor() {
        XCTAssertNil(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: false)], removalDisallowed: false)
        )
    }

    func testAnotherProfileOnThePhoneChangesNothing() {
        let profiles = [
            somebodyElses,
            ours(isActive: true, removalDisallowed: true),
        ]

        XCTAssertNil(ProfileCheck.problem(with: profiles, removalDisallowed: true))
    }

    func testOneOfOursThatIsOffIsAnsweredForByOneThatIsOn() {
        // Every install stacks on the one before it, so an older profile of
        // ours the phone has turned off says nothing about this run.
        let profiles = [
            ours(id: "com.attentionawareness.older", isActive: false, removalDisallowed: true),
            ours(isActive: true, removalDisallowed: true),
        ]

        XCTAssertNil(ProfileCheck.problem(with: profiles, removalDisallowed: true))
    }

    // MARK: - Everything that keeps the backup

    func testAPhoneThatListsNoProfileOfOursHasNotTakenIt() {
        XCTAssertEqual(ProfileCheck.problem(with: [], removalDisallowed: true), .notThere)
        XCTAssertEqual(ProfileCheck.problem(with: [somebodyElses], removalDisallowed: true), .notThere)
    }

    func testAProfileThePhoneHasNotTurnedOnIsNotInstalled() {
        XCTAssertEqual(
            ProfileCheck.problem(
                with: [ours(isActive: false, removalDisallowed: true)],
                removalDisallowed: true
            ),
            .notActive
        )
    }

    func testAProfileThatCanBeRemovedIsNotWhatALockedRunAskedFor() {
        XCTAssertEqual(
            ProfileCheck.problem(
                with: [ours(isActive: true, removalDisallowed: false)],
                removalDisallowed: true
            ),
            .wrongRemovalSetting(asked: true)
        )
    }

    func testAProfileThatCannotBeRemovedIsNotWhatATrialRunAskedFor() {
        XCTAssertEqual(
            ProfileCheck.problem(
                with: [ours(isActive: true, removalDisallowed: true)],
                removalDisallowed: false
            ),
            .wrongRemovalSetting(asked: false)
        )
    }

    func testAnInactiveProfileIsNamedBeforeItsSettingIs() {
        // The phone not turning it on is the bigger thing to say, and the
        // setting of a profile that is off answers for nothing.
        XCTAssertEqual(
            ProfileCheck.problem(
                with: [ours(isActive: false, removalDisallowed: false)],
                removalDisallowed: true
            ),
            .notActive
        )
    }

    // MARK: - A profile built somewhere else

    func testAProfileFromAFileIsCheckedOnEverythingButItsRemovalSetting() {
        // The site built it, so this app never knew what was asked for and has
        // nothing to hold the answer against.
        XCTAssertNil(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: false)], removalDisallowed: nil)
        )
        XCTAssertNil(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: true)], removalDisallowed: nil)
        )
        XCTAssertEqual(ProfileCheck.problem(with: [], removalDisallowed: nil), .notThere)
        XCTAssertEqual(
            ProfileCheck.problem(
                with: [ours(isActive: false, removalDisallowed: true)],
                removalDisallowed: nil
            ),
            .notActive
        )
    }

    // MARK: - What each one says

    func testEveryProblemEndsBySayingTheBackupWasKept() {
        let problems: [ProfileCheck.Problem] = [
            .notThere,
            .notActive,
            .wrongRemovalSetting(asked: true),
            .wrongRemovalSetting(asked: false),
        ]

        for problem in problems {
            XCTAssertTrue(
                problem.sentence.hasSuffix("The backup was kept."),
                "\(problem) says: \(problem.sentence)"
            )
        }
    }

    func testTheTwoRemovalSentencesSayOppositeThings() {
        XCTAssertNotEqual(
            ProfileCheck.Problem.wrongRemovalSetting(asked: true).sentence,
            ProfileCheck.Problem.wrongRemovalSetting(asked: false).sentence
        )
        XCTAssertTrue(
            ProfileCheck.Problem.wrongRemovalSetting(asked: true).sentence
                .contains("can be removed there")
        )
        XCTAssertTrue(
            ProfileCheck.Problem.wrongRemovalSetting(asked: false).sentence
                .contains("cannot be removed there")
        )
    }

    // MARK: - Fixtures

    /// A profile this app put there. Every one it installs carries the
    /// `com.attentionawareness.` prefix, which is the whole of what makes it
    /// ours.
    private func ours(
        id: String = "com.attentionawareness.4f1c9d6a-8f2e-4f0b-9f5c-2a6d0b3e7c11",
        isActive: Bool,
        removalDisallowed: Bool
    ) -> InstalledProfile {
        InstalledProfile(
            id: id,
            displayName: "attentionawareness",
            organization: "attentionawareness",
            description: "attentionawareness",
            isActive: isActive,
            removalDisallowed: removalDisallowed,
            uuid: "4f1c9d6a-8f2e-4f0b-9f5c-2a6d0b3e7c11"
        )
    }

    /// A profile somebody else put there, which answers for nothing.
    private let somebodyElses = InstalledProfile(
        id: "com.example.mdm.enrollment",
        displayName: "Work",
        organization: "Example",
        description: nil,
        isActive: true,
        removalDisallowed: true,
        uuid: nil
    )
}
