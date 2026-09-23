import Combine
import Foundation

/// Runs the bundled `idevicebackup2` helper and tells the window what it is
/// doing.
///
/// The helper lives in `Contents/Helpers` of the app, is started as its own
/// process, and is read line by line while it works. Its progress bar rewrites
/// one line with a carriage return, so both line ends are treated as line ends
/// (see `BackupOutputParser`). `Status.plist` inside the backup folder is read
/// on a timer as a second source of truth, because the helper can be quiet for
/// minutes while the phone writes its snapshot.
///
/// The engine turns backup encryption on, with a password the person chose,
/// only when the iPhone does not encrypt its backups yet. It never turns
/// encryption off and never changes an existing password. The phone does the
/// encrypting, and the caller passes the password down for the copy and the
/// restore.
@MainActor
final class BackupEngine: ObservableObject {
    /// Where the helper has got to.
    enum Phase: Equatable {
        case idle
        /// The helper started and the phone has not sent anything yet.
        case starting
        /// Files are moving. `progress` is the whole job, 0 to 1. The helper
        /// never says how many files there are in total, so `filesTotal` is
        /// nil until a newer helper does.
        case transferring(progress: Double, filesDone: Int?, filesTotal: Int?, bytes: String?)
        /// Everything moved. The phone is closing the snapshot, or rebooting.
        case finishing
        case done
        case cancelled
        /// The sentence is the one the window shows.
        case failed(String)
    }

    /// Where the helper sits inside the built app.
    static let helperSubpath = "Contents/Helpers/idevicebackup2"
    /// How many lines of the helper's own output are kept.
    static let logLimit = 200

    private static let statusPollInterval = Duration.seconds(2)
    /// A second cancel, or this long after the first one, ends the helper.
    private static let cancelEscalation = Duration.seconds(10)
    /// After this much silence on stdout, Status.plist speaks for the helper.
    private static let quietStdout: TimeInterval = 4
    /// Files move faster than a window can draw, so progress is published at
    /// most this often.
    private static let publishInterval: TimeInterval = 0.2

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var progress: Double = 0
    /// What the helper said, the password taken out, oldest line first.
    @Published private(set) var log: [String] = []
    /// The `SnapshotState` of `Status.plist`, as the phone last wrote it.
    @Published private(set) var snapshotState: String?

    private var process: Process?
    private var secret: String?
    private var cancelRequested = false
    private var escalated = false
    private var escalation: Task<Void, Never>?
    private var statusPoll: Task<Void, Never>?
    private var filesDone: Int?
    private var bytesMoved: String?
    private var lastOutput = Date()
    private var lastPublish = Date.distantPast
    private var lastErrorLine: String?
    /// The helper prints most of its failures without the word ERROR, so the
    /// last thing it said stands in when nothing else named a reason.
    private var lastHelperLine: String?
    private var sawAbort = false
    /// True for an engine that was handed its state. It never starts the
    /// helper, and it is the only kind `show(...)` will move.
    private let isSample: Bool

    init() {
        isSample = false
    }

    /// An engine that is running nothing and never will, with the phase, the
    /// progress and the log it should appear to have. The hidden `--ui-smoke`
    /// path draws the two transfer steps from one of these, so a transfer in
    /// flight can be drawn with nothing on the cable.
    init(sample phase: Phase, progress: Double, log: [String] = []) {
        isSample = true
        self.phase = phase
        self.progress = progress
        self.log = log
    }

    /// Put a sample engine where the caller says, without a helper and without
    /// a cable. The hidden `--demo` path walks one of these through the phases
    /// of a transfer, so the two transfer steps can be watched from beginning
    /// to end with nothing plugged in.
    ///
    /// It does nothing at all on an engine that runs the real helper, which is
    /// the only kind the app itself ever makes.
    func show(phase: Phase, progress: Double, log: [String]) {
        guard isSample else { return }
        self.phase = phase
        self.progress = progress
        self.log = log
    }

    // MARK: - The helper

    /// The bundled helper. A Debug build that never ran `scripts/vendor.sh`
    /// has no helper, so the path is named in the error.
    static var helperURL: URL {
        Bundle.main.bundleURL.appendingPathComponent(helperSubpath)
    }

    /// Looked up once. The answer cannot change while the app runs.
    private static let resolvedHelper: Result<URL, BackupError> = {
        let url = helperURL
        guard FileManager.default.isExecutableFile(atPath: url.path) else {
            return .failure(.helperMissing(path: url.path))
        }
        return .success(url)
    }()

    static func helper() throws -> URL {
        try resolvedHelper.get()
    }

    // MARK: - Backup and restore

    /// The helper's own argument list for turning encryption on. It is a pure
    /// function so the shape of the command can be checked without a phone. The
    /// helper's parser wants a trailing directory and then ignores it for the
    /// `encryption` command, so the backup root stands in for it.
    nonisolated static func encryptionArguments(udid: String, password: String, root: URL) -> [String] {
        ["-u", udid, "encryption", "on", password, root.path]
    }

    /// Turn on backup encryption for one iPhone, with the password the person
    /// chose. It runs the bundled helper's `encryption on <password>` and reads
    /// success or failure off it the same way the copy does.
    ///
    /// The iPhone can ask for its passcode on screen to confirm the change. A
    /// helper that comes back saying it could not enable encryption, or that
    /// the iPhone must be unlocked, is surfaced as an error rather than a
    /// crash. Encryption is only ever turned on from here, never off.
    func enableEncryption(udid: String, password: String, root: URL) async throws {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let folder = root.appendingPathComponent(udid)
        do {
            try await run(
                arguments: Self.encryptionArguments(udid: udid, password: password, root: root),
                folder: folder,
                password: password
            )
        } catch BackupError.failed(let sentence) {
            // The helper stopped with a reason. It is worded for the window
            // already; the flow turns it into "Couldn't Turn On Encryption".
            throw BackupError.encryptionFailed(sentence)
        }
    }

    /// Make a full backup of one iPhone under `root` and hand back the folder
    /// it landed in, which is `root/<udid>`.
    ///
    /// The copy is always an encrypted one now, so a password comes down with
    /// every call. The phone does the encrypting; this method never changes the
    /// `com.apple.mobile.backup/WillEncrypt` flag, which `enableEncryption`
    /// turns on beforehand when the phone did not already encrypt its backups.
    @discardableResult
    func backup(udid: String, into root: URL, password: String?) async throws -> URL {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let folder = root.appendingPathComponent(udid)

        var arguments = ["-u", udid, "backup", "--full"]
        if let password, !password.isEmpty {
            arguments += ["--password", password]
        }
        arguments.append(root.path)

        try await run(arguments: arguments, folder: folder, password: password)
        return folder
    }

    /// Put a backup folder back on the iPhone.
    ///
    /// `folder` is the backup itself, `root/<udid>`. The helper takes the root
    /// and finds the backup under it, so `--source` is only needed when the
    /// folder was made by another phone.
    func restore(
        udid: String,
        from folder: URL,
        password: String?,
        system: Bool = true,
        settings: Bool = true,
        reboot: Bool = true
    ) async throws {
        let manifest = folder.appendingPathComponent(BackupFolder.manifestPlistName)
        guard FileManager.default.fileExists(atPath: manifest.path) else {
            throw BackupError.noBackupFolder(path: folder.path)
        }

        var arguments = ["-u", udid]
        let sourceUdid = folder.lastPathComponent
        if sourceUdid != udid {
            arguments += ["--source", sourceUdid]
        }
        arguments.append("restore")
        if system { arguments.append("--system") }
        if settings { arguments.append("--settings") }
        arguments.append(reboot ? "--reboot" : "--no-reboot")
        if let password, !password.isEmpty {
            arguments += ["--password", password]
        }
        arguments.append(folder.deletingLastPathComponent().path)

        try await run(arguments: arguments, folder: folder, password: password)
    }

    /// Stop the helper. The first call asks it to stop with SIGINT, which lets
    /// it tell the phone to cancel. A second call, or ten seconds of waiting,
    /// ends it.
    func cancel() {
        guard let process, process.isRunning else { return }
        if cancelRequested {
            escalate()
            return
        }
        cancelRequested = true
        append("Cancelling. The iPhone is told to stop, which takes a moment.")
        process.interrupt()
        escalation = Task { [weak self] in
            try? await Task.sleep(for: Self.cancelEscalation)
            guard !Task.isCancelled else { return }
            self?.escalate()
        }
    }

    // MARK: - Running the helper

    /// What comes off the two pipes and out of the process, in order.
    private enum Chunk {
        case output(Data)
        case error(Data)
        case outputEnded
        case errorEnded
        case exited(Int32)
    }

    private func run(arguments: [String], folder: URL, password: String?) async throws {
        // A sample engine is one the window was handed to draw from. It has no
        // phone behind it, so the helper is never started from one.
        guard !isSample else {
            throw BackupError.failed("This engine runs nothing.")
        }
        guard process == nil else {
            throw BackupError.failed("A backup is already running.")
        }
        let helper = try Self.helper()

        secret = (password?.isEmpty == false) ? password : nil
        cancelRequested = false
        escalated = false
        sawAbort = false
        filesDone = nil
        bytesMoved = nil
        lastErrorLine = nil
        lastHelperLine = nil
        snapshotState = nil
        lastOutput = Date()
        lastPublish = .distantPast
        progress = 0
        log = []
        phase = .starting
        append("Running \(helper.lastPathComponent) \(arguments.joined(separator: " "))")

        let process = Process()
        process.executableURL = helper
        process.arguments = arguments
        let output = Pipe()
        let errors = Pipe()
        process.standardOutput = output
        process.standardError = errors
        process.standardInput = FileHandle.nullDevice

        let (chunks, continuation) = AsyncStream<Chunk>.makeStream()
        output.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                continuation.yield(.outputEnded)
            } else {
                continuation.yield(.output(data))
            }
        }
        errors.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                continuation.yield(.errorEnded)
            } else {
                continuation.yield(.error(data))
            }
        }
        process.terminationHandler = { finished in
            continuation.yield(.exited(finished.terminationStatus))
        }

        self.process = process
        do {
            try process.run()
        } catch {
            continuation.finish()
            cleanUp()
            throw BackupError.helperFailedToStart(
                path: helper.path,
                reason: error.localizedDescription
            )
        }
        startStatusPoll(in: folder)

        var outputLines = LineBuffer()
        var errorLines = LineBuffer()
        var outputParser = BackupOutputParser()
        var errorParser = BackupOutputParser()
        var outputEnded = false
        var errorsEnded = false
        var status: Int32?

        for await chunk in chunks {
            switch chunk {
            case .output(let data):
                if let text = outputLines.take(data) { handle(outputParser.consume(text)) }
            case .error(let data):
                if let text = errorLines.take(data) { handle(errorParser.consume(text)) }
            case .outputEnded:
                if let text = outputLines.drain() { handle(outputParser.consume(text)) }
                handle(outputParser.flush())
                outputEnded = true
            case .errorEnded:
                if let text = errorLines.drain() { handle(errorParser.consume(text)) }
                handle(errorParser.flush())
                errorsEnded = true
            case .exited(let code):
                status = code
            }
            if outputEnded, errorsEnded, status != nil {
                break
            }
        }
        continuation.finish()

        let code = status ?? -1
        let cancelled = cancelRequested || sawAbort
        let lastError = lastErrorLine ?? lastHelperLine
        cleanUp()

        if cancelled {
            phase = .cancelled
            append("The helper stopped.")
            throw BackupError.cancelled
        }
        if code == 0 {
            progress = 1
            phase = .done
            return
        }
        let sentence = BackupError.sentence(lastError: lastError, exitCode: code)
        phase = .failed(sentence)
        throw BackupError.failed(sentence)
    }

    private func cleanUp() {
        escalation?.cancel()
        escalation = nil
        stopStatusPoll()
        if let process {
            (process.standardOutput as? Pipe)?.fileHandleForReading.readabilityHandler = nil
            (process.standardError as? Pipe)?.fileHandleForReading.readabilityHandler = nil
            process.terminationHandler = nil
        }
        process = nil
        secret = nil
    }

    private func escalate() {
        guard !escalated, let process, process.isRunning else { return }
        escalated = true
        append("The helper did not stop on its own. Ending it now.")
        process.terminate()
    }

    // MARK: - What the helper says

    private func handle(_ events: [BackupEvent]) {
        guard !events.isEmpty else { return }
        lastOutput = Date()
        for event in events {
            handle(event)
        }
    }

    private func handle(_ event: BackupEvent) {
        switch event {
        case .starting(let line):
            append(line)
        case .receivingFiles:
            append("Receiving files from the iPhone.")
            publishTransfer(force: true)
        case .sendingFile(let name, let size):
            filesDone = (filesDone ?? 0) + 1
            bytesMoved = nil
            append(size.map { "Sending \(name) (\($0))" } ?? "Sending \(name)")
            publishTransfer()
        case .transfer(_, let done, let total):
            if let done, let total {
                bytesMoved = "\(done) / \(total)"
            }
            publishTransfer()
        case .overall(let percent):
            progress = min(max(percent / 100, 0), 1)
            if percent >= 100 {
                phase = .finishing
            } else {
                publishTransfer(force: true)
            }
        case .receivedFiles(let count):
            filesDone = count
            append("The iPhone sent \(count) files.")
            phase = .finishing
        case .succeeded:
            append("The helper finished.")
        case .aborted:
            sawAbort = true
            append("The helper stopped before it finished.")
        case .failed(let code):
            lastErrorLine = lastErrorLine ?? "Error code \(code)"
            append("The helper failed with error code \(code).")
        case .deviceError(let code, let message):
            lastErrorLine = redacted(message)
            append("The iPhone reported error \(code): \(message)")
        case .error(let line):
            lastErrorLine = redacted(line)
            append(line)
        case .message(let line):
            lastHelperLine = redacted(line)
            append(line)
        }
    }

    /// Publish the transfer state. Files move faster than a window can draw,
    /// so an update that is neither forced nor overdue is dropped.
    private func publishTransfer(force: Bool = false) {
        switch phase {
        case .done, .cancelled, .failed, .finishing:
            return
        default:
            break
        }
        let now = Date()
        guard force || now.timeIntervalSince(lastPublish) >= Self.publishInterval else { return }
        lastPublish = now
        phase = .transferring(
            progress: progress,
            filesDone: filesDone,
            filesTotal: nil,
            bytes: bytesMoved
        )
    }

    // MARK: - Status.plist

    private func startStatusPoll(in folder: URL) {
        statusPoll = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.statusPollInterval)
                guard !Task.isCancelled else { return }
                self?.readStatus(in: folder)
            }
        }
    }

    private func stopStatusPoll() {
        statusPoll?.cancel()
        statusPoll = nil
    }

    /// Read `Status.plist` and, while the helper is quiet, let it speak for
    /// the helper.
    private func readStatus(in folder: URL) {
        guard let status = BackupStatus.read(inBackupFolder: folder) else { return }
        if status.snapshotState != snapshotState {
            snapshotState = status.snapshotState
            append(status.sentence)
        }
        guard Date().timeIntervalSince(lastOutput) > Self.quietStdout, status.isFinished else { return }
        switch phase {
        case .starting, .transferring:
            phase = .finishing
        default:
            break
        }
    }

    // MARK: - The log

    private func append(_ line: String) {
        log.append(redacted(line))
        if log.count > Self.logLimit {
            log.removeFirst(log.count - Self.logLimit)
        }
    }

    /// The backup password is passed to the helper on its command line, so it
    /// never reaches the log with its own letters.
    private func redacted(_ line: String) -> String {
        guard let secret, !secret.isEmpty else { return line }
        return line.replacingOccurrences(of: secret, with: "(password)")
    }
}

extension BackupEngine.Phase {
    /// One line for the hidden `--backup` and `--restore` command line paths.
    var summary: String {
        switch self {
        case .idle:
            return "idle"
        case .starting:
            return "starting"
        case .transferring(let progress, let filesDone, let filesTotal, let bytes):
            var parts = ["transferring \(Int((progress * 100).rounded()))%"]
            if let filesDone {
                parts.append(filesTotal.map { "files \(filesDone)/\($0)" } ?? "files \(filesDone)")
            }
            if let bytes {
                parts.append(bytes)
            }
            return parts.joined(separator: " ")
        case .finishing:
            return "finishing"
        case .done:
            return "done"
        case .cancelled:
            return "cancelled"
        case .failed(let sentence):
            return "failed: \(sentence)"
        }
    }
}

/// Bytes off a pipe, handed on only up to the last whole line.
///
/// A read can stop in the middle of a character, and decoding half a character
/// twice gives two broken ones. A line end is always a character boundary, so
/// the rest waits for the next read.
private struct LineBuffer {
    private var bytes = Data()

    mutating func take(_ data: Data) -> String? {
        bytes.append(data)
        guard let end = bytes.lastIndex(where: { $0 == 0x0a || $0 == 0x0d }) else { return nil }
        let whole = Data(bytes[..<bytes.index(after: end)])
        bytes = Data(bytes[bytes.index(after: end)...])
        return String(decoding: whole, as: UTF8.self)
    }

    mutating func drain() -> String? {
        guard !bytes.isEmpty else { return nil }
        defer { bytes = Data() }
        return String(decoding: bytes, as: UTF8.self)
    }
}
