import Foundation
import Testing

/// The reader that turns what `idevicebackup2` prints into events, and the
/// `Status.plist` reader beside it. No iPhone is needed: every line here is
/// built the way `tools/idevicebackup2.c` of libimobiledevice 1.4.0 prints it.
final class BackupEngineParsingTests {
    private let root: URL

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("backup-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: root)
    }

    // The helper draws a 50 character bar, one `=` for every two percent, then
    // the percentage in a three wide field: `print_progress_real`.
    private func bar(_ percent: Double) -> String {
        let fill = (0..<50).map { Double($0) < percent / 2 ? "=" : " " }.joined()
        return "\r[" + fill + String(format: "] %3.0f%%", percent)
    }

    /// `print_progress`: the bar, then the bytes moved and the bytes to move.
    private func transferLine(_ percent: Double, _ done: String, _ total: String) -> String {
        bar(percent) + " (\(done)/\(total))     "
    }

    /// The bar the main loop prints when a batch of files is done.
    private func overallLine(_ percent: Double) -> String {
        bar(percent) + " Finished\n"
    }

    // MARK: - The progress bar

    @Test func theTransferBarGivesThePercentageAndBothSizes() {
        let line = transferLine(20, "1.2 MB", "6.0 MB")
        var parser = BackupOutputParser()

        // The bar starts with the carriage return that ends the line before
        // it, so the event only lands once the next bar or the pipe end comes.
        #expect(parser.consume(line) == [])
        #expect(
            parser.flush()
                == [.transfer(percent: 20, done: "1.2 MB", total: "6.0 MB")]
        )
    }

    @Test func everyRedrawOfTheBarIsItsOwnEvent() {
        var parser = BackupOutputParser()
        let events = parser.consume(
            transferLine(20, "1.2 MB", "6.0 MB") + transferLine(40, "2.4 MB", "6.0 MB")
        )

        #expect(events == [.transfer(percent: 20, done: "1.2 MB", total: "6.0 MB")])
        #expect(
            parser.flush()
                == [.transfer(percent: 40, done: "2.4 MB", total: "6.0 MB")]
        )
    }

    @Test func aBarCutInHalfByTheReadWaitsForTheRestOfIt() {
        let line = transferLine(100, "6.0 MB", "6.0 MB")
        let cut = line.index(line.startIndex, offsetBy: 30)
        var parser = BackupOutputParser()

        #expect(parser.consume(String(line[..<cut])) == [])
        #expect(parser.consume(String(line[cut...])) == [])
        #expect(
            parser.flush()
                == [.transfer(percent: 100, done: "6.0 MB", total: "6.0 MB")]
        )
    }

    @Test func theFinishedBarIsTheProgressOfTheWholeJob() {
        var parser = BackupOutputParser()
        #expect(parser.consume(overallLine(42)) == [.overall(percent: 42)])
        #expect(parser.consume(overallLine(100)) == [.overall(percent: 100)])
    }

    @Test func aBarThatWasNeverFinishedCarriesTheNextSentence() {
        // A cancelled backup stops redrawing the bar in the middle of the
        // line and prints the file count straight behind it, with no line end
        // in between.
        let line = transferLine(30, "4.0 MB", "10.0 MB") + "Received 2192 files from device.\n"
        var parser = BackupOutputParser()

        #expect(
            parser.consume(line)
                == [
                    .transfer(percent: 30, done: "4.0 MB", total: "10.0 MB"),
                    .receivedFiles(count: 2192),
                ]
        )
    }

    @Test func aBarDrawnByANewerHelperIsReadToo() {
        // A helper built from the current source draws a labelled bar with
        // other characters, and moves the cursor with escape sequences.
        let line = "\u{1b}[2K\rBackup     [#########.....................]  30%\n"
        #expect(BackupOutputParser.events(for: line) == [.overall(percent: 30)])

        let transfer = "\u{1b}[2K\r           [======>                       ]  21.0%   1.2 MB / 6.0 MB     \n"
        #expect(
            BackupOutputParser.events(for: transfer)
                == [.transfer(percent: 21, done: "1.2 MB", total: "6.0 MB")]
        )
    }

    @Test func bracketsInASentenceAreNotAProgressBar() {
        #expect(
            BackupOutputParser.events(for: "Sending '/Library/[odd] name' (1.2 MB)")
                == [.sendingFile(name: "/Library/[odd] name", size: "1.2 MB")]
        )
    }

    // MARK: - The lines between the bars

    @Test func theFileLinesOfABackupAndOfARestore() {
        #expect(BackupOutputParser.events(for: "Receiving files\n") == [.receivingFiles])
        #expect(
            BackupOutputParser.events(for: "Sending '/Manifest.plist' (209 Bytes)\n")
                == [.sendingFile(name: "/Manifest.plist", size: "209 Bytes")]
        )
        #expect(
            BackupOutputParser.events(for: "Received 2192 files from device.\n")
                == [.receivedFiles(count: 2192)]
        )
    }

    @Test func theLastLineSaysWhetherItWorked() {
        #expect(BackupOutputParser.events(for: "Backup Successful.\n") == [.succeeded])
        #expect(BackupOutputParser.events(for: "Restore Successful.\n") == [.succeeded])
        #expect(BackupOutputParser.events(for: "Backup Aborted.\n") == [.aborted])
        #expect(BackupOutputParser.events(for: "Restore Aborted.\n") == [.aborted])
        #expect(
            BackupOutputParser.events(for: "Backup Failed (Error Code 207).\n")
                == [.failed(code: 207)]
        )
        #expect(
            BackupOutputParser.events(for: "Restore Failed (Error Code 13).\n")
                == [.failed(code: 13)]
        )
    }

    @Test func theErrorLinesOfBothStreams() {
        #expect(
            BackupOutputParser.events(for: "ErrorCode 207: Find My iPhone must be turned off.\n")
                == [.deviceError(code: 207, message: "Find My iPhone must be turned off.")]
        )
        #expect(
            BackupOutputParser.events(for: "ERROR: Could not start service com.apple.mobilebackup2: Pairing dialog response pending\n")
                == [.error("ERROR: Could not start service com.apple.mobilebackup2: Pairing dialog response pending")]
        )
        // The signal handler writes this one on stderr when SIGINT arrives.
        #expect(BackupOutputParser.events(for: "Exiting...\n") == [.message("Exiting...")])
    }

    @Test func theOpeningLinesOfABackup() {
        var parser = BackupOutputParser()
        let events = parser.consume(
            """
            Backup directory is "/tmp/aa-backup-test"
            Started "com.apple.mobilebackup2" service on port 49157.
            Negotiated Protocol Version 2.1
            Starting backup...
            Requesting backup from device...
            Full backup mode.

            """
        )

        #expect(events.count == 6)
        #expect(events[0] == .message("Backup directory is \"/tmp/aa-backup-test\""))
        #expect(events[3] == .starting("Starting backup..."))
        #expect(events[5] == .message("Full backup mode."))
    }

    @Test func emptyLinesSayNothing() {
        var parser = BackupOutputParser()
        #expect(parser.consume("\n\r\n   \n") == [])
        #expect(parser.flush() == [])
        #expect(BackupOutputParser.events(for: "") == [])
    }

    // MARK: - Status.plist

    @Test func theStatusOfAFinishedBackupIsReadWhole() throws {
        let date = Date(timeIntervalSince1970: 1_757_602_610)
        try write(
            [
                "BackupState": "new",
                "Date": date,
                "IsFullBackup": false,
                "SnapshotState": "finished",
                "UUID": "5A3C5468-1418-4607-9703-C57FB7DD324E",
                "Version": "3.3",
            ]
        )

        let status = try #require(BackupStatus.read(inBackupFolder: root))
        #expect(status.snapshotState == "finished")
        #expect(status.backupState == "new")
        #expect(status.isFullBackup == false)
        #expect(status.uuid == "5A3C5468-1418-4607-9703-C57FB7DD324E")
        #expect(status.date == date)
        #expect(status.isFinished)
        #expect(status.sentence == "The iPhone finished the snapshot.")
    }

    @Test func aBackupThatIsStillRunningIsNotFinished() throws {
        try write(["SnapshotState": "new", "BackupState": "new", "IsFullBackup": true])

        let status = try #require(BackupStatus.read(inBackupFolder: root))
        #expect(status.isFinished == false)
        #expect(status.isFullBackup == true)
        #expect(status.uuid == nil)
        #expect(status.sentence == "The iPhone is writing the snapshot. It says new.")
    }

    @Test func aMissingOrBrokenStatusPlistReadsAsNothing() throws {
        #expect(BackupStatus.read(inBackupFolder: root) == nil)

        try Data("not a plist".utf8).write(
            to: root.appendingPathComponent(BackupStatus.fileName)
        )
        #expect(BackupStatus.read(inBackupFolder: root) == nil)
    }

    private func write(_ values: [String: Any]) throws {
        let data = try PropertyListSerialization.data(
            fromPropertyList: values,
            format: .binary,
            options: 0
        )
        try data.write(to: root.appendingPathComponent(BackupStatus.fileName))
    }
}
