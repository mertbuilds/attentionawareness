import CImobileDevice
import Foundation

/// Listens on an iPhone's insecure notification proxy, which needs no
/// pairing, for the two notifications usbmuxd's preflight listens for:
/// `request_pair`, posted once the person has tapped Trust and entered the
/// passcode, and `request_host_buid`, which is answered with this Mac's
/// SystemBUID as preflight does.
///
/// The callback runs on the proxy's own thread and only hands the name to
/// `TrustWatch`. Freeing the observer waits for that thread to stop, so it is
/// only ever freed away from it (`TrustWatch.release`).
///
/// It follows what usbmuxd's `src/preflight.c` does with the same public
/// libimobiledevice calls; no code is taken from it.
final class TrustObserver {
    private let device: idevice_t
    private let client: np_client_t
    private let context: Unmanaged<Context>

    init?(udid: String, watch: TrustWatch) {
        var device: idevice_t?
        guard idevice_new_with_options(&device, udid, IDEVICE_LOOKUP_USBMUX) == IDEVICE_E_SUCCESS, let device else {
            return nil
        }
        var lockdown: lockdownd_client_t?
        guard lockdownd_client_new(device, &lockdown, LockdownSession.label) == LOCKDOWN_E_SUCCESS, let lockdown else {
            idevice_free(device)
            return nil
        }
        var service: lockdownd_service_descriptor_t?
        let started = lockdownd_start_service(lockdown, "com.apple.mobile.insecure_notification_proxy", &service)
        lockdownd_client_free(lockdown)
        guard started == LOCKDOWN_E_SUCCESS, let service else {
            DeviceLog.logger.error("notification proxy refused: \(started.rawValue, privacy: .public)")
            idevice_free(device)
            return nil
        }
        var client: np_client_t?
        let connected = np_client_new(device, service, &client)
        lockdownd_service_descriptor_free(service)
        guard connected == NP_E_SUCCESS, let client else {
            idevice_free(device)
            return nil
        }

        let context = Unmanaged.passRetained(Context(udid: udid, watch: watch))
        self.device = device
        self.client = client
        self.context = context
        // Set before the callback's thread starts, so it reads it safely.
        context.takeUnretainedValue().observer = ObjectIdentifier(self)
        np_set_notify_callback(client, trustNotificationCallback, context.toOpaque())
        let names = [TrustWatch.requestPair, TrustWatch.requestHostBUID]
        let cStrings = names.map { strdup($0) }
        var spec: [UnsafePointer<CChar>?] = cStrings.map { UnsafePointer($0) } + [nil]
        np_observe_notifications(client, &spec)
        cStrings.forEach { free($0) }
    }

    deinit {
        np_client_free(client)
        context.release()
        idevice_free(device)
    }

    fileprivate final class Context {
        let udid: String
        let watch: TrustWatch
        /// The observer this context belongs to, so a watch that ended is
        /// told apart from a newer one.
        var observer: ObjectIdentifier?

        init(udid: String, watch: TrustWatch) {
            self.udid = udid
            self.watch = watch
        }

        /// Gives the iPhone this Mac's SystemBUID, as preflight's
        /// `lockdownd_set_untrusted_host_buid` does.
        func sendHostBUID() {
            var device: idevice_t?
            guard idevice_new_with_options(&device, udid, IDEVICE_LOOKUP_USBMUX) == IDEVICE_E_SUCCESS, let device else {
                return
            }
            defer { idevice_free(device) }
            var lockdown: lockdownd_client_t?
            guard lockdownd_client_new(device, &lockdown, LockdownSession.label) == LOCKDOWN_E_SUCCESS, let lockdown else {
                return
            }
            defer { lockdownd_client_free(lockdown) }
            var buid: UnsafeMutablePointer<CChar>?
            guard usbmuxd_read_buid(&buid) == 0, let buid else { return }
            defer { free(buid) }
            let status = lockdownd_set_value(lockdown, nil, "UntrustedHostBUID", plist_new_string(buid))
            DeviceLog.logger.notice("sent host BUID: \(status.rawValue, privacy: .public)")
        }
    }
}

private let trustNotificationCallback: np_notify_cb_t = { name, userData in
    guard let userData else { return }
    let context = Unmanaged<TrustObserver.Context>.fromOpaque(userData).takeUnretainedValue()
    let notification = name.map { String(cString: $0) } ?? ""
    if notification == TrustWatch.requestHostBUID {
        context.sendHostBUID()
    }
    context.watch.notified(context.udid, name: notification, by: context.observer)
}
