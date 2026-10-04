import Foundation

/// How an iPhone is supervised.
///
/// Nothing here touches the iPhone, a backup or the window, which is why it
/// is a part of the run the tests can run.
enum SupervisionMethod: Hashable {
    /// The fast way: restore the cloud configuration and Setup Assistant
    /// completion preferences from a small backup. The default on iOS 26 and
    /// older, where it went through on a real iPhone.
    case seed
    /// The full way: copy the whole iPhone, patch the copy, put it back.
    /// The default on iOS 27 and later, and wherever the version is unknown.
    case fullCopy

    /// The method a run starts on for an iPhone with this version, until the
    /// person picks the other one: fast wherever it is offered, the full copy
    /// everywhere else.
    static func defaultMethod(iosVersion: String?) -> SupervisionMethod {
        fastRefusal(iosVersion: iosVersion) == nil ? .seed : .fullCopy
    }

    /// The method a run is on: the one the person picked by hand while this
    /// version still offers it, else the default for the version.
    static func method(pickedByHand: SupervisionMethod?, iosVersion: String?) -> SupervisionMethod {
        if let pickedByHand, offered(iosVersion: iosVersion).contains(pickedByHand) { return pickedByHand }
        return defaultMethod(iosVersion: iosVersion)
    }

    /// The word in brackets after a method's name on the Ready screen, or nil
    /// for none. Only the fast method carries one: recommended where it is the
    /// default, experimental everywhere else.
    static func tag(of method: SupervisionMethod, iosVersion: String?) -> String? {
        guard method == .seed else { return nil }
        return defaultMethod(iosVersion: iosVersion) == .seed ? "recommended" : "experimental"
    }

    /// What the Ready screen calls a method for an iPhone with this version.
    static func label(of method: SupervisionMethod, iosVersion: String?) -> String {
        let name = method == .seed ? "Fast" : "Full copy and restore"
        guard let tag = tag(of: method, iosVersion: iosVersion) else { return name }
        return "\(name) (\(tag))"
    }

    /// Why an iPhone is not offered the fast method. The full copy is never
    /// refused by version.
    enum Refusal: Equatable {
        /// iOS 27 or later, where the fast method is not supported yet.
        case iosNotSupportedYet
        /// The iPhone gave no version, or one that does not read as one.
        case iosVersionUnknown

        /// The one line the person reads where the fast method would be.
        var message: String {
            switch self {
            case .iosNotSupportedYet:
                return "Fast does not work on iOS \(SupervisionMethod.newestSeedMajorVersion + 1) or later yet. "
                    + "Use full copy."
            case .iosVersionUnknown:
                return "Fast needs the iOS version, and this iPhone did not give it. Use full copy."
            }
        }
    }

    /// The newest major version of iOS the seed method works on. There is no
    /// oldest one: every version that reads as 26 or older is let through.
    static let newestSeedMajorVersion = 26

    /// Why the version the iPhone reports, such as `26.2.1`, rules the fast
    /// method out. Nil when it does not.
    ///
    /// On iOS 27 a restore of the seed backup erases the iPhone, so a version
    /// that is missing or does not read is never taken for an old one.
    static func fastRefusal(iosVersion: String?) -> Refusal? {
        guard let major = majorVersion(of: iosVersion) else { return .iosVersionUnknown }
        return major <= newestSeedMajorVersion ? nil : .iosNotSupportedYet
    }

    /// The methods an iPhone is offered, the default first. The full copy is
    /// offered on every version, a new or unreadable one included.
    static func offered(iosVersion: String?) -> [SupervisionMethod] {
        fastRefusal(iosVersion: iosVersion) == nil ? [.seed, .fullCopy] : [.fullCopy]
    }

    /// The first number of a version. Every part has to be digits and nothing
    /// else, and no iPhone runs a version 0, so anything short of that is no
    /// version at all.
    static func majorVersion(of version: String?) -> Int? {
        guard let version else { return nil }
        let parts = version.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.allSatisfy({ part in !part.isEmpty && part.allSatisfy { $0.isASCII && $0.isNumber } }),
              let major = Int(parts[0]),
              major > 0
        else {
            return nil
        }
        return major
    }
}
