/** The site's own address, which every shared link starts from. */
const SITE = 'https://attentionawareness.com/';

/**
 * Where on the site a link is shared from: the popup after a download, a
 * phone that sends it on to a Mac, or the thank-you after a support.
 */
export type SharePlacement = 'phone' | 'popup' | 'thanks';

/**
 * The site's address as a link shared from `placement` carries it, so a visit
 * from one is traced to where it was shared. `section` is the place on the
 * home page it opens at. Nothing else is ever put on it.
 */
export function shareUrl(placement: SharePlacement, section?: string): string {
  const url = new URL(SITE);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', placement);
  url.searchParams.set('utm_campaign', 'download');
  if (section !== undefined) {
    url.hash = section;
  }
  return url.href;
}

/**
 * What the system's share sheet is handed: the link and the site's name, and
 * no sentence. A sheet is free to join a sentence to the link, and one did:
 * a reader pasted one long address whose campaign held the sentence.
 */
export function shareSheet(url: string, title: string): { title: string; url: string } {
  return { title, url };
}
