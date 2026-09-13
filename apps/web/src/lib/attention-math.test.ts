import { describe, expect, it } from 'vitest';
import {
  formatHours,
  formatYears,
  homeTruth,
  receiptLines,
  screenHours,
} from './attention-math.ts';
import type { ReceiptLine } from './attention-math.ts';

/** The receipt keyed by its rows, which is how the numbers are read off it. */
function values(lines: ReadonlyArray<ReceiptLine>): Record<string, string> {
  return Object.fromEntries(lines.map((line) => [line.key, line.value]));
}

describe('formatYears', () => {
  it('turns hours a day into years of the next twenty', () => {
    expect(formatYears(4)).toBe('5');
    expect(formatYears(6)).toBe('7.5');
  });

  it('keeps one decimal and drops it when it is a zero', () => {
    expect(formatYears(3)).toBe('3.8');
    expect(formatYears(8)).toBe('10');
  });
});

describe('screenHours', () => {
  it('counts the waking hours inside those years', () => {
    expect(screenHours(4)).toBe(29_200);
  });

  it('rounds to the nearest hundred', () => {
    expect(screenHours(0.5) % 100).toBe(0);
  });
});

describe('formatHours', () => {
  it('groups thousands the way the locale does', () => {
    expect(formatHours(4, 'en')).toBe('29,200');
    expect(formatHours(4, 'tr')).toBe('29.200');
  });
});

describe('homeTruth', () => {
  it('has one line for every stop on the dial, and it gets worse', () => {
    expect(homeTruth(1, 'en')).toBe(
      'One hour a day. That is 1.25 years. A year of your life, gone by 45.',
    );
    expect(homeTruth(12, 'en')).toBe(
      'Twelve hours. This is the whole waking day. There is nobody left to save.',
    );
  });

  it('speaks Turkish to a Turkish reader', () => {
    expect(homeTruth(11, 'tr')).toBe(
      'On bir saat. Sen telefonu kullanmıyorsun. O seni kullanıyor.',
    );
  });

  it('says nothing at an hour the dial cannot stop on', () => {
    expect(homeTruth(0, 'en')).toBe('');
    expect(homeTruth(13, 'en')).toBe('');
  });
});

describe('receiptLines', () => {
  it('adds a row for every threshold the day passes', () => {
    expect(receiptLines(1, 'en')).toHaveLength(2);
    expect(receiptLines(2, 'en')).toHaveLength(3);
    expect(receiptLines(3, 'en')).toHaveLength(4);
    expect(receiptLines(4, 'en')).toHaveLength(5);
  });

  it('prints the rows in the order the receipt rings them up', () => {
    expect(receiptLines(4, 'en').map((line) => line.key)).toEqual([
      'books',
      'dinners',
      'languages',
      'money',
      'job',
    ]);
  });

  it('leaves the waking years to the total, which is the only place they are', () => {
    expect(receiptLines(12, 'en').map((line) => line.key)).not.toContain('years');
  });

  it('counts what an hour a day comes to, and leaves the rest off the bill', () => {
    expect(values(receiptLines(1, 'en'))).toEqual({
      books: '913',
      money: '$146,000',
    });
  });

  it('counts what four hours a day comes to', () => {
    expect(values(receiptLines(4, 'en'))).toEqual({
      books: '3,650',
      dinners: '7,300',
      job: '15 y',
      languages: '19',
      money: '$584,000',
    });
  });

  it('bills the screen hours as the years of full-time work they would pay for', () => {
    expect(values(receiptLines(5, 'en')).job).toBe('18 y');
    expect(values(receiptLines(12, 'en')).job).toBe('44 y');
  });

  it('bills the same dinners at every length of day, because there are no more', () => {
    expect(values(receiptLines(2, 'en')).dinners).toBe('7,300');
    expect(values(receiptLines(12, 'en')).dinners).toBe('7,300');
  });

  it('groups the numbers the way the locale does', () => {
    expect(values(receiptLines(4, 'tr'))).toMatchObject({
      books: '3.650',
      money: '$584.000',
    });
  });

  it('labels the rows in the reader language', () => {
    expect(receiptLines(1, 'en')[0]?.label).toBe('Books unread');
    expect(receiptLines(1, 'tr')[0]?.label).toBe('Okunmayan kitap');
    expect(values(receiptLines(4, 'tr')).job).toBe('15 yıl');
  });
});
