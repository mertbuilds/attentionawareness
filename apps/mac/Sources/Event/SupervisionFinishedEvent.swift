import Foundation

/// The one thing the app ever sends about a run: a count that says a
/// supervision finished.
///
/// It holds four things and nothing else: the app version, the method, the
/// first number of the iOS version and the first number of the macOS version.
/// Nothing in it names the iPhone, this Mac or the person, and nothing about
/// what was blocked goes with it. Why and what is never sent:
/// `docs/adr/0009-mac-app-one-anonymous-event.md`.
///
/// Nothing here reaches a network, which is why the tests read every key of
/// it.
struct SupervisionFinishedEvent: Equatable, Sendable {
    let appVersion: String
    let method: SupervisionMethod
    /// The first number of the iOS version, such as 26. Nil when the iPhone
    /// gave no version, and then the key is left out.
    let iosMajor: Int?
    let macosMajor: Int

    /// `iosVersion` is the version as the iPhone reports it, such as
    /// `26.6.2`. Only its first number is kept.
    init(appVersion: String, method: SupervisionMethod, iosVersion: String?, macosMajor: Int) {
        self.appVersion = appVersion
        self.method = method
        self.iosMajor = IOSSupport.majorVersion(of: iosVersion)
        self.macosMajor = macosMajor
    }

    /// What the Ready screen and the About window say about the count.
    static let disclosure =
        "When a supervision finishes, the app sends one anonymous count. "
        + "It holds the app version, the method, and the first number of the iOS version "
        + "and of the macOS version. "
        + "Nothing that names you or your iPhone."

    /// The body PostHog's capture endpoint takes.
    ///
    /// `distinctID` is a new random UUID for every event. It is not stored and
    /// not used again, so two counts cannot be tied to each other or to a
    /// person.
    func payload(distinctID: UUID) -> Payload {
        Payload(
            apiKey: Payload.projectKey,
            event: "supervision_finished",
            distinctID: distinctID.uuidString,
            properties: Payload.Properties(
                appVersion: appVersion,
                method: method == .fullCopy ? "full_copy" : "fast",
                iosMajor: iosMajor,
                macosMajor: macosMajor,
                processPersonProfile: false,
                geoipDisable: true
            )
        )
    }

    struct Payload: Encodable, Equatable {
        /// The public client key of the site's PostHog project, the one the
        /// website ships to every browser. It can only write events.
        static let projectKey = "phc_DfvN33UTDFBHJfUfC46o4aKL33aGLR7qEmEJYfWjh9gi"

        let apiKey: String
        let event: String
        let distinctID: String
        let properties: Properties

        enum CodingKeys: String, CodingKey {
            case apiKey = "api_key"
            case event
            case distinctID = "distinct_id"
            case properties
        }

        struct Properties: Encodable, Equatable {
            let appVersion: String
            let method: String
            let iosMajor: Int?
            let macosMajor: Int
            /// False keeps PostHog from making a person profile for the event.
            let processPersonProfile: Bool
            /// True keeps PostHog from working out a place from the address
            /// the request came from.
            let geoipDisable: Bool

            enum CodingKeys: String, CodingKey {
                case appVersion = "app_version"
                case method
                case iosMajor = "ios_major"
                case macosMajor = "macos_major"
                case processPersonProfile = "$process_person_profile"
                case geoipDisable = "$geoip_disable"
            }
        }
    }
}
