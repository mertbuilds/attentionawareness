import type { SiteId } from './sites.ts';

/**
 * Every word the extension's own pages show. English only for now: Paraglide
 * is not wired here, and one file is all a second language would need.
 */
export const strings = {
  brand: 'Attention Awareness',
  customCss: 'Custom CSS',
  master: 'Feeds hidden',
  website: 'attentionawareness.com',
} as const;

/** Each site's name, and the one line of what goes with it. */
export const siteStrings: Readonly<Record<SiteId, { hides: string; name: string }>> = {
  instagram: { hides: 'Reels, Explore, suggestions', name: 'Instagram' },
  tiktok: { hides: 'Everything', name: 'TikTok' },
  x: { hides: 'For you tab, trends, Grok', name: 'X' },
  youtube: { hides: 'Shorts everywhere', name: 'YouTube' },
};

/**
 * The order the popup lists them in: loudest first, and TikTok last because
 * its row is the one that says everything.
 */
export const SITE_ORDER: ReadonlyArray<SiteId> = ['x', 'youtube', 'instagram', 'tiktok'];
