import type { SiteId } from './sites.ts';
import instagram from '../rules/instagram.css?raw';
import tiktok from '../rules/tiktok.css?raw';
import x from '../rules/x.css?raw';
import youtube from '../rules/youtube.css?raw';

/**
 * The rule files, as strings in the bundle rather than files fetched at run
 * time. A fetch would race the first paint, which is the one moment that
 * matters, and a fetchable file would have to be web accessible, which hands
 * every page a way to ask whether the extension is installed.
 */
export const ruleCss: Readonly<Record<SiteId, string>> = { instagram, tiktok, x, youtube };
