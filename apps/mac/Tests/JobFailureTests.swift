import Foundation
import Testing

/// What each layer's own wording turns into on the job screen.
///
/// The point of the mapping is that nothing a layer says reaches the screen
/// unread: a helper exit code or a lockdown number comes out as a headline
/// somebody can act on and one thing to do. These are the rows of that table,
/// and none of them touches an iPhone.
struct JobFailureTests {
    // MARK: - A stop somebody asked for

    @Test func aCancelledRestoreIsNoFailureAtAll() {
        #expect(JobFailure.from(BackupError.cancelled, in: .preparing) == nil)
        #expect(JobFailure.from(BackupError.cancelled, in: .restoring) == nil)
    }

    @Test func aTaskThatWasCancelledIsNoFailureEither() {
        #expect(JobFailure.from(CancellationError(), in: .preparing) == nil)
    }

    // MARK: - The pieces of the job

    @Test func aReadOfTheIPhoneThatFailedAsksForTheCableBack() {
        let failure = JobFailure.from(DeviceError.trustPending, in: .preparing)

        #expect(failure?.title == "Couldn't Read iPhone")
        #expect(failure?.fix == "Reconnect iPhone, then try again.")
        // Nothing reached the iPhone, so Try Again starts from the top.
        #expect(failure?.retry == .start)
    }

    @Test func aRestoreThatStoppedIsNamedAsTheRestore() {
        let failure = JobFailure.from(helperStopped, in: .restoring)

        #expect(failure?.title == "Restore Didn't Finish")
        #expect(failure?.fix == "Reconnect iPhone, then try again.")
        // The restore may have reached the iPhone, so unplugging keeps this
        // screen and its Try Again.
        #expect(failure?.retry == .restore)
    }

    // MARK: - The guards

    @Test(arguments: [IOSSupport.Refusal.iosNotSupportedYet, .iosVersionUnknown])
    func aVersionTheAppDoesNotRunOnIsRefusedBeforeAnythingIsSent(_ refusal: IOSSupport.Refusal) {
        let failure = JobFailure.from(SeedRunError.refused(refusal), in: .preparing)

        #expect(failure?.title == "Can't Supervise This iPhone")
        #expect(failure?.fix == "\(refusal.message) Nothing was sent to iPhone.")
        #expect(failure?.retry == .start)
    }

    /// The two version reads of one run put it in different modes, before
    /// anything was sent.
    @Test func aVersionThatChangedDuringTheRunStartsFromTheTop() {
        let failure = JobFailure.from(SeedRunError.iosVersionChanged, in: .preparing)

        #expect(failure?.title == "Couldn't Finish Supervision")
        #expect(
            failure?.fix
                == "The iOS version iPhone gave changed during the run. Nothing was sent to iPhone. Try again."
        )
        #expect(failure?.retry == .start)
    }

    @Test func aRestartThatFailedAsksOnlyForTheRestart() {
        let failure = JobFailure.from(SeedRunError.restartFailed("No answer."), in: .restoring)

        #expect(failure?.title == "Restart Needed")
        #expect(failure?.retry == .restore)
    }

    /// iOS 27 or later: iPhone restarted from the restore and the setting
    /// sent live did not hold. Try Again sends it again alone.
    @Test func aSettingIPhoneDidNotTakeAsksToStayOnRestoreCompletedAndTryAgain() {
        let failure = JobFailure.from(
            SeedRunError.liveConfigurationNotTaken(lastReason: "iPhone refused the SetCloudConfiguration request. Test"),
            in: .restoring
        )

        #expect(failure?.title == "iPhone Didn't Take the Setting")
        #expect(
            failure?.fix
                == "iPhone restarted, but it did not take the supervision setting. Keep iPhone unlocked and on the cable. If it shows Restore Completed, do not tap Continue. Then try again."
        )
        // What iPhone said is behind the "i", and the fix stays the plain one.
        #expect(failure?.raw == "iPhone refused the SetCloudConfiguration request. Test")
        #expect(JobFailure.from(SeedRunError.liveConfigurationNotTaken(lastReason: nil), in: .restoring)?.raw == "")
        // The restore reached the iPhone, so unplugging keeps this screen.
        #expect(failure?.retry == .restore)
    }

    // MARK: - What the layer said

    @Test func theLayersOwnWordsAreKeptForTheButtonBehindTheFix() {
        let failure = JobFailure.from(helperStopped, in: .restoring)

        #expect(failure?.raw == helperStopped.localizedDescription)
    }

    // MARK: - The failures the rows are written from

    /// The cable coming out, which is the failure a reader is most likely to
    /// meet, as the helper reports it and the backup layer words it.
    private let helperStopped = BackupError.failed(
        BackupError.sentence(lastError: "ERROR: No device found, is it plugged in?", exitCode: 1)
    )
}
