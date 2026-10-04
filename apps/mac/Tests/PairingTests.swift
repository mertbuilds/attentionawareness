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

    @Test func aPhoneThatForgotTheMacWhileLockedAsksForThePasscode() {
        let phone = FakeLockdown()
        phone.forget()
        phone.locked = true
        #expect(throws: DeviceError.locked) { try phone.open() }
        #expect(phone.pairs == 1)
        #expect(!phone.dialogShown)
    }

    @Test func aPhoneThatForgotTheMacShowsTrustAndOpensOnceItIsTapped() throws {
        let phone = FakeLockdown()
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.dialogShown)
        // The dialog is still up on the next read, and nothing has changed.
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        phone.accepted = true
        try phone.open()
        #expect(phone.macRecordIsKnown)
        let pairs = phone.pairs
        try phone.open()
        #expect(phone.pairs == pairs)
    }

    @Test func aTrustDialogOnScreenIsNotSentAnotherPairForFiveSeconds() throws {
        let phone = FakeLockdown()
        phone.tick = 0
        phone.forget()
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.pairs == 1)
        phone.advance(2)
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        phone.advance(2)
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.pairs == 1)
        phone.accepted = true
        phone.advance(1)
        try phone.open()
        #expect(phone.pairs == 2)
    }

    @Test func aLockedPhoneIsAskedAgainAfterTwoSeconds() {
        let phone = FakeLockdown()
        phone.tick = 0
        phone.forget()
        phone.locked = true
        #expect(throws: DeviceError.locked) { try phone.open() }
        phone.advance(1)
        #expect(throws: DeviceError.locked) { try phone.open() }
        #expect(phone.pairs == 1)
        phone.advance(1)
        phone.locked = false
        #expect(throws: DeviceError.trustPending) { try phone.open() }
        #expect(phone.pairs == 2)
        #expect(phone.dialogShown)
    }

    @Test func aPairOutAlreadyIsNotSentTwice() {
        let throttle = PairThrottle()
        let now = Date()
        #expect(throttle.reserve("phone", at: now) == nil)
        #expect(throttle.reserve("phone", at: now) == LOCKDOWN_E_INVALID_HOST_ID)
        #expect(throttle.reserve("other", at: now) == nil)
    }

    @Test func aRecordTheMacCouldNotKeepIsAFailureNotAWaitForTrust() {
        let phone = FakeLockdown()
        phone.forget()
        phone.accepted = true
        phone.loseSavedRecord = true
        #expect(throws: DeviceError.pairRecordRejected) { try phone.open() }
        #expect(DeviceError.pairRecordRejected.pairingState == nil)
    }

    @Test func dontTrustIsReported() {
        let phone = FakeLockdown()
        phone.forget()
        phone.denied = true
        #expect(throws: DeviceError.trustDenied) { try phone.open() }
    }

    @Test func otherFailuresAreNotAnsweredWithPair() {
        var pairs = 0
        #expect(throws: DeviceError.lockdownFailed(code: LOCKDOWN_E_RECEIVE_TIMEOUT.rawValue)) {
            try Pairing.open(udid: "phone", throttle: PairThrottle(), handshake: { LOCKDOWN_E_RECEIVE_TIMEOUT }, pair: {
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

    @Test func theLogNeverCarriesAUdid() {
        #expect(DeviceLog.text(DeviceError.deviceUnavailable(udid: "00008030-0001")) == "deviceUnavailable")
        #expect(DeviceLog.text(DeviceError.lockdownFailed(code: -21)) == "lockdownFailed -21")
    }
}

/// An iPhone's lockdown as far as trust goes. The Mac holds one pair record,
/// the iPhone the host ids it trusts. A restore that resets the iPhone's
/// pairing empties that list; Pair makes a new record, as libimobiledevice
/// does, and the iPhone takes it only once the person has tapped Trust.
final class FakeLockdown: @unchecked Sendable {
    private let lock = NSLock()
    private var known: Set<Int> = [1]
    private var record: Int? = 1
    private var nextHost = 2
    private var pairCount = 0
    private var dialog = false
    private var isLocked = false
    private var hasAccepted = false
    private var hasDenied = false

    var locked: Bool {
        get { lock.withLock { isLocked } }
        set { lock.withLock { isLocked = newValue } }
    }
    var accepted: Bool {
        get { lock.withLock { hasAccepted } }
        set { lock.withLock { hasAccepted = newValue } }
    }
    var denied: Bool {
        get { lock.withLock { hasDenied } }
        set { lock.withLock { hasDenied = newValue } }
    }
    var pairs: Int { lock.withLock { pairCount } }
    var dialogShown: Bool { lock.withLock { dialog } }
    var macRecordIsKnown: Bool { lock.withLock { record.map(known.contains) ?? false } }

    /// What the fast method's restore does to the iPhone's side of trust.
    func forget() {
        lock.withLock {
            known = []
            dialog = false
            hasAccepted = false
        }
    }

    /// Each iPhone gets its own throttle, on a clock the test moves. Every
    /// read moves it on by `tick`, the way the Mac's reads are spaced.
    let throttle = PairThrottle()
    private var clock = Date(timeIntervalSinceReferenceDate: 0)
    private var step: TimeInterval = 3
    private var refuseSavedRecord = false

    var tick: TimeInterval {
        get { lock.withLock { step } }
        set { lock.withLock { step = newValue } }
    }
    /// Pair goes through but the record never reaches the Mac's store.
    var loseSavedRecord: Bool {
        get { lock.withLock { refuseSavedRecord } }
        set { lock.withLock { refuseSavedRecord = newValue } }
    }

    func advance(_ seconds: TimeInterval) {
        lock.withLock { clock += seconds }
    }

    func open() throws {
        let now = lock.withLock {
            clock += step
            return clock
        }
        try Pairing.open(udid: "phone", throttle: throttle, now: now, handshake: handshake, pair: pair)
    }

    /// `lockdownd_client_new_with_handshake`: pairs on its own only when the
    /// Mac has no record, and otherwise starts a session with the one it has.
    func handshake() -> lockdownd_error_t {
        let record = lock.withLock { self.record }
        guard let record else { return pair() }
        return lock.withLock { known.contains(record) } ? LOCKDOWN_E_SUCCESS : LOCKDOWN_E_INVALID_HOST_ID
    }

    func pair() -> lockdownd_error_t {
        lock.withLock {
            pairCount += 1
            if isLocked { return LOCKDOWN_E_PASSWORD_PROTECTED }
            if hasDenied { return LOCKDOWN_E_USER_DENIED_PAIRING }
            guard hasAccepted else {
                dialog = true
                return LOCKDOWN_E_PAIRING_DIALOG_RESPONSE_PENDING
            }
            let host = nextHost
            nextHost += 1
            known.insert(host)
            if !refuseSavedRecord { record = host }
            return LOCKDOWN_E_SUCCESS
        }
    }
}
