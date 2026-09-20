import Foundation

/// What the iPhone has to say about the profile before a run counts as done.
///
/// The install service answers Acknowledged once the phone has taken the
/// bytes, which is not the same as the profile being on the phone and saying
/// what it was asked to say. So the phone is read again afterwards and its
/// answer comes through here. It is the last thing between a run and the
/// delete that takes the backup away, which is why it is written as a value:
/// nothing here reaches an iPhone, so the tests run all of it.
enum ProfileCheck {
    /// Why the profiles the phone lists are not the one the run asked for.
    enum Problem: Equatable {
        /// The phone lists no profile of ours at all.
        case notThere
        /// One of ours is listed and the phone has not turned it on.
        case notActive
        /// It is on, and it can be removed on the phone where the run asked for
        /// one that cannot, or the other way round. The flag is what the run
        /// asked for.
        case wrongRemovalSetting(asked: Bool)

        /// What the step shows: what the phone said, and then the part that
        /// matters most to the person reading it.
        var sentence: String { "\(whatThePhoneSaid) The backup was kept." }

        private var whatThePhoneSaid: String {
            switch self {
            case .notThere:
                return "The iPhone took the profile and then listed none of ours."
            case .notActive:
                return "The iPhone lists the profile and has not turned it on."
            case .wrongRemovalSetting(let asked):
                return asked
                    ? "The profile on the iPhone can be removed there, and this run asked for one that cannot."
                    : "The profile on the iPhone cannot be removed there, and this run asked for one that can."
            }
        }
    }

    /// Whether the phone lists the profile the run asked for: one of ours, on,
    /// and locked or removable the way it was asked for. Nil means it does,
    /// which is the only outcome the backup delete waits for.
    ///
    /// `removalDisallowed` is what the run asked for: true for a profile that
    /// cannot be taken off the phone, false for trial mode, and nil for a
    /// profile that was built somewhere else, where this app never knew what
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
}
