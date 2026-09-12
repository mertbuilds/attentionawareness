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
/** What a language costs before it is spoken. */
const HOURS_PER_LANGUAGE = 1500;
/** What the receipt pays the reader for the hours they gave away. */
const DOLLARS_PER_HOUR = 20;

/** How far ahead the page projects a daily habit. */
export const HORIZON_YEARS = 20;

/**
 * One line for every stop on the dial, and the dial only stops on whole hours.
 * Each hour is worse than the one under it, so each line is.
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

/** One row of the receipt: what was taken, and what it came to. */
export type ReceiptLine = { key: string; label: string; value: string };

/** The grouped number a row is billed in. */
type Format = (value: number) => string;

type ReceiptEntry = {
  key: string;
  label: (locale: Locale) => string;
  /** The hours a day from which this row is part of the reader's bill. */
  minHours: number;
  value: (hoursPerDay: number, format: Format, locale: Locale) => string;
};

/**
 * The bill, printed the way a till prints one. A row appears once the day is
 * long enough to earn it and stays for every longer day; the books and the
 * money are owed at any length, so they carry no threshold of their own. The
 * waking years are not a row: they are the total under the tear line.
 */
const RECEIPT: ReadonlyArray<ReceiptEntry> = [
  {
    key: 'books',
    label: (locale) => m.home_receipt_books_label({}, { locale }),
    minHours: 0,
    value: (hoursPerDay, format) => format(screenHours(hoursPerDay) / HOURS_PER_BOOK),
  },
  {
    key: 'dinners',
    label: (locale) => m.home_receipt_dinners_label({}, { locale }),
    minHours: 2,
    value: (_hoursPerDay, format) => format(HORIZON_YEARS * DAYS_PER_YEAR),
  },
  {
    key: 'languages',
    label: (locale) => m.home_receipt_languages_label({}, { locale }),
    minHours: 3,
    value: (hoursPerDay, format) =>
      format(Math.floor(screenHours(hoursPerDay) / HOURS_PER_LANGUAGE)),
  },
  {
    key: 'money',
    label: (locale) => m.home_receipt_money_label({}, { locale }),
    minHours: 0,
    // One dollar sign in both locales: the reader is not being invoiced.
    value: (hoursPerDay, format) => `$${format(screenHours(hoursPerDay) * DOLLARS_PER_HOUR)}`,
  },
  {
    key: 'job',
    label: (locale) => m.home_receipt_job_label({}, { locale }),
    minHours: 4,
    value: (hoursPerDay, format, locale) =>
      m.home_receipt_job_value(
        { years: format(screenHours(hoursPerDay) / HOURS_PER_JOB_YEAR) },
        { locale },
      ),
  },
];

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

/** The hours grouped the way the reader's locale groups thousands. */
export function formatHours(hoursPerDay: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(screenHours(hoursPerDay));
}

/**
 * What the dial says out loud at the stop it is on: one sentence, no numbers
 * to read off it. A number of hours the dial cannot reach has nothing to say.
 */
export function homeTruth(hoursPerDay: number, locale: Locale): string {
  return TRUTHS[hoursPerDay - 1]?.({}, { locale }) ?? '';
}

/**
 * What the habit takes, itemized. Every row the day has earned, in the order
 * the receipt prints them, each with the number it cost. The numbers are
 * grouped for the reader's locale, and so are the labels.
 */
export function receiptLines(hoursPerDay: number, locale: Locale): Array<ReceiptLine> {
  const format: Format = (value) => new Intl.NumberFormat(locale).format(Math.round(value));
  return RECEIPT.filter((entry) => hoursPerDay >= entry.minHours).map((entry) => ({
    key: entry.key,
    label: entry.label(locale),
    value: entry.value(hoursPerDay, format, locale),
  }));
}

/** The waking hours inside the screen years, unrounded: the receipt counts them. */
function exactHours(hoursPerDay: number): number {
  return screenYears(hoursPerDay) * DAYS_PER_YEAR * WAKING_HOURS;
}
