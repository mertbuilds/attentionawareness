import Foundation

/// How an iPhone is supervised.
///
/// Nothing here touches the iPhone, a backup or the window, which is why it
/// is a part of the run the tests can run.
enum SupervisionMethod: Hashable {
    /// The fast way: restore the cloud configuration and Setup Assistant
    /// completion preferences from a small backup. Experimental: it is not
    /// proven on real iPhones yet, so it is only ever picked by hand.
    case seed
    /// The full way: copy the whole iPhone, patch the copy, put it back.
    /// The proven method, and the one every run starts on.
    case fullCopy

    /// The method a run uses until somebody picks the other one.
    static let defaultMethod: SupervisionMethod = .fullCopy

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
        fastRefusal(iosVersion: iosVersion) == nil ? [.fullCopy, .seed] : [.fullCopy]
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
