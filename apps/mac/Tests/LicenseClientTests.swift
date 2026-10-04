import Foundation
import Testing

/// Asking Polar about a supervision key, without asking Polar.
///
/// Every request in here goes through a `URLProtocol` that answers the way
/// Polar's validate endpoint does, so the suite works with no network and no
/// Polar organization. What is checked is the request the endpoint is asked
/// with, and what each of its answers means to a check and to a spend.
@Suite(.serialized)
final class LicenseClientTests {
    private static let config = LicenseConfig(
        apiBase: URL(string: "https://polar.test")!,
        organizationID: "1dbfc517-0bbf-4301-9ba8-555ca42b9737",
        checkoutURL: URL(string: "https://polar.test/checkout")!
    )
    private static let key = "AA-3F2C1D0E-8B7A-4C6D-9E5F-1A2B3C4D5E6F"

    private let client: LicenseClient

    init() {
        PolarStubURLProtocol.reset()
        client = LicenseClient(config: Self.config, session: PolarStubURLProtocol.session())
    }

    deinit {
        PolarStubURLProtocol.reset()
    }

    // MARK: - Where the keys are checked

    @Test func aDebugBuildChecksKeysInPolarsSandbox() {
        #expect(LicenseConfig.current == .sandbox)
        #expect(LicenseConfig.sandbox.apiBase.host == "sandbox-api.polar.sh")
        #expect(LicenseConfig.production.apiBase.host == "api.polar.sh")
    }

    // The two below guard against shipping a placeholder production config.

    @Test func aReleaseBuildNamesARealOrganization() {
        #expect(UUID(uuidString: LicenseConfig.production.organizationID) != nil)
    }

    @Test func aReleaseBuildSellsKeysOnARealCheckout() {
        #expect(!LicenseConfig.production.checkoutURL.absoluteString.contains("TODO"))
    }

    // MARK: - The request

    @Test func aCheckPostsTheKeyAndTheOrganizationAndNothingElse() async throws {
        PolarStubURLProtocol.answerWith(Self.validated(usage: 0, limit: 1))
        _ = await client.check(key: Self.key)

        let request = try #require(PolarStubURLProtocol.requests.last)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.absoluteString == "https://polar.test/v1/customer-portal/license-keys/validate")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        // The endpoint is public, and the app carries no token to send.
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil)

        let body = try #require(PolarStubURLProtocol.lastBody())
        #expect(Set(body.keys) == ["key", "organization_id"])
        #expect(body["key"] as? String == Self.key)
        #expect(body["organization_id"] as? String == Self.config.organizationID)
    }

    @Test func aSpendAsksForOneMoreUse() async throws {
        PolarStubURLProtocol.answerWith(Self.validated(usage: 1, limit: 1))
        _ = await client.spend(key: Self.key)

        let body = try #require(PolarStubURLProtocol.lastBody())
        #expect(Set(body.keys) == ["increment_usage", "key", "organization_id"])
        #expect(body["increment_usage"] as? Int == 1)
        #expect(body["key"] as? String == Self.key)
        #expect(PolarStubURLProtocol.requests.last?.url?.path == "/v1/customer-portal/license-keys/validate")
    }

    @Test func thePastedSpacesAndLineBreaksAreNotPartOfTheKey() async throws {
        PolarStubURLProtocol.answerWith(Self.validated(usage: 0, limit: 1))
        _ = await client.check(key: "  \(Self.key)\n")
        #expect(try #require(PolarStubURLProtocol.lastBody())["key"] as? String == Self.key)

        _ = await client.spend(key: "\t\(Self.key) \r\n")
        #expect(try #require(PolarStubURLProtocol.lastBody())["key"] as? String == Self.key)
    }

    @Test func aBlankKeyAsksNothingAtAll() async {
        #expect(await client.check(key: "  \n") == .notFound)
        #expect(await client.spend(key: "") == .rejected)
        #expect(PolarStubURLProtocol.requests.isEmpty)
    }

    // MARK: - What a check finds

    @Test func aGrantedKeyWithItsUseLeftIsUsable() async {
        PolarStubURLProtocol.answerWith(Self.validated(usage: 0, limit: 1))
        #expect(await client.check(key: Self.key) == .usable)
    }

    @Test func aKeyWithNoUsageLimitIsUsable() async {
        PolarStubURLProtocol.answerWith(Self.validated(usage: 7, limit: nil))
        #expect(await client.check(key: Self.key) == .usable)
    }

    @Test func aKeyWhoseUseIsSpentIsUsedUp() async {
        PolarStubURLProtocol.answerWith(Self.validated(usage: 1, limit: 1))
        #expect(await client.check(key: Self.key) == .usedUp)
    }

    @Test func aRevokedOrDisabledKeyIsRevoked() async {
        PolarStubURLProtocol.answerWith(Self.notFound("License key is no longer active."), status: 404)
        #expect(await client.check(key: Self.key) == .revoked)
    }

    @Test func anExpiredKeyIsRevoked() async {
        PolarStubURLProtocol.answerWith(Self.notFound("License key has expired."), status: 404)
        #expect(await client.check(key: Self.key) == .revoked)
    }

    @Test func aKeyPolarNeverIssuedIsNotFound() async {
        PolarStubURLProtocol.answerWith(Self.notFound("Not found"), status: 404)
        #expect(await client.check(key: Self.key) == .notFound)
    }

    @Test func aNotFoundWithABodyNobodyCanReadIsStillNotFound() async {
        PolarStubURLProtocol.answerWith("<html>404</html>", status: 404)
        #expect(await client.check(key: Self.key) == .notFound)
    }

    @Test func aCheckThatNeverArrivesSaysNothingAboutTheKey() async {
        PolarStubURLProtocol.failWith(URLError(.notConnectedToInternet))
        #expect(await client.check(key: Self.key) == .unavailable)
    }

    @Test func aServerErrorOrARateLimitSaysNothingAboutTheKey() async {
        PolarStubURLProtocol.answerWith("", status: 502)
        #expect(await client.check(key: Self.key) == .unavailable)
        PolarStubURLProtocol.answerWith("", status: 429)
        #expect(await client.check(key: Self.key) == .unavailable)
    }

    @Test func aRequestPolarCannotReadSaysNothingAboutTheKey() async {
        // What a placeholder organization id gets back.
        PolarStubURLProtocol.answerWith(
            #"{"detail":[{"loc":["body","organization_id"],"msg":"Input should be a valid UUID","type":"uuid_parsing"}]}"#,
            status: 422
        )
        #expect(await client.check(key: Self.key) == .unavailable)
    }

    @Test func aSuccessWithABodyNobodyCanReadSaysNothingAboutTheKey() async {
        PolarStubURLProtocol.answerWith("<html>ok</html>")
        #expect(await client.check(key: Self.key) == .unavailable)
    }

    // MARK: - How a spend ends

    @Test func aSpendPolarCountedIsSpent() async {
        PolarStubURLProtocol.answerWith(Self.validated(usage: 1, limit: 1))
        #expect(await client.spend(key: Self.key) == .spent)
    }

    @Test func aSpendOverTheLimitIsRejectedForGood() async {
        PolarStubURLProtocol.answerWith(
            #"{"error":"BadRequest","detail":"License key only has 0 more usages."}"#,
            status: 400
        )
        #expect(await client.spend(key: Self.key) == .rejected)
    }

    @Test func aSpendOnARevokedOrUnknownKeyIsRejectedForGood() async {
        PolarStubURLProtocol.answerWith(Self.notFound("License key is no longer active."), status: 404)
        #expect(await client.spend(key: Self.key) == .rejected)
        PolarStubURLProtocol.answerWith(Self.notFound("Not found"), status: 404)
        #expect(await client.spend(key: Self.key) == .rejected)
    }

    @Test func aSpendThatNeverArrivesIsTriedAgainLater() async {
        PolarStubURLProtocol.failWith(URLError(.networkConnectionLost))
        #expect(await client.spend(key: Self.key) == .transient)
        PolarStubURLProtocol.failWith(URLError(.timedOut))
        #expect(await client.spend(key: Self.key) == .transient)
    }

    @Test func aSpendPolarCouldNotAnswerYetIsTriedAgainLater() async {
        PolarStubURLProtocol.answerWith("", status: 503)
        #expect(await client.spend(key: Self.key) == .transient)
        PolarStubURLProtocol.answerWith("", status: 429)
        #expect(await client.spend(key: Self.key) == .transient)
        PolarStubURLProtocol.answerWith("", status: 408)
        #expect(await client.spend(key: Self.key) == .transient)
    }

    // MARK: - Polar's answers

    /// A `ValidatedLicenseKey`, shaped the way Polar answers a 200, with the
    /// nested customer cut down to what a test can read.
    private static func validated(usage: Int, limit: Int?) -> String {
        """
        {
          "id": "0b6a1c2e-5f3d-4e8a-9b7c-1d2e3f4a5b6c",
          "created_at": "2026-09-30T12:00:00Z",
          "modified_at": null,
          "organization_id": "\(config.organizationID)",
          "customer_id": "7c8d9e0f-1a2b-4c3d-8e5f-6a7b8c9d0e1f",
          "customer": { "id": "7c8d9e0f-1a2b-4c3d-8e5f-6a7b8c9d0e1f", "email": "reader@example.com" },
          "benefit_id": "2f3e4d5c-6b7a-4980-8a1b-2c3d4e5f6a7b",
          "key": "\(key)",
          "display_key": "****-5E6F",
          "status": "granted",
          "limit_activations": null,
          "usage": \(usage),
          "limit_usage": \(limit.map(String.init) ?? "null"),
          "validations": 3,
          "last_validated_at": "2026-09-30T12:00:00Z",
          "expires_at": null,
          "activation": null
        }
        """
    }

    /// The body Polar answers a 404 with. The sentence is the only thing that
    /// tells a revoked key from one that was never issued.
    private static func notFound(_ detail: String) -> String {
        #"{"error":"ResourceNotFound","detail":"\#(detail)"}"#
    }
}

/// Answers every request the way Polar would have, from canned bytes.
///
/// Its own class rather than `StubURLProtocol`, because that one's answer is
/// shared state and `AppSearchTests` runs beside this suite.
final class PolarStubURLProtocol: URLProtocol {
    /// What the next request is answered with. A nil answer means the stub was
    /// never set up, which fails the request rather than reaching Polar.
    static var answer: (status: Int, body: Data)?
    /// What the next request fails with instead of answering.
    static var failure: Error?
    /// Every request the stub was asked, in order.
    static var requests: [URLRequest] = []
    /// The body of every request, in the same order. A session hands a
    /// protocol the body as a stream rather than as `httpBody`, so it is read
    /// out when the request arrives.
    static var bodies: [Data] = []

    static func reset() {
        answer = nil
        failure = nil
        requests = []
        bodies = []
    }

    /// A session that reaches nothing but this stub.
    static func session() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [PolarStubURLProtocol.self]
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

    /// The JSON body of the last request, decoded, so a test reads names
    /// rather than bytes.
    static func lastBody() -> [String: Any]? {
        guard let data = bodies.last else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        Self.bodies.append(request.httpBody ?? Self.read(request.httpBodyStream))
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

    private static func read(_ stream: InputStream?) -> Data {
        guard let stream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
