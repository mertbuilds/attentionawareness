import Foundation
import Testing

/// The country the App Store is asked about.
///
/// Results are storefront-scoped, so the wrong store means an app the reader
/// has installed simply is not in the list. Nothing here reaches Apple: the
/// table, the names and the flags are all local.
struct StorefrontsTests {
    // MARK: - The table

    @Test func everyCodeIsTwoLowercaseLetters() {
        for code in Storefronts.codes {
            #expect(code.count == 2, "\(code) is not a two letter code")
            #expect(code == code.lowercased(), "\(code) is not lowercase")
        }
    }

    @Test func noStoreIsListedTwice() {
        #expect(Set(Storefronts.codes).count == Storefronts.codes.count)
    }

    @Test func theFallbackStoreIsOneOfTheStores() {
        #expect(Storefronts.codes.contains(Storefronts.fallback))
    }

    @Test func thePickerListsEveryStoreNamedAndFlagged() {
        #expect(Storefronts.all.count == Storefronts.codes.count)
        for storefront in Storefronts.all {
            #expect(storefront.label.isEmpty == false, "\(storefront.code) has no name")
            #expect(storefront.flag.isEmpty == false, "\(storefront.code) has no flag")
        }
    }

    @Test func thePickerListsTheStoresInTheOrderAReaderScansThem() {
        // Sorted by the English name, not by the code, so the list reads the
        // way a reader looks for a country.
        let english = Locale(identifier: "en")
        for (left, right) in zip(Storefronts.all, Storefronts.all.dropFirst()) {
            #expect(
                left.label.compare(right.label, options: [], range: nil, locale: english)
                    != .orderedDescending,
                "\(left.label) should not come after \(right.label)"
            )
        }
        #expect(Storefronts.all.first?.label == "Afghanistan")
        #expect(Storefronts.all.last?.label == "Zimbabwe")
    }

    // MARK: - What a store is called

    @Test func aStoreIsNamedInEnglishWhateverTheMacIsSetTo() {
        #expect(Storefronts.label(for: "de") == "Germany")
        #expect(Storefronts.label(for: "gb") == "United Kingdom")
        #expect(Storefronts.label(for: "us") == "United States")
    }

    @Test func aCodeTheSystemCannotNameIsNamedHere() {
        #expect(Storefronts.label(for: "xk") == "Kosovo")
    }

    @Test func aCodeThatNamesNoCountryIsItsOwnLabel() {
        #expect(Storefronts.label(for: "abc") == "ABC")
        #expect(Storefronts.label(for: "") == "")
    }

    @Test func aCodeIsNamedWhateverCaseAndSpacingItArrivesIn() {
        #expect(Storefronts.label(for: " DE ") == "Germany")
        #expect(Storefronts.label(for: "XK") == "Kosovo")
    }

    // MARK: - The flag

    @Test func aTwoLetterCodeIsItsFlag() {
        #expect(Storefronts.flag(for: "tr") == "🇹🇷")
        #expect(Storefronts.flag(for: "US") == "🇺🇸")
        #expect(Storefronts.flag(for: " de ") == "🇩🇪")
    }

    @Test func anythingThatIsNotTwoLettersNamesNoCountrySoItGetsNoFlag() {
        #expect(Storefronts.flag(for: "") == "")
        #expect(Storefronts.flag(for: "t") == "")
        #expect(Storefronts.flag(for: "abc") == "")
        #expect(Storefronts.flag(for: "12") == "")
        #expect(Storefronts.flag(for: "t r") == "")
    }

    @Test func aStorefrontCarriesTheFlagOfItsOwnCode() {
        #expect(Storefront(code: "tr", label: "Türkiye").flag == "🇹🇷")
    }

    // MARK: - The store searched first

    @Test func theStoreComesFromTheRegionOfTheLocale() {
        #expect(Storefronts.current(Locale(identifier: "tr-TR")) == "tr")
        #expect(Storefronts.current(Locale(identifier: "en-US")) == "us")
        #expect(Storefronts.current(Locale(identifier: "de_DE")) == "de")
    }

    @Test func aLocaleThatNamesNoRegionFallsBackToTheUsStore() {
        #expect(Storefronts.current(Locale(identifier: "en")) == Storefronts.fallback)
        #expect(Storefronts.current(Locale(identifier: "")) == Storefronts.fallback)
    }
}
