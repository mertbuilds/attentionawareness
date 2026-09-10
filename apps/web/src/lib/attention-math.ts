/** Hours in a day a person is awake. The other eight are sleep. */
const WAKING_HOURS = 16;
const DAYS_PER_YEAR = 365;
/** The screen hours are an estimate, so they are shown to the nearest hundred. */
const HOURS_ROUNDING = 100;
/** A full year block, in percent. */
const FULL_PERCENT = 100;

/** How far ahead the page projects a daily habit. */
export const HORIZON_YEARS = 20;

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
  const hours = screenYears(hoursPerDay) * DAYS_PER_YEAR * WAKING_HOURS;
  return Math.round(hours / HOURS_ROUNDING) * HOURS_ROUNDING;
}

/** The hours grouped the way the reader's locale groups thousands. */
export function formatHours(hoursPerDay: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(screenHours(hoursPerDay));
}

/**
 * How much of the block standing for one year of the horizon is screen time,
 * in percent: full for every year the total passes, a slice of the year it
 * lands in, and nothing after it.
 */
export function yearFill(hoursPerDay: number, year: number): number {
  const remaining = screenYears(hoursPerDay) - year;
  return Math.min(FULL_PERCENT, Math.max(0, Math.round(remaining * FULL_PERCENT)));
}
