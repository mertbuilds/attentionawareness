import { describe, expect, it } from 'vitest';
import { pickAppEntries, pickAppNames, pickDailyAverage } from './screen-time-ocr.ts';

/** An English Most Used list, as Tesseract reads one off an iPhone screenshot. */
const ENGLISH = `9:41
Screen Time
Daily Average
5h 12m
24% from last week
MOST USED
SHOW CATEGORIES
Instagram
2h 14m
YouTube
1h 3m
Safari
48m
WhatsApp
31m
X
22m
`;

/** The same screen in Turkish, with the letters OCR usually gets wrong. */
const TURKISH = `09:41
Ekran Süresi
Günlük Ortalama
5 sa 12 dk
EN ÇOK KULLANILAN
KATEGORİLERİ GÖSTER
lnstagram
2 sa 14 dk
YouTube
1 sa 3 dk
Safari
48 dk
WhatsApp
31 dk
`;

/** A narrow screenshot, where the duration sits on the name's own line. */
const ONE_LINE_ROWS = `MOST USED
Instagram 2h 14m
YouTube 1h 3m
Safari 48m
WhatsApp 31m
X 22m
`;

describe('pickAppNames', () => {
  it('reads the apps off an English list, worst first', () => {
    expect(pickAppNames(ENGLISH)).toEqual(['Instagram', 'YouTube', 'Safari', 'WhatsApp', 'X']);
  });

  it('reads a Turkish list, and drops its headings', () => {
    expect(pickAppNames(TURKISH)).toEqual(['Instagram', 'YouTube', 'Safari', 'WhatsApp']);
  });

  it('reads rows that carry their own duration', () => {
    expect(pickAppNames(ONE_LINE_ROWS)).toEqual([
      'Instagram',
      'YouTube',
      'Safari',
      'WhatsApp',
      'X',
    ]);
  });

  it('corrects the letters OCR confuses on apps it knows', () => {
    const text = ['lnstagram', 'T1kTok', 'VVhatsApp', 'Facebo0k', 'Redd1t'].join('\n');
    expect(pickAppNames(text)).toEqual(['Instagram', 'TikTok', 'WhatsApp', 'Facebook', 'Reddit']);
  });

  it('leaves an app it has never heard of as it was read', () => {
    expect(pickAppNames('Duolingo\n42m')).toEqual(['Duolingo']);
  });

  it('keeps a one-letter app it knows, and drops the rest of the noise', () => {
    expect(pickAppNames('X\n22m\nS\n4m\n...\n%')).toEqual(['X']);
  });

  it('lists an app once, however often the screenshot names it', () => {
    expect(pickAppNames('Instagram\n2h 14m\nlnstagram\n11m')).toEqual(['Instagram']);
  });

  it('stops at the eight apps the list opens with', () => {
    const text = [
      'Instagram',
      'YouTube',
      'Safari',
      'WhatsApp',
      'X',
      'Reddit',
      'TikTok',
      'Netflix',
      'Twitch',
      'Telegram',
    ].join('\n');
    expect(pickAppNames(text)).toHaveLength(8);
    expect(pickAppNames(text)).not.toContain('Telegram');
  });

  it('drops a wide row that ran two headings together', () => {
    const text = ['MOST USED SHOW CATEGORIES', 'Instagram', '2h 14m'].join('\n');
    expect(pickAppNames(text)).toEqual(['Instagram']);
  });

  it('drops the Turkish headings the same way', () => {
    const text = ['EN ÇOK KULLANILAN KATEGORİLERİ GÖSTER', 'Instagram', '2 sa 14 dk'].join('\n');
    expect(pickAppNames(text)).toEqual(['Instagram']);
  });

  it('drops a summary line that carries its own figure', () => {
    expect(pickAppNames('Daily Average 5h 12m\nInstagram\n2h 14m')).toEqual(['Instagram']);
  });

  it('takes nothing from a screen with no list on it', () => {
    expect(pickAppNames('Screen Time\nDaily Average\n5h 12m\nSHOW CATEGORIES')).toEqual([]);
  });
});

describe('pickAppEntries', () => {
  it('keeps the duration beside the app it belongs to', () => {
    expect(pickAppEntries(ENGLISH).slice(0, 2)).toEqual([
      { name: 'Instagram', time: '2h 14m' },
      { name: 'YouTube', time: '1h 3m' },
    ]);
  });

  it('keeps the duration a one-line row carries', () => {
    expect(pickAppEntries(ONE_LINE_ROWS).at(-1)).toEqual({ name: 'X', time: '22m' });
  });

  it('leaves a row with no duration without one', () => {
    expect(pickAppEntries('Duolingo')).toEqual([{ name: 'Duolingo' }]);
  });
});

describe('pickDailyAverage', () => {
  it('reads the average off the line under its label', () => {
    expect(pickDailyAverage(ENGLISH)).toEqual({ hours: 5, minutes: 12 });
  });

  it('reads the Turkish label and its units', () => {
    expect(pickDailyAverage(TURKISH)).toEqual({ hours: 5, minutes: 12 });
  });

  it('reads an average that shares the label line', () => {
    expect(pickDailyAverage('Daily Average 3h 7m')).toEqual({ hours: 3, minutes: 7 });
  });

  it('reads the clock form', () => {
    expect(pickDailyAverage('Daily Average\n5:12')).toEqual({ hours: 5, minutes: 12 });
  });

  it('reads a day that never reached an hour', () => {
    expect(pickDailyAverage('Daily Average\n48m')).toEqual({ hours: 0, minutes: 48 });
  });

  it('reads a whole number of hours', () => {
    expect(pickDailyAverage('Günlük Ortalama\n4 saat')).toEqual({ hours: 4, minutes: 0 });
  });

  it('answers nothing when no average is labelled', () => {
    expect(pickDailyAverage(ONE_LINE_ROWS)).toBeNull();
  });

  it('answers nothing when the label carries no time', () => {
    expect(pickDailyAverage('Daily Average\nMOST USED')).toBeNull();
  });
});
