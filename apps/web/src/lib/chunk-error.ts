/**
 * What browsers say when a script the page asks for later is not there: the
 * page came from a build that has since been replaced, and the files it names
 * are gone. Safari, Chrome and Firefox each put it their own way.
 */
const CHUNK_MESSAGES = [
  'Importing a module script failed',
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Unable to preload CSS',
];

/** Whether `error` is a script or a stylesheet of the page's build that did not load. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === 'ChunkLoadError' ||
    CHUNK_MESSAGES.some((message) => error.message.includes(message))
  );
}

/** The key a reload for one address is kept under, for the rest of the visit. */
const RELOADED_PREFIX = 'aa-reloaded:';

/** The key the reload for the address in the window is kept under. */
function reloadKey(): string {
  return RELOADED_PREFIX + window.location.pathname + window.location.search;
}

/**
 * Whether the page at the address in the window may still be loaded again
 * for a failure: once per address and visit, since a second failure is not a
 * stale page and loading again would only loop. Without the session's storage
 * there is no way to tell a first try from a loop, so it may not.
 */
export function mayReload(): boolean {
  try {
    return window.sessionStorage.getItem(reloadKey()) === null;
  } catch {
    return false;
  }
}

/**
 * Loads the page at the address in the window once more, from the server, so
 * it comes with the files of the build that is live now, if `mayReload` lets
 * it. Says whether it reloads.
 */
export function reloadOnce(): boolean {
  if (!mayReload()) {
    return false;
  }
  try {
    window.sessionStorage.setItem(reloadKey(), '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
