import SwiftUI

/// The screen that holds the whole job: copying the iPhone onto this Mac,
/// writing the flag into the copy, sending it back, and waiting for the iPhone
/// to say what it is now.
///
/// One bar and one line. While the job runs there is nothing to decide and
/// nothing to do but wait, so the screen says which piece is running and
/// nothing else. The three ends the job can come to take the bar away and put
/// a heading, a sentence and two buttons in its place.
struct JobStep: View {
    @ObservedObject var model: WizardModel

    var body: some View {
        StepLayout(title: title) {
            content
        } actions: {
            actions
        }
    }

    /// A phase that came to an end carries a heading of its own. Everything
    /// else runs under the screen's.
    private var title: String {
        model.jobPhase?.headline(direction: model.direction)
            ?? WizardStep.job.title(for: model.direction)
    }

    @ViewBuilder
    private var content: some View {
        if let phase = model.jobPhase {
            VStack(alignment: .leading, spacing: 12) {
                if phase.isRunning {
                    bar(phase)
                    line(phase)
                }
                if let sentence = phase.body(direction: model.direction) {
                    body(
                        sentence,
                        note: phase.note(direction: model.direction),
                        video: phase.noteVideo(direction: model.direction)
                    )
                }
                // The one failure somebody answers by typing. The field is the
                // same row the checks show, so the password is corrected where
                // it is refused.
                if case .failed(let failure) = phase, failure.needsPassword {
                    BackupPasswordField(model: model)
                }
            }
        }
    }

    /// One bar, the full width of the column. It says how far along it is only
    /// where this Mac can know: the two transfers. Everywhere else the work
    /// belongs to the iPhone or to the reboot.
    @ViewBuilder
    private func bar(_ phase: JobPhase) -> some View {
        if phase.isDeterminate {
            ProgressView(value: model.engine.progress)
                .tint(WizardStyle.accent)
        } else {
            ProgressView()
                .progressViewStyle(.linear)
                .tint(WizardStyle.accent)
        }
    }

    /// The phase, and how much longer the copying has where there is anything
    /// to say. Find My carries the how-to in its hover help, because it is the
    /// one phase somebody can do something about.
    @ViewBuilder
    private func line(_ phase: JobPhase) -> some View {
        if let text = phaseText(phase) {
            if phase == .waitingForFindMy {
                phaseLine(text).help(WizardGate.turnFindMyOff)
            } else {
                phaseLine(text)
            }
        }
    }

    private func phaseText(_ phase: JobPhase) -> String? {
        guard let text = phase.line(direction: model.direction) else { return nil }
        guard phase.showsEstimate, let estimate = model.estimateText else { return text }
        return "\(text) · \(estimate)"
    }

    private func phaseLine(_ text: String) -> some View {
        Text(text)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The sentence a phase that came to an end shows, with the "i" beside it
    /// wherever there is more behind it than the line.
    private func body(_ text: String, note: String?, video: String?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(text)
                .fixedSize(horizontal: false, vertical: true)
            if let note {
                InfoButton(text: note, video: video)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var actions: some View {
        if let phase = model.jobPhase {
            if phase.isRunning {
                cancel
            } else if case .checkOnIPhone = phase {
                PrimaryButton(title: "Continue") {
                    model.advance()
                }
                tryAgain(from: .restore)
            } else if case .failed(let failure) = phase {
                PrimaryButton(title: "Try Again") {
                    model.retryJob(from: failure.retry)
                }
                cancel
            } else if case .phoneGone = phase {
                cancel
            }
        }
    }

    private var cancel: some View {
        Button("Cancel") {
            model.cancelJob()
        }
        .controlSize(.large)
    }

    private func tryAgain(from piece: JobFailure.Retry) -> some View {
        Button("Try Again") {
            model.retryJob(from: piece)
        }
        .controlSize(.large)
    }
}
