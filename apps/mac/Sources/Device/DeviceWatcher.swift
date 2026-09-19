import CImobileDevice
import Combine
import Foundation

/// Watches the USB bus and keeps a live picture of the iPhones on it.
///
/// libimobiledevice delivers add and remove events on its own thread. Every
/// event triggers one fresh pass: the device list is read again and each phone
/// is asked for its lockdown values and its supervision state. Reading is done
/// off the main queue because a lockdown handshake on a locked phone can take a
/// second or two.
@MainActor
final class DeviceWatcher: ObservableObject {
    /// Every iPhone on the cable right now, in the order usbmuxd lists them.
    @Published private(set) var devices: [ConnectedDevice] = []
    /// What MCInstall said about each paired phone, keyed by udid. A phone that
    /// has not been trusted yet has no entry.
    @Published private(set) var cloudConfigurations: [String: CloudConfiguration] = [:]
    /// The configuration profiles each paired phone lists, keyed by udid, in
    /// the order the phone gave them.
    @Published private(set) var installedProfiles: [String: [InstalledProfile]] = [:]
    /// The last read failure, as a sentence to show the user. Nil when the last
    /// pass went through.
    @Published private(set) var lastError: String?

    private let readQueue = DispatchQueue(label: "com.attentionawareness.mac.device-read")
    private var subscription: idevice_subscription_context_t?
    private var relay: DeviceEventRelay?

    /// Subscribes to device events and reads whatever is already plugged in.
    init() {
        let relay = DeviceEventRelay { [weak self] in
            MainActor.assumeIsolated { self?.reload() }
        }
        self.relay = relay

        var context: idevice_subscription_context_t?
        let status = idevice_events_subscribe(
            &context,
            deviceEventCallback,
            Unmanaged.passRetained(relay).toOpaque()
        )
        if status == IDEVICE_E_SUCCESS {
            subscription = context
        } else {
            // Nothing is holding the retain that was handed to the callback.
            Unmanaged.passUnretained(relay).release()
            self.relay = nil
            lastError = DeviceError.eventSubscriptionFailed(code: status.rawValue).localizedDescription
        }

        reload()
    }

    /// A watcher that watches nothing: it publishes the phones it is handed,
    /// subscribes to no events and reads no bus. The hidden `--ui-smoke` path
    /// uses it to draw the steps with no iPhone on the cable.
    init(
        sample devices: [ConnectedDevice],
        cloudConfigurations: [String: CloudConfiguration] = [:],
        installedProfiles: [String: [InstalledProfile]] = [:]
    ) {
        self.devices = devices
        self.cloudConfigurations = cloudConfigurations
        self.installedProfiles = installedProfiles
    }

    deinit {
        // Clear the handler first, then stop delivery, then give back the
        // retain the subscription was holding. `idevice_events_unsubscribe`
        // only returns once no callback is in flight.
        relay?.stop()
        if let subscription {
            idevice_events_unsubscribe(subscription)
        }
        if let relay {
            Unmanaged.passUnretained(relay).release()
        }
    }

    /// Reads every phone again. Safe to call from anywhere on the main actor.
    func reload() {
        readQueue.async { [weak self] in
            let snapshot = DeviceWatcher.read()
            DispatchQueue.main.async {
                MainActor.assumeIsolated { self?.apply(snapshot) }
            }
        }
    }

    private func apply(_ snapshot: Snapshot) {
        devices = snapshot.devices
        cloudConfigurations = snapshot.cloudConfigurations
        installedProfiles = snapshot.installedProfiles
        lastError = snapshot.error
    }

    /// The result of one pass over the bus.
    private struct Snapshot {
        var devices: [ConnectedDevice] = []
        var cloudConfigurations: [String: CloudConfiguration] = [:]
        var installedProfiles: [String: [InstalledProfile]] = [:]
        var error: String?
    }

    /// Reads every phone on the cable. Runs off the main queue.
    private nonisolated static func read() -> Snapshot {
        var snapshot = Snapshot()
        for udid in ConnectedDevice.usbUdids() {
            do {
                let device = try ConnectedDevice.read(udid: udid)
                snapshot.devices.append(device)

                // Supervision and the installed profiles both come from
                // MCInstall, which needs a phone that has already trusted this
                // Mac. One client answers both.
                if device.pairingState == .paired {
                    let mcInstall = try MCInstall(udid: udid)
                    snapshot.cloudConfigurations[udid] = try mcInstall.cloudConfiguration()
                    snapshot.installedProfiles[udid] = try mcInstall.profileList()
                }
            } catch DeviceError.deviceUnavailable {
                // The phone was unplugged between the list and the read.
                continue
            } catch {
                snapshot.error = error.localizedDescription
            }
        }
        return snapshot
    }
}

/// Carries device events from the libimobiledevice thread to the main queue.
///
/// The subscription holds a retain on the relay, so the relay outlives any
/// callback that is already running. `stop()` clears the handler under the
/// lock, so a callback that arrives while the watcher is going away does
/// nothing.
private final class DeviceEventRelay: @unchecked Sendable {
    private let lock = NSLock()
    private var handler: (() -> Void)?

    init(handler: @escaping () -> Void) {
        self.handler = handler
    }

    func stop() {
        lock.lock()
        handler = nil
        lock.unlock()
    }

    func fire() {
        lock.lock()
        let handler = self.handler
        lock.unlock()
        guard let handler else { return }
        DispatchQueue.main.async(execute: handler)
    }
}

/// The C callback libimobiledevice calls on its event thread.
private let deviceEventCallback: idevice_event_cb_t = { event, userData in
    guard let event, let userData else { return }
    // Network devices are ignored: this app works over the cable only.
    guard event.pointee.conn_type == CONNECTION_USBMUXD else { return }
    Unmanaged<DeviceEventRelay>.fromOpaque(userData).takeUnretainedValue().fire()
}
