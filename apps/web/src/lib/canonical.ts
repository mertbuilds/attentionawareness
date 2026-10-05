/** The one host the site answers on. Everything else is sent here. */
const CANONICAL_ORIGIN = 'https://attentionawareness.com';
export const CANONICAL_HOST = 'attentionawareness.com';
const WWW_HOST = 'www.attentionawareness.com';
/**
 * Other domains that point at this same Worker and are sent to the canonical
 * apex. `keepyourattention.com` is the name the product shipped under before
 * September 2026; `dikkatfarkindaligi.com` is the Turkish name. Each covers its
 * own subdomains, so `www.` rides along.
 */
const ALIAS_DOMAINS = ['keepyourattention.com', 'dikkatfarkindaligi.com'];

/**
 * Whether a page or a request is on the live site, the only place analytics
 * run: never in dev, a local build, a LAN address or a Workers preview. `www`
 * and the old names serve no page, they move to the apex first.
 */
export function isLiveHost(hostname: string): boolean {
  return hostname === CANONICAL_HOST;
}

/**
 * The alias domains and the `www` host are custom domains on this same Worker,
 * so the move to the apex happens here rather than in DNS, and so does the move
 * from http to https. The path and the
 * query ride along: an old link keeps pointing at the page it always did.
 */
export function canonicalRedirect(url: URL): Response | null {
  const host = url.hostname;
  const isAlias = ALIAS_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  // The apex over plain http is a second copy of every page, and search
  // engines have listed it as one. A local server has another host and is left alone.
  const insecure = host === CANONICAL_HOST && url.protocol === 'http:';
  if (!isAlias && host !== WWW_HOST && !insecure) {
    return null;
  }
  return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
}
