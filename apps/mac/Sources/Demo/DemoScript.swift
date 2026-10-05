#if DEBUG
import Foundation

/// The demo's restore, written out beat by beat.
///
/// The fast method sends a small seed to the iPhone and then restarts it. The
/// demo runs the same shape in about ten seconds: the helper starting, the
/// files moving with the progress climbing, the short quiet stretch where the
/// iPhone is the one working, and the wait for the phone to come back after
/// the restart.
///
/// Nothing here touches an iPhone, a disk or a helper, which is why it is the
/// part of the demo the tests can run.
struct DemoScript: Equatable {
    /// Where a demo restore has got to.
    enum Stage: Equatable {
        /// The helper started and the phone has not taken anything yet.
        case starting
        /// Files are moving and the progress is climbing.
        case transferring
        /// Every file is across and the iPhone is applying them.
        case finishing
        /// The iPhone restarted and it is not back yet.
        case waitingForPhone
        case finished
        /// The restore stopped part way, because the demo was asked for a
        /// failure or for a cancellation.
        case stopped
    }

    /// One moment of a demo restore, in the numbers the window draws.
    struct Beat: Equatable {
        let stage: Stage
        /// The whole job, zero to one, the way the helper prints it.
        let progress: Double
        /// How many files have crossed.
        let files: Int
    }

    let outcome: DemoConditions.Outcome

    init(outcome: DemoConditions.Outcome = .succeeds) {
        self.outcome = outcome
    }

    // MARK: - How long everything takes

    /// The helper starting, before the first file moves.
    private let starting: TimeInterval = 1.5
    /// The files moving, which is the part with a progress bar.
    private let copying: TimeInterval = 4
    /// The iPhone applying what it was sent.
    private let closing: TimeInterval = 2
    /// The restart.
    private let rebooting: TimeInterval = 3

    /// How long the whole thing runs, in the seconds the reader waits.
    var duration: TimeInterval { starting + copying + closing + rebooting }

    /// The two files the seed holds: the cloud configuration and the setup
    /// preferences.
    private static let fileTotal = 2

    /// When a restore that was asked to stop does. A failure lands a little
    /// later than a cancellation, so the two are not the same picture.
    private var stopsAt: TimeInterval? {
        switch outcome {
        case .succeeds: return nil
        case .fails: return starting + copying * 0.62
        case .cancelled: return starting + copying * 0.55
        }
    }

    // MARK: - The beats

    /// Where the restore is, this many seconds into the demo.
    func beat(at demoElapsed: TimeInterval) -> Beat {
        let now = max(0, demoElapsed)
        if let stopsAt, now >= stopsAt {
            return beat(.stopped, at: stopsAt)
        }
        if now < starting {
            return beat(.starting, at: now)
        }
        if now < starting + copying {
            return beat(.transferring, at: now)
        }
        if now < starting + copying + closing {
            return beat(.finishing, at: now)
        }
        if now < duration {
            return beat(.waitingForPhone, at: now)
        }
        return beat(.finished, at: duration)
    }

    /// True once the restore has nothing left to do, whichever way it ended.
    func isOver(at demoElapsed: TimeInterval) -> Bool {
        switch beat(at: demoElapsed).stage {
        case .finished, .stopped: return true
        case .starting, .transferring, .finishing, .waitingForPhone: return false
        }
    }

    private func beat(_ stage: Stage, at now: TimeInterval) -> Beat {
        let progress = self.progress(at: now)
        return Beat(stage: stage, progress: progress, files: Int(progress * Double(Self.fileTotal)))
    }

    /// The whole job, zero to one. It climbs at one steady rate across the
    /// files moving.
    private func progress(at now: TimeInterval) -> Double {
        guard now > starting else { return 0 }
        return min(1, (now - starting) / copying)
    }

    // MARK: - What the helper says

    /// The lines the helper would have printed by now, oldest first.
    func lines(at demoElapsed: TimeInterval) -> [String] {
        let now = max(0, demoElapsed)
        let end = min(now, stopsAt ?? now)
        var lines = Self.script
            .filter { $0.at <= end }
            .map(\.line)
        if outcome == .fails, let stopsAt, now >= stopsAt {
            lines.append(contentsOf: Self.failure)
        }
        return lines
    }

    /// The sentence the window shows when a demo restore fails. It is written
    /// by the same rules a real failure goes through, from the same line the
    /// helper prints when the cable comes out.
    static var failureSentence: String {
        BackupError.sentence(lastError: failure[0], exitCode: 1)
    }

    /// The two lines a helper leaves behind when the cable comes out, which is
    /// the failure a reader is most likely to meet.
    private static let failure = [
        "ERROR: No device found, is it plugged in?",
        "The helper failed with error code 1.",
    ]

    private struct Line {
        let at: TimeInterval
        let line: String
    }

    /// The folder in the demo's lines. It is nobody's: the demo reads no
    /// disk, so it has no path of its own to print.
    private static let folder = "/private/var/folders/xx/T/attentionawareness-seed"
    private static let udid = "00008130-000000000000001C"

    private static let script = [
        Line(at: 0, line: "Running idevicebackup2 -u \(udid) restore --system --skip-apps --no-reboot \(folder)"),
        Line(at: 0.5, line: "Started \"com.apple.mobilebackup2\" service on port 51311."),
        Line(at: 0.9, line: "Negotiated Protocol Version 2.1"),
        Line(at: 1.2, line: "Starting Restore..."),
        Line(at: 1.5, line: "Started restore, the iPhone is waiting for the files."),
        Line(at: 2.5, line: "Sending Library/ConfigurationProfiles/CloudConfigurationDetails.plist"),
        Line(at: 4, line: "Sending mobile/com.apple.purplebuddy.plist"),
        Line(at: 6.5, line: "The helper finished."),
    ]
}
#endif
