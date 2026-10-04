/**
 * How a download button tells the rest of the page that its file has started,
 * without either knowing the other: the button says so, and whoever listens
 * hears where on the site it stood and which button it was.
 */
export type StartedDownload = {
  /** The button that was pressed, for focus to go back to. */
  button: HTMLElement;
  /** Where on the site the download stands. */
  placement: string;
};

type Listener = (download: StartedDownload) => void;

const listeners = new Set<Listener>();
/** A download that started before anyone listened, kept for the first to come. */
let unheard: StartedDownload | undefined;

export function announceDownload(download: StartedDownload): void {
  if (listeners.size === 0) {
    unheard = download;
    return;
  }
  for (const listener of listeners) {
    listener(download);
  }
}

/**
 * Calls `listener` for every download that starts, until the returned
 * function is called, and at once for one that started before anyone listened.
 */
export function onDownloadStarted(listener: Listener): () => void {
  listeners.add(listener);
  if (unheard !== undefined) {
    const download = unheard;
    unheard = undefined;
    listener(download);
  }
  return () => {
    listeners.delete(listener);
  };
}
