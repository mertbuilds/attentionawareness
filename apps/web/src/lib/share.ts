import { m } from '../paraglide/messages.js';
import { locales } from '../paraglide/runtime.js';
import { presets } from './profile/index.ts';

type Locale = (typeof locales)[number];

/** Where a shared link points. The generator lives at the root. */
export const SITE_URL = 'https://attentionawareness.com';
/** The page written for the people around the reader, not for the reader. */
const FRIEND_PATH = '/friend';

/** How many apps a share names before it only counts the rest. */
const NAMED_APPS = 3;

/** What the friend link carries a sender's name in: a first name, not a bio. */
export const FRIEND_NAME_MAX = 24;
/** Control and formatting characters, which a name in a heading has no use for. */
const NAME_JUNK = /\p{C}/gu;
/** Any run of blanks, so a pasted name arrives as one line of words. */
const BLANKS = /\s+/gu;

/** The slider's own range, so a tampered `h` lands somewhere it can render. */
const HOURS_MIN = 1;
const HOURS_MAX = 12;
/** What an older link's `m` is read against, now that the page has no minutes. */
const MINUTES_PER_HOUR = 60;

/** Anything a bundle id may be made of. Everything else is junk. */
const BUNDLE_ID_PATTERN = /^[a-z0-9.-]+$/iu;

const X_INTENT = 'https://x.com/intent/post?text=';
const WHATSAPP_INTENT = 'https://wa.me/?text=';
const LINKEDIN_INTENT = 'https://www.linkedin.com/sharing/share-offsite/?url=';

/**
 * Two-letter codes for the apps the generator recommends, so the common share
 * link stays short enough to read in a post. Anything else travels as its own
 * bundle id, which costs length but never drops an app.
 */
const BUNDLE_IDS_BY_CODE: Record<string, string> = {
  fb: 'com.facebook.Facebook',
  ig: 'com.burbn.instagram',
  li: 'com.linkedin.LinkedIn',
  nf: 'com.netflix.Netflix',
  pi: 'pinterest',
  pv: 'com.amazon.aiv.AIVApp',
  rd: 'com.reddit.Reddit',
  sc: 'com.toyopagroup.picaboo',
  th: 'com.burbn.barcelona',
  tt: 'com.zhiliaoapp.musically',
  tw: 'tv.twitch',
  x: 'com.atebits.Tweetie2',
  ym: 'com.google.ios.youtubemusic',
  yt: 'com.google.ios.youtube',
};

const CODES_BY_BUNDLE_ID: Record<string, string> = Object.fromEntries(
  Object.entries(BUNDLE_IDS_BY_CODE).map(([code, bundleId]) => [bundleId, code]),
);

/** The names the recommended list already knows, keyed by bundle id. */
const NAMES_BY_BUNDLE_ID: Record<string, string> = Object.fromEntries(
  presets.mert.blockedApps.map((app) => [app.bundleId, app.name]),
);

export type ShareState = {
  bundleIds: ReadonlyArray<string>;
  hours: number;
};

export type ShareTargets = {
  linkedin: string;
  whatsapp: string;
  x: string;
};

/**
 * The share state as query parameters: the day in whole hours, and the blocked
 * apps as codes where one exists. Commas stay literal: they are legal in a
 * query string, and a link a reader can parse is half the point of sharing one.
 */
export function encodeShare({ bundleIds, hours }: ShareState): string {
  const codes = bundleIds.map((bundleId) =>
    encodeURIComponent(CODES_BY_BUNDLE_ID[bundleId] ?? bundleId),
  );
  const parts = [`h=${encodeURIComponent(String(hours))}`];
  if (codes.length > 0) {
    parts.push(`a=${codes.join(',')}`);
  }
  return parts.join('&');
}

/**
 * The whole link to the page written for the people around the reader: the
 * same day and the same list, plus the sender's own name where they gave one,
 * so the page can open on it instead of on "someone".
 */
export function encodeFriendShare({
  name,
  ...state
}: ShareState & { name?: string | undefined }): string {
  const sender = friendName(name);
  const query = encodeShare(state);
  return `${SITE_URL}${FRIEND_PATH}?${sender === undefined ? query : `${query}&n=${encodeURIComponent(sender)}`}`;
}

/**
 * A sender's name as a page may print it: one line of words, no control
 * characters, and no longer than a first name. Everything a link can carry
 * that is not one of those reads as no name at all.
 */
export function friendName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const name = raw
    .replace(NAME_JUNK, ' ')
    .replace(BLANKS, ' ')
    .trim()
    .slice(0, FRIEND_NAME_MAX)
    .trim();
  return name === '' ? undefined : name;
}

/**
 * The inverse, reading a link nobody promised to keep intact: an unusable day
 * is no day at all, one longer than the slider is clamped onto its end, and an
 * entry that names neither a code nor a plausible bundle id is dropped. `m`
 * wins wherever a link carries both, because a link that carries it was
 * written when it was the precise one.
 */
export function decodeShare(search: string): { bundleIds: Array<string>; hours?: number } {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { bundleIds: [] };
  }

  const bundleIds: Array<string> = [];
  for (const entry of (params.get('a') ?? '').split(',')) {
    const code = entry.trim();
    const bundleId = BUNDLE_IDS_BY_CODE[code] ?? code;
    if (BUNDLE_ID_PATTERN.test(bundleId) && !bundleIds.includes(bundleId)) {
      bundleIds.push(bundleId);
    }
  }

  // A link written before the page dropped its minutes carries the whole day
  // in them. The slider has no stop between two hours, so it is rounded onto
  // the nearest one it does have.
  const exact = readNumber(params.get('m'));
  if (exact !== undefined) {
    return { bundleIds, hours: clampHours(exact / MINUTES_PER_HOUR) };
  }

  const hours = readNumber(params.get('h'));
  if (hours === undefined) {
    return { bundleIds };
  }
  return { bundleIds, hours: clampHours(hours) };
}

/** A whole hour the page can price, whatever the link asked for. */
function clampHours(value: number): number {
  return Math.min(Math.max(Math.round(value), HOURS_MIN), HOURS_MAX);
}

/** A parameter nobody promised to keep a number in. */
function readNumber(raw: string | null): number | undefined {
  const text = raw?.trim() ?? '';
  const value = Number(text);
  return text === '' || !Number.isFinite(value) ? undefined : value;
}

/**
 * The name one shared bundle id travels under. A link carries ids and nothing
 * else, so a name the recommended list does not know falls back to the last
 * label of the id, which reads well enough until an App Store lookup lands.
 */
export function sharedAppName(bundleId: string): string {
  return NAMES_BY_BUNDLE_ID[bundleId] ?? bundleId.split('.').at(-1) ?? bundleId;
}

/**
 * The apps a share names, and how many are left over: the card and the post
 * text both read the list this way, so they never disagree about the count.
 */
export function shareApps(appNames: ReadonlyArray<string>): { apps: string; rest: number } {
  const named = appNames.slice(0, NAMED_APPS);
  return { apps: named.join(', '), rest: appNames.length - named.length };
}

/** The post itself. Three apps or fewer are all listed; the rest are counted. */
export function shareText({
  appNames,
  locale,
  url,
  years,
}: {
  appNames: ReadonlyArray<string>;
  locale: Locale;
  url: string;
  years: string;
}): string {
  const { apps, rest } = shareApps(appNames);
  if (rest > 0) {
    return m.share_text_more({ apps, count: rest, url, years }, { locale });
  }
  return m.share_text_all({ apps, url, years }, { locale });
}

/**
 * Where each button sends the reader. LinkedIn takes no text of its own: it
 * reads the page it is handed, so it gets the url and nothing else.
 */
export function shareTargets(text: string, url: string): ShareTargets {
  return {
    linkedin: `${LINKEDIN_INTENT}${encodeURIComponent(url)}`,
    whatsapp: `${WHATSAPP_INTENT}${encodeURIComponent(text)}`,
    x: `${X_INTENT}${encodeURIComponent(text)}`,
  };
}
