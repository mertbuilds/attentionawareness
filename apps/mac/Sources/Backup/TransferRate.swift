import Foundation

/// How fast this Mac moved a whole iPhone over the cable last time.
///
/// Two numbers, bytes per second, one for copying off the phone and one for
/// copying back. They are the only thing the app writes down between runs, and
/// they are a measurement of this cable and this Mac rather than anything
/// about the person at it. Neither ever leaves the machine.
///
/// They are kept because the first sentence of a step that is about to take an
/// hour should say so. With nothing measured the honest answer is a range wide
/// enough to stay true on a slow cable. With one run behind it the same step
/// can say a figure.
enum TransferRate {
    /// Which of the two transfers a rate belongs to. They are kept apart
    /// because a restore does not run at the speed of a backup.
    enum Kind: String {
        case backup
        case restore

        /// Where the number sits in the defaults.
        var key: String { "transferRate.\(rawValue)" }
    }

    /// The slowest and the fastest a cable is expected to manage, in bytes per
    /// second. A measured 63 GB backup took about an hour, which sits in the
    /// middle of the band; the two ends are what the same phone takes on a bad
    /// cable and on a good one. They are only ever used for the range shown
    /// before this Mac has finished one.
    static let slowBytesPerSecond: Double = 12_000_000
    static let fastBytesPerSecond: Double = 35_000_000

    /// What this Mac last managed, or nil while it has never finished one.
    static func remembered(_ kind: Kind, in defaults: UserDefaults = .standard) -> Double? {
        let stored = defaults.double(forKey: kind.key)
        return stored > 0 ? stored : nil
    }

    /// Write down what a finished transfer managed.
    ///
    /// Only a whole one is ever written. The seconds a cancelled or failed
    /// transfer took say nothing about how long a whole one runs.
    static func remember(
        _ kind: Kind,
        bytes: UInt64,
        seconds: TimeInterval,
        in defaults: UserDefaults = .standard
    ) {
        guard bytes > 0, seconds > 0 else { return }
        defaults.set(Double(bytes) / seconds, forKey: kind.key)
    }

    /// The one line the Ready screen shows over its button.
    ///
    /// With a rate behind it this Mac can say a figure. Before that, and for a
    /// phone that will not say how much it holds, the honest answer is the band
    /// a cable of any speed lands in.
    static func howLong(
        _ kind: Kind,
        bytes: UInt64?,
        in defaults: UserDefaults = .standard
    ) -> String {
        guard let bytes, bytes > 0, let rate = remembered(kind, in: defaults) else {
            return "This usually takes 30 to 90 minutes. Keep iPhone connected."
        }
        let measured = TransferEstimate.duration(Double(bytes) / rate)
        return "This takes about \(measured). Keep iPhone connected."
    }

    /// What to expect before the button is pressed, in one sentence, or
    /// nothing at all while the size of the transfer is unknown.
    ///
    /// The first run has no measurement to go on, so it gets a range wide
    /// enough to stay true either way. Every run after it gets the figure this
    /// Mac earned, still hedged, because the cable and the phone both have
    /// their days.
    static func expectation(
        _ kind: Kind,
        bytes: UInt64?,
        in defaults: UserDefaults = .standard
    ) -> String? {
        guard let bytes, bytes > 0 else { return nil }
        if let rate = remembered(kind, in: defaults) {
            let measured = TransferEstimate.duration(Double(bytes) / rate)
            return "This usually takes about \(measured) on this Mac."
        }
        let fast = TransferEstimate.duration(Double(bytes) / fastBytesPerSecond)
        let slow = TransferEstimate.duration(Double(bytes) / slowBytesPerSecond)
        // A transfer small enough for both ends of the band to round to the
        // same words has no range left to state.
        guard fast != slow else { return "This usually takes about \(fast) for a phone this size." }
        return "This usually takes \(fast) to \(slow) for a phone this size."
    }
}
