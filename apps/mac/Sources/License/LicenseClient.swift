import Foundation

/// What a pasted key is good for, as far as Polar says.
enum LicenseCheck: Equatable, Sendable {
    /// Polar knows the key, it is granted, and it has a supervision left on it.
    case usable
    /// The key is real, and its one supervision has been spent.
    case usedUp
    /// Polar knows the key and will not honour it: it was revoked, disabled or
    /// has expired.
    case revoked
    /// No key like this belongs to the organization.
    case notFound
    /// Polar could not be asked, or did not say anything about the key. Nothing
    /// is known either way, so the same question can be asked again.
    case unavailable
}

/// How spending a key on a supervision went.
enum LicenseSpend: Equatable, Sendable {
    /// Polar counted the supervision against the key.
    case spent
    /// Polar refused, and will refuse the same request every time: the key is
    /// used up, revoked or unknown. This is final, so the pending spend goes.
    case rejected
    /// Polar could not be asked, or could not answer. The pending spend stays
    /// and is tried again later.
    case transient
}

/// Asks Polar about one supervision key, and spends it.
///
/// Both go through Polar's public customer portal endpoint, `POST
/// /v1/customer-portal/license-keys/validate`, which needs no token and is
/// meant for an app on somebody's own computer. A check validates the key
/// without touching its usage; a spend validates it with `increment_usage`
/// set to one, which Polar refuses with a 400 once the key has nothing left.
///
/// A spend whose answer was lost on the way back can have gone through. Trying
/// it again then finds the key used up and ends as `rejected`, which removes
/// the pending spend just as `spent` would have.
struct LicenseClient: Sendable {
    private static let path = "v1/customer-portal/license-keys/validate"
    /// Short enough that a dead network is not a long spinner under the key
    /// field.
    private static let timeout: TimeInterval = 15

    let config: LicenseConfig
    /// The session every request goes through. Injectable so the tests answer
    /// from canned JSON and never reach Polar.
    let session: URLSession

    init(config: LicenseConfig = .current, session: URLSession = .shared) {
        self.config = config
        self.session = session
    }

    /// A key as the reader pasted it, without the spaces and line breaks a copy
    /// from an email or a receipt brings along.
    static func cleaned(_ key: String) -> String {
        key.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether a key still has its supervision on it. Nothing is spent.
    func check(key: String) async -> LicenseCheck {
        let key = Self.cleaned(key)
        guard !key.isEmpty else { return .notFound }
        switch await validate(key: key, incrementUsage: nil) {
        case .accepted(let data):
            guard let validated = try? JSONDecoder().decode(Validated.self, from: data) else {
                return .unavailable
            }
            return validated.check
        case .overLimit:
            return .usedUp
        case .inactive:
            return .revoked
        case .unknown:
            return .notFound
        case .refused, .unreachable:
            // A refusal that is not about the key says nothing about the key.
            return .unavailable
        }
    }

    /// Count one supervision against a key.
    func spend(key: String) async -> LicenseSpend {
        let key = Self.cleaned(key)
        guard !key.isEmpty else { return .rejected }
        switch await validate(key: key, incrementUsage: 1) {
        case .accepted:
            return .spent
        case .overLimit, .inactive, .unknown, .refused:
            return .rejected
        case .unreachable:
            return .transient
        }
    }

    // MARK: - Asking Polar

    /// What one validate call came back with, before it means anything to a
    /// check or a spend.
    private enum Answer {
        /// A 2xx, with its body.
        case accepted(Data)
        /// 400: the increment asked for is more than the key has left.
        case overLimit
        /// 404 for a key Polar knows but no longer honours.
        case inactive
        /// 404 for a key Polar does not know.
        case unknown
        /// Any other 4xx. The same request would get the same answer.
        case refused
        /// No answer, or one that says to come back later: a network failure,
        /// a timeout, a rate limit or a server error.
        case unreachable
    }

    private func validate(key: String, incrementUsage: Int?) async -> Answer {
        var request = URLRequest(url: config.apiBase.appendingPathComponent(Self.path))
        request.httpMethod = "POST"
        request.timeoutInterval = Self.timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(
            Body(key: key, organizationID: config.organizationID, incrementUsage: incrementUsage)
        )

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            return .unreachable
        }
        guard let http = response as? HTTPURLResponse else {
            return .unreachable
        }
        switch http.statusCode {
        case 200..<300:
            return .accepted(data)
        case 400:
            return .overLimit
        case 404:
            return Self.isInactive(data) ? .inactive : .unknown
        case 408, 429, 500...:
            return .unreachable
        default:
            return .refused
        }
    }

    /// Polar answers a revoked, disabled or expired key with the same 404 as a
    /// key it never issued, and only the sentence in `detail` tells them apart:
    /// "License key is no longer active." or "License key has expired." against
    /// a bare "Not found". Anything it does not recognise reads as not found.
    private static func isInactive(_ data: Data) -> Bool {
        guard let detail = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.detail else {
            return false
        }
        let said = detail.lowercased()
        return said.contains("no longer active") || said.contains("expired")
    }

    /// The request body. `increment_usage` is left out of a check rather than
    /// sent as zero.
    private struct Body: Encodable {
        let key: String
        let organizationID: String
        let incrementUsage: Int?

        enum CodingKeys: String, CodingKey {
            case key
            case organizationID = "organization_id"
            case incrementUsage = "increment_usage"
        }
    }

    /// The part of Polar's `ValidatedLicenseKey` a check reads.
    private struct Validated: Decodable {
        let status: String
        let usage: Int
        /// Nil for a key with no usage limit.
        let limitUsage: Int?

        enum CodingKeys: String, CodingKey {
            case status
            case usage
            case limitUsage = "limit_usage"
        }

        var check: LicenseCheck {
            // Polar only answers 200 for a granted key, so any other status is
            // one this app was never told about.
            guard status == "granted" else { return .revoked }
            if let limitUsage, usage >= limitUsage {
                return .usedUp
            }
            return .usable
        }
    }

    /// The body Polar answers a 400 or a 404 with.
    private struct ErrorBody: Decodable {
        let detail: String?
    }
}
