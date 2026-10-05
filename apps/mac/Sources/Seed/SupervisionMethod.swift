import Foundation

/// How an iPhone is supervised.
///
/// Every run the window starts uses the fast method. Which iPhones get a run
/// at all is `IOSSupport`.
enum SupervisionMethod: Hashable {
    /// The fast way: restore the cloud configuration and Setup Assistant
    /// completion preferences from a small backup.
    case seed
    /// The full way: copy the whole iPhone, patch the copy, put it back.
    case fullCopy
}
