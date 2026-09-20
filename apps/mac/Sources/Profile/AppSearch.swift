import Foundation

/// One App Store app, as Apple's `entity=software` rows describe it.
struct AppResult: Equatable, Sendable {
    let bundleId: String
    let developer: String
    let iconUrl: String
    let id: Int
    let name: String
    /// Apple's developer website for the app, absent on rows that carry none.
    let sellerUrl: String?
}

/// What asking Apple for apps can fail with. The messages are the ones the
/// user reads, so they are whole sentences that say what to do next.
enum AppSearchError: LocalizedError, Equatable {
    /// The request never reached Apple.
    case offline
    /// Apple answered with something that is not a list of apps. The status is
    /// kept so a rate limit can be told from an outage.
    case status(Int)
    /// Apple answered a list this app could not read.
    case malformed

    var errorDescription: String? {
        switch self {
        case .offline:
            return "This Mac could not reach the App Store. Check the internet connection and try again."
        case .status(let status):
            return "The App Store answered \(status) rather than a list of apps. Try again in a moment."
        case .malformed:
            return "The App Store answered a list this app could not read."
        }
    }
}

/// Looks apps up through Apple's public iTunes Search API.
///
/// The endpoints need no key and no account, so the app calls them directly.
/// Nothing is cached: the caller owns request lifetime and cancels a stale
/// keystroke search by cancelling its task, which surfaces here as a
/// `CancellationError` rather than as an outage.
struct AppSearch: Sendable {
    private static let searchUrl = URL(string: "https://itunes.apple.com/search")!
    private static let lookupUrl = URL(string: "https://itunes.apple.com/lookup")!
    static let defaultLimit = 10
    static let maxLimit = 25
    /// Short enough that a dead network is not a long spinner under a search
    /// that runs on every keystroke.
    private static let timeout: TimeInterval = 15

    /// The session every request goes through. Injectable so the tests answer
    /// from canned JSON and never reach Apple.
    let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    /// Apps whose App Store title matches a search term, in the storefront the
    /// caller names. An empty term asks for nothing.
    func search(
        _ term: String,
        country: String? = nil,
        limit: Int = AppSearch.defaultLimit
    ) async throws -> [AppResult] {
        let query = term.trimmingCharacters(in: .whitespacesAndNewlines)
        if query.isEmpty {
            return []
        }
        return try await results(
            from: Self.searchUrl,
            queryItems: [
                URLQueryItem(name: "term", value: query),
                URLQueryItem(name: "country", value: country ?? Storefronts.current()),
                URLQueryItem(name: "entity", value: "software"),
                URLQueryItem(name: "limit", value: String(Self.clamped(limit))),
            ]
        )
    }

    /// Apps the caller already knows the bundle ids of, which is how the
    /// blocked list gets its names and artwork. The endpoint takes the whole
    /// set in one comma separated `bundleId` parameter. Ids the storefront
    /// does not carry are simply absent from the answer, so the caller decides
    /// what an unmatched id means.
    func lookup(_ bundleIds: [String], country: String? = nil) async throws -> [AppResult] {
        let ids = bundleIds
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if ids.isEmpty {
            return []
        }
        return try await results(
            from: Self.lookupUrl,
            queryItems: [
                URLQueryItem(name: "bundleId", value: ids.joined(separator: ",")),
                URLQueryItem(name: "country", value: country ?? Storefronts.current()),
                URLQueryItem(name: "entity", value: "software"),
            ]
        )
    }

    /// The name an app is known by, taken out of its App Store title: "TikTok
    /// - Videos, Shop & LIVE" is TikTok. Apple's `trackName` carries a
    /// marketing tagline after a separator, which no icon or list row has room
    /// for. A title that only ends on a separator keeps it, so a name is never
    /// cut to nothing.
    static func shortName(_ trackName: String) -> String {
        let name = trackName.trimmingCharacters(in: .whitespacesAndNewlines)
        var cut: String.Index?
        for separator in nameSeparators {
            guard let range = name.range(of: separator), range.lowerBound != name.startIndex else {
                continue
            }
            let tail = name[range.upperBound...].trimmingCharacters(in: .whitespacesAndNewlines)
            if tail.isEmpty {
                continue
            }
            if cut == nil || range.lowerBound < cut! {
                cut = range.lowerBound
            }
        }
        guard let cut else {
            return name
        }
        return String(name[..<cut]).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The limit one search is allowed to ask for. Apple caps a page well
    /// above this; the smaller cap is about a list a reader can still scan.
    static func clamped(_ limit: Int) -> Int {
        min(max(limit, 1), maxLimit)
    }

    /// What the App Store puts between an app's name and its tagline.
    private static let nameSeparators = [" - ", " – ", " — ", ": ", " | ", " · "]

    /// The rows one call answers with, or what went wrong instead.
    private func results(from url: URL, queryItems: [URLQueryItem]) async throws -> [AppResult] {
        var request = URLRequest(url: Self.url(url, queryItems: queryItems))
        request.timeoutInterval = Self.timeout
        // Every keystroke asks a different question, and a storefront's answer
        // changes without notice, so a cached body is never the right one.
        request.cachePolicy = .reloadIgnoringLocalCacheData

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            // A search the caller walked away from is not an outage, and the
            // list it was going to fill is already gone.
            if error is CancellationError || (error as? URLError)?.code == .cancelled {
                throw CancellationError()
            }
            throw AppSearchError.offline
        }
        guard let http = response as? HTTPURLResponse else {
            throw AppSearchError.offline
        }
        guard (200..<300).contains(http.statusCode) else {
            throw AppSearchError.status(http.statusCode)
        }
        guard let payload = try? JSONDecoder().decode(SoftwarePayload.self, from: data) else {
            throw AppSearchError.malformed
        }
        return payload.appResults
    }

    /// One endpoint with its parameters on it.
    ///
    /// `URLComponents` leaves a literal `+` in a value alone, and Apple reads
    /// that as a space, so "c++" would search for "c". Spelling it out keeps a
    /// term the reader typed the term Apple is asked for.
    private static func url(_ base: URL, queryItems: [URLQueryItem]) -> URL {
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems
        components.percentEncodedQuery = components.percentEncodedQuery?
            .replacingOccurrences(of: "+", with: "%2B")
        return components.url!
    }

    /// What both `entity=software` endpoints answer with.
    private struct SoftwarePayload: Decodable {
        let results: [SoftwareResult]?

        /// A row without a bundle id identifies no app, so it is not a usable
        /// result.
        var appResults: [AppResult] {
            (results ?? []).compactMap { result in
                guard let bundleId = result.bundleId else { return nil }
                return AppResult(
                    bundleId: bundleId,
                    developer: result.artistName ?? "",
                    iconUrl: result.artworkUrl100 ?? result.artworkUrl60 ?? "",
                    id: result.trackId ?? 0,
                    name: result.trackName ?? "",
                    sellerUrl: result.sellerUrl
                )
            }
        }
    }

    /// Shape of one `entity=software` row as returned by the iTunes APIs.
    private struct SoftwareResult: Decodable {
        let artistName: String?
        let artworkUrl100: String?
        let artworkUrl60: String?
        let bundleId: String?
        let sellerUrl: String?
        let trackId: Int?
        let trackName: String?
    }
}
