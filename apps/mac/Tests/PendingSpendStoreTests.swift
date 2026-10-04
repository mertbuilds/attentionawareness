import Foundation
import Testing

/// The keys the app holds on to between launches: the one waiting to be used,
/// and the spends Polar has not counted yet.
///
/// The store is handed a dictionary in place of the Keychain, so nothing a
/// test writes lands in the login Keychain and no test can be stopped by a
/// Keychain prompt. A second store over the same dictionary is what the app
/// finds on its next launch.
struct PendingSpendStoreTests {
    private let storage = MemoryStorage()
    private let store: PendingSpendStore

    private static let key = "AA-3F2C1D0E-8B7A-4C6D-9E5F-1A2B3C4D5E6F"
    private static let otherKey = "AA-9A8B7C6D-5E4F-4A3B-8C2D-1E0F9A8B7C6D"
    private static let udid = "00008140-000000000000001A"
    private static let otherUdid = "00008140-000B2C3D4E5F6071"

    init() {
        store = PendingSpendStore(storage: storage)
    }

    // MARK: - The key waiting to be used

    @Test func nothingIsSavedUntilAKeyIs() {
        #expect(store.savedKey == nil)
    }

    @Test func aSavedKeyIsThereOnTheNextLaunch() throws {
        try store.save(key: Self.key)
        #expect(PendingSpendStore(storage: storage).savedKey == Self.key)
    }

    @Test func aSavedKeyIsKeptWithoutThePastedSpaces() throws {
        try store.save(key: "  \(Self.key)\n")
        #expect(store.savedKey == Self.key)
    }

    @Test func savingAnotherKeyReplacesTheFirst() throws {
        try store.save(key: Self.key)
        try store.save(key: Self.otherKey)
        #expect(store.savedKey == Self.otherKey)
    }

    @Test func aClearedKeyIsGone() throws {
        try store.save(key: Self.key)
        try store.clearSavedKey()
        #expect(store.savedKey == nil)
        // Clearing what is not there is not an error.
        try store.clearSavedKey()
    }

    @Test func savingOnlySpacesClearsTheSavedKey() throws {
        try store.save(key: Self.key)
        try store.save(key: "   ")
        #expect(store.savedKey == nil)
    }

    @Test func aKeychainThatCannotBeReadFillsNothingIn() throws {
        try store.save(key: Self.key)
        storage.failure = LicenseStoreError.keychain(-25293)
        #expect(store.savedKey == nil)
    }

    // MARK: - Spends Polar has not counted yet

    @Test func nothingIsPendingAtFirst() throws {
        #expect(try store.allPending().isEmpty)
        #expect(try store.pending(for: Self.udid).isEmpty)
    }

    @Test func aPendingSpendIsThereOnTheNextLaunch() throws {
        try store.addPending(key: Self.key, deviceID: Self.udid)
        let relaunched = PendingSpendStore(storage: storage)
        #expect(try relaunched.allPending() == [PendingSpend(key: Self.key, deviceID: Self.udid)])
    }

    @Test func aPendingSpendIsKeptWithoutThePastedSpaces() throws {
        let spend = try store.addPending(key: " \(Self.key)\n", deviceID: Self.udid)
        #expect(spend.key == Self.key)
        #expect(try store.allPending() == [spend])
    }

    @Test func theSameKeyOnTheSameIPhoneIsOneSpend() throws {
        try store.addPending(key: Self.key, deviceID: Self.udid)
        try store.addPending(key: Self.key, deviceID: Self.udid)
        #expect(try store.allPending().count == 1)
    }

    @Test func pendingSpendsAreListedOldestFirstAndByIPhone() throws {
        try store.addPending(key: Self.key, deviceID: Self.udid)
        try store.addPending(key: Self.otherKey, deviceID: Self.otherUdid)
        try store.addPending(key: Self.otherKey, deviceID: Self.udid)

        #expect(
            try store.allPending() == [
                PendingSpend(key: Self.key, deviceID: Self.udid),
                PendingSpend(key: Self.otherKey, deviceID: Self.otherUdid),
                PendingSpend(key: Self.otherKey, deviceID: Self.udid),
            ]
        )
        #expect(try store.pending(for: Self.udid).map(\.key) == [Self.key, Self.otherKey])
        #expect(try store.pending(for: Self.otherUdid).map(\.key) == [Self.otherKey])
        #expect(try store.pending(for: "00008140-00000000000000FF").isEmpty)
    }

    @Test func aRemovedSpendIsGoneAndTheRestStay() throws {
        let first = try store.addPending(key: Self.key, deviceID: Self.udid)
        let second = try store.addPending(key: Self.otherKey, deviceID: Self.otherUdid)

        try store.remove(first)
        #expect(try store.allPending() == [second])

        // Removing one that is not there changes nothing.
        try store.remove(first)
        #expect(try store.allPending() == [second])
    }

    @Test func theLastRemovedSpendTakesTheItemAwayWithIt() throws {
        let spend = try store.addPending(key: Self.key, deviceID: Self.udid)
        try store.remove(spend)
        #expect(try store.allPending().isEmpty)
        #expect(storage.items["pending-spends"] == nil)
    }

    @Test func theSavedKeyAndThePendingSpendsAreKeptApart() throws {
        try store.save(key: Self.otherKey)
        let spend = try store.addPending(key: Self.key, deviceID: Self.udid)

        try store.clearSavedKey()
        #expect(try store.allPending() == [spend])

        try store.save(key: Self.otherKey)
        try store.remove(spend)
        #expect(store.savedKey == Self.otherKey)
    }

    // MARK: - Spends that are due

    @Test func aSpendWaitsUntilItIsMadeDue() throws {
        #expect(try store.addPending(key: Self.key, deviceID: Self.udid).due == false)
    }

    @Test func aDueSpendIsStillDueOnTheNextLaunch() throws {
        let spend = try store.addPending(key: Self.key, deviceID: Self.udid)
        let other = try store.addPending(key: Self.otherKey, deviceID: Self.otherUdid)
        try store.markDue(spend)

        let relaunched = PendingSpendStore(storage: storage)
        #expect(
            try relaunched.allPending() == [
                PendingSpend(key: Self.key, deviceID: Self.udid, due: true),
                other,
            ]
        )
    }

    @Test func aSettledSpendIsNotBroughtBackByMarkingItDue() throws {
        // Polar answered while the phone was being read again.
        let spend = try store.addPending(key: Self.key, deviceID: Self.udid)
        try store.remove(spend)
        try store.markDue(spend)
        #expect(try store.allPending().isEmpty)
    }

    @Test func addingTheSameKeyOnTheSameIPhoneAgainKeepsItDue() throws {
        let spend = try store.addPending(key: Self.key, deviceID: Self.udid)
        try store.markDue(spend)

        let again = try store.addPending(key: Self.key, deviceID: Self.udid)
        #expect(again.due)
        #expect(try store.allPending() == [again])
    }

    @Test func aDueSpendIsRemovedByTheSpendItWasMadeFrom() throws {
        // Same key, same iPhone: one spend, waiting or due.
        let spend = try store.addPending(key: Self.key, deviceID: Self.udid)
        try store.markDue(spend)
        try store.remove(spend)
        #expect(try store.allPending().isEmpty)
    }

    @Test func aListWrittenBeforeSpendsCouldBeDueStillReads() throws {
        let written = #"[{"key":"\#(Self.key)","deviceID":"\#(Self.udid)"}]"#
        try storage.set(Data(written.utf8), for: "pending-spends")
        #expect(try store.allPending() == [PendingSpend(key: Self.key, deviceID: Self.udid)])
    }

    // MARK: - What goes wrong

    @Test func aPendingListThisAppDidNotWriteIsUnreadable() throws {
        try storage.set(Data("not a list".utf8), for: "pending-spends")
        #expect(throws: LicenseStoreError.unreadable) {
            try store.allPending()
        }
    }

    @Test func aKeychainThatRefusesToWriteSaysSo() {
        storage.failure = LicenseStoreError.keychain(-25308)
        #expect(throws: LicenseStoreError.keychain(-25308)) {
            try store.addPending(key: Self.key, deviceID: Self.udid)
        }
    }
}

/// Keeps what the store writes in a dictionary, for the length of one test.
final class MemoryStorage: LicenseStorage {
    var items: [String: Data] = [:]
    /// What every call throws instead of working, while it is set.
    var failure: Error?

    func data(for account: String) throws -> Data? {
        if let failure { throw failure }
        return items[account]
    }

    func set(_ data: Data, for account: String) throws {
        if let failure { throw failure }
        items[account] = data
    }

    func remove(_ account: String) throws {
        if let failure { throw failure }
        items[account] = nil
    }
}
