import XCTest

/// The wizard's state machine. It is the part of the window that knows nothing
/// about iPhones, backups or SwiftUI, so it runs here without any of them.
final class WizardStepTests: XCTestCase {
    // MARK: - Which steps a direction shows

    func testSupervisingWalksSixSteps() {
        XCTAssertEqual(
            WizardStep.steps(for: .supervise),
            [.connect, .checks, .backUp, .restore, .profile, .done]
        )
    }

    func testUnsupervisingLeavesTheProfileStepOut() {
        XCTAssertEqual(
            WizardStep.steps(for: .unsupervise),
            [.connect, .checks, .backUp, .restore, .done]
        )
        XCTAssertFalse(WizardStep.profile.belongs(to: .unsupervise))
    }

    // MARK: - Moving

    func testEveryStepLeadsToTheNextOne() {
        XCTAssertEqual(WizardStep.connect.next(in: .supervise), .checks)
        XCTAssertEqual(WizardStep.checks.next(in: .supervise), .backUp)
        XCTAssertEqual(WizardStep.backUp.next(in: .supervise), .restore)
        XCTAssertEqual(WizardStep.restore.next(in: .supervise), .profile)
        XCTAssertEqual(WizardStep.profile.next(in: .supervise), .done)
    }

    func testUnsupervisingGoesFromTheRestoreStraightToTheEnd() {
        XCTAssertEqual(WizardStep.restore.next(in: .unsupervise), .done)
        XCTAssertEqual(WizardStep.done.previous(in: .unsupervise), .restore)
    }

    func testTheRunEndsAtTheLastStepAndStartsAtTheFirst() {
        XCTAssertNil(WizardStep.done.next(in: .supervise))
        XCTAssertNil(WizardStep.connect.previous(in: .supervise))
    }

    func testStepsThatTheDirectionLeavesOutLeadNowhere() {
        XCTAssertNil(WizardStep.profile.next(in: .unsupervise))
        XCTAssertNil(WizardStep.profile.previous(in: .unsupervise))
        XCTAssertEqual(WizardStep.profile.position(in: .unsupervise), "")
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

    func testThePositionCountsOnlyTheStepsTheDirectionShows() {
        XCTAssertEqual(WizardStep.connect.position(in: .supervise), "1 of 6")
        XCTAssertEqual(WizardStep.done.position(in: .supervise), "6 of 6")
        XCTAssertEqual(WizardStep.connect.position(in: .unsupervise), "1 of 5")
        XCTAssertEqual(WizardStep.done.position(in: .unsupervise), "5 of 5")
    }

    func testBackIsOfferedEverywhereExceptTheTwoEnds() {
        XCTAssertFalse(WizardStep.connect.allowsBack)
        XCTAssertFalse(WizardStep.done.allowsBack)
        for step in [WizardStep.checks, .backUp, .restore, .profile] {
            XCTAssertTrue(step.allowsBack, "\(step.rawValue) should offer Back")
        }
    }

    func testTheDirectionSaysWhatTheFlagHasToRead() {
        XCTAssertTrue(WizardDirection.supervise.target)
        XCTAssertFalse(WizardDirection.unsupervise.target)
    }
}
