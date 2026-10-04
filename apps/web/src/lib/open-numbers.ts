/** One row of a list: a name and how many. */
export type OpenRow = { count: number; label: string };

/** One UTC day, `YYYY-MM-DD`, with zeros on a day nobody came. */
export type OpenDay = { day: string; views: number; visitors: number };

/** The site's numbers for the window the public dashboard shows. Totals only. */
export type OpenNumbers = {
  countries: Array<OpenRow>;
  days: Array<OpenDay>;
  downloads: number;
  generatedAt: string;
  pages: Array<OpenRow>;
  reads: number;
  referrers: Array<OpenRow>;
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
