/**
 * The places on the home page that can be linked to, by the id each one has.
 * The page gives its sections these ids, and the header, the footer and the
 * other pages link to them by the same names, so a link and the place it goes
 * to cannot drift apart.
 */
export const SECTION = {
  /** The two ways to it, the app's download and the guide, both free. */
  download: 'download',
  /** The browser extension, the same idea on the computer. */
  extension: 'extension',
  faq: 'faq',
  proof: 'proof',
  story: 'story',
  /** Why everything is free and how to support the work. */
  support: 'support',
  /** How the Mac app works, and the download. */
  wayOut: 'way-out',
} as const;
