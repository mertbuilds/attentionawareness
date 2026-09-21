import XCTest

/// The wizard's state machine. It is the part of the window that knows nothing
/// about iPhones, backups or SwiftUI, so it runs here without any of them.
final class WizardStepTests: XCTestCase {
    // MARK: - Which steps a direction shows

    func testSupervisingWalksFiveScreens() {
        XCTAssertEqual(
            WizardStep.steps(for: .supervise),
            [.connect, .ready, .job, .restrictions, .done]
        )
    }

    func testUnsupervisingLeavesTheRestrictionsStepOut() {
        XCTAssertEqual(
            WizardStep.steps(for: .unsupervise),
            [.connect, .ready, .job, .done]
        )
        XCTAssertFalse(WizardStep.restrictions.belongs(to: .unsupervise))
    }

    // MARK: - Moving

    func testEveryStepLeadsToTheNextOne() {
        XCTAssertEqual(WizardStep.connect.next(in: .supervise), .ready)
        XCTAssertEqual(WizardStep.ready.next(in: .supervise), .job)
        XCTAssertEqual(WizardStep.job.next(in: .supervise), .restrictions)
        XCTAssertEqual(WizardStep.restrictions.next(in: .supervise), .done)
    }

    func testUnsupervisingGoesFromTheJobStraightToTheEnd() {
        XCTAssertEqual(WizardStep.job.next(in: .unsupervise), .done)
        XCTAssertEqual(WizardStep.done.previous(in: .unsupervise), .job)
    }

    func testTheRunEndsAtTheLastStepAndStartsAtTheFirst() {
        XCTAssertNil(WizardStep.done.next(in: .supervise))
        XCTAssertNil(WizardStep.connect.previous(in: .supervise))
    }

    func testStepsThatTheDirectionLeavesOutLeadNowhere() {
        XCTAssertNil(WizardStep.restrictions.next(in: .unsupervise))
        XCTAssertNil(WizardStep.restrictions.previous(in: .unsupervise))
    }

    func testGoingBackUndoesGoingForward() {
        for direction in [WizardDirection.supervise, .unsupervise] {
            for step in WizardStep.steps(for: direction) {
                guard let next = step.next(in: direction) else { continue }
                XCTAssertEqual(next.previous(in: direction), step)
            }
        }
    }

    // MARK: - What the window shows

    func testEveryScreenIsTitledForTheDirectionItIsGoing() {
        XCTAssertEqual(WizardStep.connect.title(for: .supervise), "Connect iPhone to This Mac")
        XCTAssertEqual(WizardStep.ready.title(for: .supervise), "Ready to Supervise")
        XCTAssertEqual(WizardStep.job.title(for: .supervise), "Supervising iPhone")
        XCTAssertEqual(WizardStep.restrictions.title(for: .supervise), "Choose Restrictions")
        XCTAssertEqual(WizardStep.done.title(for: .supervise), "iPhone Is Supervised")
    }

    func testUnsupervisingMirrorsTheTitlesThatNameTheDirection() {
        XCTAssertEqual(WizardStep.connect.title(for: .unsupervise), "Connect iPhone to This Mac")
        XCTAssertEqual(WizardStep.ready.title(for: .unsupervise), "Ready to Unsupervise")
        XCTAssertEqual(WizardStep.job.title(for: .unsupervise), "Unsupervising iPhone")
        XCTAssertEqual(WizardStep.done.title(for: .unsupervise), "iPhone Is No Longer Supervised")
    }

    func testBackIsOfferedOnlyWhereNothingHasBeenSentToThePhone() {
        for step in [WizardStep.connect, .job, .done] {
            XCTAssertFalse(step.allowsBack, "\(step.rawValue) should offer no Back")
        }
        for step in [WizardStep.ready, .restrictions] {
            XCTAssertTrue(step.allowsBack, "\(step.rawValue) should offer Back")
        }
    }

    func testTheDirectionSaysWhatTheFlagHasToRead() {
        XCTAssertTrue(WizardDirection.supervise.target)
        XCTAssertFalse(WizardDirection.unsupervise.target)
    }
}
