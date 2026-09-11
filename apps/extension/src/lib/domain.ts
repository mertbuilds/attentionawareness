/**
 * A host of ASCII labels with a dot in it. No IP addresses, no `localhost`, no
 * unicode: a custom rule is for a site, every site has a registrable domain,
 * and a pattern that is not one is a pattern that would silently match nothing.
 */
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;

/**
 * A domain as the extension stores it: lowercase, no scheme, no credentials,
 * no port, no path, no leading `*.`. Readers paste what the address bar gave
 * them, so a whole URL is taken apart rather than refused. Anything that is
 * not a host comes back null, and nothing is saved for it.
 */
export function normalizeDomain(input: string): string | null {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//u, '')
    .replace(/^[^/@]*@/u, '')
    .replace(/[/?#].*$/u, '')
    .replace(/:\d+$/u, '')
    .replace(/^\*\./u, '')
    .replace(/\.$/u, '');
  return HOST.test(host) ? host : null;
}

/**
 * The host permissions one domain needs: the domain, and everything under it.
 * Chromium reads `*.example.com` as covering `example.com` too, and both are
 * asked for anyway, because that pair is exactly what `matchesDomain` covers
 * and an implied permission is one that can stop being implied.
 */
export function originPatterns(domain: string): Array<string> {
  return [`*://*.${domain}/*`, `*://${domain}/*`];
}
