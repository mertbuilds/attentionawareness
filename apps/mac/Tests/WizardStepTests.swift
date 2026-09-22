import Foundation
import Testing

/// The wizard's state machine. It is the part of the window that knows nothing
/// about iPhones, backups or SwiftUI, so it runs here without any of them.
struct WizardStepTests {
    // MARK: - Which steps the run shows

    @Test func theRunWalksFiveScreens() {
        #expect(
            WizardStep.steps == [.connect, .ready, .job, .restrictions, .done]
        )
    }

    @Test func profilesIsAStandaloneDestinationOffTheRun() {
        // The Profiles screen is reached from Connect for a phone that is
        // supervised already, so it is not one of the run's steps and has no
        // next or previous of its own. Stepping back from it returns to
        // Connect, so it offers Back.
        #expect(WizardStep.profiles.title == "Manage Restrictions")
        #expect(WizardStep.steps.contains(.profiles) == false)
        #expect(WizardStep.profiles.next == nil)
        #expect(WizardStep.profiles.previous == nil)
        #expect(WizardStep.profiles.allowsBack)
    }

    // MARK: - Moving

    @Test func everyStepLeadsToTheNextOne() {
        #expect(WizardStep.connect.next == .ready)
        #expect(WizardStep.ready.next == .job)
        #expect(WizardStep.job.next == .restrictions)
        #expect(WizardStep.restrictions.next == .done)
    }

    @Test func theRunEndsAtTheLastStepAndStartsAtTheFirst() {
        #expect(WizardStep.done.next == nil)
        #expect(WizardStep.connect.previous == nil)
    }

    @Test func goingBackUndoesGoingForward() {
        for step in WizardStep.allCases {
            guard let next = step.next else { continue }
            #expect(next.previous == step)
        }
    }

    // MARK: - What the window shows

    @Test func everyScreenIsTitled() {
        #expect(WizardStep.connect.title == "Connect iPhone to This Mac")
        #expect(WizardStep.ready.title == "Ready to Supervise")
        #expect(WizardStep.job.title == "Supervising iPhone")
        #expect(WizardStep.restrictions.title == "Choose Restrictions")
        #expect(WizardStep.done.title == "iPhone Is Supervised")
    }

    @Test func backIsOfferedOnlyWhereNothingHasBeenSentToThePhone() {
        for step in [WizardStep.connect, .job, .done] {
            #expect(step.allowsBack == false, "\(step.rawValue) should offer no Back")
        }
        for step in [WizardStep.ready, .restrictions] {
            #expect(step.allowsBack, "\(step.rawValue) should offer Back")
        }
    }
}
