import XCTest

/// The body of the last screen, in each of the things it can say.
///
/// That screen is a title, one or two sentences and a button, so the sentences
/// are worth a table of their own: what a run that went through says, what one
/// the iPhone never confirmed says, and the one thing left to do for a phone
/// whose Find My is still off. None of it reads an iPhone or builds a view.
final class DoneCopyTests: XCTestCase {
    // MARK: - The body

    func testARunThatWentThroughSaysTheOneThingLeftToDo() {
        XCTAssertEqual(
            DoneCopy.lines(findMyOff: false, matched: true),
            ["You can disconnect iPhone."]
        )
    }

    func testAPhoneWhoseFindMyIsStillOffIsAskedForItBack() {
        XCTAssertEqual(
            DoneCopy.lines(findMyOff: true, matched: true),
            ["You can disconnect iPhone.", "Turn Find My iPhone back on in Settings."]
        )
    }

    func testAPhoneThatNeverSaidWhatItIsSendsTheReaderToSettings() {
        XCTAssertEqual(
            DoneCopy.lines(findMyOff: false, matched: false),
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
