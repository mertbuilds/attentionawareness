import Foundation

/// One configuration profile as the phone lists it.
///
/// `MCInstall.profileList` answers with the identifiers in the order the phone
/// keeps them, plus two dictionaries keyed by identifier: the manifest, which
/// says whether a profile is active, and the metadata, which carries the names
/// the phone shows in Settings.
///
/// It is a value and it reaches nothing, which is why it sits here rather than
/// beside the service that reads it: the tests run the rule that weighs one of
/// these without libimobiledevice and without an iPhone.
struct InstalledProfile: Identifiable, Equatable {
    /// The profile identifier, which is what the phone keys everything by.
    let id: String
    /// The name Settings shows. The identifier stands in when a profile
    /// carries no display name.
    let displayName: String
    let organization: String?
    let description: String?
    let isActive: Bool
    /// True when the profile cannot be deleted on the phone.
    let removalDisallowed: Bool
    let uuid: String?

    /// True for a profile this app put there. Every one it installs is
    /// `com.attentionawareness.<uuid>`, so the prefix is the whole test.
    var isOurs: Bool { id.hasPrefix("com.attentionawareness.") }
}
