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
/** A year of full-time work: 40 hours a week, fifty weeks of them. */
const HOURS_PER_JOB_YEAR = 2000;
/** What the hours the reader gave away would have been paid at. */
const DOLLARS_PER_HOUR = 20;
/**
 * The day from which the hours come to whole years of work. A shorter day is
 * counted in the dinners it went through instead, because a fraction of a job
 * is not a thing anybody can picture.
 */
const JOB_MIN_HOURS = 4;
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
 * One line for every whole hour the page can be answered with. Each hour is
 * worse than the one under it, so each line is.
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
 * One item of the quiet row under the total: the sentence it is said in, and
 * the figure standing inside it, which the row sets apart from the words.
 */
export type HeroMetric = { after: string; before: string; key: string; value: string };

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
 * What the page says out loud at the hour it is on: the arithmetic first, then
 * what it means. An hour the page cannot reach has nothing to say.
 */
export function homeTruth(hoursPerDay: number, locale: Locale): string {
  return TRUTHS[hoursPerDay - 1]?.({}, { locale }) ?? '';
}

/**
 * What the total cost, in three things a reader can picture: the books they
 * did not read, what the hours would have been paid, and the years of
 * full-time work they add up to. A day too short to be a job is counted in the
 * dinners it went through instead. The numbers are grouped for the reader's
 * locale, and so are the words around them.
 */
export function heroMetrics(hoursPerDay: number, locale: Locale): Array<HeroMetric> {
  const format: Format = (value) => new Intl.NumberFormat(locale).format(Math.round(value));
  const hours = screenHours(hoursPerDay);
  return [
    metric(
      'books',
      m.home_metrics_books({ n: VALUE_SLOT }, { locale }),
      format(hours / HOURS_PER_BOOK),
    ),
    metric(
      'money',
      m.home_metrics_money({ amount: VALUE_SLOT }, { locale }),
      // One dollar sign in both locales: the reader is not being invoiced.
      `$${format(hours * DOLLARS_PER_HOUR)}`,
    ),
    hoursPerDay >= JOB_MIN_HOURS
      ? metric(
          'job',
          m.home_metrics_job({ years: VALUE_SLOT }, { locale }),
          format(hours / HOURS_PER_JOB_YEAR),
        )
      : metric(
          'dinners',
          m.home_metrics_dinners({ n: VALUE_SLOT }, { locale }),
          format(HORIZON_YEARS * DAYS_PER_YEAR),
        ),
  ];
}

/** One item, cut in two on the figure that stands in it. */
function metric(key: string, sentence: string, value: string): HeroMetric {
  const [before = '', after = ''] = sentence.split(VALUE_SLOT);
  return { after, before, key, value };
}

/** The waking hours inside the screen years, unrounded: the row counts them. */
function exactHours(hoursPerDay: number): number {
  return screenYears(hoursPerDay) * DAYS_PER_YEAR * WAKING_HOURS;
}
