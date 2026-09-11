/**
 * The slice of the extension API this package uses.
 *
 * `@types/chrome` is tens of thousands of lines for a handful of calls, and
 * these are the ones Firefox exposes under `browser` too, so the surface stays
 * hand written and small until something here needs more of it.
 */
declare namespace chrome {
  namespace runtime {
    /** Opens what the manifest names in `options_page`. Needs no permission. */
    function openOptionsPage(): Promise<void>;
  }

  namespace storage {
    type AreaName = 'local' | 'managed' | 'session' | 'sync';

    type StorageChange = {
      newValue?: unknown;
      oldValue?: unknown;
    };

    type ChangeListener = (changes: Record<string, StorageChange>, area: AreaName) => void;

    type StorageArea = {
      get(keys: Array<string> | string | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };

    const sync: StorageArea;

    const onChanged: {
      addListener(listener: ChangeListener): void;
      removeListener(listener: ChangeListener): void;
    };
  }

  namespace tabs {
    /**
     * Opening a tab needs no permission of its own: `tabs` gates reading a
     * tab's url, title and favicon, and nothing here reads a tab. The answer
     * is the new tab, which the popup has no use for.
     */
    function create(properties: { url: string }): Promise<unknown>;
  }
}
