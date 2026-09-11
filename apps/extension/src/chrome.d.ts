/**
 * The slice of the extension API this package uses.
 *
 * `@types/chrome` is tens of thousands of lines for four calls, and these four
 * are the ones Firefox exposes under `browser` too, so the surface stays hand
 * written and small until something here needs more of it.
 */
declare namespace chrome {
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
}
