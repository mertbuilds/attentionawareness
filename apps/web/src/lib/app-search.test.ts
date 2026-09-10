import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppSearchError,
  defaultStorefront,
  flagEmoji,
  lookupApps,
  searchApps,
  shortAppName,
  storefrontLabel,
  storefronts,
} from './app-search.ts';

const instagram = {
  artistName: 'Instagram, Inc.',
  artworkUrl100: 'https://is1.mzstatic.com/image/100x100.jpg',
  artworkUrl60: 'https://is1.mzstatic.com/image/60x60.jpg',
  bundleId: 'com.burbn.instagram',
  sellerUrl: 'http://instagram.com/',
  trackId: 389_801_252,
  trackName: 'Instagram',
};

function fetchStub(body: unknown, status = 200) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
}

function requestedUrl(fetchImpl: ReturnType<typeof fetchStub>): URL {
  return new URL(String(fetchImpl.mock.calls[0]?.[0]));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchApps', () => {
  it('builds the iTunes search URL from the term, country and limit', async () => {
    const fetchImpl = fetchStub({ resultCount: 0, results: [] });
    await searchApps('  flappy bird & co  ', { country: 'de', fetchImpl });

    const url = requestedUrl(fetchImpl);
    expect(`${url.origin}${url.pathname}`).toBe('https://itunes.apple.com/search');
    expect(url.searchParams.get('term')).toBe('flappy bird & co');
    expect(url.search).not.toContain(' ');
    expect(url.searchParams.get('country')).toBe('de');
    expect(url.searchParams.get('entity')).toBe('software');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('clamps the limit to 25', async () => {
    const fetchImpl = fetchStub({ resultCount: 0, results: [] });
    await searchApps('instagram', { fetchImpl, limit: 100 });

    expect(requestedUrl(fetchImpl).searchParams.get('limit')).toBe('25');
  });

  it('falls back to the locale storefront when no country is given', async () => {
    vi.stubGlobal('navigator', { language: 'tr-TR' });
    const fetchImpl = fetchStub({ resultCount: 0, results: [] });
    await searchApps('instagram', { fetchImpl });

    expect(requestedUrl(fetchImpl).searchParams.get('country')).toBe('tr');
  });

  it('maps results to the fields the picker needs', async () => {
    const fetchImpl = fetchStub({ resultCount: 1, results: [instagram] });

    expect(await searchApps('instagram', { fetchImpl })).toEqual([
      {
        bundleId: 'com.burbn.instagram',
        developer: 'Instagram, Inc.',
        iconUrl: 'https://is1.mzstatic.com/image/100x100.jpg',
        id: 389_801_252,
        name: 'Instagram',
        sellerUrl: 'http://instagram.com/',
      },
    ]);
  });

  it('has no seller url when Apple sends none', async () => {
    const fetchImpl = fetchStub({
      resultCount: 1,
      results: [{ ...instagram, sellerUrl: undefined }],
    });

    const results = await searchApps('instagram', { fetchImpl });
    expect(results[0]?.sellerUrl).toBeUndefined();
  });

  it('drops results without a bundle id', async () => {
    const fetchImpl = fetchStub({
      resultCount: 2,
      results: [{ artistName: 'Nobody', trackId: 1, trackName: 'No bundle' }, instagram],
    });

    const results = await searchApps('instagram', { fetchImpl });
    expect(results).toHaveLength(1);
    expect(results[0]?.bundleId).toBe('com.burbn.instagram');
  });

  it('returns nothing for an empty term without calling the API', async () => {
    const fetchImpl = fetchStub({ resultCount: 0, results: [] });

    expect(await searchApps('   ', { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws AppSearchError carrying the status on a failed request', async () => {
    const fetchImpl = fetchStub({}, 500);

    const error = await searchApps('instagram', { fetchImpl }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(AppSearchError);
    expect(error).toMatchObject({ name: 'AppSearchError', status: 500 });
  });

  it('forwards the abort signal so stale searches can be cancelled', async () => {
    const controller = new AbortController();
    const fetchImpl = fetchStub({ resultCount: 0, results: [] });
    await searchApps('instagram', { fetchImpl, signal: controller.signal });

    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

describe('lookupApps', () => {
  it('asks for every bundle id in one storefront-scoped request', async () => {
    const fetchImpl = fetchStub({ resultCount: 0, results: [] });
    await lookupApps([' com.burbn.instagram ', 'com.reddit.Reddit', ''], {
      country: 'tr',
      fetchImpl,
    });

    const url = requestedUrl(fetchImpl);
    expect(`${url.origin}${url.pathname}`).toBe('https://itunes.apple.com/lookup');
    expect(url.searchParams.get('bundleId')).toBe('com.burbn.instagram,com.reddit.Reddit');
    expect(url.searchParams.get('country')).toBe('tr');
    expect(url.searchParams.get('entity')).toBe('software');
  });

  it('maps rows to the same shape as a search', async () => {
    const fetchImpl = fetchStub({ resultCount: 1, results: [instagram] });

    expect(await lookupApps(['com.burbn.instagram'], { fetchImpl })).toEqual([
      {
        bundleId: 'com.burbn.instagram',
        developer: 'Instagram, Inc.',
        iconUrl: 'https://is1.mzstatic.com/image/100x100.jpg',
        id: 389_801_252,
        name: 'Instagram',
        sellerUrl: 'http://instagram.com/',
      },
    ]);
  });

  it('returns nothing for an empty list without calling the API', async () => {
    const fetchImpl = fetchStub({ resultCount: 0, results: [] });

    expect(await lookupApps(['  '], { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws AppSearchError carrying the status on a failed request', async () => {
    const fetchImpl = fetchStub({}, 503);

    const error = await lookupApps(['com.burbn.instagram'], { fetchImpl }).catch(
      (error: unknown) => error,
    );
    expect(error).toMatchObject({ name: 'AppSearchError', status: 503 });
  });
});

describe('defaultStorefront', () => {
  it('takes the region from the browser locale', () => {
    vi.stubGlobal('navigator', { language: 'tr-TR' });
    expect(defaultStorefront()).toBe('tr');
  });

  it('falls back to the US store for a region-less locale', () => {
    vi.stubGlobal('navigator', { language: 'en' });
    expect(defaultStorefront()).toBe('us');
  });

  it('falls back to the US store when there is no navigator (SSR)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(defaultStorefront()).toBe('us');
  });
});

describe('flagEmoji', () => {
  it('turns an alpha-2 code into regional indicator symbols', () => {
    expect(flagEmoji('tr')).toBe('🇹🇷');
    expect(flagEmoji('us')).toBe('🇺🇸');
  });

  it('accepts any casing and surrounding space', () => {
    expect(flagEmoji(' DE ')).toBe('🇩🇪');
  });

  it('has no flag for anything that is not two letters', () => {
    expect(flagEmoji('')).toBe('');
    expect(flagEmoji('t')).toBe('');
    expect(flagEmoji('tur')).toBe('');
    expect(flagEmoji('t1')).toBe('');
    expect(flagEmoji('🇹🇷')).toBe('');
  });
});

describe('shortAppName', () => {
  it('drops the tagline after the separator', () => {
    expect(shortAppName('TikTok - Videos, Shop & LIVE')).toBe('TikTok');
    expect(shortAppName('Spotify: Music and Podcasts')).toBe('Spotify');
    expect(shortAppName('Adobe Scan: PDF & OCR Scanner')).toBe('Adobe Scan');
    expect(shortAppName('Threads – say more')).toBe('Threads');
    expect(shortAppName('Photos — edit & share')).toBe('Photos');
    expect(shortAppName('Slack | Work happens here')).toBe('Slack');
    expect(shortAppName('Arc · the browser')).toBe('Arc');
  });

  it('cuts at the first separator only', () => {
    expect(shortAppName('Booking.com: Hotels & Travel')).toBe('Booking.com');
    expect(shortAppName('Gmail - Email by Google: fast')).toBe('Gmail');
  });

  it('keeps a title that carries no tagline', () => {
    expect(shortAppName('X')).toBe('X');
    expect(shortAppName('  Instagram  ')).toBe('Instagram');
    expect(shortAppName('Yahoo! Mail')).toBe('Yahoo! Mail');
  });

  it('keeps a title with nothing after the separator', () => {
    expect(shortAppName('Notes: ')).toBe('Notes:');
    expect(shortAppName(': Notes')).toBe(': Notes');
  });
});

describe('storefronts', () => {
  it('offers every App Store country', () => {
    expect(storefronts.length).toBeGreaterThan(150);
    expect(storefronts.map((storefront) => storefront.code)).toContain('tr');
  });

  it('lists them by name', () => {
    const labels = storefronts.map((storefront) => storefront.label);
    expect([...labels].sort((left, right) => left.localeCompare(right, 'en'))).toEqual(labels);
  });
});

describe('storefrontLabel', () => {
  it('names a storefront in English', () => {
    expect(storefrontLabel('tr')).toBe('Türkiye');
    expect(storefrontLabel('us')).toBe('United States');
    expect(storefrontLabel(' GB ')).toBe('United Kingdom');
  });

  it('names Kosovo, which CLDR may not carry', () => {
    expect(storefrontLabel('xk')).toBe('Kosovo');
  });

  it('falls back to the code it cannot name', () => {
    expect(storefrontLabel('qq')).toBe('QQ');
    expect(storefrontLabel('nowhere')).toBe('NOWHERE');
  });
});
