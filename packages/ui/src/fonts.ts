/**
 * The Suisse Intl files `fonts.css` points at, as the URLs the build serves
 * them under, for the page head to preload. Vite resolves the CSS and this
 * glob to the same asset, so the preload is the one request the CSS then uses.
 * A glob rather than imports: the files are gitignored, and a checkout without
 * them builds with nothing to preload instead of failing.
 */
export const fontUrls: ReadonlyArray<string> = Object.values(
  import.meta.glob<string>('../fonts/*.woff2', { eager: true, import: 'default', query: '?url' }),
);
