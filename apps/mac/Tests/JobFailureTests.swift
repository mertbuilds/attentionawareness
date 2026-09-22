import Foundation
import Testing

/// What each layer's own wording turns into on the job screen.
///
/// The point of the mapping is that nothing a layer says reaches the screen
/// unread: a helper exit code, a lockdown number and a sentence about a keybag
/// all come out as a headline somebody can act on and one thing to do. These
/// are the rows of that table, and none of them touches an iPhone.
struct JobFailureTests {
    // MARK: - A stop somebody asked for

    @Test func aCancelledCopyIsNoFailureAtAll() {
        #expect(JobFailure.from(BackupError.cancelled, in: .copying) == nil)
        #expect(JobFailure.from(BackupError.cancelled, in: .restoring) == nil)
    }

    @Test func aTaskThatWasCancelledIsNoFailureEither() {
        #expect(JobFailure.from(CancellationError(), in: .copying) == nil)
    }

    // MARK: - The transfers

    @Test func aCopyThatStoppedAsksForTheCableBack() {
        let failure = JobFailure.from(helperStopped, in: .copying)

        #expect(failure?.title == "Copy Didn't Finish")
        #expect(failure?.fix == "Reconnect iPhone, then try again.")
        #expect(failure?.retry == .copy)
    }

    @Test func aRestoreThatStoppedIsNamedAsTheRestore() {
        let failure = JobFailure.from(helperStopped, in: .restoring)

        #expect(failure?.title == "Restore Didn't Finish")
        #expect(failure?.fix == "Reconnect iPhone, then try again.")
        // The copy on this Mac is still patched, so Try Again sends it again
        // rather than spending another hour making a new one.
        #expect(failure?.retry == .restore)
    }

    @Test func aFlagThatWouldNotGoInIsStillTheCopysFailure() {
        let failure = JobFailure.from(PatchError.noSupervisionFile, in: .preparing)

        #expect(failure?.title == "Copy Didn't Finish")
        #expect(failure?.retry == .copy)
    }

    // MARK: - The password

    @Test func aPatchThatCouldNotOpenTheCopyAsksForThePassword() {
        let failure = JobFailure.from(PatchError.wrongPassword, in: .preparing)

        #expect(failure?.title == "Wrong Backup Password")
        #expect(failure?.fix == "Enter the password set for encrypted backups.")
        // The flag is written again once the right password is typed, and the
        // screen shows the field to type it in.
        #expect(failure?.retry == .patch)
        #expect(failure?.needsPassword == true)
    }

    @Test func aHelperThatRefusedThePasswordSaysTheSameThing() {
        let refused = BackupError.failed(
            BackupError.sentence(lastError: "ERROR: Invalid password", exitCode: 1)
        )

        #expect(JobFailure.from(refused, in: .restoring)?.title == "Wrong Backup Password")
    }

    @Test func everyOtherFailureLeavesThePasswordFieldOffTheScreen() {
        #expect(JobFailure.from(helperStopped, in: .copying)?.needsPassword == false)
    }

    // MARK: - The disk

    @Test func aFullDiskSaysHowMuchToFreeWhenTheChecksMeasuredIt() {
        let failure = JobFailure.from(noSpace, in: .copying, missingSpace: "12 GB")

        #expect(failure?.title == "Not Enough Space on This Mac")
        #expect(failure?.fix == "Free up about 12 GB, then try again.")
        #expect(failure?.retry == .copy)
    }

    @Test func aFullDiskThatCouldNotBeMeasuredStillSaysWhatToDo() {
        #expect(
            JobFailure.from(noSpace, in: .copying)?.fix == "Free up space on this Mac, then try again."
        )
    }

    @Test func aDiskThatFilledDuringTheRestoreIsStillAboutTheDisk() {
        #expect(JobFailure.from(noSpace, in: .restoring)?.title == "Not Enough Space on This Mac")
    }

    // MARK: - What the layer said

    @Test func theLayersOwnWordsAreKeptForTheButtonBehindTheFix() {
        let failure = JobFailure.from(PatchError.wrongPassword, in: .preparing)

        #expect(failure?.raw == PatchError.wrongPassword.localizedDescription)
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
