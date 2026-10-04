import Foundation
import Testing

/// The argument list the engine hands the helper to turn encryption on.
///
/// No iPhone is needed: the shape of the command is a value, built the way
/// `idevicebackup2` parses `encryption on|off [PWD] DIRECTORY`. The password
/// sits before the directory on purpose, because that is the order the helper
/// reads them in.
struct BackupEngineArgumentsTests {
    @Test func turningEncryptionOnNamesTheDeviceThePasswordAndTheRoot() {
        let arguments = BackupEngine.encryptionArguments(
            udid: "00000000-1111111111111111",
            password: "hunter2",
            root: URL(fileURLWithPath: "/tmp/aa-backup-test")
        )

        #expect(
            arguments == [
                "-u", "00000000-1111111111111111", "encryption", "on", "hunter2", "/tmp/aa-backup-test",
            ]
        )
    }

    @Test func thePasswordComesRightAfterOnAndTheRootIsLast() throws {
        let arguments = BackupEngine.encryptionArguments(
            udid: "u",
            password: "pw",
            root: URL(fileURLWithPath: "/root")
        )

        let on = try #require(arguments.firstIndex(of: "on"))
        #expect(arguments[on + 1] == "pw")
        #expect(arguments.last == "/root")
    }
}
