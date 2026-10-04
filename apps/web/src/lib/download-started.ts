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

export function announceDownload(download: StartedDownload): void {
  for (const listener of listeners) {
    listener(download);
  }
}

/** Calls `listener` for every download that starts, until the returned function is called. */
export function onDownloadStarted(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
