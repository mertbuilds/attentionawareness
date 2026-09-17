import SwiftUI

/// The progress of the helper, the same on the backup step and on the restore
/// step: a bar, the percentage, what has moved, how long it has taken, and the
/// helper's own lines folded away underneath.
struct TransferProgress: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ProgressView(value: model.engine.progress)
                .tint(WizardStyle.accent)

            HStack(alignment: .firstTextBaseline) {
                Text(percent)
                    .font(.title3)
                    .monospacedDigit()
                Spacer(minLength: 12)
                elapsed
            }

            HStack(alignment: .firstTextBaseline) {
                if let files {
                    Text(files)
                }
                Spacer(minLength: 12)
                if let bytes {
                    Text(bytes)
                        .monospacedDigit()
                }
            }
            .font(.callout)
            .foregroundStyle(.secondary)

            TransferLog(lines: model.engine.log)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var percent: String {
        "\(Int((model.engine.progress * 100).rounded()))%"
    }

    @ViewBuilder
    private var elapsed: some View {
        if let start = model.transferStartedAt {
            TimelineView(.periodic(from: start, by: 1)) { context in
                Text(WizardStyle.elapsed(context.date.timeIntervalSince(start)))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }

    private var files: String? {
        guard case .transferring(_, let done, _, _) = model.engine.phase, let done else { return nil }
        return done == 1 ? "1 file" : "\(done) files"
    }

    private var bytes: String? {
        guard case .transferring(_, _, _, let bytes) = model.engine.phase else { return nil }
        return bytes
    }
}

/// The last lines the helper printed, folded away. They are here for the day
/// something goes wrong in a way the sentences do not cover.
struct TransferLog: View {
    let lines: [String]
    @State private var expanded = false

    /// How many lines the box shows. The engine keeps more than this.
    private static let visible = 40

    var body: some View {
        if !lines.isEmpty {
            disclosure
        }
    }

    private var disclosure: some View {
        DisclosureGroup(isExpanded: $expanded) {
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(lines.suffix(Self.visible).enumerated()), id: \.offset) { line in
                        Text(line.element)
                            .font(.caption)
                            .monospaced()
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(8)
            }
            .frame(height: 120)
            .background(
                Color(nsColor: .textBackgroundColor),
                in: RoundedRectangle(cornerRadius: WizardStyle.cardRadius)
            )
        } label: {
            Text("Details")
                .font(.callout)
        }
    }
}
