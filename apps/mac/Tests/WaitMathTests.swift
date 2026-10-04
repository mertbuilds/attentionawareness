import Foundation
import Testing

/// The figures of the cost story.
///
/// The job screen tells the site's story, so every number it shows has to be
/// the number the site shows for the same day: six hours on the screen,
/// sixteen awake, twenty years ahead. They are worked out from the rules here
/// and checked against what the site prints.
struct WaitMathTests {
    private let day = WaitMath.averageHours

    @Test func sixHoursADayIsSevenAndAHalfYearsAwake() {
        #expect(WaitMath.screenYears(day) == 7.5)
        #expect(WaitMath.formatYears(day) == "7.5")
        // A whole number of years is printed without a bare ".0".
        #expect(WaitMath.formatYears(8) == "10")
    }

    @Test func theScreenHoursAreRoundedToTheNearestHundred() {
        #expect(WaitMath.screenHours(day) == 43_800)
        #expect(WaitMath.screenHours(4) == 29_200)
        // 4 hours 5 minutes is 29,808.33 hours, which the site prints as 29,800.
        #expect(WaitMath.screenHours(4 + 5.0 / 60) == 29_800)
    }

    @Test func theGridOfWeeksFills390OfThe1040() {
        #expect(WaitMath.screenWeeks(day) == 390)
        #expect(WaitMath.horizonWeeks == 1040)
    }

    @Test func aWeekOnTheScreenTakesAWholeWeekend() {
        #expect(WaitMath.weekHours == 42)
        #expect(WaitMath.weekendWakingHours == 32)
        #expect(WaitMath.weekHours >= WaitMath.weekendWakingHours)
    }

    @Test func theHoursWalkAroundTheEarthFiveTimes() {
        #expect(WaitMath.earthLaps(day) == 5)
    }

    @Test func theHoursWalkMoreThanHalfwayToTheMoon() {
        let share = WaitMath.moonShare(day)
        #expect((share * 100).rounded() == 57)
        #expect(share > 0.5)
    }

    @Test func theDeckCountsWhatTheSameHoursWouldHaveBought() {
        #expect(WaitMath.books(day) == 5475)
        #expect(WaitMath.languages(day) == 29)
        #expect(WaitMath.marathons(day) == 219)
        #expect(WaitMath.trips(day) == 391)
        #expect(WaitMath.novels(day) == 87)
        #expect(WaitMath.instruments(day) == 21)
        #expect(WaitMath.degrees(day) == 9)
        #expect(WaitMath.skills(day) == 4)
    }

    @Test func theFingerScrollsNinetyMeters() {
        #expect(WaitMath.scrollMeters == 90)
    }
}
