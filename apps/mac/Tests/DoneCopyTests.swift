import XCTest

/// The body of the last screen, in each of the things it can say.
///
/// That screen is a title, one sentence and a button, so the sentences are
/// worth a table of their own: what a run that went through says, and what one
/// the iPhone never confirmed says. None of it reads an iPhone or builds a view.
final class DoneCopyTests: XCTestCase {
    // MARK: - The body

    func testARunThatWentThroughSaysTheOneThingLeftToDo() {
        XCTAssertEqual(
            DoneCopy.lines(matched: true),
            ["You can disconnect iPhone."]
        )
    }

    func testAPhoneThatNeverSaidWhatItIsSendsTheReaderToSettings() {
        XCTAssertEqual(
            DoneCopy.lines(matched: false),
            ["iPhone didn't report the change. Check the top of Settings."]
        )
    }

    // MARK: - The note behind the title

    func testTheNoteSaysWhereToLookForWhatTheTitleClaims() {
        XCTAssertEqual(
            DoneCopy.note,
            "Settings shows 'This iPhone is supervised' at the top."
        )
    }
}
