/** Hours in a day a person is awake. The other eight are sleep. */
const WAKING_HOURS = 16;
const DAYS_PER_YEAR = 365;
/** The screen hours are an estimate, so they are shown to the nearest hundred. */
const HOURS_ROUNDING = 100;
/** How long one book takes to read: 90,000 words at 238 a minute, with the pauses. */
const HOURS_PER_BOOK = 8;
/** Hours to speak a language well (US Foreign Service Institute, category III). */
const HOURS_PER_LANGUAGE = 1500;
/** Hours to play an instrument well. */
const HOURS_PER_INSTRUMENT = 2000;
/** Hours of a four-year degree: 1,200 a year. */
const HOURS_PER_DEGREE = 4800;
/** The folk figure for mastery. */
const HOURS_PER_SKILL = 10_000;
/** Once around the Earth on foot: 40,075 km at 5 km/h. */
const HOURS_PER_EARTH_WALK = 8000;

/** How far ahead the page projects a daily habit. */
export const HORIZON_YEARS = 20;

/**
 * The day every page falls back to: what a US adult spends on the phone
 * itself. A link that carries no day of its own is read against it.
 */
export const AVERAGE_DAY = { hours: 4, minutes: 5 };

/** One thing the hours would have bought: what it is, and how many. */
export type HeroMetric = { amount: number; key: string };

/**
 * The waking years a daily screen habit costs over the horizon. The calendar
 * cancels out: a day spent `hoursPerDay` of the 16 awake on a screen is that
 * same fraction of every year in it.
 */
export function screenYears(hoursPerDay: number): number {
  return (hoursPerDay * HORIZON_YEARS) / WAKING_HOURS;
}

/** Those years as the page prints them: one decimal, and never a bare `.0`. */
export function formatYears(hoursPerDay: number): string {
  const text = screenYears(hoursPerDay).toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

/** The same span counted in waking hours, rounded to the nearest hundred. */
export function screenHours(hoursPerDay: number): number {
  return Math.round(exactHours(hoursPerDay) / HOURS_ROUNDING) * HOURS_ROUNDING;
}

/**
 * What the same hours would have bought, smallest to largest: books, then
 * languages, instruments, degrees, world-class skills, and walks around the
 * Earth. Every one is whole; nobody pictures half a degree.
 */
export function heroMetrics(hoursPerDay: number): Array<HeroMetric> {
  const hours = screenHours(hoursPerDay);
  return [
    { amount: Math.round(hours / HOURS_PER_BOOK), key: 'books' },
    { amount: Math.floor(hours / HOURS_PER_LANGUAGE), key: 'languages' },
    { amount: Math.floor(hours / HOURS_PER_INSTRUMENT), key: 'instruments' },
    { amount: Math.floor(hours / HOURS_PER_DEGREE), key: 'degrees' },
    { amount: Math.floor(hours / HOURS_PER_SKILL), key: 'skills' },
    { amount: Math.floor(hours / HOURS_PER_EARTH_WALK), key: 'earth' },
  ];
}

/** The waking hours inside the screen years, unrounded. */
function exactHours(hoursPerDay: number): number {
  return screenYears(hoursPerDay) * DAYS_PER_YEAR * WAKING_HOURS;
}
