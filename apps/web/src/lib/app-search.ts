const SEARCH_URL = 'https://itunes.apple.com/search';
const LOOKUP_URL = 'https://itunes.apple.com/lookup';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const FALLBACK_STOREFRONT = 'us';

export type AppResult = {
  bundleId: string;
  developer: string;
  iconUrl: string;
  id: number;
  name: string;
};

type LookupOptions = {
  country?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

type SearchOptions = LookupOptions & {
  limit?: number;
};

/** What both `entity=software` endpoints answer with. */
type SoftwarePayload = { results?: Array<SoftwareResult> };

/** Shape of one `entity=software` row as returned by the iTunes APIs. */
type SoftwareResult = {
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  bundleId?: string;
  trackId?: number;
  trackName?: string;
};

/**
 * Thrown when the iTunes Search API answers with a non-2xx status. Carries the
 * status so callers can tell a rate limit from an outage. Identify it by
 * `name === 'AppSearchError'`, not `instanceof`.
 */
export class AppSearchError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`iTunes search failed with status ${status}`);
    this.name = 'AppSearchError';
    this.status = status;
  }
}

/**
 * App Store storefronts offered in the picker. Results are storefront-scoped:
 * an app missing from one country's store is absent from its results, so the
 * user picks the store they actually install from.
 */
export const storefronts: Array<{ code: string; label: string }> = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: 'tr', label: 'Türkiye' },
  { code: 'ar', label: 'Argentina' },
  { code: 'br', label: 'Brazil' },
  { code: 'in', label: 'India' },
  { code: 'jp', label: 'Japan' },
  { code: 'kr', label: 'South Korea' },
  { code: 'es', label: 'Spain' },
  { code: 'it', label: 'Italy' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'se', label: 'Sweden' },
  { code: 'ca', label: 'Canada' },
  { code: 'au', label: 'Australia' },
  { code: 'mx', label: 'Mexico' },
];

/**
 * Storefront to search first, derived from the browser locale region
 * (`tr-TR` gives `tr`). Region-less locales (`en`) and SSR, where there is no
 * navigator, fall back to the US store.
 */
export function defaultStorefront(): string {
  if (typeof navigator === 'undefined') {
    return FALLBACK_STOREFRONT;
  }
  try {
    const region = new Intl.Locale(navigator.language).region;
    return region ? region.toLowerCase() : FALLBACK_STOREFRONT;
  } catch {
    return FALLBACK_STOREFRONT;
  }
}

/**
 * Looks up App Store apps by name through Apple's public iTunes Search API,
 * which answers with `Access-Control-Allow-Origin: *` and needs no key, so the
 * browser calls it directly. Nothing is cached: the caller owns request
 * lifetime and passes a `signal` to cancel stale keystroke searches.
 */
export async function searchApps(term: string, options?: SearchOptions): Promise<Array<AppResult>> {
  const query = term.trim();
  if (query === '') {
    return [];
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set('term', query);
  url.searchParams.set('country', options?.country ?? defaultStorefront());
  url.searchParams.set('entity', 'software');
  url.searchParams.set('limit', String(clampLimit(options?.limit)));

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const response = await fetchImpl(url.toString(), { signal: options?.signal ?? null });
  if (!response.ok) {
    throw new AppSearchError(response.status);
  }

  return toAppResults((await response.json()) as SoftwarePayload);
}

/**
 * Reads apps the caller already knows the bundle ids of (the blocked list)
 * through Apple's lookup endpoint, which takes the whole set in one comma
 * separated `bundleId` parameter. Ids the storefront does not carry are simply
 * absent from the answer, so the caller decides what an unmatched id means.
 */
export async function lookupApps(
  bundleIds: ReadonlyArray<string>,
  options?: LookupOptions,
): Promise<Array<AppResult>> {
  const ids = bundleIds.map((bundleId) => bundleId.trim()).filter((bundleId) => bundleId !== '');
  if (ids.length === 0) {
    return [];
  }

  const url = new URL(LOOKUP_URL);
  url.searchParams.set('bundleId', ids.join(','));
  url.searchParams.set('country', options?.country ?? defaultStorefront());
  url.searchParams.set('entity', 'software');

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const response = await fetchImpl(url.toString(), { signal: options?.signal ?? null });
  if (!response.ok) {
    throw new AppSearchError(response.status);
  }

  return toAppResults((await response.json()) as SoftwarePayload);
}

/** A row without a bundle id identifies no app, so it is not a usable result. */
function toAppResults(payload: SoftwarePayload): Array<AppResult> {
  return (payload.results ?? []).flatMap((result) =>
    result.bundleId
      ? [
          {
            bundleId: result.bundleId,
            developer: result.artistName ?? '',
            iconUrl: result.artworkUrl100 ?? result.artworkUrl60 ?? '',
            id: result.trackId ?? 0,
            name: result.trackName ?? '',
          },
        ]
      : [],
  );
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}
