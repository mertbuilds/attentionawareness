import Foundation
import Testing

/// Asking Apple for apps, without asking Apple.
///
/// Every request in here goes through a `URLProtocol` that answers from canned
/// JSON, so the suite works on a Mac with no network and never spends one of
/// Apple's unauthenticated requests. What is checked is the two things that
/// can drift: the url the endpoints are asked with, and what one of their rows
/// turns into.
@Suite(.serialized)
final class AppSearchTests {
    private let search: AppSearch

    init() {
        StubURLProtocol.reset()
        search = AppSearch(session: StubURLProtocol.session())
    }

    deinit {
        StubURLProtocol.reset()
    }

    // MARK: - The name an app is known by

    @Test func aTaglineAfterADashIsNotPartOfTheName() {
        #expect(AppSearch.shortName("TikTok - Videos, Music & LIVE") == "TikTok")
    }

    @Test func everySeparatorTheAppStoreUsesCutsTheTagline() {
        #expect(AppSearch.shortName("Threads – Instagram's text app") == "Threads")
        #expect(AppSearch.shortName("Reddit — Dive into anything") == "Reddit")
        #expect(AppSearch.shortName("Notion: notes, docs, tasks") == "Notion")
        #expect(AppSearch.shortName("Pinterest | Ideas") == "Pinterest")
        #expect(AppSearch.shortName("Kick · Live streaming") == "Kick")
    }

    @Test func aNameWithNoTaglineIsLeftAlone() {
        #expect(AppSearch.shortName("Instagram") == "Instagram")
        #expect(AppSearch.shortName("X") == "X")
    }

    @Test func theEarliestSeparatorIsTheOneThatCuts() {
        #expect(AppSearch.shortName("Foo: bar - baz") == "Foo")
        #expect(AppSearch.shortName("Foo - bar: baz") == "Foo")
    }

    @Test func aNameThatStartsOnASeparatorIsNeverCutToNothing() {
        #expect(AppSearch.shortName(": Foo") == ": Foo")
        #expect(AppSearch.shortName("| Foo") == "| Foo")
    }

    @Test func theNameComesBackTrimmed() {
        #expect(AppSearch.shortName("  Instagram  ") == "Instagram")
        #expect(AppSearch.shortName("  TikTok  -  Videos ") == "TikTok")
    }

    // MARK: - How many results one search asks for

    @Test func theLimitStaysWithinWhatAListCanShow() {
        #expect(AppSearch.clamped(AppSearch.defaultLimit) == 10)
        #expect(AppSearch.clamped(0) == 1)
        #expect(AppSearch.clamped(-5) == 1)
        #expect(AppSearch.clamped(100) == AppSearch.maxLimit)
        #expect(AppSearch.clamped(7) == 7)
    }

    // MARK: - The url the search is asked with

    @Test func theSearchNamesTheTermTheStoreTheEntityAndTheLimit() async throws {
        StubURLProtocol.answerWith(Self.oneApp)
        _ = try await search.search("tiktok", country: "tr", limit: 5)
        let query = try #require(StubURLProtocol.lastQuery())
        #expect(StubURLProtocol.lastRequest()?.url?.path == "/search")
        #expect(query["term"] == "tiktok")
        #expect(query["country"] == "tr")
        #expect(query["entity"] == "software")
        #expect(query["limit"] == "5")
    }

    @Test func theSearchAsksTheMacsOwnStoreWhenNoneIsNamed() async throws {
        StubURLProtocol.answerWith(Self.oneApp)
        _ = try await search.search("tiktok")
        #expect(StubURLProtocol.lastQuery()?["country"] == Storefronts.current())
        #expect(StubURLProtocol.lastQuery()?["limit"] == String(AppSearch.defaultLimit))
    }

    @Test func aLimitTheCallerOverreachesWithIsCappedInTheUrl() async throws {
        StubURLProtocol.answerWith(Self.oneApp)
        _ = try await search.search("tiktok", country: "us", limit: 500)
        #expect(StubURLProtocol.lastQuery()?["limit"] == String(AppSearch.maxLimit))
    }

    @Test func aPlusInTheTermIsSearchedForRatherThanReadAsASpace() async throws {
        StubURLProtocol.answerWith(Self.oneApp)
        _ = try await search.search("c++", country: "us")
        #expect(StubURLProtocol.lastRequest()?.url?.query == "term=c%2B%2B&country=us&entity=software&limit=10")
        #expect(StubURLProtocol.lastQuery()?["term"] == "c++")
    }

    @Test func anEmptyTermAsksNothingAtAll() async throws {
        let results = try await search.search("   ", country: "us")
        #expect(results == [])
        #expect(StubURLProtocol.requests.count == 0)
    }

    // MARK: - The url the lookup is asked with

    @Test func theLookupPutsEveryIdInOneParameter() async throws {
        StubURLProtocol.answerWith(Self.oneApp)
        _ = try await search.lookup(["com.reddit.Reddit", "com.burbn.instagram"], country: "us")
        let query = try #require(StubURLProtocol.lastQuery())
        #expect(StubURLProtocol.lastRequest()?.url?.path == "/lookup")
        #expect(query["bundleId"] == "com.reddit.Reddit,com.burbn.instagram")
        #expect(query["country"] == "us")
        #expect(query["entity"] == "software")
    }

    @Test func blankIdsAreDroppedAndTheRestAreStillAskedFor() async throws {
        StubURLProtocol.answerWith(Self.oneApp)
        _ = try await search.lookup(["", "  ", " com.reddit.Reddit "], country: "us")
        #expect(StubURLProtocol.lastQuery()?["bundleId"] == "com.reddit.Reddit")
    }

    @Test func anEmptyIdListAsksNothingAtAll() async throws {
        let none = try await search.lookup([], country: "us")
        let blanks = try await search.lookup(["", " "], country: "us")
        #expect(none == [])
        #expect(blanks == [])
        #expect(StubURLProtocol.requests.count == 0)
    }

    // MARK: - What a row turns into

    @Test func aRowBecomesTheAppItNames() async throws {
        StubURLProtocol.answerWith(Self.oneApp)
        let results = try await search.search("tiktok", country: "us")
        #expect(
            results
                == [
                    AppResult(
                        bundleId: "com.zhiliaoapp.musically",
                        developer: "TikTok Ltd.",
                        iconUrl: "https://example.com/100x100bb.jpg",
                        id: 835_599_320,
                        name: "TikTok - Videos, Music & LIVE",
                        sellerUrl: "http://www.tiktok.com"
                    ),
                ]
        )
    }

    @Test func aRowWithNoBundleIdIdentifiesNoAppSoItIsDropped() async throws {
        StubURLProtocol.answerWith(
            #"{"resultCount":2,"results":[{"trackName":"Nothing"},{"bundleId":"tv.twitch","trackName":"Twitch"}]}"#
        )
        let results = try await search.search("twitch", country: "us")
        #expect(results.map(\.bundleId) == ["tv.twitch"])
    }

    @Test func theSmallerArtworkStandsInWhenTheLargerOneIsMissing() async throws {
        StubURLProtocol.answerWith(
            #"{"results":[{"bundleId":"tv.twitch","artworkUrl60":"https://example.com/60.jpg"}]}"#
        )
        let results = try await search.search("twitch", country: "us")
        #expect(results.first?.iconUrl == "https://example.com/60.jpg")
    }

    @Test func aRowThatCarriesNothingButAnIdStillBecomesAnApp() async throws {
        StubURLProtocol.answerWith(#"{"results":[{"bundleId":"tv.twitch"}]}"#)
        let results = try await search.search("twitch", country: "us")
        #expect(
            results
                == [AppResult(bundleId: "tv.twitch", developer: "", iconUrl: "", id: 0, name: "", sellerUrl: nil)]
        )
    }

    @Test func anAnswerWithNoResultsAtAllIsAnEmptyList() async throws {
        StubURLProtocol.answerWith(#"{"resultCount":0}"#)
        let results = try await search.search("nothing at all", country: "us")
        #expect(results == [])
    }

    // MARK: - What goes wrong

    @Test func aRefusalCarriesItsStatusSoARateLimitCanBeToldFromAnOutage() async {
        StubURLProtocol.answerWith("", status: 403)
        do {
            _ = try await search.search("tiktok", country: "us")
            Issue.record("A refused search should throw.")
        } catch {
            #expect((error as? AppSearchError) == .status(403))
        }
    }

    @Test func anOutageIsToldApartFromARefusal() async {
        StubURLProtocol.answerWith("", status: 503)
        do {
            _ = try await search.search("tiktok", country: "us")
            Issue.record("A failed search should throw.")
        } catch {
            #expect((error as? AppSearchError) == .status(503))
        }
    }

    @Test func aRequestThatNeverArrivesIsOffline() async {
        StubURLProtocol.failWith(URLError(.notConnectedToInternet))
        do {
            _ = try await search.search("tiktok", country: "us")
            Issue.record("A search that never arrived should throw.")
        } catch {
            #expect((error as? AppSearchError) == .offline)
        }
    }

    @Test func anAnswerThatIsNotAListOfAppsIsMalformed() async {
        StubURLProtocol.answerWith("<html>not json</html>")
        do {
            _ = try await search.search("tiktok", country: "us")
            Issue.record("An unreadable answer should throw.")
        } catch {
            #expect((error as? AppSearchError) == .malformed)
        }
    }

    @Test func aSearchTheCallerWalkedAwayFromIsNotAnOutage() async {
        StubURLProtocol.failWith(URLError(.cancelled))
        do {
            _ = try await search.search("tiktok", country: "us")
            Issue.record("A cancelled search should throw.")
        } catch {
            #expect(error is CancellationError)
        }
    }

    @Test func everyFailureSaysWhatItIsInASentence() {
        #expect(
            AppSearchError.offline.localizedDescription
                == "This Mac could not reach the App Store. Check the internet connection and try again."
        )
        #expect(
            AppSearchError.status(429).localizedDescription
                == "The App Store answered 429 rather than a list of apps. Try again in a moment."
        )
        #expect(
            AppSearchError.malformed.localizedDescription
                == "The App Store answered a list this app could not read."
        )
    }

    /// One `entity=software` row, shaped the way Apple answers, with the
    /// artwork urls cut down to something a test can read.
    private static let oneApp = """
        {
          "resultCount": 1,
          "results": [
            {
              "artistName": "TikTok Ltd.",
              "artworkUrl60": "https://example.com/60x60bb.jpg",
              "artworkUrl100": "https://example.com/100x100bb.jpg",
              "bundleId": "com.zhiliaoapp.musically",
              "sellerUrl": "http://www.tiktok.com",
              "trackId": 835599320,
              "trackName": "TikTok - Videos, Music & LIVE"
            }
          ]
        }
        """
}

/// Answers every request from canned bytes, so no test reaches the network.
final class StubURLProtocol: URLProtocol {
    /// What the next request is answered with. A nil body means the stub was
    /// never set up, which fails the request rather than reaching Apple.
    static var answer: (status: Int, body: Data)?
    /// What the next request fails with instead of answering.
    static var failure: Error?
    /// Every request the stub was asked, in order.
    static var requests: [URLRequest] = []

    static func reset() {
        answer = nil
        failure = nil
        requests = []
    }

    /// A session that reaches nothing but this stub.
    static func session() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    static func answerWith(_ body: String, status: Int = 200) {
        answer = (status: status, body: Data(body.utf8))
        failure = nil
    }

    static func failWith(_ error: Error) {
        answer = nil
        failure = error
    }

    static func lastRequest() -> URLRequest? {
        requests.last
    }

    /// The parameters of the last request, decoded, so a test reads names
    /// rather than a percent encoded string.
    static func lastQuery() -> [String: String]? {
        guard
            let url = requests.last?.url,
            let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        else {
            return nil
        }
        return Dictionary(items.map { ($0.name, $0.value ?? "") }, uniquingKeysWith: { first, _ in first })
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        if let failure = Self.failure {
            client?.urlProtocol(self, didFailWithError: failure)
            return
        }
        guard let answer = Self.answer, let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL))
            return
        }
        let response = HTTPURLResponse(
            url: url,
            statusCode: answer.status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: answer.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
