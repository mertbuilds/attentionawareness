/** A page is checked with the server on every load; the hashed files it names are kept. */
const DOCUMENT_CACHE = 'no-cache';

/**
 * A page with no cache rule of its own is told to be checked with the server
 * each time it is opened, so a browser never reuses one from an older build
 * that names files a later build has replaced.
 */
export function withDocumentCache(response: Response): Response {
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('text/html') || response.headers.has('cache-control')) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('cache-control', DOCUMENT_CACHE);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * A build's hashed files are served before the Worker is asked, so one under
 * `/assets/` that reaches it is not there: the name of a build that has been
 * replaced. It is answered as missing, at once, instead of with a page.
 */
export function missingAssetResponse(url: URL): Response | null {
  if (!url.pathname.startsWith('/assets/')) {
    return null;
  }
  return new Response(null, { headers: { 'cache-control': 'no-store' }, status: 404 });
}
