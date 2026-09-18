import Foundation

/// What asking the site for a signature can fail with. The messages are the
/// ones the user reads, so they are whole sentences that say what to do next.
enum ProfileError: LocalizedError, Equatable {
    /// The request never reached the site.
    case offline
    /// The site answered, and the answer was not a profile. The reason comes
    /// from the site.
    case rejected(String)

    var errorDescription: String? {
        switch self {
        case .offline:
            return "This Mac could not reach the site that signs the profile. Check the internet connection and try again."
        case .rejected(let reason):
            return "The site did not sign the profile. \(reason)"
        }
    }
}

/// Asks attentionawareness.com to sign one profile.
///
/// The signing certificate is the founder's Developer ID and never leaves the
/// Worker, so the app builds the configuration and the site turns it into the
/// `.mobileconfig` bytes the iPhone accepts. Nothing is cached: every call is
/// a new profile with a new identifier, which is what lets a second one stack
/// on the first instead of loosening it.
struct ProfileSigner {
    /// The path on the site, and the environment variable that moves the whole
    /// thing to a dev server.
    private static let path = "api/sign"
    static let siteVariable = "AA_SITE_URL"
    private static let site = URL(string: "https://attentionawareness.com")!
    /// Long enough for a cold Worker, short enough that a dead network is not
    /// a minute of spinner.
    private static let timeout: TimeInterval = 30

    /// The site this signer asks. Production unless `AA_SITE_URL` says
    /// otherwise.
    let site: URL
    /// True only under the override. A dev server behind portless has a
    /// certificate from a local authority this app does not know, and trusting
    /// one is a thing production must never do.
    let trustsSelfSignedCertificate: Bool

    init(environment: [String: String] = ProcessInfo.processInfo.environment) {
        if let override = environment[Self.siteVariable].flatMap(URL.init(string:)) {
            site = override
            trustsSelfSignedCertificate = true
        } else {
            site = Self.site
            trustsSelfSignedCertificate = false
        }
    }

    /// The signed `.mobileconfig` bytes, ready for `MCInstall.installProfile`.
    func signedProfile(for config: ProfileConfig) async throws -> Data {
        var request = URLRequest(url: site.appendingPathComponent(Self.path))
        request.httpMethod = "POST"
        request.timeoutInterval = Self.timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(Self.userAgent, forHTTPHeaderField: "User-Agent")
        request.httpBody = try JSONEncoder().encode(Body(config: config))

        let session = URLSession(
            configuration: .ephemeral,
            delegate: trustsSelfSignedCertificate ? SelfSignedTrust(host: site.host ?? "") : nil,
            delegateQueue: nil
        )
        // The session holds its delegate until it is invalidated, and this one
        // is used for a single request.
        defer { session.finishTasksAndInvalidate() }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw ProfileError.offline
        }
        guard let http = response as? HTTPURLResponse else {
            throw ProfileError.offline
        }
        guard (200..<300).contains(http.statusCode) else {
            throw ProfileError.rejected(Self.reason(data, status: http.statusCode))
        }
        return data
    }

    /// The request body. The route reads `config` and nothing else.
    private struct Body: Encodable {
        let config: ProfileConfig
    }

    /// The body `api.sign.ts` answers every refusal with.
    struct ErrorBody: Decodable, Equatable {
        let error: String
    }

    /// Which release asked, so a request can be traced to a version of the app.
    private static var userAgent: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
        return "attention awareness mac/\(version)"
    }

    /// What the site said, in as many of its own words as it gave.
    private static func reason(_ data: Data, status: Int) -> String {
        guard
            let body = try? JSONDecoder().decode(ErrorBody.self, from: data),
            !body.error.isEmpty
        else {
            return "It answered \(status) and said nothing more."
        }
        return "It said: \(body.error)."
    }
}

/// Trusts the dev server's certificate, and only its host.
///
/// It is reached through `AA_SITE_URL`, which production never sets, so the
/// app as it ships has no way into this class at all.
private final class SelfSignedTrust: NSObject, URLSessionDelegate {
    private let host: String

    init(host: String) {
        self.host = host
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        let space = challenge.protectionSpace
        guard
            space.authenticationMethod == NSURLAuthenticationMethodServerTrust,
            space.host == host,
            let trust = space.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }
}
