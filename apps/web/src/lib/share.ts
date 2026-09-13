import { m } from '../paraglide/messages.js';
import { locales } from '../paraglide/runtime.js';

type Locale = (typeof locales)[number];

/** Where a shared link points. The generator lives at the root. */
export const SITE_URL = 'https://attentionawareness.com';

/** How many apps a share names before it only counts the rest. */
const NAMED_APPS = 3;

/** The slider's own range, so a tampered `h` lands somewhere it can render. */
const HOURS_MIN = 1;
const HOURS_MAX = 12;
/** The longest day the minutes form can name: the same twelve hours of them. */
const MINUTES_MAX = 720;
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

export type ShareState = {
  bundleIds: ReadonlyArray<string>;
  hours: number;
  /** The minutes past the hour, where the reader answered with some. */
  minutes?: number | undefined;
};

export type ShareTargets = {
  linkedin: string;
  whatsapp: string;
  x: string;
};

/**
 * The share state as query parameters: the day, and the blocked apps as codes
 * where one exists. Commas stay literal: they are legal in a query string, and
 * a link a reader can parse is half the point of sharing one.
 *
 * A whole day travels as its hours. Anything finer travels as the minutes it
 * is, because the dial has no stop between two hours to round it onto.
 */
export function encodeShare({ bundleIds, hours, minutes }: ShareState): string {
  const codes = bundleIds.map((bundleId) =>
    encodeURIComponent(CODES_BY_BUNDLE_ID[bundleId] ?? bundleId),
  );
  const past = minutes ?? 0;
  const day =
    past > 0
      ? `m=${encodeURIComponent(String(hours * MINUTES_PER_HOUR + past))}`
      : `h=${encodeURIComponent(String(hours))}`;
  const parts = [day];
  if (codes.length > 0) {
    parts.push(`a=${codes.join(',')}`);
  }
  return parts.join('&');
}

/**
 * The inverse, reading a link nobody promised to keep intact: an unusable day
 * is no day at all, one longer than the dial is clamped onto its end, and an
 * entry that names neither a code nor a plausible bundle id is dropped. `m`
 * wins wherever a link carries both, because it is the precise one.
 */
export function decodeShare(search: string): {
  bundleIds: Array<string>;
  hours?: number;
  minutes?: number;
} {
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

  const exact = readNumber(params.get('m'));
  if (exact !== undefined) {
    const total = Math.min(Math.max(Math.round(exact), 0), MINUTES_MAX);
    return {
      bundleIds,
      hours: Math.floor(total / MINUTES_PER_HOUR),
      minutes: total % MINUTES_PER_HOUR,
    };
  }

  const hours = readNumber(params.get('h'));
  if (hours === undefined) {
    return { bundleIds };
  }
  return { bundleIds, hours: Math.min(Math.max(Math.round(hours), HOURS_MIN), HOURS_MAX) };
}

/** A parameter nobody promised to keep a number in. */
function readNumber(raw: string | null): number | undefined {
  const text = raw?.trim() ?? '';
  const value = Number(text);
  return text === '' || !Number.isFinite(value) ? undefined : value;
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
