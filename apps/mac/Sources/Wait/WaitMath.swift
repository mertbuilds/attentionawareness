import Foundation

/// The site's attention math, number for number.
///
/// The cost story the job screen plays while iPhone is supervised is the one
/// the site tells, so its figures come from the same rules: a day on the
/// screen as a share of the sixteen hours awake, carried twenty years ahead,
/// and counted in what those hours would have bought instead. Every figure is
/// worked out here from the constants rather than written down, so a rule
/// that changes on the site changes in one place here too.
///
/// Nothing here draws anything, which is why it is the part of the cost story
/// the tests can run.
enum WaitMath {
    /// The day the story is priced at. The typical internet user is online 6
    /// hours 40 minutes a day (DataReportal, Digital 2024); the site counts
    /// only the whole hours, so every figure here is on the low side.
    static let averageHours: Double = 6
    /// Hours in a day a person is awake. The other eight are sleep.
    static let wakingHours: Double = 16
    /// How far ahead the story projects a daily habit.
    static let horizonYears = 20
    private static let daysPerYear: Double = 365
    /// The screen hours are an estimate, so they are shown to the nearest
    /// hundred.
    private static let hoursRounding: Double = 100

    /// How long one book takes to read: 90,000 words at 238 a minute, with the
    /// pauses.
    static let hoursPerBook: Double = 8
    /// A week away: 16 waking hours, seven days.
    static let hoursPerTravelWeek: Double = 112
    /// A marathon, with the 16-week training block before it.
    static let hoursPerMarathon: Double = 200
    /// A novel's first draft.
    static let hoursPerNovel: Double = 500
    /// Hours to speak a language well (US Foreign Service Institute, category
    /// III).
    static let hoursPerLanguage: Double = 1500
    /// Hours to play an instrument well.
    static let hoursPerInstrument: Double = 2000
    /// Hours of a four-year degree: 1,200 a year.
    static let hoursPerDegree: Double = 4800
    /// The folk figure for mastery.
    static let hoursPerSkill: Double = 10_000
    /// Once around the Earth on foot: 40,075 km at 5 km/h.
    static let hoursPerEarthWalk: Double = 8000

    /// Weeks in a year, so weekends in a year too.
    private static let weeksPerYear = 52
    /// The weeks inside the horizon, and as many weekends.
    static let horizonWeeks = horizonYears * weeksPerYear
    private static let daysPerWeek: Double = 7
    private static let weekendDays = 2
    /// The screen hours of one week, at the day the story is priced at.
    static let weekHours = averageHours * daysPerWeek
    /// Every waking hour of one weekend. The story says a week on the screen
    /// takes a whole weekend.
    static let weekendWakingHours = Double(weekendDays) * wakingHours

    /// The walk to the Moon: its mean distance, at the pace the Earth walk is
    /// counted at.
    static let moonKilometers: Double = 384_400
    static let walkingSpeed: Double = 5
    private static let hoursToMoon = moonKilometers / walkingSpeed

    /// How far a thumb scrolls a day: 300 feet of mobile content, the height of
    /// the Statue of Liberty, as Facebook's global creative director put it in
    /// 2017 (The Drum). It is not scaled to the day above.
    static let scrollMeters = 90

    /// The waking years a daily screen habit costs over the horizon. The
    /// calendar cancels out: a day spent `hoursPerDay` of the 16 awake on a
    /// screen is that same fraction of every year in it.
    static func screenYears(_ hoursPerDay: Double) -> Double {
        hoursPerDay * Double(horizonYears) / wakingHours
    }

    /// Those years as the story prints them: one decimal, and never a bare
    /// `.0`.
    static func formatYears(_ hoursPerDay: Double) -> String {
        let text = String(format: "%.1f", screenYears(hoursPerDay))
        return text.hasSuffix(".0") ? String(text.dropLast(2)) : text
    }

    /// The same span counted in waking hours, rounded to the nearest hundred.
    static func screenHours(_ hoursPerDay: Double) -> Double {
        let exact = screenYears(hoursPerDay) * daysPerYear * wakingHours
        return (exact / hoursRounding).rounded() * hoursRounding
    }

    /// The weeks of the horizon the screen years fill, whole: the orange
    /// squares in the grid of weeks.
    static func screenWeeks(_ hoursPerDay: Double) -> Int {
        Int((screenYears(hoursPerDay) / Double(horizonYears) * Double(horizonWeeks)).rounded())
    }

    /// How far toward the Moon the screen hours would walk, as a share of the
    /// way.
    static func moonShare(_ hoursPerDay: Double) -> Double {
        screenHours(hoursPerDay) / hoursToMoon
    }

    /// What the same hours would have bought. Every one is whole: nobody
    /// pictures half a degree. Books are rounded and the rest are counted
    /// down, the way the site counts them.
    static func books(_ hoursPerDay: Double) -> Int {
        Int((screenHours(hoursPerDay) / hoursPerBook).rounded())
    }

    static func trips(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerTravelWeek) }
    static func marathons(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerMarathon) }
    static func novels(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerNovel) }
    static func languages(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerLanguage) }
    static func instruments(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerInstrument) }
    static func degrees(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerDegree) }
    static func skills(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerSkill) }
    static func earthLaps(_ hoursPerDay: Double) -> Int { whole(hoursPerDay, per: hoursPerEarthWalk) }

    private static func whole(_ hoursPerDay: Double, per hours: Double) -> Int {
        Int((screenHours(hoursPerDay) / hours).rounded(.down))
    }
}
