import Foundation

/// One demo transfer, written out beat by beat.
///
/// A full backup takes about an hour on a real cable and a restore about forty
/// minutes. Sitting through either of them is not what a demo is for, so the
/// demo runs the same shape in about twenty five seconds: the helper starting,
/// the files moving with the progress climbing, and the long quiet stretch at
/// the end where the iPhone is the one working. A restore then waits for the
/// phone to come back.
///
/// Time is compressed rather than skipped. One second of the demo stands for a
/// little over two minutes on the cable, and the window is told the hour the
/// transfer stands for rather than the seconds it really took, so the elapsed
/// time, the estimate and the progress all agree with each other and the
/// wording under them is the wording a real run shows.
///
/// Nothing here touches an iPhone, a disk or a helper, which is why it is the
/// part of the demo the tests can run.
struct DemoScript: Equatable {
    /// Which of the two transfers this is. They take different lengths of
    /// time, and only a restore waits for the phone afterwards.
    enum Kind: String, Equatable {
        case backup
        case restore
    }

    /// Where a demo transfer has got to.
    enum Stage: Equatable {
        /// The helper started and the phone has not sent anything yet.
        case starting
        /// Files are moving and the progress is climbing.
        case transferring
        /// Every file is across and the iPhone is closing the snapshot, or
        /// applying the backup.
        case finishing
        /// The restore rebooted the phone and it is not back yet.
        case waitingForPhone
        case finished
        /// The transfer stopped part way, because the demo was asked for a
        /// failure or for a cancellation.
        case stopped
    }

    /// One moment of a demo transfer, in the numbers the window draws.
    struct Beat: Equatable {
        let stage: Stage
        /// The whole job, zero to one, the way the helper prints it.
        let progress: Double
        /// How long the transfer would have been running on a real cable.
        let elapsed: TimeInterval
        /// How many files have crossed.
        let files: Int
        /// The byte counter of the file crossing right now. Nil outside the
        /// copying, where no file is moving.
        let bytes: String?
        /// The trailing window to feed the estimate with, in the seconds a
        /// real transfer would have taken, and the progress at the start of
        /// it. Nil while the transfer is too young to say anything, which is
        /// the first minute of a real one.
        let window: TimeInterval?
        let progressThen: Double

        /// The estimate a transfer this far along would be holding: the same
        /// type the window reads in a real run, fed two readings a minute
        /// apart at the rate this transfer is running at. A beat that is too
        /// young gets one reading, which is what the first minute of a real
        /// transfer gives it.
        func estimate(at now: Date) -> TransferEstimate {
            var estimate = TransferEstimate()
            guard let window else {
                estimate.record(progress: progress, at: now)
                return estimate
            }
            estimate.record(progress: progressThen, at: now.addingTimeInterval(-window))
            estimate.record(progress: progress, at: now)
            return estimate
        }
    }

    let kind: Kind
    let outcome: DemoConditions.Outcome

    init(kind: Kind, outcome: DemoConditions.Outcome = .succeeds) {
        self.kind = kind
        self.outcome = outcome
    }

    // MARK: - How long everything takes

    /// What one second of the demo stands for on the cable.
    var pace: TimeInterval { kind == .backup ? 139 : 120 }

    /// The helper starting, before the first file moves.
    private var starting: TimeInterval { kind == .backup ? 2 : 1.5 }
    /// The files moving, which is the part with a progress bar.
    private var copying: TimeInterval { kind == .backup ? 18 : 15.5 }
    /// The iPhone closing the snapshot, or applying the backup.
    private var closing: TimeInterval { kind == .backup ? 5 : 3.5 }
    /// The restart, which only a restore has.
    private var rebooting: TimeInterval { kind == .backup ? 0 : 6 }

    /// How long the whole thing runs, in the seconds the reader waits.
    var duration: TimeInterval { starting + copying + closing + rebooting }

    /// How long the copying would have taken on a real cable, which is what
    /// the estimate divides by.
    var copyingOnTheCable: TimeInterval { copying * pace }

    /// The first seconds of the copying, before the estimate says anything.
    /// A real transfer says nothing for its first minute, and this is the same
    /// silence at demo speed, long enough to be read.
    private static let quiet: TimeInterval = 3
    /// The trailing window the estimate reads the rate over, in the seconds a
    /// real transfer would have taken. It is the window `TransferEstimate`
    /// itself uses.
    private static let window: TimeInterval = 60
    /// A measured full backup of an iPhone 16e, for the file counter.
    private static let fileTotal = 69_445
    /// A few file sizes, in megabytes, so the byte counter beside the file
    /// count moves the way it does during a real transfer.
    private static let fileSizes: [Double] = [44.1, 3.1, 128.6, 0.9, 12.4, 2.7]

    /// When a transfer that was asked to stop does. A failure lands a little
    /// later than a cancellation, so the two are not the same picture.
    private var stopsAt: TimeInterval? {
        switch outcome {
        case .succeeds: return nil
        case .fails: return starting + copying * 0.62
        case .cancelled: return starting + copying * 0.55
        }
    }

    // MARK: - The beats

    /// Where the transfer is, this many seconds into the demo.
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
            return beat(kind == .restore ? .waitingForPhone : .finished, at: now)
        }
        return beat(.finished, at: duration)
    }

    /// True once the transfer has nothing left to do, whichever way it ended.
    func isOver(at demoElapsed: TimeInterval) -> Bool {
        switch beat(at: demoElapsed).stage {
        case .finished, .stopped: return true
        case .starting, .transferring, .finishing, .waitingForPhone: return false
        }
    }

    private func beat(_ stage: Stage, at now: TimeInterval) -> Beat {
        let progress = self.progress(at: now)
        let files = Int(progress * Double(Self.fileTotal))
        let copying = copyingOnTheCable
        let settled = stage == .transferring && now >= starting + Self.quiet
        return Beat(
            stage: stage,
            progress: progress,
            elapsed: now * pace,
            files: files,
            bytes: stage == .transferring ? Self.bytes(at: progress) : nil,
            window: settled ? Self.window : nil,
            progressThen: settled ? max(0, progress - Self.window / copying) : progress
        )
    }

    /// The whole job, zero to one. It climbs at one steady rate across the
    /// copying, which is close enough to what the helper prints and is what
    /// lets the estimate read a rate worth dividing by.
    private func progress(at now: TimeInterval) -> Double {
        guard now > starting else { return 0 }
        return min(1, (now - starting) / copying)
    }

    /// The byte counter of the file crossing right now, in the words the
    /// helper writes it: how much of this file is across, out of how big it is.
    private static func bytes(at progress: Double) -> String {
        let place = progress * Double(fileTotal)
        let size = fileSizes[Int(place) % fileSizes.count]
        let done = size * (place - place.rounded(.down))
        return String(format: "%.1f MB / %.1f MB", done, size)
    }

    // MARK: - What the helper says

    /// The lines the helper would have printed by now, oldest first. They are
    /// the same shape as the real ones, because the folded-away details are
    /// part of what a reader is judging.
    func lines(at demoElapsed: TimeInterval) -> [String] {
        let now = max(0, demoElapsed)
        let end = min(now, stopsAt ?? now)
        var lines = Self.script(for: kind)
            .filter { $0.at <= end }
            .map(\.line)
        if outcome == .fails, let stopsAt, now >= stopsAt {
            lines.append(contentsOf: Self.failure)
        }
        return lines
    }

    /// The sentence the window shows when a demo transfer fails. It is written
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

    /// The folder in the demo's lines. It is nobody's home folder: the demo
    /// reads no disk, so it has no path of its own to print.
    private static let folder = "/Users/you/Library/Application Support/attention awareness/Backups"
    private static let udid = "00008130-000A4D3E0C30001C"

    private static func script(for kind: Kind) -> [Line] {
        kind == .backup ? backupLines : restoreLines
    }

    private static let backupLines = [
        Line(at: 0, line: "Running idevicebackup2 -u \(udid) backup --full \(folder)"),
        Line(at: 0.6, line: "Backup directory is \"\(folder)\""),
        Line(at: 1.1, line: "Started \"com.apple.mobilebackup2\" service on port 51284."),
        Line(at: 1.5, line: "Negotiated Protocol Version 2.1"),
        Line(at: 1.8, line: "Requesting backup from device..."),
        Line(at: 2, line: "Receiving files from the iPhone."),
        Line(at: 4, line: "The iPhone is writing the snapshot. It says uploading."),
        Line(at: 20, line: "The iPhone sent 69445 files."),
        Line(at: 20.4, line: "The iPhone finished the snapshot."),
        Line(at: 24.6, line: "The helper finished."),
    ]

    private static let restoreLines = [
        Line(
            at: 0,
            line: "Running idevicebackup2 -u \(udid) restore --system --settings --reboot \(folder)"
        ),
        Line(at: 0.5, line: "Started \"com.apple.mobilebackup2\" service on port 51311."),
        Line(at: 0.9, line: "Negotiated Protocol Version 2.1"),
        Line(at: 1.2, line: "Starting Restore..."),
        Line(at: 1.5, line: "Started restore, the iPhone is waiting for the files."),
        Line(at: 3, line: "Sending Library/SMS/sms.db (48.2 MB)"),
        Line(at: 8, line: "Sending Media/DCIM/108APPLE/IMG_8123.HEIC (3.1 MB)"),
        Line(at: 14, line: "Sending Library/Caches/com.apple.Maps/tiles.db (128.6 MB)"),
        Line(at: 17, line: "Restoring applications..."),
        Line(at: 20.5, line: "The helper finished."),
    ]
}
