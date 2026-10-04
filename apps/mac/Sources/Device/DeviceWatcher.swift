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
///
/// One pass is out at a time and a second one asked for meanwhile runs after
/// it, so reads never pile up. A phone that is starting can hold a read for
/// minutes, each lockdown value waiting out its own timeout, so the next pass
/// stops waiting for one that is still out after `passTimeout` and starts
/// beside it on a connection of its own. The slow one still lands when it
/// comes back, unless a newer one landed first. Every call a pass makes has a
/// timeout of its own, so each one ends, and no more than `maxPassesOut` are
/// ever out together.
@MainActor
final class DeviceWatcher: ObservableObject {
    /// Every iPhone on the cable right now, in the order usbmuxd lists them.
    @Published private(set) var devices: [ConnectedDevice] = []
    /// The udid of every iPhone usbmuxd lists on the cable, whether or not it
    /// could be read. A phone that is busy or still booting can fail a
    /// lockdown read and drop out of `devices` for a pass, so this is what
    /// says whether a phone was unplugged.
    @Published private(set) var onCable: [String] = []
    /// What MCInstall said about each paired phone, keyed by udid. A phone that
    /// has not been trusted yet has no entry.
    @Published private(set) var cloudConfigurations: [String: CloudConfiguration] = [:]
    /// The configuration profiles each paired phone lists, keyed by udid, in
    /// the order the phone gave them.
    @Published private(set) var installedProfiles: [String: [InstalledProfile]] = [:]
    /// The last read failure, as a sentence to show the user. Nil when the last
    /// pass went through.
    @Published private(set) var lastError: String?

    /// How many reads of the cable have landed. A wait that needs an answer
    /// newer than the one already published counts from here.
    private(set) var passes = 0

    /// How long a pass is given before the next one stops waiting for it.
    static let passTimeout: TimeInterval = 20
    /// How many passes may be out at once. Past this the next one waits for
    /// one of them to come back.
    static let maxPassesOut = 4

    private let readQueue = DispatchQueue(
        label: "com.attentionawareness.mac.device-read",
        attributes: .concurrent
    )
    private var subscription: idevice_subscription_context_t?
    private var relay: DeviceEventRelay?
    /// What one pass runs, or nil for a watcher that was handed its phones.
    /// That one reads no bus, which is what `reload()` and `show(...)` both
    /// turn on.
    private let reader: (@Sendable () -> Snapshot)?
    private var isSample: Bool { reader == nil }
    private let passTimeout: TimeInterval
    /// The newest pass that was started.
    private var passID = 0
    /// The pass whose answer is published. An older one lands nowhere.
    private var landedID = 0
    /// When the newest pass started, or nil once it is back.
    private var passStartedAt: Date?
    private var passesOut = 0
    private var wantsAnotherPass = false

    /// Subscribes to device events and reads whatever is already plugged in.
    init() {
        reader = { DeviceWatcher.read() }
        passTimeout = Self.passTimeout
        let relay = DeviceEventRelay { [weak self] in
            MainActor.assumeIsolated { self?.reload() }
        }
        self.relay = relay
        // The iPhone saying Trust was tapped is heard on another thread, and
        // the next read is what sends the Pair.
        TrustWatch.shared.onChange = { [weak relay] in relay?.fire() }

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
        reader = nil
        passTimeout = Self.passTimeout
        self.devices = devices
        onCable = devices.map(\.udid)
        self.cloudConfigurations = cloudConfigurations
        self.installedProfiles = installedProfiles
    }

    /// A watcher that reads through `reader` in place of the bus and hears no
    /// events, so every pass is one somebody asked for. The tests use it to
    /// say what each read of the cable finds, and how long it takes.
    init(reading reader: @escaping @Sendable () -> Snapshot, passTimeout: TimeInterval = DeviceWatcher.passTimeout) {
        self.reader = reader
        self.passTimeout = passTimeout
        apply(reader())
    }

    /// Hand a sample watcher another set of phones, so the hidden `--demo`
    /// path can plug one in, unplug it or add a second one while the window is
    /// open. It does nothing at all on a watcher that reads the real bus,
    /// which is the only kind the app itself ever makes.
    func show(
        devices: [ConnectedDevice],
        cloudConfigurations: [String: CloudConfiguration] = [:],
        installedProfiles: [String: [InstalledProfile]] = [:]
    ) {
        guard isSample else { return }
        self.devices = devices
        self.cloudConfigurations = cloudConfigurations
        self.installedProfiles = installedProfiles
        lastError = nil
        passes += 1
        onCable = devices.map(\.udid)
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

    /// True while a phone on the cable is locked, waits for Trust or could
    /// not be read, which is when reading it again can change the answer.
    var hasPendingDevice: Bool {
        devices.contains { $0.pairingState != .paired } || (lastError != nil && !onCable.isEmpty)
    }

    /// Reads every phone again. Safe to call from anywhere on the main actor.
    ///
    /// A sample watcher reads nothing: what it publishes was handed to it, and
    /// a bus read would put whatever iPhone happens to be plugged in over the
    /// top of it.
    func reload() {
        guard !isSample else { return }
        if let passStartedAt {
            let overdue = Date().timeIntervalSince(passStartedAt) >= passTimeout
            guard overdue, passesOut < Self.maxPassesOut else {
                wantsAnotherPass = true
                return
            }
        }
        startPass()
    }

    private func startPass() {
        guard let reader else { return }
        passID += 1
        let id = passID
        passStartedAt = Date()
        passesOut += 1
        wantsAnotherPass = false
        readQueue.async { [weak self] in
            let snapshot = reader()
            DispatchQueue.main.async {
                MainActor.assumeIsolated { self?.finishPass(id, with: snapshot) }
            }
        }
    }

    private func finishPass(_ id: Int, with snapshot: Snapshot) {
        passesOut -= 1
        // A slow pass still lands, as long as nothing newer has. One that
        // comes back after a newer answer says what is no longer true.
        if id > landedID {
            landedID = id
            apply(snapshot)
        }
        // Only the newest pass clears the clock: an older one coming back
        // says nothing about the one still out.
        if id == passID { passStartedAt = nil }
        if wantsAnotherPass { reload() }
    }

    private func apply(_ snapshot: Snapshot) {
        passes += 1
        let states = snapshot.devices.map(\.pairingState.rawValue)
        if states != devices.map(\.pairingState.rawValue) {
            DeviceLog.logger.notice("devices now: \(states.isEmpty ? "none" : states.joined(separator: ", "), privacy: .public)")
        }
        devices = snapshot.devices
        cloudConfigurations = snapshot.cloudConfigurations
        installedProfiles = snapshot.installedProfiles
        lastError = snapshot.error
        // A usbmuxd that did not answer says nothing about what is plugged in,
        // so the last answer stands rather than reading as an empty cable.
        if let listed = snapshot.onCable {
            onCable = listed
        }
    }

    /// The result of one pass over the bus.
    struct Snapshot: Sendable {
        var devices: [ConnectedDevice] = []
        /// What usbmuxd listed, or nil when it would not answer.
        var onCable: [String]?
        var cloudConfigurations: [String: CloudConfiguration] = [:]
        var installedProfiles: [String: [InstalledProfile]] = [:]
        var error: String?
    }

    /// Reads every phone on the cable. Runs off the main queue.
    private nonisolated static func read() -> Snapshot {
        var snapshot = Snapshot()
        let listed = ConnectedDevice.usbListing()
        snapshot.onCable = listed
        if let listed {
            TrustWatch.shared.keep(only: listed)
        } else {
            DeviceLog.logger.error("read: usbmuxd did not list devices")
        }
        for udid in listed ?? [] {
            do {
                let device = try ConnectedDevice.read(udid: udid)
                snapshot.devices.append(device)

                // Supervision and the installed profiles both come from
                // MCInstall, which needs a phone that has already trusted this
                // Mac. One client answers both. This read is best-effort: right
                // after trust completes MCInstall can still fail for a poll or
                // two, so a failure here only skips supervision for this pass
                // (leaving those entries unset) and never marks the device in
                // error. The device still shows as paired and the next poll
                // fills supervision in.
                guard device.pairingState == .paired else {
                    DeviceLog.logger.info("read: \(device.pairingState.rawValue, privacy: .public)")
                    continue
                }
                do {
                    let mcInstall = try MCInstall(udid: udid)
                    let configuration = try mcInstall.cloudConfiguration()
                    snapshot.cloudConfigurations[udid] = configuration
                    snapshot.installedProfiles[udid] = try mcInstall.profileList()
                    DeviceLog.logger.info("read: paired, supervised \(configuration.isSupervised, privacy: .public)")
                } catch {
                    DeviceLog.logger.error("read: paired, MCInstall failed: \(DeviceLog.text(error), privacy: .public)")
                    continue
                }
            } catch DeviceError.deviceUnavailable {
                // The phone was unplugged between the list and the read.
                DeviceLog.logger.info("read: unplugged during the read")
                continue
            } catch {
                DeviceLog.logger.error("read: failed: \(DeviceLog.text(error), privacy: .public)")
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
    // A denial and a Trust dialog both belong to one connection, so an
    // iPhone that leaves the cable starts over.
    if event.pointee.event == IDEVICE_DEVICE_REMOVE, let udid = event.pointee.udid {
        TrustWatch.shared.forget(String(cString: udid))
    }
    Unmanaged<DeviceEventRelay>.fromOpaque(userData).takeUnretainedValue().fire()
}
