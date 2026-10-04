import Foundation
import Testing

/// The body of the last screen, in each of the things it can say.
///
/// That screen opens with two plain lines, and the first of them is worked out
/// from the profile the person built. So the counts are worth a table of their
/// own: the two clauses together, one on its own, and the reassurance a
/// stripped-down profile falls back to. None of it reads an iPhone or builds a
/// view.
struct DoneCopyTests {
    // MARK: - The blocked summary

    @Test func aProfileThatHidesAppsAndBlocksSitesCountsBoth() {
        #expect(
            DoneCopy.lines(apps: 8, sites: 24)
                == ["You blocked 8 apps and 24 websites.", "You can disconnect iPhone."]
        )
    }

    @Test func oneOfEachReadsInTheSingular() {
        #expect(
            DoneCopy.lines(apps: 1, sites: 1)
                == ["You blocked 1 app and 1 website.", "You can disconnect iPhone."]
        )
    }

    @Test func noSitesDropsTheWebsiteClause() {
        #expect(
            DoneCopy.lines(apps: 6, sites: 0)
                == ["You blocked 6 apps.", "You can disconnect iPhone."]
        )
    }

    @Test func noAppsSaysOnlyTheWebsites() {
        #expect(
            DoneCopy.lines(apps: 0, sites: 5)
                == ["You blocked 5 websites.", "You can disconnect iPhone."]
        )
    }

    @Test func aStrippedProfileFallsBackToAPlainReassurance() {
        #expect(
            DoneCopy.lines(apps: 0, sites: 0)
                == ["Your restrictions are on.", "You can disconnect iPhone."]
        )
    }

    // MARK: - The closing line

    @Test func theBodyEndsOnTheOneLineTheRunIsFor() {
        #expect(DoneCopy.closing == "Your future self will thank you.")
    }

    // MARK: - The note behind the popover

    @Test func theNoteSaysWhereToLookForWhatTheRunSetUp() {
        #expect(
            DoneCopy.note == "Settings shows 'This iPhone is supervised' at the top."
        )
    }
}
