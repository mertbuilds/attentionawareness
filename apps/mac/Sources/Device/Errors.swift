import Foundation

/// Everything the device layer can fail with. The messages are the ones that
/// reach the screen, so they are whole sentences that say what to do next.
enum DeviceError: LocalizedError, Equatable {
    /// The Mac could not start listening for iPhones on the USB bus.
    case eventSubscriptionFailed(code: Int32)
    /// The iPhone was in the device list but could not be opened.
    case deviceUnavailable(udid: String)
    /// The iPhone is waiting for an answer to the Trust dialog, or it is
    /// locked with a passcode.
    case trustPending
    /// The Trust dialog was answered with Don't Trust.
    case trustDenied
    /// The lockdown handshake failed for a reason that is not about trust.
    case lockdownFailed(code: Int32)
    /// The iPhone refused to start a service.
    case serviceStartFailed(name: String, code: Int32)
    /// The service started but the Mac could not open a connection to it.
    case serviceConnectionFailed(name: String, code: Int32)
    /// A request was sent but the iPhone did not answer it.
    case requestFailed(request: String, code: Int32)
    /// The iPhone answered with something the app cannot read.
    case unexpectedResponse(request: String)
    /// The iPhone answered a request with an error. The reason comes from the
    /// iPhone.
    case requestRefused(request: String, reason: String)
    /// The iPhone rejected a profile. The reason comes from the iPhone.
    case profileRejected(reason: String)

    var errorDescription: String? {
        switch self {
        case .eventSubscriptionFailed(let code):
            return "This Mac can't watch the USB port for iPhones. usbmuxd reported error \(code)."
        case .deviceUnavailable(let udid):
            return "iPhone \(udid) is no longer connected. Plug it back in with a cable."
        case .trustPending:
            return "iPhone hasn't trusted this Mac yet. Unlock it and tap Trust."
        case .trustDenied:
            return "iPhone refused to trust this Mac. Unplug it, plug it back in and tap Trust."
        case .lockdownFailed(let code):
            return "This Mac couldn't reach iPhone. Lockdown reported error \(code)."
        case .serviceStartFailed(let name, let code):
            return "iPhone didn't start the service \(name). Lockdown reported error \(code)."
        case .serviceConnectionFailed(let name, let code):
            return "This Mac couldn't connect to the service \(name) on iPhone. The service reported error \(code)."
        case .requestFailed(let request, let code):
            return "iPhone didn't answer the \(request) request. The service reported error \(code)."
        case .unexpectedResponse(let request):
            return "iPhone answered the \(request) request with something the app can't read."
        case .requestRefused(let request, let reason):
            return "iPhone refused the \(request) request. \(reason)"
        case .profileRejected(let reason):
            return "iPhone refused the profile. \(reason)"
        }
    }
}
