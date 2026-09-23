import Foundation

/// What the iPhone has to say about the profile before a run counts as done.
///
/// The install service answers Acknowledged once the iPhone has taken the
/// bytes, which is not the same as the profile being on the iPhone and saying
/// what it was asked to say. So the iPhone is read again afterwards and its
/// answer comes through here. It is the last thing between a run and the
/// delete that takes the backup away, which is why it is written as a value:
/// nothing here reaches an iPhone, so the tests run all of it.
enum ProfileCheck {
    /// Why the profiles the iPhone lists are not the one the run asked for.
    enum Problem: Equatable {
        /// The iPhone lists no profile of ours at all.
        case notThere
        /// One of ours is listed and the iPhone has not turned it on.
        case notActive
        /// It is on, and it can be removed on the iPhone where the run asked for
        /// one that cannot, or the other way round. The flag is what the run
        /// asked for.
        case wrongRemovalSetting(asked: Bool)

        /// What the step shows: what the iPhone said, and then the part that
        /// matters most to the person reading it.
        var sentence: String { "\(whatThePhoneSaid) The copy was kept." }

        private var whatThePhoneSaid: String {
            switch self {
            case .notThere:
                return "iPhone took the profile and then didn't list it."
            case .notActive:
                return "iPhone lists the profile and hasn't turned it on."
            case .wrongRemovalSetting(let asked):
                return asked
                    ? "The profile on iPhone can be removed there, and this run asked for one that can't."
                    : "The profile on iPhone can't be removed there, and this run asked for one that can."
            }
        }
    }

    /// Whether the iPhone lists the profile the run asked for: one of ours, on,
    /// and locked or removable the way it was asked for. Nil means it does,
    /// which is the only outcome the backup delete waits for.
    ///
    /// `removalDisallowed` is what the run asked for: true for a profile that
    /// cannot be taken off the iPhone, false for trial mode, and nil for a
    /// profile that was built somewhere else, where the app never knew what
    /// was asked for and so has nothing to hold the answer against.
    ///
    /// Several profiles of ours can be on one phone, because every install
    /// stacks on the one before it and none of them can loosen another. Any one
    /// of them that is on and set the way the run asked for answers for the
    /// run.
    static func problem(
        with profiles: [InstalledProfile],
        removalDisallowed: Bool?
    ) -> Problem? {
        let ours = profiles.filter(\.isOurs)
        guard !ours.isEmpty else { return .notThere }
        let active = ours.filter(\.isActive)
        guard !active.isEmpty else { return .notActive }
        guard let removalDisallowed else { return nil }
        guard active.contains(where: { $0.removalDisallowed == removalDisallowed }) else {
            return .wrongRemovalSetting(asked: removalDisallowed)
        }
        return nil
    }

    /// What the confirm read after a download comes to. Because the profile is
    /// downloaded and then turned on by the person, the read happens when they
    /// say they are done, and it needs the iPhone unlocked.
    enum Confirmation: Equatable {
        /// The iPhone lists the profile the run asked for.
        case installed
        /// The iPhone answered, but the profile it asked for is not on it and
        /// correct yet, so the person has more to do in Settings.
        case notInstalled
        /// The read saw nothing, so the iPhone is likely locked or still
        /// settling. It is a retry, not a failure.
        case locked
    }

    /// Weigh one confirm read. A read that threw comes in as nil; an iPhone
    /// that answered with nothing comes in empty. Both read as `locked`,
    /// because the list needs the iPhone unlocked and a locked one answers with
    /// nothing. A non-empty answer is weighed by `problem(with:removalDisallowed:)`,
    /// so an iPhone that lists other profiles but not ours reads as
    /// `notInstalled` rather than as locked.
    static func confirmation(read: [InstalledProfile]?, removalDisallowed: Bool?) -> Confirmation {
        guard let read, !read.isEmpty else { return .locked }
        return problem(with: read, removalDisallowed: removalDisallowed) == nil ? .installed : .notInstalled
    }
}
