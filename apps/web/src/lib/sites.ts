/** A scheme a url may already carry, e.g. `http://`. */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//iu;

/** Host prefixes that serve the same site as the bare domain. */
const HOST_PREFIX_PATTERN = /^(?:www|m|mobile)\./u;

/** A public domain name: dot separated labels, nothing else. */
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/u;

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/u;

/** Where the sites of one app came from, so the UI can say how sure it is. */
export type SiteSource = 'curated' | 'seller' | 'none';

/**
 * The sites that belong to an app, for the apps whose developer website does
 * not name them all: short links (t.co, youtu.be), alternate domains and the
 * mobile hosts. iOS's BuiltIn filter matches by host and covers a host's
 * subdomains, so an entry is one registrable domain, plus the mobile hosts
 * that are worth naming even though the domain already covers them, because
 * they are what a phone actually opens.
 */
export const curatedSites: Record<string, Array<string>> = {
  'AlexisBarreyat.BeReal': ['https://bereal.com'],
  'com.9gag.ios.mobile': ['https://9gag.com'],
  'com.amazon.aiv.AIVApp': ['https://primevideo.com'],
  'com.atebits.Tweetie2': ['https://x.com', 'https://twitter.com', 'https://t.co'],
  'com.burbn.barcelona': ['https://threads.net', 'https://threads.com'],
  'com.burbn.instagram': ['https://instagram.com'],
  'com.disney.disneyplus': ['https://disneyplus.com'],
  'com.facebook.Facebook': [
    'https://facebook.com',
    'https://fb.com',
    'https://m.facebook.com',
    'https://fb.watch',
  ],
  'com.facebook.Messenger': ['https://messenger.com'],
  'com.google.ios.youtube': ['https://youtube.com', 'https://m.youtube.com', 'https://youtu.be'],
  'com.google.ios.youtubekids': ['https://youtubekids.com'],
  'com.google.ios.youtubemusic': ['https://music.youtube.com'],
  'com.hammerandchisel.discord': ['https://discord.com', 'https://discord.gg'],
  'com.hulu.plus': ['https://hulu.com'],
  'com.kick.mobile': ['https://kick.com'],
  'com.linkedin.LinkedIn': ['https://linkedin.com'],
  'com.netflix.Netflix': ['https://netflix.com'],
  'com.reddit.Reddit': ['https://reddit.com', 'https://redd.it', 'https://old.reddit.com'],
  'com.toyopagroup.picaboo': ['https://snapchat.com'],
  'com.tumblr.tumblr': ['https://tumblr.com'],
  'com.zhiliaoapp.musically': ['https://tiktok.com', 'https://vm.tiktok.com'],
  imgurmobile: ['https://imgur.com'],
  pinterest: ['https://pinterest.com', 'https://pin.it'],
  'tv.twitch': ['https://twitch.tv'],
};

/**
 * The shape a url takes inside a profile: a scheme in front, no trailing
 * slash. `profile/build.ts` normalizes the same way but keeps its copy
 * private, so the curated urls are tested against both. A drift then shows up
 * as a failing test, not as a filter entry iOS quietly ignores.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '') {
    return '';
  }
  const withScheme = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.endsWith('/') ? withScheme.slice(0, -1) : withScheme;
}

/**
 * The blockable host behind an App Store developer website:
 * `https://www.reddit.com/mobile/download` is reddit.com. Path, query and the
 * `www.`, `m.` and `mobile.` prefixes all name the same site the bare domain
 * does. A value that names no public site (empty, malformed, localhost, a
 * bare IP) blocks nothing, so it is null.
 */
export function hostFromSellerUrl(url: string | undefined): string | null {
  const trimmed = url?.trim() ?? '';
  if (trimmed === '') {
    return null;
  }
  const withScheme = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  let hostname: string;
  try {
    hostname = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
  const host = hostname.replace(HOST_PREFIX_PATTERN, '');
  if (IPV4_PATTERN.test(host) || !HOST_PATTERN.test(host)) {
    return null;
  }
  return host;
}

/**
 * The sites one blocked app implies. A curated entry wins: it carries the
 * domains Apple's single `sellerUrl` cannot. Everything else falls back to
 * that seller url, which names the right site often enough to beat blocking
 * nothing, and says so through `source` so the UI can mark it as a guess.
 */
export function sitesForApp(
  bundleId: string,
  sellerUrl?: string,
): { sites: Array<string>; source: SiteSource } {
  const curated = Object.hasOwn(curatedSites, bundleId) ? curatedSites[bundleId] : undefined;
  if (curated !== undefined) {
    return { sites: [...curated], source: 'curated' };
  }
  const host = hostFromSellerUrl(sellerUrl);
  if (host === null) {
    return { sites: [], source: 'none' };
  }
  return { sites: [`https://${host}`], source: 'seller' };
}

/**
 * Every site the blocked apps imply, in the order the apps were picked,
 * normalized the way the profile writes them and listed once each.
 */
export function sitesForApps(
  apps: ReadonlyArray<{ bundleId: string; sellerUrl?: string | undefined }>,
): Array<string> {
  const sites = new Set<string>();
  for (const app of apps) {
    for (const site of sitesForApp(app.bundleId, app.sellerUrl).sites) {
      const url = normalizeUrl(site);
      if (url !== '') {
        sites.add(url);
      }
    }
  }
  return [...sites];
}
