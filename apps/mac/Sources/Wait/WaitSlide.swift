import Foundation

/// One slide of the cost story the job screen plays while iPhone is
/// supervised: a drawing, and the sentence under it.
///
/// The slides are the site's, in the site's order: the story first (the
/// weeks, the weekends, the Earth, the Moon), then the thumb, then the deck of
/// what the same hours would have bought, in the deck's own order. The words
/// are the app's own. Whoever is watching has already done something about it,
/// so the sentences say what they are taking back rather than what they could
/// have had, and most of them finish the line that heads every slide. Every
/// number comes from `WaitMath`.
///
/// Nothing here draws anything: a slide names its drawing and the numbers it
/// is drawn to, and the slideshow turns that into a view. That is why the
/// order and the words are something the tests can read.
struct WaitSlide: Equatable {
    /// What the slide draws, with the numbers it is drawn to.
    enum Drawing: Equatable {
        case weeks(filled: Int, total: Int)
        case weekends(Int)
        case earth(laps: Int)
        case moon(share: Double)
        case finger(meters: Int)
        case books(Int)
        case trips(Int)
        case marathons(Int)
        case novels(Int)
        case languages(Int)
        case instruments(Int)
        case degrees(Int)
        case skills(Int, labels: [String], hoursLabel: String)
    }

    /// The sentence in three pieces: the stretch the accent picks out, and the
    /// words either side of it.
    let before: String
    let figure: String
    let after: String
    let drawing: Drawing
    /// Whether the sentence finishes `header`, which shows above it only then.
    var followsHeader = true

    var sentence: String { before + figure + after }

    /// The line above the sentence, which the sentences finish.
    static let header = "Over the next \(WaitMath.horizonYears) years, you're taking back"

    /// The whole story, in the order it plays.
    static let story: [WaitSlide] = {
        let day = WaitMath.averageHours
        return [
            WaitSlide(
                before: "",
                figure: "\(WaitMath.formatYears(day)) years",
                after: " awake",
                drawing: .weeks(filled: WaitMath.screenWeeks(day), total: WaitMath.horizonWeeks)
            ),
            WaitSlide(
                before: "",
                figure: "A whole weekend",
                after: ", every week",
                drawing: .weekends(WaitMath.horizonWeeks)
            ),
            WaitSlide(
                before: "Enough to walk around the Earth ",
                figure: "\(count(WaitMath.earthLaps(day))) times",
                after: "",
                drawing: .earth(laps: WaitMath.earthLaps(day))
            ),
            moon(share: WaitMath.moonShare(day)),
            // The one sentence that does not finish the header, so the header
            // gives way to it.
            WaitSlide(
                before: "Your finger gets a break from ",
                figure: "\(count(WaitMath.scrollMeters)) meters",
                after: " a day",
                drawing: .finger(meters: WaitMath.scrollMeters),
                followsHeader: false
            ),
            deck("Time to read ", WaitMath.books(day), "books", Drawing.books),
            // The site keeps "week-long" and "world-class" on one line with a
            // hyphen that does not break, and so does the app.
            deck("Time for ", WaitMath.trips(day), "week\u{2011}long trips", Drawing.trips),
            deck("Time to run ", WaitMath.marathons(day), "marathons", Drawing.marathons),
            deck("Time to write ", WaitMath.novels(day), "novels", Drawing.novels),
            deck("Time to learn ", WaitMath.languages(day), "languages", Drawing.languages),
            deck("Time to learn ", WaitMath.instruments(day), "instruments", Drawing.instruments),
            deck("Time to earn ", WaitMath.degrees(day), "degrees", Drawing.degrees),
            deck("Time to become world\u{2011}class at ", WaitMath.skills(day), "skills") {
                .skills(
                    $0,
                    labels: ["Software design", "Drawing", "Photography", "Chess"],
                    hoursLabel: "\(count(Int(WaitMath.hoursPerSkill))) hours"
                )
            },
        ]
    }()

    /// The Moon slide. More than halfway is the sentence for the day the
    /// story is priced at; a share short of half says how far it gets.
    static func moon(share: Double) -> WaitSlide {
        guard share < 0.5 else {
            return WaitSlide(
                before: "More than ",
                figure: "halfway",
                after: " to the Moon on foot",
                drawing: .moon(share: share)
            )
        }
        return WaitSlide(
            before: "",
            figure: "\(Int((share * 100).rounded()))%",
            after: " of the way to the Moon on foot",
            drawing: .moon(share: share)
        )
    }

    /// One answer from the deck: the count and what it counts in the accent,
    /// and the drawing it is drawn to.
    private static func deck(
        _ before: String,
        _ amount: Int,
        _ noun: String,
        _ drawing: (Int) -> Drawing
    ) -> WaitSlide {
        WaitSlide(before: before, figure: "\(count(amount)) \(noun)", after: "", drawing: drawing(amount))
    }

    /// A count the way the English sentence writes it, with the thousands
    /// grouped by a comma whatever this Mac's own region is.
    static func count(_ amount: Int) -> String {
        amount.formatted(.number.locale(Locale(identifier: "en_US")))
    }
}

/// Which slide is on screen, and how far into it, for any moment of the
/// slideshow, and when it next has to be drawn.
///
/// Each slide stands for a beat while its sentence lands, its drawing, and
/// then a hold on the finished picture, and the next one fades in over the
/// first moments of its own time while the last fades out on its end. After
/// the last slide the story starts again.
/// It is a function of the time the slideshow has played and nothing else, so
/// a slideshow that was paused picks up exactly where it stood.
struct WaitSchedule: Equatable {
    /// How long a drawing waits for its sentence to land before it starts,
    /// `drawing.delay` on the site.
    static let drawingDelay: TimeInterval = 0.54
    /// How long a slide stands on its finished drawing before the next.
    static let hold: TimeInterval = 6
    /// How long one slide takes to fade into the next.
    static let fade: TimeInterval = 0.6
    /// How long each slide stands with Reduce Motion on, where every drawing
    /// is shown finished.
    static let stillLength: TimeInterval = 10
    /// How often a slide is drawn while something on it moves.
    static let frame: TimeInterval = 1.0 / 30
    /// How far past the end of a slide or of a fade the slideshow steps when
    /// it is drawn next or paused there, so rounding never leaves it a hair
    /// short of the end.
    private static let nudge: TimeInterval = 0.001

    /// Where the slideshow is at one moment.
    struct Moment: Equatable {
        /// The slide on screen, by its place in the story.
        let index: Int
        /// How long it has been on.
        let elapsed: TimeInterval
        /// How far it has faded in, from zero to one.
        let opacity: Double
        /// The slide it is taking over from while that one fades out, or nil
        /// once the fade is over and on the very first slide.
        let previous: Int?
        /// How long the outgoing slide has been on, which is past its end.
        let previousElapsed: TimeInterval

        /// How much of something only some slides show is on screen: all of
        /// it on a slide that shows it, none on one that does not, and as far
        /// as the fade has got while one gives way to the other. Between two
        /// slides that both show it, it stays put.
        func showing(_ shows: (Int) -> Bool) -> Double {
            let now: Double = shows(index) ? 1 : 0
            guard let previous else { return now }
            let before: Double = shows(previous) ? 1 : 0
            return before + (now - before) * opacity
        }
    }

    /// How long each slide stands, in the order they play.
    let lengths: [TimeInterval]
    /// How long the end of every slide stands still: its fade is over and its
    /// drawing finished, so nothing on screen moves until the next comes on.
    var rest: TimeInterval = 0

    /// The slideshow as it plays: the beat for the sentence, each drawing's
    /// own length, then the hold. Nothing moves on the hold once a fade's time
    /// has passed, which is time enough for a drawing that runs a moment past
    /// its own length.
    static func playing(_ drawings: [TimeInterval]) -> WaitSchedule {
        WaitSchedule(lengths: drawings.map { drawingDelay + $0 + hold }, rest: hold - fade)
    }

    /// The time a drawing is drawn at, `elapsed` into its slide.
    static func drawn(_ elapsed: TimeInterval) -> TimeInterval {
        max(0, elapsed - drawingDelay)
    }

    /// The slideshow with Reduce Motion on: the same slides, the same time
    /// for each. Nothing on a slide moves, and the fade from one to the next
    /// plays without being drawn frame by frame, so every slide stands still
    /// all through.
    static func still(count: Int) -> WaitSchedule {
        WaitSchedule(lengths: Array(repeating: stillLength, count: count), rest: stillLength)
    }

    /// One time through the whole story.
    var cycle: TimeInterval { lengths.reduce(0, +) }

    func moment(at played: TimeInterval) -> Moment {
        let played = max(0, played)
        let cycle = self.cycle
        guard cycle > 0 else {
            return Moment(index: 0, elapsed: played, opacity: 1, previous: nil, previousElapsed: 0)
        }
        let (index, into) = slide(at: played)
        // The first slide of the first time through has nothing to take over
        // from: the slideshow itself fades in around it.
        let first = index == 0 && played < cycle
        guard into < Self.fade, !first else {
            return Moment(index: index, elapsed: into, opacity: 1, previous: nil, previousElapsed: 0)
        }
        let previous = (index + lengths.count - 1) % lengths.count
        return Moment(
            index: index,
            elapsed: into,
            opacity: into / Self.fade,
            previous: previous,
            previousElapsed: lengths[previous] + into
        )
    }

    /// The next moment after `played` the slideshow has to be drawn at: a
    /// frame on while something on the slide moves, and once nothing does,
    /// the moment the next slide comes on.
    func nextFrame(after played: TimeInterval) -> TimeInterval {
        let played = max(0, played)
        guard cycle > 0 else { return played + Self.frame }
        let (index, into) = slide(at: played)
        let moving = lengths[index] - rest
        let ahead = into < moving ? min(Self.frame, moving - into) : lengths[index] - into
        return played + max(Self.nudge, ahead)
    }

    /// Where a pause at `played` holds the slideshow: right there, or at the
    /// end of the fade it falls in, so it never waits on two slides each half
    /// faded into the other.
    func settled(_ played: TimeInterval) -> TimeInterval {
        let played = max(0, played)
        let moment = moment(at: played)
        guard moment.previous != nil else { return played }
        return played - moment.elapsed + Self.fade + Self.nudge
    }

    /// The slide on at `played`, and how long it has been on.
    private func slide(at played: TimeInterval) -> (index: Int, into: TimeInterval) {
        var into = played.truncatingRemainder(dividingBy: cycle)
        var index = 0
        while index < lengths.count - 1, into >= lengths[index] {
            into -= lengths[index]
            index += 1
        }
        return (index, into)
    }
}

/// The time the slideshow has played, which stands still while nobody can
/// see it and carries on from there when somebody can again.
struct WaitClock: Equatable {
    /// The time played before the last pause.
    private(set) var banked: TimeInterval = 0
    /// When it last started running, or nil while it is paused.
    private(set) var since: Date?

    var isRunning: Bool { since != nil }

    /// Whether the slideshow plays: only while somebody can see it, which is
    /// while the app is the one in front, its window is the active scene,
    /// and some of that window is on screen, neither minimized nor wholly
    /// covered by others.
    static func runs(appActive: Bool, sceneActive: Bool, windowVisible: Bool) -> Bool {
        appActive && sceneActive && windowVisible
    }

    /// Runs the clock while the slideshow plays, and pauses it while it does
    /// not. A pause that falls inside a fade banks the end of the fade, so
    /// what stands on screen meanwhile is the one slide.
    mutating func follow(_ running: Bool, at now: Date, on schedule: WaitSchedule) {
        if running {
            run(at: now)
        } else if isRunning {
            pause(at: now)
            banked = schedule.settled(banked)
        }
    }

    func played(at now: Date) -> TimeInterval {
        guard let since else { return banked }
        return banked + max(0, now.timeIntervalSince(since))
    }

    mutating func run(at now: Date) {
        guard since == nil else { return }
        since = now
    }

    mutating func pause(at now: Date) {
        guard since != nil else { return }
        banked = played(at: now)
        since = nil
    }
}
