import { matchesDomain } from './css.ts';

/** The sites the extension ships rules for. */
export type SiteId = 'instagram' | 'x' | 'youtube';

/**
 * One registrable domain each, subdomains included. `twitter.com` is X: the
 * old domain still resolves, and still serves the same timeline.
 */
const SITE_DOMAINS: ReadonlyArray<readonly [string, SiteId]> = [
  ['instagram.com', 'instagram'],
  ['twitter.com', 'x'],
  ['x.com', 'x'],
  ['youtube.com', 'youtube'],
];

/** Which site a host belongs to, or nothing when it belongs to none of them. */
export function siteFor(hostname: string): SiteId | null {
  for (const [domain, site] of SITE_DOMAINS) {
    if (matchesDomain(domain, hostname)) {
      return site;
    }
  }
  return null;
}
