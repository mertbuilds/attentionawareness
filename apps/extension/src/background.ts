import { originPatterns } from './lib/domain.ts';
import { customDomains, desiredMatches } from './lib/registration.ts';
import { getSettings } from './lib/storage.ts';

/**
 * The one dynamic registration. Every custom host is a match inside it, so
 * there is a single thing to create, update and drop, and no bookkeeping of
 * which id belonged to which rule.
 */
const REGISTRATION_ID = 'aa-custom';

/**
 * The service worker exists for this one call. The four sites are static
 * matches in the manifest; a custom rule for anything else needs the content
 * script registered for its origin, and only a worker can do that.
 */
chrome.runtime.onInstalled.addListener(reconcile);
chrome.runtime.onStartup.addListener(reconcile);
// A rule saved before its permission was granted has nothing registered for
// it. The grant is the moment that changes, and it fires no storage change.
chrome.permissions.onAdded.addListener(reconcile);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && Object.hasOwn(changes, 'custom')) {
    reconcile();
  }
});

/**
 * Runs are serialised: two overlapping ones would both find no registration
 * and both create it, and the second would throw on the duplicate id. A run
 * that fails leaves this promise rejected, which the worker's console reports
 * as an unhandled rejection and the next run clears.
 */
let pending: Promise<void> = Promise.resolve();

function reconcile(): void {
  pending = pending.then(run, run);
}

async function run(): Promise<void> {
  const settings = await getSettings();

  // Permission is asked for on the options page, inside the gesture that
  // saved the rule. What is held by now is what the reader granted, and a
  // domain they refused is simply not registered.
  const held = await Promise.all(
    customDomains(settings).map(async (domain) => {
      const origins = originPatterns(domain);
      return (await chrome.permissions.contains({ origins })) ? origins : [];
    }),
  );
  const matches = desiredMatches(settings, held.flat());
  const [existing] = await chrome.scripting.getRegisteredContentScripts({ ids: [REGISTRATION_ID] });

  if (matches.length === 0) {
    if (existing !== undefined) {
      await chrome.scripting.unregisterContentScripts({ ids: [REGISTRATION_ID] });
    }
    return;
  }

  const script: chrome.scripting.RegisteredContentScript = {
    id: REGISTRATION_ID,
    js: ['content.js'],
    matches,
    // The registration outlives the worker, which Chromium stops whenever it
    // likes. Without this, custom hosts would work until the first idle.
    persistAcrossSessions: true,
    runAt: 'document_start',
  };
  await (existing === undefined
    ? chrome.scripting.registerContentScripts([script])
    : chrome.scripting.updateContentScripts([script]));
}
