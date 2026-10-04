import SwiftUI

/// The timing curves the cost story's drawings play on, in one place.
///
/// They are the site's. Most of them it writes as CSS timing curves, which are
/// `UnitCurve` beziers here; a few of its drawings ease by a polynomial of
/// their own, written out as it is. Every curve takes how far through it is,
/// clamped to 0...1, and gives back how far along that has got.
enum SiteEasing {
    /// `easing.smoothOut`, CSS's `cubic-bezier(0.22, 1, 0.36, 1)`: off fast,
    /// and a long, slow settle.
    static func smoothOut(_ t: Double) -> Double {
        smoothOutCurve.value(at: clamp(t))
    }

    /// CSS's `ease-in-out`, `cubic-bezier(0.42, 0, 0.58, 1)`.
    static func easeInOut(_ t: Double) -> Double {
        easeInOutCurve.value(at: clamp(t))
    }

    /// `easeInOut` run backwards: how far through it the curve reaches `y`.
    static func easeInOutReaching(_ y: Double) -> Double {
        easeInOutCurve.inverse.value(at: clamp(y))
    }

    /// CSS's `ease-out`, `cubic-bezier(0, 0, 0.58, 1)`.
    static func easeOut(_ t: Double) -> Double {
        easeOutCurve.value(at: clamp(t))
    }

    /// Slow in and slow out, `3t² - 2t³`.
    static func smoothstep(_ t: Double) -> Double {
        let t = clamp(t)
        return t * t * (3 - 2 * t)
    }

    /// Slow in and slow out, steeper in the middle than `smoothstep`.
    static func cubicInOut(_ t: Double) -> Double {
        let t = clamp(t)
        return t < 0.5 ? 4 * t * t * t : 1 - pow(2 - 2 * t, 3) / 2
    }

    /// Fast off the mark and slowing to the end, `1 - (1 - t)³`.
    static func cubicOut(_ t: Double) -> Double {
        1 - pow(1 - clamp(t), 3)
    }

    /// The same, gentler: `1 - (1 - t)²`.
    static func quadOut(_ t: Double) -> Double {
        let left = 1 - clamp(t)
        return 1 - left * left
    }

    /// Up a little past the end and back, the way a mark is set down. Never
    /// under nothing, which rounding would otherwise give it at the very start.
    static func backOut(_ t: Double) -> Double {
        let overshoot = 1.7
        let t = clamp(t)
        return max(0, 1 + (overshoot + 1) * pow(t - 1, 3) + overshoot * pow(t - 1, 2))
    }

    static func clamp(_ value: Double) -> Double {
        min(1, max(0, value))
    }

    private static let smoothOutCurve = UnitCurve.bezier(
        startControlPoint: UnitPoint(x: 0.22, y: 1),
        endControlPoint: UnitPoint(x: 0.36, y: 1)
    )
    private static let easeInOutCurve = UnitCurve.bezier(
        startControlPoint: UnitPoint(x: 0.42, y: 0),
        endControlPoint: UnitPoint(x: 0.58, y: 1)
    )
    private static let easeOutCurve = UnitCurve.bezier(
        startControlPoint: UnitPoint(x: 0, y: 0),
        endControlPoint: UnitPoint(x: 0.58, y: 1)
    )
}
