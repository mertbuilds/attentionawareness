import SwiftUI

/// The supervision key, as one row of the checks: a line that says where the
/// key stands, the field it is pasted into, and the one thing to do when it is
/// no good.
///
/// The line takes the tick the moment a check says the key is usable, which is
/// also what turns the Supervise button on. Until then the button beside the
/// line sells one. How the key is counted sits in the hover help, so a reader
/// with a key that works reads one line and moves on.
struct SupervisionKeyField: View {
    @ObservedObject var model: WizardModel

    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                status
                if model.keyStatus != .checked(.usable) {
                    Button("Buy for $29") {
                        model.buyKey()
                    }
                    .font(.callout)
                }
            }
            RingedField(focused: focused) {
                TextField(
                    "Paste key",
                    text: Binding(
                        get: { model.licenseKey },
                        set: { model.editKey($0) }
                    )
                )
                .accessibilityLabel("Supervision key")
                // A key is pasted, not written, and a corrected one is no key.
                .autocorrectionDisabled()
                .focused($focused)
                .onSubmit { model.checkKey() }
            }
            if let failure {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(failure.fix)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if failure.retries {
                        Button("Try Again") {
                            model.checkKey()
                        }
                        .font(.callout)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The line over the field. A check on its way back gets a spinner in
    /// place of the dot, because the answer is seconds away rather than
    /// something to do.
    @ViewBuilder
    private var status: some View {
        switch model.keyStatus {
        case .empty:
            CheckLine(ok: false, text: "Paste a supervision key.", help: Self.help)
        case .checking:
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                ProgressView()
                    .controlSize(.small)
                Text("Checking the key")
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .checked(let check):
            CheckLine(ok: check == .usable, text: failure?.headline ?? "Supervision key is ready", help: Self.help)
        }
    }

    /// What a key that is no good says: what is wrong with it, the one thing
    /// to do about it, and whether asking again could change the answer.
    private struct Failure {
        let headline: String
        let fix: String
        /// True where the same key can come back different: a key server
        /// that could not be reached, and a key bought so recently that it
        /// is not there yet. A used up or revoked key stays that way.
        let retries: Bool
    }

    private var failure: Failure? {
        guard case .checked(let check) = model.keyStatus else { return nil }
        switch check {
        case .usable:
            return nil
        case .usedUp:
            return Failure(
                headline: "This key was already used",
                fix: "Each key is good for one supervision. Buy another to continue.",
                retries: false
            )
        case .revoked:
            return Failure(
                headline: "This key no longer works",
                fix: "Paste another key or buy a new one.",
                retries: false
            )
        case .notFound:
            return Failure(
                headline: "Key not found",
                fix: "Copy the key from your receipt and paste it again.",
                retries: true
            )
        case .unavailable:
            return Failure(
                headline: "Can't reach the key server",
                fix: "Check the internet connection, then try again.",
                retries: true
            )
        }
    }

    /// How the key is counted, for anyone who wonders what they are paying
    /// for before they paste one.
    private static let help = """
        One key is good for one supervision. It's counted once iPhone reads as supervised, so a run \
        that doesn't finish costs nothing. Keys are sold and checked through Polar.
        """
}
