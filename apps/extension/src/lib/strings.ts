import type { SiteId } from './sites.ts';

/**
 * Every word the extension's own pages show. English only for now: Paraglide
 * is not wired here, and one file is all a second language would need.
 */
export const strings = {
  add: 'Add a site',
  badDomain: 'That is not a domain.',
  brand: 'attention awareness',
  copyHint: 'Enter a site first',
  copyPrompt: 'Copy a prompt for your AI',
  copyPromptDone: 'Copied',
  cssFieldLabel: 'Your CSS',
  customCss: 'Custom CSS',
  customIntro:
    "Your own rules. One block per site, applied on top of the built-in ones. If you don't write CSS, copy a prompt for your AI and paste back what it gives you.",
  domainLabel: 'Domain',
  domainPlaceholder: 'reddit.com',
  enabledLabel: 'Rule on',
  master: 'Feeds hidden',
  remove: 'Remove',
  removeConfirm: 'Sure?',
  saved: 'Saved',
  website: 'attentionawareness.com',
} as const;

/** The lines that need a number or a name in them. */
export const sentences = {
  /** How the popup says there is more than the three sites in play. */
  customCount: (count: number) => (count === 1 ? '1 custom rule' : `${count} custom rules`),
  /** The browser asked, the reader said no, and the rule stays off. */
  denied: (domain: string) => `Brave did not grant access to ${domain}`,
  /** The brief the reader hands their own AI to get CSS back for a domain. */
  promptTemplate: (domain: string) =>
    `I use a browser extension that hides distracting feeds with CSS. Help me write a CSS rule for ${domain}.

Goal: hide the endless feed, recommendations, autoplay, and "for you" surfaces that pull me in. Keep the parts I open on purpose: search, messages, notifications, my profile, settings, and any single page or video I go to directly.

Rules for your answer:
- Output only CSS. No explanation, no code fences.
- Use display: none !important on the distracting containers.
- Target stable selectors: element roles, aria- attributes, data-testid, ids. Avoid hashed or random class names, they change.
- Prefer a few precise selectors over one broad one, so the useful parts survive.
- If the layout is ambiguous, ask me one or two short questions first (for example, keep the sidebar, keep Shorts), then give the CSS.

The domain is ${domain}.`,
};

/** Each site's name, and the one line of what goes with it. */
export const siteStrings: Readonly<Record<SiteId, { hides: string; name: string }>> = {
  instagram: { hides: 'Reels, Explore grid, suggestions', name: 'Instagram' },
  x: { hides: 'For you tab, trends', name: 'X' },
  youtube: { hides: 'Shorts everywhere', name: 'YouTube' },
};

/** The order the popup lists them in: loudest first. */
export const SITE_ORDER: ReadonlyArray<SiteId> = ['x', 'youtube', 'instagram'];
