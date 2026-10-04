import Foundation

/// Where the supervision key is bought and checked.
///
/// One key costs $29 on Polar and is worth one supervision: the license key
/// benefit behind it has a usage limit of one, and a supervision that went
/// through spends it. A Debug build talks to Polar's sandbox, so a test
/// purchase never touches real money or real keys; a Release build talks to
/// Polar itself. The two are separate organizations with separate ids.
struct LicenseConfig: Equatable, Sendable {
    /// The root of Polar's API, without the `/v1` part.
    let apiBase: URL
    /// The Polar organization the keys belong to. Validating asks for it,
    /// because a key string is only unique inside one organization.
    let organizationID: String
    /// The page that sells one key.
    let checkoutURL: URL

    static let sandbox = LicenseConfig(
        apiBase: URL(string: "https://sandbox-api.polar.sh")!,
        organizationID: "8fb00f32-f5ad-4a06-9b6f-bfe2b22ce714",
        checkoutURL: URL(string: "https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_vOhSA7DWHShxGhNIDG1yFEr32eYDr5xZOkCGi1uo5Pn/redirect")!
    )

    static let production = LicenseConfig(
        apiBase: URL(string: "https://api.polar.sh")!,
        organizationID: "aead889b-9b53-4ba9-a0d5-4d588cbc56b2",
        checkoutURL: URL(string: "https://buy.polar.sh/polar_cl_T9RG7BLrakVmgi7pbw6mA6z6Hlf0Fio56H3b43tbsbm")!
    )

    /// The one this build uses.
    static var current: LicenseConfig {
        #if DEBUG
        return sandbox
        #else
        return production
        #endif
    }
}
