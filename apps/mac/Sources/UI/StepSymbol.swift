import SwiftUI

/// The symbol above a step's title, for the steps that report how something
/// ended: the tick when the run went through, and the warning sign when a
/// piece of it did not.
enum StepSymbol {
    case done
    case warning

    var body: some View {
        // The title says the same thing in words, so VoiceOver skips the
        // picture.
        image
            .font(.system(size: 40))
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var image: some View {
        switch self {
        case .done:
            Image(systemName: "checkmark.circle.fill")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(WizardStyle.accent)
        case .warning:
            // The system's own warning colours, yellow with a dark mark, so a
            // failure never wears the orange of the brand and of the button
            // that moves on.
            Image(systemName: "exclamationmark.triangle.fill")
                .symbolRenderingMode(.multicolor)
        }
    }
}
