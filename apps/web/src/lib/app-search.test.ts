import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSearchError, defaultStorefront, searchApps } from './app-search.ts';

const instagram = {
  artistName: 'Instagram, Inc.',
  artworkUrl100: 'https://is1.mzstatic.com/image/100x100.jpg',
  artworkUrl60: 'https://is1.mzstatic.com/image/60x60.jpg',
  bundleId: 'com.burbn.instagram',
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
      },
    ]);
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
