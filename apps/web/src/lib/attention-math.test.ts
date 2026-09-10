import { describe, expect, it } from 'vitest';
import {
  formatHours,
  formatYears,
  HORIZON_YEARS,
  screenHours,
  yearFill,
} from './attention-math.ts';

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

describe('yearFill', () => {
  it('fills every year the total passes and nothing after it', () => {
    expect(yearFill(4, 0)).toBe(100);
    expect(yearFill(4, 4)).toBe(100);
    expect(yearFill(4, 5)).toBe(0);
    expect(yearFill(4, HORIZON_YEARS - 1)).toBe(0);
  });

  it('fills the year the total lands in part of the way', () => {
    expect(yearFill(3, 3)).toBe(75);
    expect(yearFill(6, 7)).toBe(50);
  });
});
