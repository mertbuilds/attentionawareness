import XCTest

/// The country the App Store is asked about.
///
/// Results are storefront-scoped, so the wrong store means an app the reader
/// has installed simply is not in the list. Nothing here reaches Apple: the
/// table, the names and the flags are all local.
final class StorefrontsTests: XCTestCase {
    // MARK: - The table

    func testEveryCodeIsTwoLowercaseLetters() {
        for code in Storefronts.codes {
            XCTAssertEqual(code.count, 2, "\(code) is not a two letter code")
            XCTAssertEqual(code, code.lowercased(), "\(code) is not lowercase")
        }
    }

    func testNoStoreIsListedTwice() {
        XCTAssertEqual(Set(Storefronts.codes).count, Storefronts.codes.count)
    }

    func testTheFallbackStoreIsOneOfTheStores() {
        XCTAssertTrue(Storefronts.codes.contains(Storefronts.fallback))
    }

    func testThePickerListsEveryStoreNamedAndFlagged() {
        XCTAssertEqual(Storefronts.all.count, Storefronts.codes.count)
        for storefront in Storefronts.all {
            XCTAssertFalse(storefront.label.isEmpty, "\(storefront.code) has no name")
            XCTAssertFalse(storefront.flag.isEmpty, "\(storefront.code) has no flag")
        }
    }

    func testThePickerListsTheStoresInTheOrderAReaderScansThem() {
        // Sorted by the English name, not by the code, so the list reads the
        // way a reader looks for a country.
        let english = Locale(identifier: "en")
        for (left, right) in zip(Storefronts.all, Storefronts.all.dropFirst()) {
            XCTAssertNotEqual(
                left.label.compare(right.label, options: [], range: nil, locale: english),
                .orderedDescending,
                "\(left.label) should not come after \(right.label)"
            )
        }
        XCTAssertEqual(Storefronts.all.first?.label, "Afghanistan")
        XCTAssertEqual(Storefronts.all.last?.label, "Zimbabwe")
    }

    // MARK: - What a store is called

    func testAStoreIsNamedInEnglishWhateverTheMacIsSetTo() {
        XCTAssertEqual(Storefronts.label(for: "de"), "Germany")
        XCTAssertEqual(Storefronts.label(for: "gb"), "United Kingdom")
        XCTAssertEqual(Storefronts.label(for: "us"), "United States")
    }

    func testACodeTheSystemCannotNameIsNamedHere() {
        XCTAssertEqual(Storefronts.label(for: "xk"), "Kosovo")
    }

    func testACodeThatNamesNoCountryIsItsOwnLabel() {
        XCTAssertEqual(Storefronts.label(for: "abc"), "ABC")
        XCTAssertEqual(Storefronts.label(for: ""), "")
    }

    func testACodeIsNamedWhateverCaseAndSpacingItArrivesIn() {
        XCTAssertEqual(Storefronts.label(for: " DE "), "Germany")
        XCTAssertEqual(Storefronts.label(for: "XK"), "Kosovo")
    }

    // MARK: - The flag

    func testATwoLetterCodeIsItsFlag() {
        XCTAssertEqual(Storefronts.flag(for: "tr"), "🇹🇷")
        XCTAssertEqual(Storefronts.flag(for: "US"), "🇺🇸")
        XCTAssertEqual(Storefronts.flag(for: " de "), "🇩🇪")
    }

    func testAnythingThatIsNotTwoLettersNamesNoCountrySoItGetsNoFlag() {
        XCTAssertEqual(Storefronts.flag(for: ""), "")
        XCTAssertEqual(Storefronts.flag(for: "t"), "")
        XCTAssertEqual(Storefronts.flag(for: "abc"), "")
        XCTAssertEqual(Storefronts.flag(for: "12"), "")
        XCTAssertEqual(Storefronts.flag(for: "t r"), "")
    }

    func testAStorefrontCarriesTheFlagOfItsOwnCode() {
        XCTAssertEqual(Storefront(code: "tr", label: "Türkiye").flag, "🇹🇷")
    }

    // MARK: - The store searched first

    func testTheStoreComesFromTheRegionOfTheLocale() {
        XCTAssertEqual(Storefronts.current(Locale(identifier: "tr-TR")), "tr")
        XCTAssertEqual(Storefronts.current(Locale(identifier: "en-US")), "us")
        XCTAssertEqual(Storefronts.current(Locale(identifier: "de_DE")), "de")
    }

    func testALocaleThatNamesNoRegionFallsBackToTheUsStore() {
        XCTAssertEqual(Storefronts.current(Locale(identifier: "en")), Storefronts.fallback)
        XCTAssertEqual(Storefronts.current(Locale(identifier: "")), Storefronts.fallback)
    }
}
