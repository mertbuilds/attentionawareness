import Foundation

/// The restrictions in a few lines, which is the whole of what the screen
/// shows before the profile goes on the iPhone.
///
/// Each line says one thing, and the longer answer sits in its hover help: the
/// names behind a count, or what a switch costs. That way a reader who is
/// happy with the profile as it comes reads six short lines and presses one
/// button, and a reader who wants to know what "22 websites" means can find
/// out without the screen growing.
///
/// Nothing here reaches an iPhone or a window, so the tests read every line of
/// it.
enum RestrictionsSummary {
    /// One line of the card: what it says, and what hovering it says.
    struct Line: Equatable, Identifiable {
        let text: String
        let help: String

        /// No two lines of a card say the same thing, so the words are the
        /// identity.
        var id: String { text }
    }

    /// The card, top to bottom. The two counts are always there, a switch only
    /// where it takes something away, and the last line always, because
    /// whether the profile can be taken off again is the thing people ask
    /// about first.
    static func lines(for draft: ProfileDraft) -> [Line] {
        var lines = [apps(draft), websites(draft)]
        // Apple's own adult heuristic rides on the deny list, so a profile
        // with no list to carry it filters nothing and says nothing.
        if draft.autoFilterAdult, !draft.sites.isEmpty {
            lines.append(
                Line(
                    text: "Adult websites filtered",
                    help: "Safari keeps adult websites out as well, beyond the list."
                )
            )
        }
        if !draft.allowAppStore {
            lines.append(
                Line(
                    text: "App Store hidden",
                    help: "No new apps and no app updates on iPhone."
                )
            )
        }
        if !draft.allowPrivateBrowsing {
            lines.append(
                Line(
                    text: "Private browsing off",
                    help: "No private tabs, and history can't be cleared."
                )
            )
        }
        lines.append(removal(draft))
        return lines
    }

    /// The apps the profile hides, with their names behind the count.
    private static func apps(_ draft: ProfileDraft) -> Line {
        let names = draft.blockedApps.map(\.name).joined(separator: ", ")
        return Line(
            text: "\(count(draft.blockedApps.count, "app")) hidden",
            help: names.isEmpty ? "No apps yet" : names
        )
    }

    /// The sites the filter carries, with the hosts behind the count. A filter
    /// with nothing in it is not written into the profile at all, so the line
    /// says what Safari does instead.
    private static func websites(_ draft: ProfileDraft) -> Line {
        let hosts = draft.sites.map(\.host)
        guard !hosts.isEmpty else {
            return Line(
                text: "No websites blocked",
                help: "Safari opens every website, whichever apps are hidden."
            )
        }
        return Line(
            text: "\(count(hosts.count, "website")) blocked",
            help: hosts.joined(separator: ", ")
        )
    }

    /// Whether the profile can be taken off the iPhone, which is the whole
    /// difference between a trial and the real thing.
    private static func removal(_ draft: ProfileDraft) -> Line {
        draft.allowsRemoval
            ? Line(
                text: "Can be removed from iPhone",
                help: "Trial mode: you can remove it in Settings."
            )
            : Line(
                text: "Can't be removed from iPhone",
                help: "Only erasing iPhone removes it."
            )
    }

    /// A number and the thing it counts, in whole words, because the copy
    /// never abbreviates a unit.
    private static func count(_ value: Int, _ unit: String) -> String {
        "\(value) \(unit)\(value == 1 ? "" : "s")"
    }
}
