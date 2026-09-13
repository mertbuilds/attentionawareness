import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppResult } from './app-search.ts';

// The App Store is the one thing a scan reaches out to, and only for names the
// local table has never heard of.
const store = vi.hoisted(() => ({
  lookupApps: vi.fn(),
  searchApps: vi.fn(),
}));
vi.mock(import('./app-search.ts'), async (importOriginal) => ({
  ...(await importOriginal()),
  lookupApps: store.lookupApps,
  searchApps: store.searchApps,
}));

const { keepByDefault, knownApp, matchApps, mergeBlockedApps } = await import('./known-apps.ts');

/** One row as Apple answers a search or a lookup with it. */
function result(name: string, bundleId: string): AppResult {
  return {
    bundleId,
    developer: 'Example, Inc.',
    iconUrl: `https://example.test/${bundleId}.png`,
    id: 1,
    name,
    sellerUrl: 'https://example.com',
  };
}

describe('knownApp', () => {
  it('names an app the table carries, however it was written', () => {
    expect(knownApp('instagram')).toEqual({
      bundleId: 'com.burbn.instagram',
      name: 'Instagram',
      system: false,
    });
    expect(knownApp('Tik Tok')?.bundleId).toBe('com.zhiliaoapp.musically');
  });

  it('flags an Apple built-in, which has no id to block', () => {
    expect(knownApp('Safari')).toEqual({ name: 'Safari', system: true });
    expect(knownApp('Messages')?.bundleId).toBeUndefined();
  });

  it('knows nothing about an app that is not in the table', () => {
    expect(knownApp('Duolingo')).toBeUndefined();
  });
});

describe('keepByDefault', () => {
  it('holds the apps a day actually needs', () => {
    expect(keepByDefault('WhatsApp')).toBe(true);
    expect(keepByDefault('telegram')).toBe(true);
    expect(keepByDefault('Instagram')).toBe(false);
  });
});

describe('matchApps', () => {
  beforeEach(() => {
    store.lookupApps.mockReset();
    store.searchApps.mockReset();
    store.lookupApps.mockResolvedValue([]);
    store.searchApps.mockResolvedValue([]);
  });

  it('answers from the table, and asks the App Store for nothing it holds', async () => {
    const matches = await matchApps(['Instagram', 'Safari'], { country: 'tr' });

    expect(matches).toEqual([
      {
        app: { bundleId: 'com.burbn.instagram', iconUrl: '', name: 'Instagram' },
        name: 'Instagram',
        status: 'found',
      },
      { name: 'Safari', status: 'system' },
    ]);
    expect(store.searchApps).not.toHaveBeenCalled();
  });

  it('gives the table hits the artwork Apple has for them', async () => {
    store.lookupApps.mockResolvedValue([result('Instagram', 'com.burbn.instagram')]);

    const [match] = await matchApps(['Instagram'], { country: 'us' });

    expect(store.lookupApps).toHaveBeenCalledWith(['com.burbn.instagram'], { country: 'us' });
    expect(match?.app).toEqual({
      bundleId: 'com.burbn.instagram',
      iconUrl: 'https://example.test/com.burbn.instagram.png',
      name: 'Instagram',
      sellerUrl: 'https://example.com',
    });
  });

  it('searches the storefront for a name the table has never heard of', async () => {
    store.searchApps.mockResolvedValue([
      result('Duolingo - Language Lessons', 'com.duolingo.DuolingoMobile'),
    ]);

    const [match] = await matchApps(['Duolingo'], { country: 'de' });

    expect(store.searchApps).toHaveBeenCalledWith('Duolingo', { country: 'de', limit: 1 });
    expect(match).toEqual({
      app: {
        bundleId: 'com.duolingo.DuolingoMobile',
        iconUrl: 'https://example.test/com.duolingo.DuolingoMobile.png',
        name: 'Duolingo',
        sellerUrl: 'https://example.com',
      },
      name: 'Duolingo',
      status: 'found',
    });
  });

  it('leaves a name unknown when the search answers with nothing, or not at all', async () => {
    store.searchApps.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);

    const matches = await matchApps(['Fasting', 'Notion'], { country: 'us' });

    expect(matches).toEqual([
      { name: 'Fasting', status: 'unknown' },
      { name: 'Notion', status: 'unknown' },
    ]);
  });

  it('keeps the lookup off the App Store when the whole list is unknown', async () => {
    await matchApps(['Fasting'], { country: 'us' });
    expect(store.lookupApps).not.toHaveBeenCalled();
  });

  it('holds the searches to three at a time', async () => {
    let running = 0;
    let peak = 0;
    store.searchApps.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
      return [];
    });

    await matchApps(['one', 'two', 'three', 'four', 'five'], { country: 'us' });

    expect(peak).toBe(3);
  });
});

describe('mergeBlockedApps', () => {
  it('adds what is new and leaves what the reader already blocked', () => {
    const blocked = [{ bundleId: 'com.burbn.instagram', name: 'Instagram' }];
    const added = [
      { bundleId: 'com.burbn.instagram', name: 'Instagram, Inc.' },
      { bundleId: 'tv.twitch', name: 'Twitch' },
    ];

    expect(mergeBlockedApps(blocked, added)).toEqual([
      { bundleId: 'com.burbn.instagram', name: 'Instagram' },
      { bundleId: 'tv.twitch', name: 'Twitch' },
    ]);
  });

  it('lists an app once, however often it is added', () => {
    const merged = mergeBlockedApps(
      [],
      [
        { bundleId: 'tv.twitch', name: 'Twitch' },
        { bundleId: 'tv.twitch', name: 'Twitch' },
      ],
    );

    expect(merged).toHaveLength(1);
  });
});
