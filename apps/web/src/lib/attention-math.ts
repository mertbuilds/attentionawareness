import { m } from '../paraglide/messages.js';
import { locales } from '../paraglide/runtime.js';

type Locale = (typeof locales)[number];

/** Hours in a day a person is awake. The other eight are sleep. */
const WAKING_HOURS = 16;
const DAYS_PER_YEAR = 365;
/** The screen hours are an estimate, so they are shown to the nearest hundred. */
const HOURS_ROUNDING = 100;
/** How long one book takes to read: 90,000 words at 238 a minute, with the pauses. */
const HOURS_PER_BOOK = 8;
/** One session in the gym, changed and showered. */
const HOURS_PER_WORKOUT = 1;
/** One dinner with people, sat down rather than eaten standing up. */
const HOURS_PER_DINNER = 2;
/** What the hours the reader gave away would have been paid at. */
const DOLLARS_PER_HOUR = 20;
/**
 * Where the figure stands inside its own sentence. The message is written with
 * the number as a placeholder and split on it, so the row can set the number
 * apart from the words around it without stitching the sentence from pieces.
 */
const VALUE_SLOT = '\u0000';

/** How far ahead the page projects a daily habit. */
export const HORIZON_YEARS = 20;

/**
 * The day every page falls back to: what a US adult spends on the phone
 * itself. The generator opens its question on it, and a link that carries no
 * day of its own is read against it.
 */
export const AVERAGE_DAY = { hours: 4, minutes: 5 };

/**
 * The one extra sentence the page says at every whole hour it can be answered
 * with, on top of the total. Each hour is worse than the one under it, so each
 * sentence is.
 */
const TRUTHS = [
  m.home_truth_1,
  m.home_truth_2,
  m.home_truth_3,
  m.home_truth_4,
  m.home_truth_5,
  m.home_truth_6,
  m.home_truth_7,
  m.home_truth_8,
  m.home_truth_9,
  m.home_truth_10,
  m.home_truth_11,
  m.home_truth_12,
];

/**
 * One line of the quiet list under the total: the sentence it is said in, and
 * the figure standing inside it, which the list sets apart from the words.
 */
export type HeroMetric = {
  after: string;
  amount: number;
  before: string;
  key: string;
  prefix: string;
  value: string;
};

/** The grouped number an item is counted in. */
type Format = (value: number) => string;

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
 * The one extra sentence for the hour the page is on, said under the total
 * that already priced it. An hour the page cannot reach has nothing to say.
 */
export function homeTruth(hoursPerDay: number, locale: Locale): string {
  return TRUTHS[hoursPerDay - 1]?.({}, { locale }) ?? '';
}

/**
 * What the same hours would have bought instead, in four things a reader can
 * picture: the books, the workouts, the dinners with people, and what the
 * hours would have been paid. Every day of every length is counted the same
 * four ways. The numbers are grouped for the reader's locale, and so are the
 * words around them.
 */
export function heroMetrics(hoursPerDay: number, locale: Locale): Array<HeroMetric> {
  const format: Format = (value) => new Intl.NumberFormat(locale).format(Math.round(value));
  const hours = screenHours(hoursPerDay);
  return [
    metric(
      'books',
      m.home_metrics_books({ n: VALUE_SLOT }, { locale }),
      hours / HOURS_PER_BOOK,
      format,
    ),
    metric(
      'workouts',
      m.home_metrics_workouts({ n: VALUE_SLOT }, { locale }),
      hours / HOURS_PER_WORKOUT,
      format,
    ),
    metric(
      'dinners',
      m.home_metrics_dinners({ n: VALUE_SLOT }, { locale }),
      hours / HOURS_PER_DINNER,
      format,
    ),
    // One dollar sign in both locales: the reader is not being invoiced.
    metric(
      'money',
      m.home_metrics_money({ amount: VALUE_SLOT }, { locale }),
      hours * DOLLARS_PER_HOUR,
      format,
      '$',
    ),
  ];
}

/** One item, cut in two on the figure that stands in it. */
function metric(
  key: string,
  sentence: string,
  amount: number,
  format: Format,
  prefix = '',
): HeroMetric {
  const [before = '', after = ''] = sentence.split(VALUE_SLOT);
  return { after, amount: Math.round(amount), before, key, prefix, value: prefix + format(amount) };
}

/** The waking hours inside the screen years, unrounded: the row counts them. */
function exactHours(hoursPerDay: number): number {
  return screenYears(hoursPerDay) * DAYS_PER_YEAR * WAKING_HOURS;
}
