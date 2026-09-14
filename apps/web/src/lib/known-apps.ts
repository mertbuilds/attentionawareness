import { lookupApps, searchApps, shortAppName } from './app-search.ts';
import type { BlockedApp } from './profile/index.ts';

/** One app a scanned screenshot line turned into, with its artwork if Apple answered for it. */
export type ScannedApp = {
  bundleId: string;
  iconUrl: string;
  name: string;
  sellerUrl?: string | undefined;
};

/**
 * What one scanned line ended as: an app that can be hidden, one of Apple's
 * own that cannot, or a name nothing was found for.
 */
export type ScanMatch = {
  app?: ScannedApp | undefined;
  name: string;
  status: 'found' | 'system' | 'unknown';
};

/** An app this table names, and the id it is blocked by. Apple's own carry none. */
export type KnownApp = {
  bundleId?: string | undefined;
  name: string;
  system: boolean;
};

type MatchOptions = {
  country: string;
  signal?: AbortSignal | undefined;
};

/**
 * How many App Store searches one scan runs at a time. A screenshot lists at
 * most eight apps and Apple answers an unauthenticated endpoint, so the cap is
 * about being a good citizen rather than about throughput.
 */
const SEARCH_CONCURRENCY = 3;

/**
 * Apple's own apps. They have no App Store entry, and `blockedAppBundleIDs`
 * does not hide them, so a scan never proposes blocking one: Safari is the
 * web filter's job, and the phone has to keep answering calls.
 */
const SYSTEM_APPS: ReadonlyArray<string> = [
  'Safari',
  'Messages',
  'Mail',
  'Phone',
  'Settings',
  'Maps',
  'Photos',
  'Camera',
  'Clock',
  'Calendar',
];

/**
 * The apps a Screen Time list is usually topped by, and every app the
 * recommended profile blocks. A hit here costs no App Store request, and it
 * names the app the way the profile does; everything else is searched for.
 */
const STORE_APPS: Readonly<Record<string, string>> = {
  Discord: 'com.hammerandchisel.discord',
  Facebook: 'com.facebook.Facebook',
  Instagram: 'com.burbn.instagram',
  LinkedIn: 'com.linkedin.LinkedIn',
  Messenger: 'com.facebook.Messenger',
  Pinterest: 'pinterest',
  Reddit: 'com.reddit.Reddit',
  Snapchat: 'com.toyopagroup.picaboo',
  Telegram: 'ph.telegra.Telegraph',
  Threads: 'com.burbn.barcelona',
  TikTok: 'com.zhiliaoapp.musically',
  Twitch: 'tv.twitch',
  Twitter: 'com.atebits.Tweetie2',
  WhatsApp: 'net.whatsapp.WhatsApp',
  X: 'com.atebits.Tweetie2',
  YouTube: 'com.google.ios.youtube',
};

/**
 * Apps a scan lists but leaves unticked: the ones a day actually needs. The
 * reader can still tick them, and the Apple ones among them are `system`
 * anyway, which the picker says more plainly.
 */
const KEEP_APPS: ReadonlyArray<string> = [
  'WhatsApp',
  'Messages',
  'Telegram',
  'Mail',
  'Maps',
  'Phone',
];

/** Diacritics, so `Gösteri` and `Gosteri` are one key. */
const COMBINING_MARKS = /\p{M}+/gu;
/** Everything that is not a letter or a digit: spaces, dots, ampersands. */
const NOT_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;
/** The dotless Turkish i, which decomposes to nothing of its own. */
const DOTLESS_I = /ı/gu;

/**
 * One name as a lookup key: no case, no diacritics, no punctuation. It is what
 * makes "TikTok", "tiktok" and "Tik Tok" the same app.
 */
export function foldName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(DOTLESS_I, 'i')
    .toLowerCase()
    .replace(NOT_ALPHANUMERIC, '');
}

const SYSTEM_KEYS = new Map(SYSTEM_APPS.map((name) => [foldName(name), name]));
const STORE_KEYS = new Map(
  Object.entries(STORE_APPS).map(([name, bundleId]) => [foldName(name), { bundleId, name }]),
);
const KEEP_KEYS = new Set(KEEP_APPS.map((name) => foldName(name)));

/** Every app this table names, which is also what the OCR fuzz map is built from. */
export const knownAppNames: ReadonlyArray<string> = [...Object.keys(STORE_APPS), ...SYSTEM_APPS];

/** What this table knows about a name, or nothing when it has never heard of it. */
export function knownApp(name: string): KnownApp | undefined {
  const key = foldName(name);
  const system = SYSTEM_KEYS.get(key);
  if (system !== undefined) {
    return { name: system, system: true };
  }
  const store = STORE_KEYS.get(key);
  if (store === undefined) {
    return undefined;
  }
  return { bundleId: store.bundleId, name: store.name, system: false };
}

/** Whether an app is one the scan lists but does not tick for the reader. */
export function keepByDefault(name: string): boolean {
  return KEEP_KEYS.has(foldName(name));
}

/**
 * The apps behind the names a screenshot was read for, in the order they were
 * read. The local table answers first and costs nothing; every other name is
 * searched for in the reader's own storefront, a few at a time. A search that
 * fails leaves its name unknown, because half a list is still worth showing.
 */
export async function matchApps(
  names: ReadonlyArray<string>,
  options: MatchOptions,
): Promise<Array<ScanMatch>> {
  const matches: Array<ScanMatch> = names.map((name) => {
    const known = knownApp(name);
    if (known === undefined) {
      return { name, status: 'unknown' };
    }
    if (known.bundleId === undefined) {
      return { name: known.name, status: 'system' };
    }
    return {
      app: { bundleId: known.bundleId, iconUrl: '', name: known.name },
      name: known.name,
      status: 'found',
    };
  });

  await Promise.all([fillArtwork(matches, options), searchTheRest(names, matches, options)]);
  return matches;
}

/**
 * The blocked list with the scanned apps folded into it: an id it already
 * carries stays as it is, so nothing the reader added by hand is overwritten
 * or listed twice.
 */
export function mergeBlockedApps(
  blocked: ReadonlyArray<BlockedApp>,
  added: ReadonlyArray<BlockedApp>,
): Array<BlockedApp> {
  const ids = new Set(blocked.map((app) => app.bundleId));
  const merged = [...blocked];
  for (const app of added) {
    if (ids.has(app.bundleId)) {
      continue;
    }
    ids.add(app.bundleId);
    merged.push(app);
  }
  return merged;
}

/**
 * What Apple's endpoints are asked for, carrying a signal only when the caller
 * gave one: the options they take hold no `undefined`.
 */
function request(options: MatchOptions): { country: string; signal?: AbortSignal } {
  return options.signal === undefined
    ? { country: options.country }
    : { country: options.country, signal: options.signal };
}

/**
 * Artwork for the table's own hits, which carry an id but no icon. One lookup
 * covers them all, and an answer that never comes only costs them their icon.
 */
async function fillArtwork(matches: Array<ScanMatch>, options: MatchOptions): Promise<void> {
  const ids = matches.flatMap((match) =>
    match.app !== undefined && match.app.iconUrl === '' ? [match.app.bundleId] : [],
  );
  if (ids.length === 0) {
    return;
  }
  let apps: Array<Awaited<ReturnType<typeof lookupApps>>[number]> = [];
  try {
    apps = await lookupApps(ids, request(options));
  } catch {
    return;
  }
  const byId = new Map(apps.map((app) => [app.bundleId, app]));
  for (const [index, match] of matches.entries()) {
    const app = match.app === undefined ? undefined : byId.get(match.app.bundleId);
    if (match.app === undefined || app === undefined) {
      continue;
    }
    matches[index] = {
      ...match,
      app: { ...match.app, iconUrl: app.iconUrl, sellerUrl: app.sellerUrl },
    };
  }
}

/** The names the table had never heard of, asked of the App Store a few at a time. */
async function searchTheRest(
  names: ReadonlyArray<string>,
  matches: Array<ScanMatch>,
  options: MatchOptions,
): Promise<void> {
  const queue = matches.flatMap((match, index) => (match.status === 'unknown' ? [index] : []));
  let next = 0;
  async function worker(): Promise<void> {
    while (next < queue.length) {
      const index = queue[next];
      next += 1;
      const term = index === undefined ? undefined : names[index];
      if (index === undefined || term === undefined) {
        return;
      }
      try {
        const [top] = await searchApps(term, { ...request(options), limit: 1 });
        if (top !== undefined) {
          matches[index] = {
            app: {
              bundleId: top.bundleId,
              iconUrl: top.iconUrl,
              name: shortAppName(top.name),
              sellerUrl: top.sellerUrl,
            },
            name: shortAppName(top.name),
            status: 'found',
          };
        }
      } catch {
        // A search that did not answer leaves the name unknown, which the
        // picker offers as something to look up by hand.
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(SEARCH_CONCURRENCY, queue.length) }, () => worker()),
  );
}
