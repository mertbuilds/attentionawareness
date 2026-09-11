/** The one host the site answers on. Everything else is sent here. */
const CANONICAL_ORIGIN = 'https://attentionawareness.com';
/** The name the product shipped under before September 2026. */
const OLD_DOMAIN = 'keepyourattention.com';
const WWW_HOST = 'www.attentionawareness.com';

/**
 * The old domain and the `www` host are custom domains on this same Worker, so
 * the move to the apex happens here rather than in DNS. The path and the query
 * ride along: an old link keeps pointing at the page it always did.
 */
export function canonicalRedirect(url: URL): Response | null {
  const host = url.hostname;
  const isOld = host === OLD_DOMAIN || host.endsWith(`.${OLD_DOMAIN}`);
  if (!isOld && host !== WWW_HOST) {
    return null;
  }
  return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
}
