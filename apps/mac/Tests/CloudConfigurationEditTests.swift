import Foundation
import Testing

/// The cloud configuration the seed method writes, from the one the iPhone
/// holds now. Dictionaries in, a dictionary and its list of changes out.
struct CloudConfigurationEditTests {
    /// A configuration that already says everything a supervised iPhone says.
    private static let supervised: [String: Any] = [
        "AllowPairing": true,
        "CloudConfigurationUIComplete": true,
        "ConfigurationSource": 0,
        "ConfigurationWasApplied": true,
        "IsSupervised": true,
        "PostSetupProfileWasInstalled": true,
        "SkipSetup": CloudConfigurationEdit.setupPanes,
    ]

    @Test func anUnsupervisedIPhoneIsSupervised() {
        let edit = CloudConfigurationEdit.plan(current: BackupFixture.baseContent, supervised: true)

        #expect(edit.changes == [
            "IsSupervised: false -> true",
            "CloudConfigurationUIComplete: false -> true",
            "ConfigurationWasApplied: missing -> true",
            "SkipSetup: updated",
        ])
        #expect(edit.content as NSDictionary == Self.supervised as NSDictionary)
    }

    @Test func aSupervisedIPhoneNeedsNoChange() {
        let edit = CloudConfigurationEdit.plan(current: Self.supervised, supervised: true)

        #expect(edit.changes.isEmpty)
        #expect(edit.content as NSDictionary == Self.supervised as NSDictionary)
    }

    @Test func anIPhoneWithNoConfigurationGetsTheFlagsAndSetupSuppression() {
        let edit = CloudConfigurationEdit.plan(current: [:], supervised: true)

        #expect(edit.changes == [
            "IsSupervised: missing -> true",
            "CloudConfigurationUIComplete: missing -> true",
            "ConfigurationWasApplied: missing -> true",
            "AllowPairing: missing -> true",
            "PostSetupProfileWasInstalled: missing -> true",
            "ConfigurationSource: missing -> 0",
            "SkipSetup: updated",
        ])
        #expect(edit.content as NSDictionary == Self.supervised as NSDictionary)
    }

    @Test func unsupervisingTakesTheSupervisingIdentityAway() {
        var current = Self.supervised
        current["OrganizationName"] = "Example"
        current["OrganizationMagic"] = "7A1D3C52-0B7E-4E0C-9C55-2F3E4D5C6B7A"
        current["SupervisorHostCertificates"] = [Data([0x30, 0x82])]

        let edit = CloudConfigurationEdit.plan(current: current, supervised: false)

        #expect(edit.changes == [
            "IsSupervised: true -> false",
            "OrganizationMagic: present -> missing",
            "SupervisorHostCertificates: present -> missing",
        ])
        var expected = Self.supervised
        expected["IsSupervised"] = false
        expected["OrganizationName"] = "Example"
        #expect(edit.content as NSDictionary == expected as NSDictionary)
    }

    @Test func supervisingLeavesASupervisingIdentityWhereItIs() {
        // Every key the iPhone had is kept on the way in, these two as well.
        var current = Self.supervised
        current["IsSupervised"] = false
        current["OrganizationMagic"] = "7A1D3C52-0B7E-4E0C-9C55-2F3E4D5C6B7A"
        current["SupervisorHostCertificates"] = [Data([0x30, 0x82])]

        let edit = CloudConfigurationEdit.plan(current: current, supervised: true)

        #expect(edit.changes == ["IsSupervised: false -> true"])
        var expected = current
        expected["IsSupervised"] = true
        #expect(edit.content as NSDictionary == expected as NSDictionary)
    }

    @Test(arguments: [true, false])
    func keysTheEditKnowsNothingAboutSurvive(_ supervised: Bool) {
        let unknown: [String: Any] = [
            "MysteryKey": "kept",
            "SkipSetup": ["WiFi", "Siri"],
            "IsMDMUnremovable": false,
            "Nested": ["Depth": 2],
        ]

        let edit = CloudConfigurationEdit.plan(current: unknown, supervised: supervised)

        var expected = Self.supervised
        expected["IsSupervised"] = supervised
        expected.merge(unknown) { _, kept in kept }
        expected["SkipSetup"] = ["WiFi", "Siri"] + CloudConfigurationEdit.setupPanes.filter { !["WiFi", "Siri"].contains($0) }
        #expect(edit.content as NSDictionary == expected as NSDictionary)
    }

    @Test(arguments: [true, false])
    func setupPanesRetainUnknownNamesAndAddUpstreamNamesInStableOrder(_ supervised: Bool) {
        let current: [String: Any] = ["SkipSetup": ["FuturePane", "RestoreCompleted", "FuturePane", "AnotherPane"]]
        let edit = CloudConfigurationEdit.plan(current: current, supervised: supervised)
        let panes = edit.content["SkipSetup"] as? [String]
        let expected = ["FuturePane", "RestoreCompleted", "AnotherPane"]
            + CloudConfigurationEdit.setupPanes.filter { $0 != "RestoreCompleted" }
        #expect(panes == expected)
        #expect(CloudConfigurationEdit.plan(current: edit.content, supervised: supervised).changes.isEmpty)
    }

    @Test func mixedExistingSetupPanesKeepTheirStringEntries() {
        let current: [String: Any] = ["SkipSetup": ["FuturePane", 7, "Siri"]]
        let panes = CloudConfigurationEdit.plan(current: current, supervised: true).content["SkipSetup"] as? [String]
        #expect(panes?.prefix(2) == ["FuturePane", "Siri"])
        #expect(panes?.contains("RestoreCompleted") == true)
    }

    @Test(arguments: [true, false])
    func serializedConfigurationSuppressesTheObservedAndPostRestorePanes(_ supervised: Bool) throws {
        let data = try CloudConfigurationEdit.plan(current: [:], supervised: supervised).plistData()
        let plist = try PropertyListSerialization.propertyList(from: data, options: [], format: nil)
        let dictionary = try #require(plist as? [String: Any])
        let panes = try #require(dictionary["SkipSetup"] as? [String])
        let required: Set<String> = [
            "Language", "Region", "Siri", "ScreenTime", "Restore",
            "RestoreCompleted", "UpdateCompleted", "LanguageAndLocale",
        ]
        #expect(required.isSubset(of: Set(panes)))
    }

    @Test func aFlagOfTheWrongTypeIsWrittenAgain() {
        // A plist integer is not a boolean and a plist boolean is not an
        // integer, so neither passes for the value it looks like.
        var current = Self.supervised
        current["IsSupervised"] = 1
        current["ConfigurationSource"] = false

        let edit = CloudConfigurationEdit.plan(current: current, supervised: true)

        #expect(edit.changes == ["IsSupervised: 1 -> true", "ConfigurationSource: false -> 0"])
        #expect(SupervisionPatch.boolean(edit.content["IsSupervised"]) == true)
        #expect(SupervisionPatch.boolean(edit.content["ConfigurationSource"]) == nil)
        #expect(edit.content as NSDictionary == Self.supervised as NSDictionary)
    }

    @Test func theFileIsAnXMLPropertyListOfTheEditedConfiguration() throws {
        let edit = CloudConfigurationEdit.plan(current: BackupFixture.baseContent, supervised: true)

        let data = try edit.plistData()

        #expect(data.starts(with: Array("<?xml".utf8)))
        var format = PropertyListSerialization.PropertyListFormat.binary
        let read = try PropertyListSerialization.propertyList(from: data, options: [], format: &format)
        #expect(format == .xml)
        #expect(read as? NSDictionary == edit.content as NSDictionary)
    }
}
