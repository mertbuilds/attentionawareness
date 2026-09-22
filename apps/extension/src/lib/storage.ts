import type { SiteId } from './sites.ts';

/** One rule the reader wrote: CSS for every host a domain pattern covers. */
export type CustomRule = {
  css: string;
  domain: string;
  enabled: boolean;
  id: string;
};

/**
 * A new rule's id. It only has to stay distinct from the ids already in the
 * list: it names a row while it is being edited and keys nothing else.
 * `crypto.randomUUID` is missing on insecure origins, which an extension page
 * never is, and in engines older than this one is built for.
 */
export function newRuleId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Everything the extension keeps, all of it in `chrome.storage.sync`. */
export type Settings = {
  custom: Array<CustomRule>;
  enabled: boolean;
  sites: Record<SiteId, boolean>;
};

/** On, everywhere. Turning a thing off is the reader's decision to make. */
export const defaultSettings: Settings = {
  custom: [],
  enabled: true,
  sites: { instagram: true, x: true, youtube: true },
};

/**
 * Settings as they are actually stored, which is: whatever some version of
 * this extension wrote, on some device, at some point. Every key is checked
 * against the defaults on the way in, so a half-written or outgrown object
 * degrades to the default rather than to a broken page.
 */
export function mergeSettings(stored: Record<string, unknown> | undefined): Settings {
  const sites = { ...defaultSettings.sites };
  const storedSites = stored?.['sites'];
  if (isRecord(storedSites)) {
    for (const site of Object.keys(sites) as Array<SiteId>) {
      const value = storedSites[site];
      if (typeof value === 'boolean') {
        sites[site] = value;
      }
    }
  }

  const enabled = stored?.['enabled'];
  return {
    custom: toCustomRules(stored?.['custom']),
    enabled: typeof enabled === 'boolean' ? enabled : defaultSettings.enabled,
    sites,
  };
}

export async function getSettings(): Promise<Settings> {
  return mergeSettings(await chrome.storage.sync.get(null));
}

/**
 * Writes the keys given and leaves the rest alone. The keys are top level
 * rather than one settings object because `storage.sync` caps a single item at
 * 8KB, and custom CSS is the one thing here that can grow.
 */
export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

/**
 * Calls back with the whole of the settings whenever any part of them changes
 * anywhere: this window, another window, the options page, another device.
 * Returns the unsubscribe.
 */
export function onSettingsChange(callback: (settings: Settings) => void): () => void {
  const listener: chrome.storage.ChangeListener = (_changes, area) => {
    if (area !== 'sync') {
      return;
    }
    void getSettings().then(callback);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toCustomRules(value: unknown): Array<CustomRule> {
  return Array.isArray(value) ? value.filter(isCustomRule) : [];
}

function isCustomRule(value: unknown): value is CustomRule {
  return (
    isRecord(value) &&
    typeof value['css'] === 'string' &&
    typeof value['domain'] === 'string' &&
    typeof value['enabled'] === 'boolean' &&
    typeof value['id'] === 'string'
  );
}
