import XCTest

/// The wizard's state machine. It is the part of the window that knows nothing
/// about iPhones, backups or SwiftUI, so it runs here without any of them.
final class WizardStepTests: XCTestCase {
    // MARK: - Which steps the run shows

    func testTheRunWalksFiveScreens() {
        XCTAssertEqual(
            WizardStep.steps,
            [.connect, .ready, .job, .restrictions, .done]
        )
    }

    func testProfilesIsAStandaloneDestinationOffTheRun() {
        // The Profiles screen is reached from Connect for a phone that is
        // supervised already, so it is not one of the run's steps and has no
        // next or previous of its own. Stepping back from it returns to
        // Connect, so it offers Back.
        XCTAssertEqual(WizardStep.profiles.title, "Manage Restrictions")
        XCTAssertFalse(WizardStep.steps.contains(.profiles))
        XCTAssertNil(WizardStep.profiles.next)
        XCTAssertNil(WizardStep.profiles.previous)
        XCTAssertTrue(WizardStep.profiles.allowsBack)
    }

    // MARK: - Moving

    func testEveryStepLeadsToTheNextOne() {
        XCTAssertEqual(WizardStep.connect.next, .ready)
        XCTAssertEqual(WizardStep.ready.next, .job)
        XCTAssertEqual(WizardStep.job.next, .restrictions)
        XCTAssertEqual(WizardStep.restrictions.next, .done)
    }

    func testTheRunEndsAtTheLastStepAndStartsAtTheFirst() {
        XCTAssertNil(WizardStep.done.next)
        XCTAssertNil(WizardStep.connect.previous)
    }

    func testGoingBackUndoesGoingForward() {
        for step in WizardStep.allCases {
            guard let next = step.next else { continue }
            XCTAssertEqual(next.previous, step)
        }
    }

    // MARK: - What the window shows

    func testEveryScreenIsTitled() {
        XCTAssertEqual(WizardStep.connect.title, "Connect iPhone to This Mac")
        XCTAssertEqual(WizardStep.ready.title, "Ready to Supervise")
        XCTAssertEqual(WizardStep.job.title, "Supervising iPhone")
        XCTAssertEqual(WizardStep.restrictions.title, "Choose Restrictions")
        XCTAssertEqual(WizardStep.done.title, "iPhone Is Supervised")
    }

    func testBackIsOfferedOnlyWhereNothingHasBeenSentToThePhone() {
        for step in [WizardStep.connect, .job, .done] {
            XCTAssertFalse(step.allowsBack, "\(step.rawValue) should offer no Back")
        }
        for step in [WizardStep.ready, .restrictions] {
            XCTAssertTrue(step.allowsBack, "\(step.rawValue) should offer Back")
        }
    }
}
