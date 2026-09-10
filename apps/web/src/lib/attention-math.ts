import { m } from '../paraglide/messages.js';
import { locales } from '../paraglide/runtime.js';

type Locale = (typeof locales)[number];

/** Hours in a day a person is awake. The other eight are sleep. */
const WAKING_HOURS = 16;
const DAYS_PER_YEAR = 365;
/** The screen hours are an estimate, so they are shown to the nearest hundred. */
const HOURS_ROUNDING = 100;
/** How long one book takes to read: 80,000 words at 240 a minute. */
const HOURS_PER_BOOK = 6;
/** What the ledger pays the reader for the hours they gave away. */
const DOLLARS_PER_HOUR = 20;

/** How far ahead the page projects a daily habit. */
export const HORIZON_YEARS = 20;

/** One line of the ledger. The number, where there is one, leads the sentence. */
export type LedgerItem = { key: string; number?: string; text: string };

/** The grouped number a ledger line leads with. */
type Format = (value: number) => string;

type LedgerEntry = {
  key: string;
  /** The hours a day from which this line is part of the reader's bill. */
  minHours: number;
  number?: (totalHours: number, format: Format) => string;
  text: (locale: Locale) => string;
};

/**
 * The bill, mild first and brutal last. A line appears once the day is long
 * enough to earn it and stays for every longer day; the money is the last word
 * at any length, so it carries no threshold of its own.
 */
const LEDGER: ReadonlyArray<LedgerEntry> = [
  {
    key: 'books',
    minHours: 1,
    number: (totalHours, format) => format(totalHours / HOURS_PER_BOOK),
    text: (locale) => m.home_ledger_books({}, { locale }),
  },
  { key: 'dinners', minHours: 2, text: (locale) => m.home_ledger_dinners({}, { locale }) },
  { key: 'body', minHours: 3, text: (locale) => m.home_ledger_body({}, { locale }) },
  {
    key: 'career',
    minHours: 4,
    number: (totalHours, format) => format(totalHours),
    text: (locale) => m.home_ledger_career({}, { locale }),
  },
  { key: 'unstarted', minHours: 5, text: (locale) => m.home_ledger_unstarted({}, { locale }) },
  { key: 'kids', minHours: 6, text: (locale) => m.home_ledger_kids({}, { locale }) },
  { key: 'job', minHours: 8, text: (locale) => m.home_ledger_job({}, { locale }) },
  {
    key: 'money',
    minHours: 0,
    // One dollar sign in both locales: the reader is not being invoiced.
    number: (totalHours, format) => `$${format(totalHours * DOLLARS_PER_HOUR)}`,
    text: (locale) => m.home_ledger_money({}, { locale }),
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
 * What the habit takes, as sentences. Every line the day has earned, in the
 * order the page prints them, each with its own leading number where it has
 * one. The numbers are grouped for the reader's locale, and so is the text.
 */
export function ledgerItems(hoursPerDay: number, locale: Locale): Array<LedgerItem> {
  const totalHours = exactHours(hoursPerDay);
  const format: Format = (value) => new Intl.NumberFormat(locale).format(Math.round(value));
  return LEDGER.filter((entry) => hoursPerDay >= entry.minHours).map((entry) => {
    const text = entry.text(locale);
    if (entry.number === undefined) {
      return { key: entry.key, text };
    }
    return { key: entry.key, number: entry.number(totalHours, format), text };
  });
}

/** The waking hours inside the screen years, unrounded: the ledger counts them. */
function exactHours(hoursPerDay: number): number {
  return screenYears(hoursPerDay) * DAYS_PER_YEAR * WAKING_HOURS;
}
