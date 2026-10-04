import SwiftUI

/// The screen that holds the whole job: copying the iPhone onto this Mac,
/// writing the flag into the copy, sending it back, and waiting for the iPhone
/// to say what it is now.
///
/// One bar and one line. While the job runs there is nothing to decide and
/// nothing to do but wait, so the screen says which piece is running and,
/// under it, plays the cost story quietly for as long as the wait lasts. The
/// three ends the job can come to take the bar away and put a heading, a
/// sentence and two buttons in its place.
struct JobStep: View {
    @ObservedObject var model: WizardModel

    /// How long a job runs before the cost story comes in, so a job that is
    /// over in a moment never flashes it.
    private static let storyDelay = Duration.seconds(5)
    private static let storyFade: TimeInterval = 0.8
    /// How long the cost story takes to fade out at the end of the job, which
    /// is how long the end waits before it comes on.
    private static let storyExit: TimeInterval = 0.3

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The phase the cost story is playing under. Nil until the job has run
    /// long enough for the story to show, and again once it has gone.
    @State private var storyPhase: JobPhase?
    /// True while the cost story fades out at the end of the job.
    @State private var storyLeaving = false
    /// How far the cost story has played. It is kept here rather than in the
    /// slideshow and started again only when a job starts, a Try Again
    /// included, so the story runs on through every phase of the job in the
    /// one order it is told. Leaving the job screen takes it away with the
    /// screen.
    @State private var storyClock = WaitClock()

    var body: some View {
        StepLayout(title: title) {
            content
        } actions: {
            actions
        }
        // `storyPlays` holds from the start of the job until the story has
        // left at its end, so this runs once for each job and never on a
        // change of phase.
        .task(id: storyPlays) {
            storyPhase = nil
            guard storyPlays else { return }
            storyClock = WaitClock()
            try? await Task.sleep(for: Self.storyDelay)
            guard !Task.isCancelled else { return }
            storyPhase = model.jobPhase
        }
        .onChange(of: model.jobPhase) { _, job in
            guard storyPhase != nil, !storyLeaving else { return }
            if job?.playsStory == true {
                storyPhase = job
            } else {
                leaveStory()
            }
        }
    }

    /// What the screen draws, `JobPhase.onScreen`.
    private var phase: JobPhase? {
        JobPhase.onScreen(model.jobPhase, story: storyPhase)
    }

    /// `JobPhase.playsStory` of the phase on screen.
    private var storyPlays: Bool {
        phase?.playsStory ?? false
    }

    /// Fade the cost story out, and only then put the end the job came to on
    /// screen. With Reduce Motion on, the end takes its place at once.
    private func leaveStory() {
        guard !reduceMotion else {
            storyPhase = nil
            return
        }
        withAnimation(.easeOut(duration: Self.storyExit)) {
            storyLeaving = true
        } completion: {
            storyPhase = nil
            storyLeaving = false
        }
    }

    /// A phase that came to an end carries a heading of its own. Everything
    /// else runs under the screen's.
    private var title: String {
        phase?.headline
            ?? WizardStep.job.title
    }

    @ViewBuilder
    private var content: some View {
        if let phase {
            VStack(alignment: .leading, spacing: 12) {
                if phase.isRunning {
                    bar(phase)
                    line(phase)
                }
                if let sentence = phase.body {
                    // The confirm-supervision screen carries the picture of the
                    // top of Settings inline below, so its sentence needs no
                    // "i". Every other ended phase keeps its note behind one.
                    if case .checkOnIPhone = phase {
                        body(sentence, note: nil)
                    } else {
                        body(sentence, note: phase.note)
                    }
                }
                if case .checkOnIPhone = phase {
                    reference
                }
                // The one failure somebody answers by typing. The field is the
                // same row the checks show, so the password is corrected where
                // it is refused.
                if case .failed(let failure) = phase, failure.needsPassword {
                    BackupPasswordField(model: model)
                }
                // It fades out in place and keeps its room while it does, so
                // nothing moves over it, and is taken away with the phase.
                if storyPhase != nil {
                    WaitSlideshow(clock: $storyClock)
                        .padding(.top, 12)
                        .opacity(storyLeaving ? 0 : 1)
                        .transition(.asymmetric(
                            insertion: .opacity.animation(.easeInOut(duration: Self.storyFade)),
                            removal: .identity
                        ))
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
        guard let text = phase.line else { return nil }
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
    private func body(_ text: String, note: String?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(text)
                .fixedSize(horizontal: false, vertical: true)
            if let note {
                InfoButton(text: note)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The picture of the top of Settings, shown inline on the confirm screen so
    /// somebody can hold it beside the phone in their hand. It loads the same
    /// bundled screenshot the "i" popovers use, at the width they show it, and
    /// where nobody has dropped one in the bundle it shows nothing at all.
    @ViewBuilder
    private var reference: some View {
        if let url = InfoImage.url(named: InfoImage.checking),
           let picture = NSImage(contentsOf: url) {
            Image(nsImage: picture)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 280)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    @ViewBuilder
    private var actions: some View {
        if let phase {
            if phase.isRunning {
                cancel
            } else if case .checkOnIPhone = phase {
                tryAgain(from: .restore)
                PrimaryButton(title: "It's Supervised") {
                    model.advance()
                }
            } else if case .failed(let failure) = phase {
                cancel
                PrimaryButton(title: "Try Again") {
                    model.retryJob(from: failure.retry)
                }
            } else if case .phoneGone = phase {
                cancel
            }
        }
    }

    private var cancel: some View {
        Button("Cancel") {
            model.cancelJob()
        }
    }

    private func tryAgain(from piece: JobFailure.Retry) -> some View {
        Button("Try Again") {
            model.retryJob(from: piece)
        }
    }
}
