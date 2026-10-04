import Foundation

/// One thing the bundled `idevicebackup2` helper said while it worked.
///
/// The formats come from `tools/idevicebackup2.c` of libimobiledevice 1.4.0,
/// the version `scripts/vendor.sh` copies out of Homebrew. The helper prints
/// almost everything on stdout, keeps stderr for the signal handler and a few
/// lock failures, and rewrites its progress bar in place with a carriage
/// return instead of a newline.
enum BackupEvent: Equatable {
    /// `Starting backup...` or `Starting Restore...`.
    case starting(String)
    /// `Receiving files`, printed once per batch the phone sends.
    case receivingFiles
    /// `Sending '<path>' (1.2 MB)`, printed once per file of a restore.
    case sendingFile(name: String, size: String?)
    /// The file transfer bar: `[====    ]  42% (1.2 MB/3.4 GB)`.
    case transfer(percent: Double, done: String?, total: String?)
    /// The overall bar, printed when a batch of files is done:
    /// `[====    ]  42% Finished`.
    case overall(percent: Double)
    /// `Received 219 files from device.`
    case receivedFiles(count: Int)
    /// `Backup Successful.` or `Restore Successful.`
    case succeeded
    /// `Backup Aborted.`, `Restore Aborted.` or `Operation Aborted.`
    case aborted
    /// `Backup Failed (Error Code 207).`
    case failed(code: Int)
    /// `ErrorCode 207: <what the phone said>`. The phone wrote the message.
    case deviceError(code: Int, message: String)
    /// A line that starts with `ERROR:`, on either stream.
    case error(String)
    /// Everything else, kept for the log.
    case message(String)
}

/// Turns what the helper writes into events.
///
/// Feed it every chunk that comes off the pipes. It buffers a partial line
/// until its end arrives, and it treats a carriage return as a line end,
/// because that is how the progress bar overwrites itself.
struct BackupOutputParser {
    private var pending = ""

    /// Split `text` into whole lines and turn each one into events. A
    /// trailing partial line is kept until the next chunk completes it.
    mutating func consume(_ text: String) -> [BackupEvent] {
        pending += text
        var events: [BackupEvent] = []
        while let end = pending.firstIndex(where: { $0 == "\n" || $0 == "\r" }) {
            let line = String(pending[pending.startIndex..<end])
            pending = String(pending[pending.index(after: end)...])
            events += Self.events(for: line)
        }
        return events
    }

    /// Turn whatever is left in the buffer into events. Call it once the pipe
    /// is at its end: the last progress bar carries no line end.
    mutating func flush() -> [BackupEvent] {
        let line = pending
        pending = ""
        return Self.events(for: line)
    }

    /// What one line says. Usually nothing or one thing, but a progress bar
    /// that was never finished off carries the next sentence behind it: the
    /// helper stops redrawing the bar mid line and just keeps printing.
    static func events(for rawLine: String) -> [BackupEvent] {
        let line = strippingControlCodes(rawLine).trimmingCharacters(in: .whitespaces)
        guard !line.isEmpty else { return [] }

        if let (bar, rest) = progressEvent(line) {
            return [bar] + events(for: rest)
        }
        guard let event = sentenceEvent(line) else { return [] }
        return [event]
    }

    /// The event a line without a progress bar stands for.
    private static func sentenceEvent(_ line: String) -> BackupEvent? {
        if line.hasSuffix("Receiving files") { return .receivingFiles }
        if let sending = sendingEvent(line) { return sending }
        if let received = receivedFilesEvent(line) { return received }
        if line.hasSuffix("Successful.") { return .succeeded }
        if line.hasSuffix("Aborted.") { return .aborted }
        if let failure = failedEvent(line) { return .failed(code: failure) }
        if let deviceError = deviceErrorEvent(line) { return deviceError }
        if line.hasPrefix("ERROR:") || line.contains(": ERROR ") { return .error(line) }
        if line.hasPrefix("Starting ") { return .starting(line) }
        return .message(line)
    }

    /// Drop the escape sequences and the other control characters a terminal
    /// eats. libimobiledevice 1.4.0 writes none, but a newer helper draws its
    /// progress with them and pipes them through all the same.
    static func strippingControlCodes(_ line: String) -> String {
        var clean = ""
        var inEscape = false
        for character in line {
            if inEscape {
                // A CSI sequence ends at the first byte in 0x40...0x7e.
                if let ascii = character.asciiValue, (0x40...0x7e).contains(ascii), character != "[" {
                    inEscape = false
                }
                continue
            }
            if character == "\u{1b}" {
                inEscape = true
                continue
            }
            if let ascii = character.asciiValue, ascii < 0x20, character != "\t" {
                continue
            }
            clean.append(character)
        }
        return clean
    }

    /// The characters a progress bar is drawn with. 1.4.0 uses `=` and a
    /// space, a newer helper uses `#`, `.` and `>` as well.
    private static let barCharacters: Set<Character> = ["=", " ", "#", ".", ">"]
    /// Shorter than this and the brackets are part of a sentence, not a bar.
    private static let shortestBar = 10

    /// `[====      ]  42% (1.2 MB/3.4 GB)` and the two other shapes the bar
    /// takes, with whatever the helper printed behind it.
    ///
    /// A leading label is ignored, because a newer helper writes one.
    private static func progressEvent(_ line: String) -> (BackupEvent, String)? {
        guard
            let open = line.firstIndex(of: "["),
            let close = line[open...].firstIndex(of: "]")
        else {
            return nil
        }
        let bar = line[line.index(after: open)..<close]
        guard bar.count >= shortestBar, bar.allSatisfy(barCharacters.contains) else { return nil }

        let rest = line[line.index(after: close)...].trimmingCharacters(in: .whitespaces)
        guard
            let percentEnd = rest.firstIndex(of: "%"),
            let percent = Double(rest[rest.startIndex..<percentEnd].trimmingCharacters(in: .whitespaces))
        else {
            return nil
        }

        let tail = rest[rest.index(after: percentEnd)...].trimmingCharacters(in: .whitespaces)
        if tail.isEmpty {
            return (.overall(percent: percent), "")
        }
        if tail.hasPrefix("Finished") {
            return (.overall(percent: percent), String(tail.dropFirst("Finished".count)))
        }
        // 1.4.0 puts the sizes in brackets, so anything behind them is the
        // next sentence. A newer helper writes them bare, on a line of their
        // own.
        if tail.hasPrefix("("), let sizesEnd = tail.firstIndex(of: ")") {
            let sizes = String(tail[tail.index(after: tail.startIndex)..<sizesEnd])
            return (transferEvent(percent: percent, sizes: sizes), String(tail[tail.index(after: sizesEnd)...]))
        }
        return (transferEvent(percent: percent, sizes: tail), "")
    }

    /// `1.2 MB/3.4 GB`, the two sizes the helper prints beside the bar.
    private static func transferEvent(percent: Double, sizes: String) -> BackupEvent {
        let parts = sizes.split(separator: "/", maxSplits: 1).map {
            $0.trimmingCharacters(in: .whitespaces)
        }
        guard parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty else {
            return .transfer(percent: percent, done: nil, total: nil)
        }
        return .transfer(percent: percent, done: parts[0], total: parts[1])
    }

    /// `Sending '/path/in/the/backup' (1.2 MB)`.
    private static func sendingEvent(_ line: String) -> BackupEvent? {
        guard line.hasPrefix("Sending '") else { return nil }
        let afterQuote = line.index(line.startIndex, offsetBy: "Sending '".count)
        guard let closingQuote = line[afterQuote...].lastIndex(of: "'") else { return nil }
        let name = String(line[afterQuote..<closingQuote])
        let tail = line[line.index(after: closingQuote)...].trimmingCharacters(in: .whitespaces)
        let size = tail.hasPrefix("(") && tail.hasSuffix(")") ? String(tail.dropFirst().dropLast()) : nil
        return .sendingFile(name: name, size: size)
    }

    /// `Received 219 files from device.`
    private static func receivedFilesEvent(_ line: String) -> BackupEvent? {
        guard line.hasPrefix("Received "), line.hasSuffix(" files from device.") else { return nil }
        let count = line.dropFirst("Received ".count).prefix { $0.isNumber }
        guard let value = Int(count) else { return nil }
        return .receivedFiles(count: value)
    }

    /// `Backup Failed (Error Code 207).` and the restore line beside it.
    private static func failedEvent(_ line: String) -> Int? {
        guard line.hasSuffix(").") , let marker = line.range(of: "Failed (Error Code ") else { return nil }
        let digits = line[marker.upperBound...].prefix { $0.isNumber }
        return Int(digits)
    }

    /// `ErrorCode 207: The backup could not be written.`
    private static func deviceErrorEvent(_ line: String) -> BackupEvent? {
        guard line.hasPrefix("ErrorCode "), let colon = line.firstIndex(of: ":") else { return nil }
        let digits = line.dropFirst("ErrorCode ".count).prefix { $0.isNumber || $0 == "-" }
        guard let code = Int(digits) else { return nil }
        let message = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        return .deviceError(code: code, message: message)
    }
}
