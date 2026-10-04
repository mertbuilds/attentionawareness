import Foundation
import Testing

/// What the iPhone has to say about the profile before the run counts as done.
///
/// The phone answering Acknowledged only means it took the bytes, so the list
/// it gives afterwards is read again and weighed here. It is the last thing
/// between a run and the delete that takes the backup away, which is why every
/// way of failing it has a test of its own: each one keeps a whole copy of
/// somebody's iPhone on the Mac.
struct ProfileCheckTests {
    // MARK: - The profile the run asked for

    @Test func aProfileOfOursThatIsOnAndLockedIsTheOneALockedRunAskedFor() {
        #expect(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: true)], removalDisallowed: true) == nil
        )
    }

    @Test func aProfileThatCanBeRemovedIsTheOneATrialRunAskedFor() {
        #expect(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: false)], removalDisallowed: false) == nil
        )
    }

    @Test func anotherProfileOnThePhoneChangesNothing() {
        let profiles = [
            somebodyElses,
            ours(isActive: true, removalDisallowed: true),
        ]

        #expect(ProfileCheck.problem(with: profiles, removalDisallowed: true) == nil)
    }

    @Test func oneOfOursThatIsOffIsAnsweredForByOneThatIsOn() {
        // Every install stacks on the one before it, so an older profile of
        // ours the phone has turned off says nothing about this run.
        let profiles = [
            ours(id: "com.attentionawareness.older", isActive: false, removalDisallowed: true),
            ours(isActive: true, removalDisallowed: true),
        ]

        #expect(ProfileCheck.problem(with: profiles, removalDisallowed: true) == nil)
    }

    // MARK: - Everything that keeps the backup

    @Test func aPhoneThatListsNoProfileOfOursHasNotTakenIt() {
        #expect(ProfileCheck.problem(with: [], removalDisallowed: true) == .notThere)
        #expect(ProfileCheck.problem(with: [somebodyElses], removalDisallowed: true) == .notThere)
    }

    @Test func aProfileThePhoneHasNotTurnedOnIsNotInstalled() {
        #expect(
            ProfileCheck.problem(
                with: [ours(isActive: false, removalDisallowed: true)],
                removalDisallowed: true
            ) == .notActive
        )
    }

    @Test func aProfileThatCanBeRemovedIsNotWhatALockedRunAskedFor() {
        #expect(
            ProfileCheck.problem(
                with: [ours(isActive: true, removalDisallowed: false)],
                removalDisallowed: true
            ) == .wrongRemovalSetting(asked: true)
        )
    }

    @Test func aProfileThatCannotBeRemovedIsNotWhatATrialRunAskedFor() {
        #expect(
            ProfileCheck.problem(
                with: [ours(isActive: true, removalDisallowed: true)],
                removalDisallowed: false
            ) == .wrongRemovalSetting(asked: false)
        )
    }

    @Test func anInactiveProfileIsNamedBeforeItsSettingIs() {
        // The phone not turning it on is the bigger thing to say, and the
        // setting of a profile that is off answers for nothing.
        #expect(
            ProfileCheck.problem(
                with: [ours(isActive: false, removalDisallowed: false)],
                removalDisallowed: true
            ) == .notActive
        )
    }

    // MARK: - A profile built somewhere else

    @Test func aProfileFromAFileIsCheckedOnEverythingButItsRemovalSetting() {
        // The site built it, so this app never knew what was asked for and has
        // nothing to hold the answer against.
        #expect(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: false)], removalDisallowed: nil) == nil
        )
        #expect(
            ProfileCheck.problem(with: [ours(isActive: true, removalDisallowed: true)], removalDisallowed: nil) == nil
        )
        #expect(ProfileCheck.problem(with: [], removalDisallowed: nil) == .notThere)
        #expect(
            ProfileCheck.problem(
                with: [ours(isActive: false, removalDisallowed: true)],
                removalDisallowed: nil
            ) == .notActive
        )
    }

    // MARK: - The confirm read after a download

    @Test func aReadThatThrewIsAReasonToUnlockNotAFailure() {
        // A locked iPhone fails the read, which the confirm check takes as nil.
        #expect(ProfileCheck.confirmation(read: nil, removalDisallowed: true) == .locked)
    }

    @Test func anIPhoneThatAnsweredWithNothingReadsAsLocked() {
        // An empty answer is what a locked or still-settling iPhone gives, so
        // it is a retry rather than a phone that has not taken the profile.
        #expect(ProfileCheck.confirmation(read: [], removalDisallowed: true) == .locked)
    }

    @Test func theProfileTheRunAskedForReadsAsInstalled() {
        #expect(
            ProfileCheck.confirmation(
                read: [ours(isActive: true, removalDisallowed: true)],
                removalDisallowed: true
            ) == .installed
        )
    }

    @Test func anIPhoneThatListsOthersButNotOursReadsAsNotInstalled() {
        // A non-empty answer means the iPhone spoke, so a missing profile of
        // ours is finished-in-Settings work, not a locked iPhone.
        #expect(
            ProfileCheck.confirmation(read: [somebodyElses], removalDisallowed: true) == .notInstalled
        )
    }

    @Test func aProfileTheIPhoneHasNotTurnedOnReadsAsNotInstalled() {
        #expect(
            ProfileCheck.confirmation(
                read: [ours(isActive: false, removalDisallowed: true)],
                removalDisallowed: true
            ) == .notInstalled
        )
    }

    @Test func theWrongRemovalSettingReadsAsNotInstalled() {
        #expect(
            ProfileCheck.confirmation(
                read: [ours(isActive: true, removalDisallowed: false)],
                removalDisallowed: true
            ) == .notInstalled
        )
    }

    @Test func aProfileBuiltElsewhereIsNotWeighedOnItsRemovalSetting() {
        // The site built it, so nothing was asked for, and an active profile of
        // ours is confirmed whichever way it can be removed.
        #expect(
            ProfileCheck.confirmation(
                read: [ours(isActive: true, removalDisallowed: false)],
                removalDisallowed: nil
            ) == .installed
        )
    }

    // MARK: - What each one says

    @Test func everyProblemEndsBySayingTheBackupWasKept() {
        let problems: [ProfileCheck.Problem] = [
            .notThere,
            .notActive,
            .wrongRemovalSetting(asked: true),
            .wrongRemovalSetting(asked: false),
        ]

        for problem in problems {
            #expect(
                problem.sentence.hasSuffix("The copy was kept."),
                "\(problem) says: \(problem.sentence)"
            )
        }
    }

    @Test func theTwoRemovalSentencesSayOppositeThings() {
        #expect(
            ProfileCheck.Problem.wrongRemovalSetting(asked: true).sentence
                != ProfileCheck.Problem.wrongRemovalSetting(asked: false).sentence
        )
        #expect(
            ProfileCheck.Problem.wrongRemovalSetting(asked: true).sentence
                .contains("can be removed there")
        )
        #expect(
            ProfileCheck.Problem.wrongRemovalSetting(asked: false).sentence
                .contains("can't be removed there")
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
