/**
 * The pages folded into the home page in September 2026. The site is one page
 * now: the guides, the Mac page, the friend landing and the retired product
 * features all live on the home page or nowhere. Every path that used to be its
 * own is sent there, so a link shared before the fold still lands somewhere.
 */
const REMOVED_PATHS = new Set(['/build', '/friend', '/mac', '/supervise']);
/** The guides lived under one prefix, so the whole tree goes home together. */
const GUIDES_PREFIX = '/guides';

/**
 * A 301 to the home page for a path the site no longer answers on its own. The
 * static files under `/mac/` (the Sparkle feed and `latest.json`) are served by
 * the asset worker before this runs, so only the bare `/mac` page is caught.
 * `null` when the path is one the site still renders.
 */
export function removedPathRedirect(url: URL): Response | null {
  const path = url.pathname.replace(/\/+$/u, '') || '/';
  const removed =
    REMOVED_PATHS.has(path) || path === GUIDES_PREFIX || path.startsWith(`${GUIDES_PREFIX}/`);
  if (!removed) {
    return null;
  }
  return Response.redirect(new URL('/', url).toString(), 301);
}
