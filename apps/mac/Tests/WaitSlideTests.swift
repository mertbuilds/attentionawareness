import Foundation
import Testing

/// The cost story's slides, and the clock they play to.
///
/// What the slideshow draws is the drawings' business. What is tested here is
/// everything around them: the order the story is told in, the words of each
/// sentence and the stretch the accent picks out, the header the sentences
/// finish and the one slide it gives way on, which slide is on at any moment,
/// how one fades into the next, that the story starts again after the last
/// slide, when a slide has to be drawn and when it stands still, when the
/// slideshow plays at all, and that a paused clock picks up where it stood.
struct WaitSlideTests {
    // MARK: - The story

    @Test func theStoryStartsWithTheWeeksAndEndsOnTheDeck() {
        let drawings = WaitSlide.story.map(\.drawing)

        #expect(drawings == [
            .weeks(filled: 390, total: 1040),
            .weekends(1040),
            .earth(laps: 5),
            .moon(share: WaitMath.moonShare(WaitMath.averageHours)),
            .finger(meters: 90),
            .books(5475),
            .trips(391),
            .marathons(219),
            .novels(87),
            .languages(29),
            .instruments(21),
            .degrees(9),
            .skills(
                4,
                labels: ["Software design", "Drawing", "Photography", "Chess"],
                hoursLabel: "10,000 hours"
            ),
        ])
    }

    @Test func everySentenceSaysWhatIsTakenBack() {
        let sentences = WaitSlide.story.map(\.sentence)

        #expect(sentences == [
            "7.5 years awake",
            "A whole weekend, every week",
            "Enough to walk around the Earth 5 times",
            "More than halfway to the Moon on foot",
            "Your finger gets a break from 90 meters a day",
            "Time to read 5,475 books",
            "Time for 391 week\u{2011}long trips",
            "Time to run 219 marathons",
            "Time to write 87 novels",
            "Time to learn 29 languages",
            "Time to learn 21 instruments",
            "Time to earn 9 degrees",
            "Time to become world\u{2011}class at 4 skills",
        ])
    }

    @Test func theAccentPicksOutTheKeyNumberOfEachSentence() {
        let figures = WaitSlide.story.map(\.figure)

        #expect(figures == [
            "7.5 years", "A whole weekend", "5 times", "halfway", "90 meters",
            "5,475 books", "391 week\u{2011}long trips", "219 marathons", "87 novels",
            "29 languages", "21 instruments", "9 degrees", "4 skills",
        ])
    }

    @Test func aShareShortOfHalfwaySaysHowFarItGets() {
        #expect(WaitSlide.moon(share: 0.38).sentence == "38% of the way to the Moon on foot")
        #expect(WaitSlide.moon(share: 0.38).figure == "38%")
        #expect(WaitSlide.moon(share: 0.38).followsHeader)
    }

    // MARK: - Which slide is on

    /// Three slides of ten, twelve and eight seconds.
    private let schedule = WaitSchedule(lengths: [10, 12, 8])

    @Test func eachSlideStandsForItsSentenceItsDrawingAndThenTheHold() {
        let playing = WaitSchedule.playing([4, 3.8])

        #expect(playing.lengths == [0.54 + 4 + 6, 0.54 + 3.8 + 6])
    }

    @Test func aDrawingStartsOnceItsSentenceHasLanded() {
        #expect(WaitSchedule.drawn(0) == 0)
        #expect(WaitSchedule.drawn(0.5) == 0)
        #expect(abs(WaitSchedule.drawn(1.54) - 1) < 0.0001)
    }

    @Test func theSlidesPlayInOrderForTheirOwnLength() {
        #expect(schedule.moment(at: 0).index == 0)
        #expect(schedule.moment(at: 9.9).index == 0)
        #expect(schedule.moment(at: 10).index == 1)
        #expect(schedule.moment(at: 21.9).index == 1)
        #expect(schedule.moment(at: 22).index == 2)
        #expect(schedule.moment(at: 29.9).index == 2)
    }

    @Test func aSlideIsDrawnAtTheTimeSinceItCameOn() {
        let moment = schedule.moment(at: 13.5)

        #expect(moment.index == 1)
        #expect(abs(moment.elapsed - 3.5) < 0.0001)
    }

    @Test func theFirstSlideComesInWithNothingToFadeFrom() {
        let start = schedule.moment(at: 0.2)

        #expect(start.previous == nil)
        #expect(start.opacity == 1)
    }

    @Test func eachNextSlideFadesInWhileTheOneBeforeFadesOutOnItsEnd() {
        let landing = schedule.moment(at: 10)
        #expect(landing.previous == 0)
        #expect(landing.opacity == 0)
        #expect(landing.previousElapsed == 10)

        let halfway = schedule.moment(at: 10 + WaitSchedule.fade / 2)
        #expect(halfway.previous == 0)
        #expect(abs(halfway.opacity - 0.5) < 0.0001)
        #expect(abs(halfway.previousElapsed - (10 + WaitSchedule.fade / 2)) < 0.0001)

        let landed = schedule.moment(at: 10 + WaitSchedule.fade + 0.01)
        #expect(landed.previous == nil)
        #expect(landed.opacity == 1)
    }

    @Test func afterTheLastSlideTheStoryStartsAgain() {
        #expect(schedule.cycle == 30)

        let again = schedule.moment(at: 30)
        #expect(again.index == 0)
        #expect(again.elapsed == 0)
        // The second time round, the first slide takes over from the last.
        #expect(again.previous == 2)
        #expect(again.previousElapsed == 8)

        #expect(schedule.moment(at: 30 + 10.5).index == 1)
        #expect(schedule.moment(at: 3 * 30 + 23).index == 2)
    }

    @Test func reduceMotionGivesEverySlideTheSameTime() {
        let still = WaitSchedule.still(count: 3)

        #expect(still.lengths == [10, 10, 10])
        #expect(still.moment(at: 9.9).index == 0)
        #expect(still.moment(at: 10).index == 1)
        #expect(still.moment(at: 30).index == 0)
    }

    @Test func theWholeStoryLoopsThroughEverySlide() {
        let story = WaitSchedule.playing(Array(repeating: 3.46, count: WaitSlide.story.count))
        var seen: [Int] = []
        for second in stride(from: 0.0, to: story.cycle, by: 0.5) {
            let index = story.moment(at: second).index
            if seen.last != index {
                seen.append(index)
            }
        }

        #expect(seen == Array(WaitSlide.story.indices))
        #expect(story.moment(at: story.cycle).index == 0)
    }

    // MARK: - When it is drawn

    /// Two slides whose drawings take four seconds and three point eight, as
    /// they play.
    private let playing = WaitSchedule.playing([4, 3.8])
    /// When the first slide stops moving: its sentence's beat, its drawing
    /// and a fade's time after it.
    private let firstStill = 0.54 + 4 + 0.6
    private let secondComesOn = 0.54 + 4 + 6

    @Test func aSlideIsDrawnFrameByFrameWhileSomethingOnItMoves() {
        #expect(abs(playing.nextFrame(after: 0) - WaitSchedule.frame) < 0.0001)
        #expect(abs(playing.nextFrame(after: 3) - (3 + WaitSchedule.frame)) < 0.0001)
    }

    @Test func theLastFrameLandsOnTheMomentNothingMovesAnyMore() {
        #expect(abs(playing.nextFrame(after: firstStill - 0.01) - firstStill) < 0.0001)
    }

    @Test func aStillSlideIsNotDrawnAgainUntilTheNextComesOn() {
        #expect(abs(playing.nextFrame(after: firstStill) - secondComesOn) < 0.0001)
        #expect(abs(playing.nextFrame(after: 8) - secondComesOn) < 0.0001)
        // The slide that comes on is drawn frame by frame again.
        #expect(abs(playing.nextFrame(after: secondComesOn) - (secondComesOn + WaitSchedule.frame)) < 0.0001)
    }

    @Test func afterTheLastSlideStandsStillTheFirstIsNextToComeOn() {
        let lastStill = playing.cycle - WaitSchedule.hold + WaitSchedule.fade

        #expect(abs(playing.nextFrame(after: lastStill + 1) - playing.cycle) < 0.0001)
    }

    @Test func withReduceMotionASlideIsDrawnOnlyAsItComesOn() {
        let still = WaitSchedule.still(count: 3)

        #expect(still.nextFrame(after: 0) == 10)
        #expect(still.nextFrame(after: 4) == 10)
        #expect(still.nextFrame(after: 10) == 20)
        #expect(still.nextFrame(after: 29) == 30)
    }

    @Test func theNextMomentToDrawIsAlwaysLater() {
        let moments = Array(stride(from: 0.0, to: 3 * playing.cycle, by: 0.01))
            + (1...3).map { Double($0) * playing.cycle }
            + (1...3).map { Double($0) * playing.cycle + playing.lengths[0] }
        let stuck = moments.filter { playing.nextFrame(after: $0) <= $0 }

        #expect(stuck.isEmpty)
    }

    // MARK: - The header

    @Test func theHeaderLooksAsFarAheadAsTheMath() {
        #expect(WaitSlide.header == "Over the next 20 years, you're taking back")
    }

    @Test func everySentenceButTheFingersFinishesTheHeader() {
        let follows = WaitSlide.story.map(\.followsHeader)

        #expect(follows == [true, true, true, true, false, true, true, true, true, true, true, true, true])
    }

    /// The middle slide of three is the one without the header.
    private func headed(_ index: Int) -> Bool { index != 1 }

    @Test func theHeaderStaysPutBetweenTwoSlidesThatBothFinishIt() {
        let wrapping = schedule.moment(at: 30 + WaitSchedule.fade / 2)

        #expect(wrapping.previous == 2)
        #expect(wrapping.showing(headed) == 1)
        #expect(schedule.moment(at: 5).showing(headed) == 1)
    }

    @Test func theHeaderFadesWithTheSlideThatDoesNotFinishIt() {
        #expect(schedule.moment(at: 10).showing(headed) == 1)
        #expect(abs(schedule.moment(at: 10 + WaitSchedule.fade / 2).showing(headed) - 0.5) < 0.0001)
        #expect(schedule.moment(at: 10 + WaitSchedule.fade + 0.01).showing(headed) == 0)
        #expect(schedule.moment(at: 15).showing(headed) == 0)

        #expect(schedule.moment(at: 22).showing(headed) == 0)
        #expect(abs(schedule.moment(at: 22 + WaitSchedule.fade / 4).showing(headed) - 0.25) < 0.0001)
        #expect(schedule.moment(at: 22 + WaitSchedule.fade + 0.01).showing(headed) == 1)
    }

    // MARK: - The clock

    private let start = Date(timeIntervalSinceReferenceDate: 1_000)

    @Test func theClockCountsOnlyWhileItRuns() {
        var clock = WaitClock()
        #expect(clock.played(at: start) == 0)

        clock.run(at: start)
        #expect(clock.played(at: start.addingTimeInterval(5)) == 5)

        clock.pause(at: start.addingTimeInterval(5))
        // Put away for a minute and a half, it stands where it was.
        #expect(clock.played(at: start.addingTimeInterval(95)) == 5)

        clock.run(at: start.addingTimeInterval(95))
        #expect(clock.played(at: start.addingTimeInterval(98)) == 8)
    }

    @Test func theSlideshowPlaysOnlyWhileSomebodyCanSeeIt() {
        #expect(WaitClock.runs(appActive: true, sceneActive: true, windowVisible: true))
        // Another app in front, the scene put away, the window minimized or
        // covered: any one of them stops it.
        #expect(WaitClock.runs(appActive: false, sceneActive: true, windowVisible: true) == false)
        #expect(WaitClock.runs(appActive: true, sceneActive: false, windowVisible: true) == false)
        #expect(WaitClock.runs(appActive: true, sceneActive: true, windowVisible: false) == false)
    }

    @Test func theClockRunsAndPausesWithTheSlideshow() {
        var clock = WaitClock()
        clock.follow(true, at: start, on: schedule)
        #expect(clock.isRunning)

        clock.follow(false, at: start.addingTimeInterval(5), on: schedule)
        #expect(clock.isRunning == false)
        #expect(abs(clock.played(at: start.addingTimeInterval(50)) - 5) < 0.0001)
    }

    @Test func aPauseInsideAFadeWaitsOnTheSlideComingIn() {
        var clock = WaitClock()
        clock.follow(true, at: start, on: schedule)
        // Put away a moment into the fade from the first slide to the second.
        clock.follow(false, at: start.addingTimeInterval(10.2), on: schedule)
        let held = clock.played(at: start.addingTimeInterval(60))

        #expect(abs(held - (10 + WaitSchedule.fade)) < 0.01)
        let moment = schedule.moment(at: held)
        #expect(moment.index == 1)
        #expect(moment.previous == nil)
        #expect(moment.opacity == 1)

        // Told again while it is already paused, it stays where it was.
        clock.follow(false, at: start.addingTimeInterval(70), on: schedule)
        #expect(clock.played(at: start.addingTimeInterval(80)) == held)
    }

    @Test func aPauseOutsideAFadeWaitsRightThere() {
        var clock = WaitClock()
        clock.follow(true, at: start, on: schedule)
        // The first slide of all has no fade to finish.
        clock.follow(false, at: start.addingTimeInterval(0.2), on: schedule)
        #expect(abs(clock.played(at: start.addingTimeInterval(9)) - 0.2) < 0.0001)

        clock.follow(true, at: start.addingTimeInterval(9), on: schedule)
        clock.follow(false, at: start.addingTimeInterval(14), on: schedule)
        #expect(abs(clock.played(at: start.addingTimeInterval(20)) - 5.2) < 0.0001)
    }

    @Test func runningOrPausingTwiceChangesNothing() {
        var clock = WaitClock()
        clock.run(at: start)
        clock.run(at: start.addingTimeInterval(3))
        #expect(clock.played(at: start.addingTimeInterval(4)) == 4)

        clock.pause(at: start.addingTimeInterval(4))
        clock.pause(at: start.addingTimeInterval(9))
        #expect(clock.played(at: start.addingTimeInterval(20)) == 4)
        #expect(clock.isRunning == false)
    }

    @Test func oneClockForTheWholeJobOnlyEverMovesOnToTheNextSlide() {
        // The job screen keeps one clock from the start of the job to its end,
        // so however often the window is put away and brought back, the slide
        // on screen only ever gives way to the one after it.
        var clock = WaitClock()
        var seen: [Int] = []
        for second in 0..<Int(3 * schedule.cycle) {
            let now = start.addingTimeInterval(TimeInterval(second))
            clock.follow(second % 7 != 6, at: now, on: schedule)
            let index = schedule.moment(at: clock.played(at: now)).index
            if seen.last != index {
                seen.append(index)
            }
        }

        #expect(seen.count > schedule.lengths.count)
        for (before, after) in zip(seen, seen.dropFirst()) {
            #expect(after == (before + 1) % schedule.lengths.count)
        }
    }
}
