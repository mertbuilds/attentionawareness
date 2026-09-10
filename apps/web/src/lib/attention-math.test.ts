import { describe, expect, it } from 'vitest';
import { formatHours, formatYears, ledgerItems, screenHours } from './attention-math.ts';

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

describe('ledgerItems', () => {
  it('adds a line for every threshold the day passes', () => {
    expect(ledgerItems(1, 'en')).toHaveLength(2);
    expect(ledgerItems(4, 'en')).toHaveLength(5);
    expect(ledgerItems(8, 'en')).toHaveLength(8);
  });

  it('counts the books and the money the hours were worth', () => {
    const items = ledgerItems(4, 'en');
    expect(items.map((item) => item.key)).toEqual(['books', 'dinners', 'body', 'career', 'money']);
    expect(items[0]?.number).toBe('4,867');
    expect(items.at(-1)?.number).toBe('$584,000');
  });

  it('groups the numbers the way the locale does', () => {
    expect(ledgerItems(4, 'tr')[0]?.number).toBe('4.867');
  });

  it('leaves the lines that carry no number without one', () => {
    expect(ledgerItems(2, 'en')[1]).toEqual({
      key: 'dinners',
      text: 'every dinner with the people you love, for 20 years',
    });
  });
});
