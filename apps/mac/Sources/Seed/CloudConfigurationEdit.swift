import Foundation

/// What the seed method writes into the cloud configuration, worked out
/// before anything is sent.
///
/// The seed method sends a whole new file: it takes the configuration the
/// iPhone holds now, keeps every key in it and sets the flags Nugget sets in
/// `add_skip_setup`.
///
/// Setup suppression also applies after restoring onto an already configured
/// iPhone. Existing supervising identity keys stay on a supervising run and
/// are removed only when supervision comes off.
///
/// Portions adapted from Nugget (https://github.com/leminlimez/Nugget), AGPL-3.0:
/// the flags and the list of setup panes. See THIRD_PARTY_NOTICES.md.
struct CloudConfigurationEdit {
    /// The flags a configuration that was applied carries, whichever way
    /// supervision goes.
    static let appliedFlags = [
        "CloudConfigurationUIComplete",
        "ConfigurationWasApplied",
        "AllowPairing",
        "PostSetupProfileWasInstalled",
    ]
    /// Nugget's add_skip_setup list, including the post-restore panes.
    /// https://github.com/leminlimez/Nugget/blob/5d6a0e561034727cbad6b8080001cc8f4b763c4b/src/devicemanagement/device_manager.py#L348-L430
    /// The file is the same, byte for byte, at commit 26e0c50e, which
    /// THIRD_PARTY_NOTICES.md names for the rest.
    static let setupPanes = [
        "Location",
        "Restore",
        "SIMSetup",
        "Android",
        "AppleID",
        "IntendedUser",
        "TOS",
        "Siri",
        "ScreenTime",
        "Diagnostics",
        "SoftwareUpdate",
        "Passcode",
        "Biometric",
        "Payment",
        "Zoom",
        "DisplayTone",
        "MessagingActivationUsingPhoneNumber",
        "HomeButtonSensitivity",
        "CloudStorage",
        "ScreenSaver",
        "TapToSetup",
        "Keyboard",
        "PreferredLanguage",
        "SpokenLanguage",
        "WatchMigration",
        "OnBoarding",
        "TVProviderSignIn",
        "TVHomeScreenSync",
        "Privacy",
        "TVRoom",
        "iMessageAndFaceTime",
        "AppStore",
        "Safety",
        "Multitasking",
        "ActionButton",
        "TermsOfAddress",
        "AccessibilityAppearance",
        "Welcome",
        "Appearance",
        "RestoreCompleted",
        "UpdateCompleted",
        "WiFi",
        "Display",
        "Tone",
        "LanguageAndLocale",
        "TouchID",
        "TrueToneDisplay",
        "FileVault",
        "iCloudStorage",
        "iCloudDiagnostics",
        "Registration",
        "DeviceToDeviceMigration",
        "UnlockWithWatch",
        "Accessibility",
        "All",
        "ExpressLanguage",
        "Language",
        "N/A",
        "Region",
        "Avatar",
        "DeviceProtection",
        "Key",
        "LockdownMode",
        "Wallpaper",
        "PrivacySubtitle",
        "SecuritySubtitle",
        "DataSubtitle",
        "AppleIDSubtitle",
        "AppearanceSubtitle",
        "PreferredLang",
        "OnboardingSubtitle",
        "AppleTVSubtitle",
        "Intelligence",
        "WebContentFiltering",
        "CameraButton",
        "AdditionalPrivacySettings",
        "EnableLockdownMode",
        "OSShowcase",
        "SafetyAndHandling",
        "Tips",
        "AgeBasedSafetySettings",
    ]
    /// The keys of a supervising identity, which go when supervision does.
    static let identityKeys = ["OrganizationMagic", "SupervisorHostCertificates"]

    /// The configuration to write: every key the iPhone had, with the flags set.
    let content: [String: Any]
    /// One line per change, for the window.
    let changes: [String]

    /// Work out the configuration to write. `current` is what the iPhone
    /// holds now, and is empty when it holds none.
    static func plan(current: [String: Any], supervised: Bool) -> CloudConfigurationEdit {
        var content = current
        var changes: [String] = []

        let flags = [("IsSupervised", supervised)] + appliedFlags.map { ($0, true) }
        for (key, target) in flags where boolean(content[key]) != target {
            changes.append("\(key): \(label(content[key])) -> \(target)")
            content[key] = target
        }
        if !isZero(content["ConfigurationSource"]) {
            changes.append("ConfigurationSource: \(label(content["ConfigurationSource"])) -> 0")
            content["ConfigurationSource"] = 0
        }
        let existingPanes = (content["SkipSetup"] as? [Any] ?? []).compactMap { $0 as? String }
        var seen = Set<String>()
        let skipSetup = (existingPanes + setupPanes).filter { seen.insert($0).inserted }
        if content["SkipSetup"] as? [String] != skipSetup {
            changes.append("SkipSetup: updated")
            content["SkipSetup"] = skipSetup
        }
        if !supervised {
            for key in identityKeys where content[key] != nil {
                changes.append("\(key): present -> missing")
                content.removeValue(forKey: key)
            }
        }
        return CloudConfigurationEdit(content: content, changes: changes)
    }

    /// The bytes of the file to send: an XML property list, the format Nugget
    /// writes it in.
    func plistData() throws -> Data {
        try PropertyListSerialization.data(fromPropertyList: content, format: .xml, options: 0)
    }

    /// A plist integer that is zero. A plist boolean is a number to Foundation
    /// as well, and false would pass for zero without the first check.
    private static func isZero(_ value: Any?) -> Bool {
        guard boolean(value) == nil, let number = value as? NSNumber else { return false }
        return number == NSNumber(value: 0)
    }

    /// A plist boolean, and nothing else. An integer is not a boolean here,
    /// which is what the Python `is True` comparison says too.
    static func boolean(_ value: Any?) -> Bool? {
        guard let value, CFGetTypeID(value as CFTypeRef) == CFBooleanGetTypeID() else { return nil }
        return (value as? NSNumber)?.boolValue
    }

    /// How a flag is named in the list of changes.
    static func label(_ value: Any?) -> String {
        switch boolean(value) {
        case true: return "true"
        case false: return "false"
        case nil:
            guard let value else { return "missing" }
            return String(describing: value)
        }
    }
}
