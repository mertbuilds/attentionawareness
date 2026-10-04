import Foundation

/// Sends the one count to the site's PostHog project.
///
/// It goes through `e.attentionawareness.com`, the same first-party proxy the
/// website uses. It is sent once and forgotten: a short timeout, no retry, no
/// queue on disk, and an answer nobody reads, so a Mac that is offline loses
/// the count and nothing else.
enum SupervisionEventSender {
    static let endpoint = URL(string: "https://e.attentionawareness.com/i/v0/e/")!
    /// How long the request may take before it is dropped.
    static let timeout: TimeInterval = 5

    /// The request for one event. Nil when the body would not encode, which
    /// drops the count.
    static func request(for event: SupervisionFinishedEvent, distinctID: UUID) -> URLRequest? {
        guard let body = try? JSONEncoder().encode(event.payload(distinctID: distinctID)) else { return nil }
        var request = URLRequest(url: endpoint, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // The headers macOS would fill in name the Darwin build and the
        // languages this Mac is set to, so both are fixed here.
        request.setValue("attentionawareness-mac/\(event.appVersion)", forHTTPHeaderField: "User-Agent")
        request.setValue("en", forHTTPHeaderField: "Accept-Language")
        request.httpBody = body
        return request
    }

    /// Send the count and wait for nothing. A debug build sends nothing at
    /// all, so the demo, the tests and a build made from source for
    /// development never add to the count.
    static func send(_ event: SupervisionFinishedEvent) {
        #if !DEBUG
        guard let request = request(for: event, distinctID: UUID()) else { return }
        // No cookies and no cache, so nothing of one request is carried into
        // the next.
        let session = URLSession(configuration: .ephemeral)
        session.dataTask(with: request) { _, _, _ in
            session.finishTasksAndInvalidate()
        }.resume()
        #endif
    }
}
