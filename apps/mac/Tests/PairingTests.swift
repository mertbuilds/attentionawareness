import CImobileDevice
import Foundation
import Testing

/// Opening a lockdown session on an iPhone that may have forgotten this Mac,
/// against a fake that answers the handshake and Pair the way the real one
/// did after the fast method's restart.
struct PairingTests {
    @Test func aPhoneThatKnowsTheMacIsNeverAskedToPair() throws {
        let phone = FakeLockdown()
        try phone.open()
        #expect(phone.pairs == 0)
    }

    @Test func aLockedPhoneIsAskedAgainEveryTwoSeconds() {
        let phone = FakeLockdown()
        phone.tick = 0
        phone.forget()
        phone.locked = true
        #expect(throws: DeviceError.locked) { try phone.open() }
        phone.advance(1)
        #expect(throws: DeviceError.locked) { try phone.open() }
        #expect(phone.pairs == 1)
        phone.advance(1)
        #expect(throws: DeviceError.locked) { try phone.open() }
        #expect(phone.pairs == 2)
        #expect(!phone.dialogShown)
    }

    /// The owner's run: a second Pair while he typed the passcode cancelled
    /// it, and the iPhone said no until the cable was pulled.
    @Test func trustOnScreenGetsNoSecondPairHoweverLongItTakes() {
        let phone = FakeLockdown()
        phone.forget()
        phone.locked = true
        #expect(throws: DeviceError.locked) { try phone.open() }
        phone.locked = false
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.dialogShown)
        let pairs = phone.pairs
        for _ in 0..<39 {
            #expect(throws: DeviceError.trustPending) { try phone.open() }
        }
        // Past the limit the read asks for a replug, and still sends no Pair.
        for _ in 0..<10 {
            #expect(throws: DeviceError.trustUnseen) { try phone.open() }
        }
        #expect(phone.pairs == pairs)
        #expect(!phone.denied)
    }

    @Test func requestPairSendsOnePairAndThePhoneIsPaired() throws {
        let phone = FakeLockdown()
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.pairs == 1)
        phone.accept()
        try phone.open()
        #expect(phone.pairs == 2)
        #expect(phone.macRecordIsKnown)
        try phone.open()
        #expect(phone.pairs == 2)
    }

    @Test func theFakeSaysNoToAPairSentWhileThePasscodeIsTyped() {
        let phone = FakeLockdown()
        phone.forget()
        #expect(phone.pair() == LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING)
        #expect(phone.pair() == LOCKDOWN_E_USER_DENIED_PAIRING)
    }

    @Test func dontTrustEndsThePairingUntilThePhoneIsPluggedInAgain() throws {
        let phone = FakeLockdown()
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        phone.deny()
        // The answer comes with the next Pair, and none follows it.
        phone.trust.notified("phone", name: TrustWatch.requestPair)
        #expect(throws: DeviceError.trustDenied) { try phone.open() }
        let pairs = phone.pairs
        for _ in 0..<10 {
            #expect(throws: DeviceError.trustDenied) { try phone.open() }
        }
        #expect(phone.pairs == pairs)
        #expect(DeviceError.trustDenied.pairingState == .untrusted)
        #expect(
            DeviceError.trustDenied.errorDescription
                == "iPhone did not trust this Mac. Unplug iPhone, plug it in again, then tap Trust."
        )
        phone.replug()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.pairs == pairs + 1)
    }

    @Test func theWatchGoesWhenThePhoneLeavesOrIsPaired() async throws {
        let phone = FakeLockdown()
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.liveObservers == 1)
        phone.replug()
        #expect(await settles { phone.liveObservers == 0 })
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.liveObservers == 1)
        phone.accept()
        try phone.open()
        #expect(await settles { phone.liveObservers == 0 })
    }

    @Test func trustThatCannotBeHeardEndsInAReplugNotAWaitForever() {
        let phone = FakeLockdown()
        phone.canObserve = false
        phone.tick = 10
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        var error: DeviceError?
        for _ in 0..<20 where error == nil {
            do { try phone.open() } catch let thrown as DeviceError where thrown != .trustPending {
                error = thrown
            } catch {}
        }
        #expect(error == .trustUnseen)
        #expect(phone.pairs == 1)
    }

    /// Don't Trust, or a Trust alert that closed with the screen lock, posts
    /// nothing. The watch is alive, and the read still ends in a replug.
    @Test func trustWithNoAnswerHeardEndsInAReplugAndALateTapStillPairs() throws {
        let phone = FakeLockdown()
        phone.tick = 10
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.liveObservers == 1)
        #expect(firstFailureAfterTrust(phone) == .trustUnseen)
        for _ in 0..<5 {
            #expect(throws: DeviceError.trustUnseen) { try phone.open() }
        }
        #expect(phone.pairs == 1)
        #expect(phone.liveObservers == 1)
        phone.accept()
        try phone.open()
        #expect(phone.pairs == 2)
        #expect(phone.macRecordIsKnown)
    }

    @Test func dontTrustWithNoNotificationEndsInAReplugThroughTheLimit() {
        let phone = FakeLockdown()
        phone.tick = 10
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        phone.deny()
        #expect(firstFailureAfterTrust(phone) == .trustUnseen)
        #expect(phone.pairs == 1)
        #expect(DeviceError.trustUnseen.pairingState == .needsReplug)
        phone.replug()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.pairs == 2)
    }

    @Test func aRecordTheMacCouldNotKeepIsAFailureNotAWaitForTrust() {
        let phone = FakeLockdown()
        phone.forget()
        phone.accept()
        phone.loseSavedRecord = true
        #expect(throws: DeviceError.pairRecordRejected) { try phone.open() }
        #expect(DeviceError.pairRecordRejected.pairingState == .needsReplug)
    }

    @Test func aRecordTheMacCouldNotKeepStaysAFailureUntilAReplug() throws {
        let phone = FakeLockdown()
        phone.forget()
        phone.accept()
        phone.loseSavedRecord = true
        #expect(throws: DeviceError.pairRecordRejected) { try phone.open() }
        #expect(phone.pairs == 1)
        for _ in 0..<5 {
            #expect(throws: DeviceError.pairRecordRejected) { try phone.open() }
        }
        phone.trust.notified("phone", name: TrustWatch.requestPair)
        #expect(throws: DeviceError.pairRecordRejected) { try phone.open() }
        #expect(phone.pairs == 1)
        phone.replug()
        phone.loseSavedRecord = false
        try phone.open()
        #expect(phone.pairs == 2)
        #expect(phone.macRecordIsKnown)
    }

    @Test func anOldWatchThatEndsLeavesTheNewOneInPlace() {
        let trust = TrustWatch()
        let now = Date()
        let old = NSObject()
        let new = NSObject()
        trust.startObserving("phone", at: now, with: { old })
        trust.notified("phone", name: "", by: ObjectIdentifier(old))
        #expect(trust.isObserving["phone"] == false)
        trust.startObserving("phone", at: now + TrustWatch.observeRetryInterval, with: { new })
        trust.notified("phone", name: "", by: ObjectIdentifier(old))
        #expect(trust.isObserving["phone"] == true)
        trust.notified("phone", name: "", by: ObjectIdentifier(new))
        #expect(trust.isObserving["phone"] == false)
    }

    @Test func aPairOutAlreadyIsNotSentTwice() {
        let trust = TrustWatch()
        let now = Date()
        #expect(trust.next("phone", at: now) == .pair("first"))
        #expect(trust.next("phone", at: now) == .hold(LOCKDOWN_E_INVALID_HOST_ID))
        #expect(trust.next("other", at: now) == .pair("first"))
    }

    @Test func otherFailuresAreNotAnsweredWithPair() {
        var pairs = 0
        #expect(throws: DeviceError.lockdownFailed(code: LOCKDOWN_E_RECEIVE_TIMEOUT.rawValue)) {
            try Pairing.open(udid: "phone", trust: TrustWatch(), handshake: { LOCKDOWN_E_RECEIVE_TIMEOUT }, pair: {
                pairs += 1
                return LOCKDOWN_E_SUCCESS
            })
        }
        #expect(pairs == 0)
    }

    @Test func eachWaitingCodeIsAPairingState() {
        #expect(Pairing.error(for: LOCKDOWN_E_PASSWORD_PROTECTED).pairingState == .locked)
        #expect(Pairing.error(for: LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING).pairingState == .trustPending)
        #expect(Pairing.error(for: LOCKDOWN_E_INVALID_HOST_ID).pairingState == .trustPending)
        #expect(Pairing.error(for: LOCKDOWN_E_USER_DENIED_PAIRING).pairingState == .untrusted)
        #expect(Pairing.error(for: LOCKDOWN_E_RECEIVE_TIMEOUT).pairingState == nil)
    }

    /// The run on iOS 27.2: the handshake failed with MuxError while iPhone
    /// went down for its restart, and the window said "Tap Trust".
    @Test func aConnectionThatDropsIsNotAWaitForTrust() {
        #expect(Pairing.error(for: LOCKDOWN_E_MUX_ERROR) == .lockdownFailed(code: LOCKDOWN_E_MUX_ERROR.rawValue))
        #expect(Pairing.error(for: LOCKDOWN_E_MUX_ERROR).pairingState == nil)
        let phone = FakeLockdown()
        phone.forget()
        phone.dropping = true
        for _ in 0..<5 {
            #expect(throws: DeviceError.lockdownFailed(code: LOCKDOWN_E_MUX_ERROR.rawValue)) { try phone.open() }
        }
        #expect(phone.pairs == 0)
        #expect(!phone.dialogShown)
        // Back up and unlocked, it is asked to pair as if nothing had dropped.
        phone.dropping = false
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.pairs == 1)
        #expect(phone.dialogShown)
    }

    /// A Pair that the dropping connection ate goes again on the same clock
    /// as any other Pair that failed.
    @Test func aPairLostToADroppedConnectionGoesAgainAfterTwoSeconds() {
        let trust = TrustWatch()
        let start = Date(timeIntervalSinceReferenceDate: 0)
        var pairs = 0
        func open(at seconds: TimeInterval) throws {
            try Pairing.open(
                udid: "phone", trust: trust, now: start + seconds,
                handshake: { LOCKDOWN_E_INVALID_HOST_ID },
                pair: {
                    pairs += 1
                    return LOCKDOWN_E_MUX_ERROR
                }
            )
        }
        let dropped = DeviceError.lockdownFailed(code: LOCKDOWN_E_MUX_ERROR.rawValue)
        #expect(throws: dropped) { try open(at: 0) }
        #expect(throws: dropped) { try open(at: 1) }
        #expect(pairs == 1)
        #expect(throws: dropped) { try open(at: 2) }
        #expect(pairs == 2)
    }

    @Test func theLogNeverCarriesAUdid() {
        #expect(DeviceLog.text(DeviceError.deviceUnavailable(udid: "00008030-0001")) == "deviceUnavailable")
        #expect(DeviceLog.text(DeviceError.lockdownFailed(code: -21)) == "lockdownFailed -21")
    }

    /// Reads until the answer is no longer "Tap Trust", well past the limit.
    private func firstFailureAfterTrust(_ phone: FakeLockdown) -> DeviceError? {
        for _ in 0..<20 {
            do { try phone.open() } catch let thrown as DeviceError where thrown != .trustPending {
                return thrown
            } catch {}
        }
        return nil
    }

    private func settles(_ condition: () -> Bool) async -> Bool {
        let deadline = ContinuousClock.now + .seconds(3)
        while !condition(), ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(5))
        }
        return condition()
    }
}

/// An iPhone's lockdown as far as trust goes. The Mac holds one pair record,
/// the iPhone the host ids it trusts. A restore that resets the iPhone's
/// pairing empties that list. Pair makes a new record, as libimobiledevice
/// does: the first one shows Trust, one sent while the person is still
/// answering cancels it and the iPhone says no until the cable is pulled,
/// and once Trust is tapped and the passcode entered the iPhone posts
/// `request_pair` and the next Pair goes through.
final class FakeLockdown: @unchecked Sendable {
    let trust = TrustWatch()
    private let lock = NSLock()
    private var known: Set<Int> = [1]
    private var record: Int? = 1
    private var nextHost = 2
    private var pairCount = 0
    private var dialog = false
    private var isLocked = false
    private var hasAccepted = false
    private var hasDenied = false
    private var clock = Date(timeIntervalSinceReferenceDate: 0)
    private var step: TimeInterval = 3
    private var refuseSavedRecord = false
    private var observing = true
    private var observers = 0
    private var isDropping = false

    /// The iPhone is going down for a restart: the connection to lockdown
    /// drops before it answers anything.
    var dropping: Bool {
        get { lock.withLock { isDropping } }
        set { lock.withLock { isDropping = newValue } }
    }
    var locked: Bool {
        get { lock.withLock { isLocked } }
        set { lock.withLock { isLocked = newValue } }
    }
    /// Every read moves the clock on by this much, the way the Mac's reads
    /// are spaced.
    var tick: TimeInterval {
        get { lock.withLock { step } }
        set { lock.withLock { step = newValue } }
    }
    /// Pair goes through but the record never reaches the Mac's store.
    var loseSavedRecord: Bool {
        get { lock.withLock { refuseSavedRecord } }
        set { lock.withLock { refuseSavedRecord = newValue } }
    }
    /// Whether the iPhone starts the insecure notification proxy.
    var canObserve: Bool {
        get { lock.withLock { observing } }
        set { lock.withLock { observing = newValue } }
    }
    var pairs: Int { lock.withLock { pairCount } }
    var dialogShown: Bool { lock.withLock { dialog } }
    var denied: Bool { lock.withLock { hasDenied } }
    var liveObservers: Int { lock.withLock { observers } }
    var macRecordIsKnown: Bool { lock.withLock { record.map(known.contains) ?? false } }

    func advance(_ seconds: TimeInterval) {
        lock.withLock { clock += seconds }
    }

    /// What the fast method's restore does to the iPhone's side of trust.
    func forget() {
        lock.withLock {
            known = []
            dialog = false
            hasAccepted = false
            hasDenied = false
        }
    }

    /// The person taps Trust and enters the passcode.
    func accept() {
        lock.withLock { hasAccepted = true }
        trust.notified("phone", name: TrustWatch.requestPair)
    }

    /// The person taps Don't Trust.
    func deny() {
        lock.withLock { hasDenied = true }
    }

    /// The cable is pulled and put back: the iPhone forgets its answer.
    func replug() {
        lock.withLock {
            dialog = false
            hasDenied = false
        }
        trust.forget("phone")
    }

    func open() throws {
        let now = lock.withLock {
            clock += step
            return clock
        }
        try Pairing.open(
            udid: "phone", trust: trust, now: now, handshake: handshake, pair: pair,
            observe: { canObserve ? Observer(self) : nil }
        )
    }

    /// `lockdownd_client_new_with_handshake`: pairs on its own only when the
    /// Mac has no record, and otherwise starts a session with the one it has.
    func handshake() -> lockdownd_error_t {
        if dropping { return LOCKDOWN_E_MUX_ERROR }
        let record = lock.withLock { self.record }
        guard let record else { return pair() }
        return lock.withLock { known.contains(record) } ? LOCKDOWN_E_SUCCESS : LOCKDOWN_E_INVALID_HOST_ID
    }

    func pair() -> lockdownd_error_t {
        lock.withLock {
            pairCount += 1
            if isLocked { return LOCKDOWN_E_PASSWORD_PROTECTED }
            if hasDenied { return LOCKDOWN_E_USER_DENIED_PAIRING }
            if hasAccepted {
                let host = nextHost
                nextHost += 1
                known.insert(host)
                if !refuseSavedRecord { record = host }
                dialog = false
                return LOCKDOWN_E_SUCCESS
            }
            if dialog {
                hasDenied = true
                return LOCKDOWN_E_USER_DENIED_PAIRING
            }
            dialog = true
            return LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING
        }
    }

    private final class Observer {
        private let phone: FakeLockdown
        init(_ phone: FakeLockdown) {
            self.phone = phone
            phone.lock.withLock { phone.observers += 1 }
        }
        deinit { phone.lock.withLock { phone.observers -= 1 } }
    }
}
