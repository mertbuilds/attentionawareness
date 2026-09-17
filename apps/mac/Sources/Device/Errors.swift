import Foundation

/// Everything the device layer can fail with. The messages are the ones the
/// user reads, so they are whole sentences that say what to do next.
enum DeviceError: LocalizedError, Equatable {
    /// The Mac could not start listening for iPhones on the USB bus.
    case eventSubscriptionFailed(code: Int32)
    /// The phone was in the device list but could not be opened.
    case deviceUnavailable(udid: String)
    /// The phone is waiting for the user to answer the Trust dialog, or it is
    /// locked with a passcode.
    case trustPending
    /// The user answered the Trust dialog with Don't Trust.
    case trustDenied
    /// The lockdown handshake failed for a reason that is not about trust.
    case lockdownFailed(code: Int32)
    /// The phone refused to start a service.
    case serviceStartFailed(name: String, code: Int32)
    /// The service started but the Mac could not open a connection to it.
    case serviceConnectionFailed(name: String, code: Int32)
    /// A request was sent but the phone did not answer it.
    case requestFailed(request: String, code: Int32)
    /// The phone answered with something this app cannot read.
    case unexpectedResponse(request: String)
    /// The phone answered a request with an error. The reason comes from the
    /// phone.
    case requestRefused(request: String, reason: String)
    /// The phone rejected a profile. The reason comes from the phone.
    case profileRejected(reason: String)

    var errorDescription: String? {
        switch self {
        case .eventSubscriptionFailed(let code):
            return "The Mac cannot watch the USB port for iPhones. usbmuxd reported error \(code)."
        case .deviceUnavailable(let udid):
            return "The iPhone \(udid) is no longer connected. Plug it back in with a cable."
        case .trustPending:
            return "The iPhone has not trusted this Mac yet. Unlock the phone and tap Trust."
        case .trustDenied:
            return "The iPhone refused to trust this Mac. Unplug it, plug it back in and tap Trust."
        case .lockdownFailed(let code):
            return "The Mac could not talk to the iPhone. Lockdown reported error \(code)."
        case .serviceStartFailed(let name, let code):
            return "The iPhone did not start the service \(name). Lockdown reported error \(code)."
        case .serviceConnectionFailed(let name, let code):
            return "The Mac could not connect to the service \(name) on the iPhone. The service reported error \(code)."
        case .requestFailed(let request, let code):
            return "The iPhone did not answer the \(request) request. The service reported error \(code)."
        case .unexpectedResponse(let request):
            return "The iPhone answered the \(request) request with something this app cannot read."
        case .requestRefused(let request, let reason):
            return "The iPhone refused the \(request) request. \(reason)"
        case .profileRejected(let reason):
            return "The iPhone refused the profile. \(reason)"
        }
    }
}
