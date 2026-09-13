import { describe, expect, it } from 'vitest';
import { formatYears, heroMetrics, homeTruth, screenHours } from './attention-math.ts';
import type { HeroMetric } from './attention-math.ts';

/** Each line of the list as the reader reads it: the words with the figure in. */
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
  it('has one sentence for every stop on the dial, and it gets worse', () => {
    expect(homeTruth(1, 'en')).toBe(
      'Maps, messages, a bank, a book. A phone doing its job. Nothing to fix.',
    );
    expect(homeTruth(12, 'en')).toBe('Three quarters of your waking day. This is serious.');
  });

  it('leaves the hours and the years to the total line above it', () => {
    expect(homeTruth(4, 'en')).toBe('More of your life scrolling than eating. This is bad.');
  });

  it('speaks Turkish to a Turkish reader', () => {
    expect(homeTruth(11, 'tr')).toBe('Sen telefonu kullanmıyorsun. O seni kullanıyor.');
  });

  it('says nothing at an hour the dial cannot stop on', () => {
    expect(homeTruth(0, 'en')).toBe('');
    expect(homeTruth(13, 'en')).toBe('');
  });
});

describe('heroMetrics', () => {
  it('counts the same hours in books, workouts, dinners and pay', () => {
    expect(sentences(heroMetrics(6, 'en'))).toEqual([
      'You could read 5,475 books.',
      'You could do 43,800 workouts.',
      'You could have 21,900 dinners.',
      'You could earn $876,000 at 20 dollars an hour.',
    ]);
  });

  it('counts a short day the same four ways as a long one', () => {
    expect(heroMetrics(1, 'en').map((item) => item.key)).toEqual([
      'books',
      'workouts',
      'dinners',
      'money',
    ]);
    expect(heroMetrics(12, 'en').map((item) => item.key)).toEqual([
      'books',
      'workouts',
      'dinners',
      'money',
    ]);
  });

  it('sets the figure apart from the words it is said in', () => {
    expect(heroMetrics(6, 'en')).toEqual([
      { after: ' books.', before: 'You could read ', key: 'books', value: '5,475' },
      { after: ' workouts.', before: 'You could do ', key: 'workouts', value: '43,800' },
      { after: ' dinners.', before: 'You could have ', key: 'dinners', value: '21,900' },
      {
        after: ' at 20 dollars an hour.',
        before: 'You could earn ',
        key: 'money',
        value: '$876,000',
      },
    ]);
  });

  it('groups the numbers and says the words the way the locale does', () => {
    expect(sentences(heroMetrics(6, 'tr'))).toEqual([
      '5.475 kitap okuyabilirdin.',
      '43.800 kez antrenman yapabilirdin.',
      '21.900 akşam yemeği yiyebilirdin.',
      'Saati 20 dolardan $876.000 kazanabilirdin.',
    ]);
  });
});
