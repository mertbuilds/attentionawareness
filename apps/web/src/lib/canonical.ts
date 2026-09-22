/** The one host the site answers on. Everything else is sent here. */
const CANONICAL_ORIGIN = 'https://attentionawareness.com';
const WWW_HOST = 'www.attentionawareness.com';
/**
 * Other domains that point at this same Worker and are sent to the canonical
 * apex. `keepyourattention.com` is the name the product shipped under before
 * September 2026; `dikkatfarkindaligi.com` is the Turkish name. Each covers its
 * own subdomains, so `www.` rides along.
 */
const ALIAS_DOMAINS = ['keepyourattention.com', 'dikkatfarkindaligi.com'];

/**
 * The alias domains and the `www` host are custom domains on this same Worker,
 * so the move to the apex happens here rather than in DNS. The path and the
 * query ride along: an old link keeps pointing at the page it always did.
 */
export function canonicalRedirect(url: URL): Response | null {
  const host = url.hostname;
  const isAlias = ALIAS_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!isAlias && host !== WWW_HOST) {
    return null;
  }
  return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
}
