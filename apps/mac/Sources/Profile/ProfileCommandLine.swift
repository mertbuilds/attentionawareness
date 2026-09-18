import Foundation

/// The hidden `--sign-profile <file>` command line path.
///
/// It asks the site to sign the profile the Profile step installs and writes
/// the answer, which is how the signing side is checked from a terminal
/// without an iPhone:
///
/// ```sh
/// AA_SITE_URL=https://attentionawareness.localhost \
///   "attention awareness.app/Contents/MacOS/attention awareness" --sign-profile /tmp/aa.mobileconfig
/// ```
///
/// It prints the size and whether the bytes are the DER of a signed CMS
/// message. Nothing is sent to an iPhone.
@MainActor
enum ProfileCommandLine {
    static let flag = "--sign-profile"

    static let usage = "usage: attention awareness \(flag) <out.mobileconfig>"

    /// Sign the profile, write it and exit. Comes back only when the arguments
    /// are about something else.
    static func runIfAsked(_ arguments: [String] = CommandLine.arguments) {
        guard let index = arguments.firstIndex(of: flag) else { return }
        guard arguments.count > index + 1 else {
            print(usage)
            exit(2)
        }
        // stdout is a pipe as often as it is a terminal, and a pipe holds every
        // line back until the buffer fills.
        setvbuf(stdout, nil, _IOLBF, 0)
        exit(run(writingTo: URL(fileURLWithPath: arguments[index + 1])))
    }

    private static func run(writingTo url: URL) -> Int32 {
        let state = RunState()
        Task { @MainActor in
            do {
                state.data = try await ProfileSigner().signedProfile(for: .default)
            } catch {
                state.message = error.localizedDescription
            }
            state.finished = true
        }

        // The task runs on the main actor, so the main run loop has to keep
        // turning for it to get anywhere.
        while !state.finished {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
        }

        guard let data = state.data else {
            print(state.message ?? "The site did not sign the profile.")
            return 1
        }
        do {
            try data.write(to: url)
        } catch {
            print(error.localizedDescription)
            return 1
        }
        print("\(url.path): \(data.count) bytes, \(Self.shape(data))")
        return 0
    }

    /// What came back. A signed profile is a CMS message in DER, which of this
    /// size always starts with a sequence tag and a two byte length. A site
    /// with no signing key of its own would answer with the profile as plain
    /// XML instead.
    private static func shape(_ data: Data) -> String {
        if data.starts(with: [0x30, 0x82]) { return "signed CMS in DER" }
        if data.starts(with: Array("<?xml".utf8)) { return "unsigned XML" }
        return "neither DER nor XML"
    }

    /// What the run loop waits for.
    @MainActor
    private final class RunState {
        var finished = false
        var data: Data?
        var message: String?
    }
}
