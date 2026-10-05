import Foundation

/// The cloud configuration an iPhone that is not supervised holds, and the
/// udid the tests name it by.
enum BackupFixture {
    static let udid = "00008140-000A1B2C3D4E5F60"

    static let baseContent: [String: Any] = [
        "AllowPairing": true,
        "CloudConfigurationUIComplete": false,
        "ConfigurationSource": 0,
        "IsSupervised": false,
        "PostSetupProfileWasInstalled": true,
    ]
}
