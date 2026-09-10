const SEARCH_URL = 'https://itunes.apple.com/search';
const LOOKUP_URL = 'https://itunes.apple.com/lookup';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const FALLBACK_STOREFRONT = 'us';
/** Code point of 🇦, the regional indicator symbol the letter A maps to. */
const REGIONAL_INDICATOR_A = 127_462;
/** Code point of the ASCII letter A. */
const UPPERCASE_A = 65;
const ALPHA_2 = /^[a-z]{2}$/iu;
/** What the App Store puts between an app's name and its tagline. */
const NAME_SEPARATORS = [' - ', ' – ', ' — ', ': ', ' | ', ' · '];

export type AppResult = {
  bundleId: string;
  developer: string;
  iconUrl: string;
  id: number;
  name: string;
  /** Apple's developer website for the app, absent on rows that carry none. */
  sellerUrl?: string | undefined;
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
  sellerUrl?: string;
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
 * Every country the App Store ships to, as ISO 3166-1 alpha-2 codes. Results
 * are storefront-scoped: an app missing from one country's store is absent from
 * its results, so the user picks the store they actually install from.
 */
const STOREFRONT_CODES = `
  af al dz ao ai ag ar am au at az bs bh bb by be
  bz bj bm bt bo ba bw br vg bn bg bf kh cm ca cv
  ky td cl cn co cr ci hr cy cz dk dm do ec eg sv
  gq ee sz et fj fi fr ga gm ge de gh gr gd gt gw
  gy hn hk hu is in id iq ie il it jm jp jo kz ke
  kr xk kw kg la lv lb lr ly lt lu mo mg mw my mv
  ml mt mr mu mx fm md mn me ms ma mz mm na np nl
  nz ni ne ng mk no om pk pw pa pg py pe ph pl pt
  qa ro ru rw kn lc vc ws sa sn rs sc sl sg sk si
  sb za es lk sr se ch st tw tj tz th to tt tn tr
  tm tc ug ua ae gb us uy uz vu ve vn ye zm zw
`
  .trim()
  .split(/\s+/u);

/** Storefronts CLDR carries no region name for, or names differently. */
const STOREFRONT_NAMES: Record<string, string> = { xk: 'Kosovo' };

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * The English name of a storefront: `tr` is Türkiye. A code CLDR cannot name —
 * and anything that is not a region code at all — is its own label, uppercased,
 * so the picker never renders a blank row.
 */
export function storefrontLabel(code: string): string {
  const normalized = code.trim().toLowerCase();
  const known = STOREFRONT_NAMES[normalized];
  if (known !== undefined) {
    return known;
  }
  const upper = normalized.toUpperCase();
  try {
    return regionNames.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/** The storefronts as the picker lists them: named, and sorted by name. */
export const storefronts: Array<{ code: string; label: string }> = STOREFRONT_CODES.map((code) => ({
  code,
  label: storefrontLabel(code),
})).sort((left, right) => left.label.localeCompare(right.label, 'en'));

/**
 * An ISO 3166-1 alpha-2 country code as its flag emoji: `tr` is the pair of
 * regional indicator symbols fonts draw as 🇹🇷. Anything that is not two
 * letters names no country, so it gets no flag.
 */
export function flagEmoji(code: string): string {
  const letters = code.trim().toUpperCase();
  if (!ALPHA_2.test(letters)) {
    return '';
  }
  return String.fromCodePoint(
    letters.charCodeAt(0) - UPPERCASE_A + REGIONAL_INDICATOR_A,
    letters.charCodeAt(1) - UPPERCASE_A + REGIONAL_INDICATOR_A,
  );
}

/**
 * The name an app is known by, taken out of its App Store title: "TikTok -
 * Videos, Shop & LIVE" is TikTok. Apple's `trackName` carries a marketing
 * tagline after a separator, which no icon or list row has room for. A title
 * that only ends on a separator keeps it, so a name is never cut to nothing.
 */
export function shortAppName(trackName: string): string {
  const name = trackName.trim();
  let cut = -1;
  for (const separator of NAME_SEPARATORS) {
    const index = name.indexOf(separator);
    if (index <= 0 || name.slice(index + separator.length).trim() === '') {
      continue;
    }
    if (cut === -1 || index < cut) {
      cut = index;
    }
  }
  return cut === -1 ? name : name.slice(0, cut).trim();
}

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
            sellerUrl: result.sellerUrl,
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
