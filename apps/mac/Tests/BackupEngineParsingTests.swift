import XCTest

/// The reader that turns what `idevicebackup2` prints into events, and the
/// `Status.plist` reader beside it. No iPhone is needed: every line here is
/// built the way `tools/idevicebackup2.c` of libimobiledevice 1.4.0 prints it.
final class BackupEngineParsingTests: XCTestCase {
    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("backup-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
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

    func testTheTransferBarGivesThePercentageAndBothSizes() {
        let line = transferLine(20, "1.2 MB", "6.0 MB")
        var parser = BackupOutputParser()

        // The bar starts with the carriage return that ends the line before
        // it, so the event only lands once the next bar or the pipe end comes.
        XCTAssertEqual(parser.consume(line), [])
        XCTAssertEqual(
            parser.flush(),
            [.transfer(percent: 20, done: "1.2 MB", total: "6.0 MB")]
        )
    }

    func testEveryRedrawOfTheBarIsItsOwnEvent() {
        var parser = BackupOutputParser()
        let events = parser.consume(
            transferLine(20, "1.2 MB", "6.0 MB") + transferLine(40, "2.4 MB", "6.0 MB")
        )

        XCTAssertEqual(events, [.transfer(percent: 20, done: "1.2 MB", total: "6.0 MB")])
        XCTAssertEqual(
            parser.flush(),
            [.transfer(percent: 40, done: "2.4 MB", total: "6.0 MB")]
        )
    }

    func testABarCutInHalfByTheReadWaitsForTheRestOfIt() {
        let line = transferLine(100, "6.0 MB", "6.0 MB")
        let cut = line.index(line.startIndex, offsetBy: 30)
        var parser = BackupOutputParser()

        XCTAssertEqual(parser.consume(String(line[..<cut])), [])
        XCTAssertEqual(parser.consume(String(line[cut...])), [])
        XCTAssertEqual(
            parser.flush(),
            [.transfer(percent: 100, done: "6.0 MB", total: "6.0 MB")]
        )
    }

    func testTheFinishedBarIsTheProgressOfTheWholeJob() {
        var parser = BackupOutputParser()
        XCTAssertEqual(parser.consume(overallLine(42)), [.overall(percent: 42)])
        XCTAssertEqual(parser.consume(overallLine(100)), [.overall(percent: 100)])
    }

    func testABarThatWasNeverFinishedCarriesTheNextSentence() {
        // A cancelled backup stops redrawing the bar in the middle of the
        // line and prints the file count straight behind it, with no line end
        // in between.
        let line = transferLine(30, "4.0 MB", "10.0 MB") + "Received 2192 files from device.\n"
        var parser = BackupOutputParser()

        XCTAssertEqual(
            parser.consume(line),
            [
                .transfer(percent: 30, done: "4.0 MB", total: "10.0 MB"),
                .receivedFiles(count: 2192),
            ]
        )
    }

    func testABarDrawnByANewerHelperIsReadToo() {
        // A helper built from the current source draws a labelled bar with
        // other characters, and moves the cursor with escape sequences.
        let line = "\u{1b}[2K\rBackup     [#########.....................]  30%\n"
        XCTAssertEqual(BackupOutputParser.events(for: line), [.overall(percent: 30)])

        let transfer = "\u{1b}[2K\r           [======>                       ]  21.0%   1.2 MB / 6.0 MB     \n"
        XCTAssertEqual(
            BackupOutputParser.events(for: transfer),
            [.transfer(percent: 21, done: "1.2 MB", total: "6.0 MB")]
        )
    }

    func testBracketsInASentenceAreNotAProgressBar() {
        XCTAssertEqual(
            BackupOutputParser.events(for: "Sending '/Library/[odd] name' (1.2 MB)"),
            [.sendingFile(name: "/Library/[odd] name", size: "1.2 MB")]
        )
    }

    // MARK: - The lines between the bars

    func testTheFileLinesOfABackupAndOfARestore() {
        XCTAssertEqual(BackupOutputParser.events(for: "Receiving files\n"), [.receivingFiles])
        XCTAssertEqual(
            BackupOutputParser.events(for: "Sending '/Manifest.plist' (209 Bytes)\n"),
            [.sendingFile(name: "/Manifest.plist", size: "209 Bytes")]
        )
        XCTAssertEqual(
            BackupOutputParser.events(for: "Received 2192 files from device.\n"),
            [.receivedFiles(count: 2192)]
        )
    }

    func testTheLastLineSaysWhetherItWorked() {
        XCTAssertEqual(BackupOutputParser.events(for: "Backup Successful.\n"), [.succeeded])
        XCTAssertEqual(BackupOutputParser.events(for: "Restore Successful.\n"), [.succeeded])
        XCTAssertEqual(BackupOutputParser.events(for: "Backup Aborted.\n"), [.aborted])
        XCTAssertEqual(BackupOutputParser.events(for: "Restore Aborted.\n"), [.aborted])
        XCTAssertEqual(
            BackupOutputParser.events(for: "Backup Failed (Error Code 207).\n"),
            [.failed(code: 207)]
        )
        XCTAssertEqual(
            BackupOutputParser.events(for: "Restore Failed (Error Code 13).\n"),
            [.failed(code: 13)]
        )
    }

    func testTheErrorLinesOfBothStreams() {
        XCTAssertEqual(
            BackupOutputParser.events(for: "ErrorCode 207: Find My iPhone must be turned off.\n"),
            [.deviceError(code: 207, message: "Find My iPhone must be turned off.")]
        )
        XCTAssertEqual(
            BackupOutputParser.events(for: "ERROR: Could not start service com.apple.mobilebackup2: Pairing dialog response pending\n"),
            [.error("ERROR: Could not start service com.apple.mobilebackup2: Pairing dialog response pending")]
        )
        // The signal handler writes this one on stderr when SIGINT arrives.
        XCTAssertEqual(BackupOutputParser.events(for: "Exiting...\n"), [.message("Exiting...")])
    }

    func testTheOpeningLinesOfABackup() {
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

        XCTAssertEqual(events.count, 6)
        XCTAssertEqual(events[0], .message("Backup directory is \"/tmp/aa-backup-test\""))
        XCTAssertEqual(events[3], .starting("Starting backup..."))
        XCTAssertEqual(events[5], .message("Full backup mode."))
    }

    func testEmptyLinesSayNothing() {
        var parser = BackupOutputParser()
        XCTAssertEqual(parser.consume("\n\r\n   \n"), [])
        XCTAssertEqual(parser.flush(), [])
        XCTAssertEqual(BackupOutputParser.events(for: ""), [])
    }

    // MARK: - Status.plist

    func testTheStatusOfAFinishedBackupIsReadWhole() throws {
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

        let status = try XCTUnwrap(BackupStatus.read(inBackupFolder: root))
        XCTAssertEqual(status.snapshotState, "finished")
        XCTAssertEqual(status.backupState, "new")
        XCTAssertEqual(status.isFullBackup, false)
        XCTAssertEqual(status.uuid, "5A3C5468-1418-4607-9703-C57FB7DD324E")
        XCTAssertEqual(status.date, date)
        XCTAssertTrue(status.isFinished)
        XCTAssertEqual(status.sentence, "The iPhone finished the snapshot.")
    }

    func testABackupThatIsStillRunningIsNotFinished() throws {
        try write(["SnapshotState": "new", "BackupState": "new", "IsFullBackup": true])

        let status = try XCTUnwrap(BackupStatus.read(inBackupFolder: root))
        XCTAssertFalse(status.isFinished)
        XCTAssertEqual(status.isFullBackup, true)
        XCTAssertNil(status.uuid)
        XCTAssertEqual(status.sentence, "The iPhone is writing the snapshot. It says new.")
    }

    func testAMissingOrBrokenStatusPlistReadsAsNothing() throws {
        XCTAssertNil(BackupStatus.read(inBackupFolder: root))

        try Data("not a plist".utf8).write(
            to: root.appendingPathComponent(BackupStatus.fileName)
        )
        XCTAssertNil(BackupStatus.read(inBackupFolder: root))
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
