/**
 * The pages folded into the home page in September 2026. The site is one page
 * now: the guides, the Mac page, the friend landing and the retired product
 * features all live on the home page or nowhere. Every path that used to be its
 * own is sent there, so a link shared before the fold still lands somewhere.
 */
const REMOVED_PATHS = new Set(['/friend', '/mac', '/supervise']);
/**
 * The old guides lived under one prefix, so the whole tree goes home together.
 * `/guide`, singular, is the page that replaced them and is not caught.
 */
const GUIDES_PREFIX = '/guides';

/**
 * A 301 to the home page for a path the site no longer answers on its own. The
 * files under `/mac/` (the Sparkle feed, `latest.json`, the dmgs) come from R2
 * through `macFileResponse`, so only the bare `/mac` page is caught.
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

/**
 * A 308 to the same path without its closing slash, query kept. The router
 * sends `/guide/` to `/guide` itself, but with a 307, which search engines
 * take as a move for now. The new address is built on the request's own
 * origin, so a path like `//other.example/` stays on this site.
 * `null` for `/` and for any path without a closing slash.
 */
export function trailingSlashRedirect(url: URL): Response | null {
  if (url.pathname.length < 2 || !url.pathname.endsWith('/')) {
    return null;
  }
  const target = new URL(url.toString());
  target.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return Response.redirect(target.toString(), 308);
}
