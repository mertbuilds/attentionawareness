import Foundation

/// How much longer a transfer has, from nothing but the progress the helper
/// prints.
///
/// The helper says how far along the whole job is and says nothing else: no
/// file total, no byte rate, and not one word about what the iPhone does with
/// the files once they are across. So the figure here is the copying and only
/// the copying, and three rules keep it from claiming more than it knows.
///
/// - It says nothing for the first minute or so. The first files are small and
///   the phone is still opening the snapshot, so an early rate is a lie about
///   the hour that follows.
/// - It reads the rate over the last minute rather than over the whole run, so
///   a slow stretch shows up in the figure instead of being buried under an
///   average of everything before it.
/// - It gives up on a figure once the progress has sat still for a couple of
///   minutes. A number divided by a rate that no longer exists is worse than
///   no number at all.
///
/// The figure only ever moves when a new reading of the progress comes in, so
/// a step that asks again every second cannot watch it count down to nothing
/// while the work carries on.
///
/// Nothing here touches the iPhone, the disk or the window, which is why it is
/// the part of a transfer the tests can run.
struct TransferEstimate {
    /// What the estimate is able to say.
    enum Reading: Equatable {
        /// Too little of the transfer has happened to say anything yet.
        case tooEarly
        /// Something is going on, but not at a rate worth dividing by.
        case working
        /// About this much longer.
        case about(TimeInterval)
    }

    /// How long a transfer runs before the first figure. The seconds before
    /// this are the setup and the small files, not the hour behind them.
    static let warmUp: TimeInterval = 45
    /// How far along a transfer gets before the first figure.
    static let warmUpProgress = 0.02
    /// The trailing window the rate is read over.
    static let window: TimeInterval = 60
    /// How long the progress may sit still before the figure goes away.
    static let stall: TimeInterval = 120
    /// How quickly the smoothed rate follows the window rate. It is a length
    /// of time rather than a count of readings, so a helper that prints five
    /// lines a second and one that prints one settle at the same speed.
    static let smoothing: TimeInterval = 20
    /// A figure longer than this is not one anybody can act on, so it is not
    /// shown at all.
    static let tooLong: TimeInterval = 12 * 3600

    /// One reading of the progress.
    private struct Sample {
        let date: Date
        let progress: Double
    }

    /// The readings back to the start of the window, plus the one before it,
    /// which is the mark the window is measured from.
    private var samples: [Sample] = []
    private var startedAt: Date?
    /// When the progress last went up. A transfer that is stuck still sends
    /// readings; they just all say the same thing.
    private var lastMovement: Date?
    /// Progress per second, smoothed. Nil until two readings are in.
    private var rate: Double?

    /// Take one reading of the progress. The engine publishes several a
    /// second and every one of them is welcome: the window does the thinning.
    mutating func record(progress: Double, at now: Date = Date()) {
        let progress = min(max(progress, 0), 1)
        guard let last = samples.last else {
            startedAt = now
            lastMovement = now
            samples = [Sample(date: now, progress: progress)]
            return
        }
        // A reading out of order says nothing about the rate of this run.
        guard now > last.date else { return }
        if progress > last.progress {
            lastMovement = now
        }
        let step = now.timeIntervalSince(last.date)
        samples.append(Sample(date: now, progress: progress))
        trim(before: now.addingTimeInterval(-Self.window))
        updateRate(over: step)
    }

    /// What can be said now.
    ///
    /// It is asked for rather than published, because the answer depends on
    /// the time as well as on the readings: a transfer that stops sending them
    /// has to stop showing a figure on its own.
    func reading(at now: Date = Date()) -> Reading {
        guard let startedAt, let lastMovement, let latest = samples.last else { return .tooEarly }
        // The last of the bytes are across. Whatever the iPhone does with them
        // from here is its own work, and this Mac can see none of it.
        guard latest.progress < 1 else { return .working }
        guard now.timeIntervalSince(lastMovement) < Self.stall else { return .working }
        guard now.timeIntervalSince(startedAt) >= Self.warmUp,
              latest.progress > Self.warmUpProgress
        else { return .tooEarly }
        guard let rate, rate > 0 else { return .working }
        let remaining = (1 - latest.progress) / rate
        guard remaining <= Self.tooLong else { return .working }
        return .about(remaining)
    }

    /// Drop the readings that have fallen out of the window, except the newest
    /// of them, which is the mark the window is measured from.
    private mutating func trim(before cutoff: Date) {
        guard let index = samples.lastIndex(where: { $0.date <= cutoff }), index > 0 else { return }
        samples.removeFirst(index)
    }

    /// Read the rate across the window and let the smoothed rate follow it.
    /// `step` is how long it has been since the reading before this one, which
    /// is how far the smoothing is allowed to move.
    private mutating func updateRate(over step: TimeInterval) {
        guard let anchor = samples.first, let latest = samples.last else { return }
        let span = latest.date.timeIntervalSince(anchor.date)
        guard span > 0 else { return }
        let windowRate = max(0, (latest.progress - anchor.progress) / span)
        let weight = 1 - exp(-step / Self.smoothing)
        rate = rate.map { $0 + (windowRate - $0) * weight } ?? windowRate
    }

    // MARK: - The words

    /// How much longer, in the words the step shows. Always hedged, because a
    /// figure from one minute of rate has not earned anything firmer.
    static func remaining(_ seconds: TimeInterval) -> String {
        seconds < 60 ? "less than a minute left" : "about \(duration(seconds)) left"
    }

    /// A length of time in whole words, rounded as coarsely as its own size
    /// deserves: to the minute under ten minutes, to five minutes under an
    /// hour, and to ten minutes above that. There is no precision here to
    /// throw away, so none of it is claimed.
    static func duration(_ seconds: TimeInterval) -> String {
        let minutes = roundedMinutes(seconds)
        guard minutes >= 60 else { return count(minutes, "minute") }
        let hours = minutes / 60
        let rest = minutes % 60
        guard rest > 0 else { return count(hours, "hour") }
        return "\(count(hours, "hour")) \(count(rest, "minute"))"
    }

    /// The whole minutes a length of time rounds to, never fewer than one.
    private static func roundedMinutes(_ seconds: TimeInterval) -> Int {
        let step: Double
        switch seconds {
        case ..<600:
            step = 60
        case ..<3600:
            step = 300
        default:
            step = 600
        }
        return max(1, Int((seconds / step).rounded()) * Int(step) / 60)
    }

    /// The copy never abbreviates a unit, so the word is written out and made
    /// plural where it needs to be.
    private static func count(_ value: Int, _ unit: String) -> String {
        "\(value) \(unit)\(value == 1 ? "" : "s")"
    }
}
