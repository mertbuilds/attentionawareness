import type { SiteId } from './sites.ts';

/**
 * Every word the extension's own pages show. English only for now: Paraglide
 * is not wired here, and one file is all a second language would need.
 */
export const strings = {
  add: 'Add rule',
  badDomain: 'That is not a domain.',
  brand: 'attention awareness',
  cssLabel: 'CSS',
  customCss: 'Custom CSS',
  customIntro: 'Your own rules. One block per site, applied on top of the built-in ones.',
  domainLabel: 'Domain',
  domainPlaceholder: 'reddit.com',
  enabledLabel: 'Rule on',
  master: 'Feeds hidden',
  remove: 'Remove',
  removeConfirm: 'Remove?',
  saved: 'Saved',
  website: 'attentionawareness.com',
} as const;

/** The lines that need a number or a name in them. */
export const sentences = {
  /** How the popup says there is more than the three sites in play. */
  customCount: (count: number) => (count === 1 ? '1 custom rule' : `${count} custom rules`),
  /** The browser asked, the reader said no, and the rule stays off. */
  denied: (domain: string) => `Brave did not grant access to ${domain}`,
};

/** Each site's name, and the one line of what goes with it. */
export const siteStrings: Readonly<Record<SiteId, { hides: string; name: string }>> = {
  instagram: { hides: 'Reels, Explore grid, suggestions', name: 'Instagram' },
  x: { hides: 'For you tab, trends', name: 'X' },
  youtube: { hides: 'Shorts everywhere', name: 'YouTube' },
};

/** The order the popup lists them in: loudest first. */
export const SITE_ORDER: ReadonlyArray<SiteId> = ['x', 'youtube', 'instagram'];
