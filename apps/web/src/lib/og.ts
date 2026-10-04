import { SITE_URL } from './structured-data.ts';

/**
 * The share cards: one picture a page, rendered by `scripts/render-og.ts`
 * into `public/og/` and committed, since the licensed font they are set in
 * is not there when CI builds. A post's card is `og/blog/<slug>.png`.
 */

/** Every card is this size, the one a share card is laid out at. */
export const OG_SIZE = { height: 630, width: 1200 } as const;

/** Each page's card, by the page's path, as its file's name in `public/og/`. */
export const OG_PAGES = {
  '/': 'home',
  '/blog': 'blog',
  '/build': 'build',
  '/extension/privacy': 'extension-privacy',
  '/guide': 'guide',
  '/open': 'open',
} as const;

const BLOG_PREFIX = '/blog/';

/**
 * The card of the page at `path`, as its path on the site. A post is known by
 * its slug, one of `slugs`. A path with no card of its own, the 404 among
 * them, shows the home page's.
 */
export function ogImagePath(path: string, slugs: ReadonlyArray<string>): string {
  if (Object.hasOwn(OG_PAGES, path)) {
    return `/og/${OG_PAGES[path as keyof typeof OG_PAGES]}.png`;
  }
  const slug = path.startsWith(BLOG_PREFIX) ? path.slice(BLOG_PREFIX.length) : undefined;
  if (slug !== undefined && slugs.includes(slug)) {
    return `/og/blog/${slug}.png`;
  }
  return `/og/${OG_PAGES['/']}.png`;
}

/** The same card as an address on the site, which a share card needs. */
export function ogImage(path: string, slugs: ReadonlyArray<string>): string {
  return `${SITE_URL}${ogImagePath(path, slugs)}`;
}
