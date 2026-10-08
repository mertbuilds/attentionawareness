import { useSyncExternalStore } from 'react';
import { detectBrowser } from './browser.ts';
import type { Browser } from './browser.ts';

/** The parts of `navigator` that only some browsers have. */
interface BrowserNavigator {
  brave?: unknown;
  userAgent: string;
  userAgentData?: { brands?: ReadonlyArray<{ brand: string }> };
}

/** The colour Arc sets on the root of every page, a little after it loads. */
const ARC_PROPERTY = '--arc-palette-title';

/** The browser does not change under the page, so there is nothing to listen to. */
function subscribeNever(): () => void {
  return () => {};
}

function browser(): Browser | null {
  const nav: BrowserNavigator = navigator;
  return detectBrowser({
    arc: getComputedStyle(document.documentElement).getPropertyValue(ARC_PROPERTY) !== '',
    brands: nav.userAgentData?.brands?.map((entry) => entry.brand) ?? [],
    brave: nav.brave !== undefined,
    userAgent: nav.userAgent,
  });
}

function browserOnServer(): null {
  return null;
}

/**
 * Which of the extension's browsers the reader is in, or null. The server
 * cannot tell, so it and the first client render answer null, and the page
 * changes once it has come alive. Arc is caught only when its colours are
 * already on the page by then.
 */
export function useBrowser(): Browser | null {
  return useSyncExternalStore(subscribeNever, browser, browserOnServer);
}
