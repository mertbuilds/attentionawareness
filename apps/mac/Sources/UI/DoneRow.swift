import SwiftUI

/// One row of the box on the last screen: a symbol, a sentence, and the
/// buttons for it under the sentence, where a longer sentence in another
/// language still has the whole width. Every button in a row is a standard
/// bordered one, so the filled button at the bottom stays the only loud thing
/// on the screen.
struct DoneRow<Actions: View>: View {
    let symbol: String
    let text: String
    @ViewBuilder let actions: Actions

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            // The sentence beside it says what the row is, so VoiceOver skips
            // the picture.
            Image(systemName: symbol)
                .foregroundStyle(.secondary)
                .frame(width: 18)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 8) {
                Text(text)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    actions
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .buttonStyle(StandardButton())
    }
}
