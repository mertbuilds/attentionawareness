import AppKit
import SwiftUI

/// The cost story, played under the bar while iPhone is supervised.
///
/// The job is a few minutes of nothing to do, so the screen spends
/// it on the reason for the job: the site's story of what a day on the screen
/// costs, one quiet slide at a time, round and round until the job is over.
/// The bar stays the loud thing on the screen; this is smaller and greyer.
///
/// It plays only while somebody can see it: while the app is the one in
/// front and some of its window is on screen, neither minimized nor covered
/// by other windows. The clock stops whenever that is not so, and starts again
/// where it stood. Nor is it drawn while nothing on it moves: a slide is drawn
/// frame by frame while it fades in and its drawing draws itself, and not
/// again until the next one comes on. With Reduce Motion on, every drawing is
/// shown finished and the slides change on a plain fade.
struct WaitSlideshow: View {
    /// The frame every drawing fills, 4:3.
    static let drawingSize = CGSize(width: 320, height: 240)

    private static let slides = WaitSlide.story
    private static let schedule = WaitSchedule.playing(slides.map { duration(of: $0.drawing) })
    private static let stillSchedule = WaitSchedule.still(count: slides.count)

    /// How far the story has played. The job screen holds it, so the story
    /// is not started over when anything above it changes.
    @Binding var clock: WaitClock

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var appActive = true
    @State private var windowVisible = true

    private var running: Bool {
        WaitClock.runs(appActive: appActive, sceneActive: scenePhase == .active, windowVisible: windowVisible)
    }

    private var currentSchedule: WaitSchedule {
        reduceMotion ? Self.stillSchedule : Self.schedule
    }

    var body: some View {
        TimelineView(Frames(schedule: currentSchedule, clock: clock)) { timeline in
            let played = clock.played(at: timeline.date)
            if reduceMotion {
                still(at: played)
            } else {
                moving(at: played)
            }
        }
        .frame(maxWidth: .infinity)
        .background(WindowVisibility { windowVisible = $0 })
        .onAppear {
            appActive = NSApplication.shared.isActive
        }
        .onChange(of: running, initial: true) { _, running in
            clock.follow(running, at: .now, on: currentSchedule)
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            appActive = true
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didResignActiveNotification)) { _ in
            appActive = false
        }
    }

    /// The slide on screen, drawn at its own time, with the one before it
    /// fading out on its finished drawing for the first moments. The header
    /// stands still between them, and fades only on the way to or from a
    /// sentence that does not finish it.
    private func moving(at played: TimeInterval) -> some View {
        let moment = Self.schedule.moment(at: played)
        let slide = Self.slides[moment.index]
        let previous = moment.previous.map { Self.slides[$0] }
        return WaitSlideView.layout(header: moment.showing { Self.slides[$0].followsHeader }) {
            ZStack {
                if let previous {
                    WaitSlideView.drawing(previous.drawing, at: WaitSchedule.drawn(moment.previousElapsed))
                        .opacity(1 - moment.opacity)
                }
                WaitSlideView.drawing(slide.drawing, at: WaitSchedule.drawn(moment.elapsed))
                    .opacity(moment.opacity)
            }
        } sentence: {
            ZStack {
                if let previous {
                    WaitSlideView.sentence(previous)
                        .opacity(1 - moment.opacity)
                        .accessibilityHidden(true)
                }
                WaitSlideView.sentence(slide)
                    .opacity(moment.opacity)
            }
        }
    }

    /// The slide on screen with its drawing finished, changing on a plain fade.
    private func still(at played: TimeInterval) -> some View {
        let index = Self.stillSchedule.moment(at: played).index
        let slide = Self.slides[index]
        return WaitSlideView.layout(header: slide.followsHeader ? 1 : 0) {
            ZStack {
                WaitSlideView.drawing(slide.drawing, at: Self.finished(slide.drawing))
                    .id(index)
                    .transition(.opacity)
            }
        } sentence: {
            ZStack {
                WaitSlideView.sentence(slide)
                    .id(index)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: WaitSchedule.fade), value: index)
    }

    /// The time a drawing stands finished from, where the slideshow holds it
    /// once it is drawn, and where Reduce Motion and the pictures `--ui-smoke`
    /// writes show it. A drawing may let its last fade run a moment past its
    /// own length, so this waits that moment out. The few that go on with a
    /// small loop of their own once they are done, a ripple, a caret, a
    /// tassel or a breath, are held at their own length instead, where that
    /// loop is at rest, so a hold is still. So is the thumb, which climbs on a
    /// loop of its own that the slideshow takes the place of.
    static func finished(_ drawing: WaitSlide.Drawing) -> TimeInterval {
        switch drawing {
        case .finger, .trips, .marathons, .novels, .instruments, .degrees:
            return duration(of: drawing)
        case .weeks, .weekends, .earth, .moon, .books, .languages, .skills:
            return duration(of: drawing) + settle
        }
    }

    private static let settle: TimeInterval = 0.3

    /// How long a drawing takes to draw itself, which is its own business.
    static func duration(of drawing: WaitSlide.Drawing) -> TimeInterval {
        switch drawing {
        case .weeks: return WeeksDrawing.duration
        case .weekends: return WeekendsDrawing.duration
        case .earth: return EarthDrawing.duration
        case .moon: return MoonDrawing.duration
        case .finger: return FingerDrawing.duration
        case .books: return BooksDrawing.duration
        case .trips: return TripsDrawing.duration
        case .marathons: return MarathonsDrawing.duration
        case .novels: return NovelsDrawing.duration
        case .languages: return LanguagesDrawing.duration
        case .instruments: return InstrumentsDrawing.duration
        case .degrees: return DegreesDrawing.duration
        case .skills: return SkillsDrawing.duration
        }
    }
}

/// One slide: its drawing at one moment, the header when the sentence finishes
/// it, and the sentence under it with the figure in the accent.
struct WaitSlideView: View {
    let slide: WaitSlide
    /// The time the drawing is drawn at.
    let elapsed: TimeInterval

    var body: some View {
        Self.layout(header: slide.followsHeader ? 1 : 0) {
            Self.drawing(slide.drawing, at: elapsed)
        } sentence: {
            Self.sentence(slide)
        }
    }

    /// The drawing, the header, and the sentence, one under the other. While
    /// one slide fades into the next, the slideshow puts both drawings in the
    /// one place and both sentences in the other, so the header, laid out once
    /// between them, stands still. `header` is how much of it shows, and its
    /// line keeps its place when none of it does.
    static func layout(
        header: Double,
        @ViewBuilder drawing: () -> some View,
        @ViewBuilder sentence: () -> some View
    ) -> some View {
        VStack(spacing: 10) {
            drawing()
                .frame(width: WaitSlideshow.drawingSize.width, height: WaitSlideshow.drawingSize.height)
                .accessibilityHidden(true)
            VStack(spacing: 2) {
                Text(WaitSlide.header)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .opacity(header)
                    .accessibilityHidden(header == 0)
                sentence()
            }
        }
        // The paper in a few of the drawings is filled with the background
        // style, which is the window's.
        .backgroundStyle(Color(nsColor: .windowBackgroundColor))
    }

    /// The sentence, with the figure in the accent.
    static func sentence(_ slide: WaitSlide) -> some View {
        Text("\(slide.before)\(Text(slide.figure).foregroundStyle(WizardStyle.accent))\(slide.after)")
            .font(.callout)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .lineLimit(2, reservesSpace: true)
            .accessibilityLabel(slide.sentence)
    }

    /// The drawing at `elapsed`, held at the time it stands finished from, so
    /// a finished drawing is the same view from one moment to the next.
    @ViewBuilder
    static func drawing(_ drawing: WaitSlide.Drawing, at elapsed: TimeInterval) -> some View {
        let elapsed = min(elapsed, WaitSlideshow.finished(drawing))
        switch drawing {
        case .weeks(let filled, let total):
            WeeksDrawing(elapsed: elapsed, filledWeeks: filled, totalWeeks: total)
        case .weekends(let weekends):
            WeekendsDrawing(elapsed: elapsed, weekends: weekends)
        case .earth(let laps):
            EarthDrawing(elapsed: elapsed, laps: laps)
        case .moon(let share):
            MoonDrawing(elapsed: elapsed, share: share)
        case .finger(let meters):
            FingerDrawing(elapsed: elapsed, meters: Double(meters))
        case .books(let amount):
            BooksDrawing(elapsed: elapsed, amount: amount)
        case .trips(let amount):
            TripsDrawing(elapsed: elapsed, amount: amount)
        case .marathons(let amount):
            MarathonsDrawing(elapsed: elapsed, amount: amount)
        case .novels(let amount):
            NovelsDrawing(elapsed: elapsed, amount: amount)
        case .languages(let amount):
            LanguagesDrawing(elapsed: elapsed, amount: amount)
        case .instruments(let amount):
            InstrumentsDrawing(elapsed: elapsed, amount: amount)
        case .degrees(let amount):
            DegreesDrawing(elapsed: elapsed, amount: amount)
        case .skills(let amount, let labels, let hoursLabel):
            SkillsDrawing(elapsed: elapsed, amount: amount, labels: labels, hoursLabel: hoursLabel)
        }
    }
}

/// The moments the slideshow is drawn at: a frame at a time while something on
/// the slide moves, the moment the next slide comes on once nothing does, and
/// none at all while the clock is paused.
private struct Frames: TimelineSchedule {
    let schedule: WaitSchedule
    let clock: WaitClock

    func entries(from start: Date, mode: TimelineScheduleMode) -> UnfoldFirstSequence<Date> {
        sequence(first: start) { [schedule, clock] date in
            guard clock.isRunning else { return nil }
            let played = clock.played(at: date)
            return date.addingTimeInterval(schedule.nextFrame(after: played) - played)
        }
    }
}

/// Says whether the window the slideshow is in can be seen at all: on a
/// screen, not minimized, and not wholly covered by other windows. AppKit
/// tells a window when that changes, and this listens for its own window.
private struct WindowVisibility: NSViewRepresentable {
    let changed: (Bool) -> Void

    func makeNSView(context: Context) -> Watcher {
        Watcher(changed: changed)
    }

    func updateNSView(_ watcher: Watcher, context: Context) {
        watcher.changed = changed
    }

    final class Watcher: NSView {
        var changed: (Bool) -> Void

        init(changed: @escaping (Bool) -> Void) {
            self.changed = changed
            super.init(frame: .zero)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            let center = NotificationCenter.default
            let name = NSWindow.didChangeOcclusionStateNotification
            center.removeObserver(self, name: name, object: nil)
            guard let window else { return }
            center.addObserver(self, selector: #selector(occlusionChanged), name: name, object: window)
            // Told once on the way in, after the update that put it there.
            DispatchQueue.main.async { [weak self] in
                self?.report()
            }
        }

        @objc private func occlusionChanged(_ notification: Notification) {
            report()
        }

        private func report() {
            guard let window else { return }
            changed(window.occlusionState.contains(.visible))
        }
    }
}
