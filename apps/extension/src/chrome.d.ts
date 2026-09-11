/**
 * The slice of the extension API this package uses.
 *
 * `@types/chrome` is tens of thousands of lines for a handful of calls, and
 * these are the ones Firefox exposes under `browser` too, so the surface stays
 * hand written and small until something here needs more of it.
 */
declare namespace chrome {
  namespace permissions {
    type Permissions = {
      origins?: Array<string> | undefined;
      permissions?: Array<string> | undefined;
    };

    /** Whether every origin listed is already held. */
    function contains(permissions: Permissions): Promise<boolean>;

    /**
     * Asks for the optional origins the manifest allows. It has to be called
     * inside a user gesture, and an `await` before it spends that gesture, so
     * the options page calls it straight out of a blur or a click.
     */
    function request(permissions: Permissions): Promise<boolean>;

    const onAdded: {
      addListener(listener: (permissions: Permissions) => void): void;
    };
  }

  namespace runtime {
    /** Opens what the manifest names in `options_page`. Needs no permission. */
    function openOptionsPage(): Promise<void>;

    const onInstalled: {
      addListener(listener: () => void): void;
    };

    const onStartup: {
      addListener(listener: () => void): void;
    };
  }

  namespace scripting {
    type RegisteredContentScript = {
      allFrames?: boolean | undefined;
      id: string;
      js?: Array<string> | undefined;
      matches?: Array<string> | undefined;
      persistAcrossSessions?: boolean | undefined;
      runAt?: 'document_end' | 'document_idle' | 'document_start' | undefined;
    };

    function getRegisteredContentScripts(filter?: {
      ids?: Array<string> | undefined;
    }): Promise<Array<RegisteredContentScript>>;

    function registerContentScripts(scripts: Array<RegisteredContentScript>): Promise<void>;

    function unregisterContentScripts(filter?: { ids?: Array<string> | undefined }): Promise<void>;

    function updateContentScripts(scripts: Array<RegisteredContentScript>): Promise<void>;
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
