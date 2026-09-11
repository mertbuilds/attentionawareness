import type { SiteId } from './sites.ts';
import type { Settings } from './storage.ts';

/**
 * Whether a custom rule's domain covers a host: the domain itself, or anything
 * under it. `reddit.com` takes `old.reddit.com`, and does not take
 * `notreddit.com`. A leading `*.` is allowed because that is how the pattern
 * reads in a manifest, and means the same thing here.
 */
export function matchesDomain(pattern: string, hostname: string): boolean {
  const domain = pattern.trim().toLowerCase().replace(/^\*\./u, '').replace(/\.$/u, '');
  const host = hostname.trim().toLowerCase().replace(/\.$/u, '');
  if (domain === '') {
    return false;
  }
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Everything that goes into the page's one style element: the site's own rule
 * file while that site is on, then every custom rule whose domain covers the
 * host. The master switch short-circuits both, which is what makes turning the
 * extension off the same code path as never having matched a site.
 */
export function buildCss({
  hostname,
  rules,
  settings,
  site,
}: {
  hostname: string;
  rules: Readonly<Record<SiteId, string>>;
  settings: Settings;
  site: SiteId | null;
}): string {
  if (!settings.enabled) {
    return '';
  }

  const parts: Array<string> = [];
  if (site !== null && settings.sites[site]) {
    parts.push(rules[site]);
  }
  for (const rule of settings.custom) {
    if (rule.enabled && matchesDomain(rule.domain, hostname)) {
      parts.push(rule.css);
    }
  }
  return parts.join('\n');
}
