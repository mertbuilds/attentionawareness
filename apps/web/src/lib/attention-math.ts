/** Hours in a day a person is awake. The other eight are sleep. */
export const WAKING_HOURS = 16;
const DAYS_PER_YEAR = 365;
/** The screen hours are an estimate, so they are shown to the nearest hundred. */
const HOURS_ROUNDING = 100;
/** How long one book takes to read: 90,000 words at 238 a minute, with the pauses. */
const HOURS_PER_BOOK = 8;
/** A week away: 16 waking hours, seven days. */
const HOURS_PER_TRAVEL_WEEK = 112;
/** A marathon, with the 16-week training block before it. */
const HOURS_PER_MARATHON = 200;
/** A novel's first draft. */
const HOURS_PER_NOVEL = 500;
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

/** Weeks in a year, so weekends in a year too. */
const WEEKS_PER_YEAR = 52;
/** The weeks inside the horizon, and as many weekends: one square each in the grid of weeks. */
export const HORIZON_WEEKS = HORIZON_YEARS * WEEKS_PER_YEAR;
const WEEKEND_DAYS = 2;
/**
 * Every waking hour of every weekend inside the horizon. The story says the
 * screen takes more than this, which holds from 5 hours a day (36,500).
 */
export const WEEKEND_HOURS = HORIZON_WEEKS * WEEKEND_DAYS * WAKING_HOURS;

/** The walk to the Moon: its mean distance, at the pace the Earth walk is counted at. */
export const MOON_KM = 384_400;
export const WALKING_KMH = 5;
const HOURS_TO_MOON = MOON_KM / WALKING_KMH;
/** That walk in hours, rounded the way the screen hours are: it is an estimate too. */
export const MOON_WALK_HOURS = Math.round(HOURS_TO_MOON / HOURS_ROUNDING) * HOURS_ROUNDING;

/**
 * The day the page is priced at. The typical internet user is online 6 hours
 * 40 minutes a day (DataReportal, Digital 2024); the page counts only the
 * whole hours, so every figure it derives is on the low side.
 */
export const AVERAGE_HOURS = 6;

/**
 * Everyone with a mobile phone, each counted once however many lines they
 * hold: 5.83 billion in April 2026 (GSMA Intelligence, in DataReportal's
 * Digital 2026 Mid-Year Global Update Report).
 */
export const MOBILE_USERS = 5_830_000_000;
const HOURS_PER_DAY = 24;
const SECONDS_PER_DAY = 86_400;
/** The hours all of them spend on a phone in a day, each at the page's average day. */
export const WORLD_HOURS_PER_DAY = MOBILE_USERS * AVERAGE_HOURS;
/** The same hours, spread over the day's seconds. */
export const WORLD_HOURS_PER_SECOND = WORLD_HOURS_PER_DAY / SECONDS_PER_DAY;
/** And counted in years: about 46 of them every second. */
export const WORLD_YEARS_PER_SECOND = WORLD_HOURS_PER_SECOND / HOURS_PER_DAY / DAYS_PER_YEAR;

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

/** The weeks of the horizon the screen years fill, whole: the grid's orange squares. */
export function screenWeeks(hoursPerDay: number): number {
  return Math.round((screenYears(hoursPerDay) / HORIZON_YEARS) * HORIZON_WEEKS);
}

/** How far toward the Moon the screen hours would walk, as a share of the way. */
export function moonShare(hoursPerDay: number): number {
  return screenHours(hoursPerDay) / HOURS_TO_MOON;
}

/**
 * What the same hours would have bought, smallest to largest: books, weeks
 * away, marathons, novels, languages, instruments, degrees, world-class
 * skills, and walks around the Earth. Every one is whole; nobody pictures half a degree.
 */
export function heroMetrics(hoursPerDay: number): Array<HeroMetric> {
  const hours = screenHours(hoursPerDay);
  return [
    { amount: Math.round(hours / HOURS_PER_BOOK), key: 'books' },
    { amount: Math.floor(hours / HOURS_PER_TRAVEL_WEEK), key: 'travel' },
    { amount: Math.floor(hours / HOURS_PER_MARATHON), key: 'marathons' },
    { amount: Math.floor(hours / HOURS_PER_NOVEL), key: 'novels' },
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
