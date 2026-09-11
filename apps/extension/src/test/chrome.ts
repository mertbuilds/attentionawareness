import { vi } from 'vitest';

/**
 * Enough of the extension API to drive this package: one object for
 * `storage.sync`, one listener list, and the same read-everything,
 * write-a-patch shape the real one has. The calls the pages make out of a
 * click come back as spies, because what matters about them is that they were
 * made, and with what. `requestPermissions` grants by default; a test that
 * wants a refusal says `mockResolvedValue(false)`.
 */
export function mockChrome(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  const listeners = new Set<chrome.storage.ChangeListener>();
  const createTab = vi.fn(() => Promise.resolve());
  const openOptionsPage = vi.fn(() => Promise.resolve());
  const requestPermissions = vi.fn((_permissions: chrome.permissions.Permissions) =>
    Promise.resolve(true),
  );

  Object.assign(globalThis, {
    chrome: {
      permissions: { request: requestPermissions },
      runtime: { openOptionsPage },
      storage: {
        onChanged: {
          addListener: (listener: chrome.storage.ChangeListener) => {
            listeners.add(listener);
          },
          removeListener: (listener: chrome.storage.ChangeListener) => {
            listeners.delete(listener);
          },
        },
        sync: {
          get: () => Promise.resolve({ ...store }),
          set: (items: Record<string, unknown>) => {
            const changes = Object.fromEntries(
              Object.entries(items).map(([key, newValue]) => [
                key,
                { newValue, oldValue: store[key] },
              ]),
            );
            Object.assign(store, items);
            for (const listener of listeners) {
              listener(changes, 'sync');
            }
            return Promise.resolve();
          },
        },
      },
      tabs: { create: createTab },
    },
  });

  return { createTab, listeners, openOptionsPage, requestPermissions, store };
}
