/** One row of a list: a name and how many. */
export type OpenRow = { count: number; label: string };

/** One UTC day, `YYYY-MM-DD`, with zeros on a day nobody came. */
export type OpenDay = { day: string; views: number; visitors: number };

/** The site's numbers for the window the public dashboard shows. Totals only. */
export type OpenNumbers = {
  /** The share of visits that bounced, as a whole percent. */
  bounceRate: number;
  countries: Array<OpenRow>;
  days: Array<OpenDay>;
  downloads: number;
  generatedAt: string;
  pages: Array<OpenRow>;
  reads: number;
  referrers: Array<OpenRow>;
  /** How long a visit lasts on average, in whole seconds. */
  sessionSeconds: number;
  supervisions: number;
  supportClicks: number;
  views: number;
  visitors: number;
};

/** What the page is handed: the numbers and their age, or `null` when there are none. */
export type OpenNumbersAnswer = { ageMinutes: number; numbers: OpenNumbers } | null;

/** How PostHog names a visit that came from no other site. */
export const DIRECT = '$direct';

/** The shared PostHog dashboard with the same numbers, public by design. */
export const DASHBOARD_URL = 'https://eu.posthog.com/shared/Wd_BFikjUZHCinzMYV-K4b-pnGYjWA';

/** A length of time in the units a reader says it in, largest first. */
export type DurationPart = { count: number; unit: 'hour' | 'minute' | 'second' };

/**
 * Whole seconds as hours, minutes and seconds, leaving out the units that are
 * zero. No time at all is zero seconds.
 */
export function durationParts(seconds: number): Array<DurationPart> {
  const whole = Math.max(0, Math.round(seconds));
  const parts: Array<DurationPart> = [
    { count: Math.floor(whole / 3600), unit: 'hour' },
    { count: Math.floor((whole % 3600) / 60), unit: 'minute' },
    { count: whole % 60, unit: 'second' },
  ];
  const shown = parts.filter((part) => part.count > 0);
  return shown.length === 0 ? [{ count: 0, unit: 'second' }] : shown;
}
