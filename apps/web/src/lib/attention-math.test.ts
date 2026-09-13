import { describe, expect, it } from 'vitest';
import { formatYears, heroMetrics, homeTruth, screenHours } from './attention-math.ts';
import type { HeroMetric } from './attention-math.ts';

/** Each item of the row as the reader reads it: the words with the figure in. */
function sentences(items: ReadonlyArray<HeroMetric>): Array<string> {
  return items.map((item) => `${item.before}${item.value}${item.after}`);
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

describe('homeTruth', () => {
  it('has one line for every stop on the dial, and it gets worse', () => {
    expect(homeTruth(1, 'en')).toBe(
      'One hour. 1.25 years of the next twenty. Maps, messages, a bank, a book. A phone doing its job.',
    );
    expect(homeTruth(12, 'en')).toBe(
      'Twelve hours. 15 years. Three quarters of your waking day. This is serious.',
    );
  });

  it('speaks Turkish to a Turkish reader', () => {
    expect(homeTruth(11, 'tr')).toBe(
      'On bir saat. 13,75 yıl. Sen telefonu kullanmıyorsun. O seni kullanıyor.',
    );
  });

  it('says nothing at an hour the dial cannot stop on', () => {
    expect(homeTruth(0, 'en')).toBe('');
    expect(homeTruth(13, 'en')).toBe('');
  });
});

describe('heroMetrics', () => {
  it('counts a long day in books, money and the job it would have been', () => {
    expect(sentences(heroMetrics(6, 'en'))).toEqual([
      '5,475 books unread',
      '$876,000 of unpaid work',
      '22 years of a full-time job',
    ]);
  });

  it('counts a day too short to be a job in the dinners it went through', () => {
    expect(sentences(heroMetrics(3, 'en'))).toEqual([
      '2,738 books unread',
      '$438,000 of unpaid work',
      '7,300 dinners missed',
    ]);
  });

  it('bills a full-time job from four hours a day, and not under it', () => {
    expect(heroMetrics(3, 'en').map((item) => item.key)).toEqual(['books', 'money', 'dinners']);
    expect(heroMetrics(4, 'en').map((item) => item.key)).toEqual(['books', 'money', 'job']);
    expect(sentences(heroMetrics(4, 'en')).at(-1)).toBe('15 years of a full-time job');
  });

  it('keeps the same dinners at every length of day, because there are no more', () => {
    expect(sentences(heroMetrics(1, 'en')).at(-1)).toBe('7,300 dinners missed');
    expect(sentences(heroMetrics(3, 'en')).at(-1)).toBe('7,300 dinners missed');
  });

  it('sets the figure apart from the words it is said in', () => {
    expect(heroMetrics(6, 'en')).toEqual([
      { after: ' books unread', before: '', key: 'books', value: '5,475' },
      { after: ' of unpaid work', before: '', key: 'money', value: '$876,000' },
      { after: ' years of a full-time job', before: '', key: 'job', value: '22' },
    ]);
  });

  it('groups the numbers and says the words the way the locale does', () => {
    expect(sentences(heroMetrics(6, 'tr'))).toEqual([
      '5.475 okunmamış kitap',
      '$876.000 değerinde ücretsiz mesai',
      '22 yıllık tam zamanlı iş',
    ]);
  });
});
