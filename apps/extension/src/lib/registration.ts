import { normalizeDomain, originPatterns } from './domain.ts';
import { siteFor } from './sites.ts';
import type { Settings } from './storage.ts';

/**
 * The domains a custom rule needs a content script registered for: every
 * enabled rule's, deduped and in a fixed order, minus the three the manifest
 * already covers. Those three are static matches; registering them a second
 * time would inject the script twice into the same page.
 */
export function customDomains(settings: Settings): Array<string> {
  const domains = new Set<string>();
  for (const rule of settings.custom) {
    const domain = rule.enabled ? normalizeDomain(rule.domain) : null;
    if (domain !== null && siteFor(domain) === null) {
      domains.add(domain);
    }
  }
  return [...domains].sort();
}

/**
 * The match patterns to register, given the origins the extension actually
 * holds. A domain whose origins were never granted is left out rather than
 * registered and refused: `registerContentScripts` rejects the whole call over
 * one match it has no permission for, which would take the granted ones with
 * it.
 *
 * The master switch is not read here. It decides what the content script
 * injects, not where it runs, so turning it off and back on costs no
 * re-registration and no second permission prompt.
 */
export function desiredMatches(settings: Settings, granted: ReadonlyArray<string>): Array<string> {
  const held = new Set(granted);
  return customDomains(settings)
    .map(originPatterns)
    .filter((origins) => origins.every((origin) => held.has(origin)))
    .flat();
}
