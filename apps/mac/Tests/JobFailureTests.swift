import XCTest

/// What each layer's own wording turns into on the job screen.
///
/// The point of the mapping is that nothing a layer says reaches the screen
/// unread: a helper exit code, a lockdown number and a sentence about a keybag
/// all come out as a headline somebody can act on and one thing to do. These
/// are the rows of that table, and none of them touches an iPhone.
final class JobFailureTests: XCTestCase {
    // MARK: - A stop somebody asked for

    func testACancelledCopyIsNoFailureAtAll() {
        XCTAssertNil(JobFailure.from(BackupError.cancelled, in: .copying))
        XCTAssertNil(JobFailure.from(BackupError.cancelled, in: .restoring))
    }

    func testATaskThatWasCancelledIsNoFailureEither() {
        XCTAssertNil(JobFailure.from(CancellationError(), in: .copying))
    }

    // MARK: - The transfers

    func testACopyThatStoppedAsksForTheCableBack() {
        let failure = JobFailure.from(helperStopped, in: .copying)

        XCTAssertEqual(failure?.title, "Copy Didn't Finish")
        XCTAssertEqual(failure?.fix, "Reconnect iPhone, then try again.")
        XCTAssertEqual(failure?.retry, .copy)
    }

    func testARestoreThatStoppedIsNamedAsTheRestore() {
        let failure = JobFailure.from(helperStopped, in: .restoring)

        XCTAssertEqual(failure?.title, "Restore Didn't Finish")
        XCTAssertEqual(failure?.fix, "Reconnect iPhone, then try again.")
        // The copy on this Mac is still patched, so Try Again sends it again
        // rather than spending another hour making a new one.
        XCTAssertEqual(failure?.retry, .restore)
    }

    func testAFlagThatWouldNotGoInIsStillTheCopysFailure() {
        let failure = JobFailure.from(PatchError.noSupervisionFile, in: .preparing)

        XCTAssertEqual(failure?.title, "Copy Didn't Finish")
        XCTAssertEqual(failure?.retry, .copy)
    }

    // MARK: - The password

    func testAPatchThatCouldNotOpenTheCopyAsksForThePassword() {
        let failure = JobFailure.from(PatchError.wrongPassword, in: .preparing)

        XCTAssertEqual(failure?.title, "Wrong Backup Password")
        XCTAssertEqual(failure?.fix, "Enter the password set for encrypted backups.")
        // The flag is written again once the right password is typed, and the
        // screen shows the field to type it in.
        XCTAssertEqual(failure?.retry, .patch)
        XCTAssertEqual(failure?.needsPassword, true)
    }

    func testAHelperThatRefusedThePasswordSaysTheSameThing() {
        let refused = BackupError.failed(
            BackupError.sentence(lastError: "ERROR: Invalid password", exitCode: 1)
        )

        XCTAssertEqual(JobFailure.from(refused, in: .restoring)?.title, "Wrong Backup Password")
    }

    func testEveryOtherFailureLeavesThePasswordFieldOffTheScreen() {
        XCTAssertEqual(JobFailure.from(helperStopped, in: .copying)?.needsPassword, false)
    }

    // MARK: - The disk

    func testAFullDiskSaysHowMuchToFreeWhenTheChecksMeasuredIt() {
        let failure = JobFailure.from(noSpace, in: .copying, missingSpace: "12 GB")

        XCTAssertEqual(failure?.title, "Not Enough Space on This Mac")
        XCTAssertEqual(failure?.fix, "Free up about 12 GB, then try again.")
        XCTAssertEqual(failure?.retry, .copy)
    }

    func testAFullDiskThatCouldNotBeMeasuredStillSaysWhatToDo() {
        XCTAssertEqual(
            JobFailure.from(noSpace, in: .copying)?.fix,
            "Free up space on this Mac, then try again."
        )
    }

    func testADiskThatFilledDuringTheRestoreIsStillAboutTheDisk() {
        XCTAssertEqual(JobFailure.from(noSpace, in: .restoring)?.title, "Not Enough Space on This Mac")
    }

    // MARK: - What the layer said

    func testTheLayersOwnWordsAreKeptForTheButtonBehindTheFix() {
        let failure = JobFailure.from(PatchError.wrongPassword, in: .preparing)

        XCTAssertEqual(failure?.raw, PatchError.wrongPassword.localizedDescription)
    }

    // MARK: - The failures the rows are written from

    /// The cable coming out, which is the failure a reader is most likely to
    /// meet, as the helper reports it and the backup layer words it.
    private let helperStopped = BackupError.failed(
        BackupError.sentence(lastError: "ERROR: No device found, is it plugged in?", exitCode: 1)
    )

    private let noSpace = BackupError.failed(
        BackupError.sentence(lastError: "ERROR: No space left on device", exitCode: 1)
    )
}
