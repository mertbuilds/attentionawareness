/**
 * How a download button tells the rest of the page that its file has started,
 * without either knowing the other: the button says so, and whoever listens
 * hears where on the site it stood and which button it was.
 */
const EVENT = 'aa:download-started';

export type StartedDownload = {
  /** The button that was pressed, for focus to go back to. */
  button: HTMLElement;
  /** Where on the site the download stands. */
  placement: string;
};

export function announceDownload(download: StartedDownload): void {
  window.dispatchEvent(new CustomEvent<StartedDownload>(EVENT, { detail: download }));
}

/** Calls `listener` for every download that starts, until the returned function is called. */
export function onDownloadStarted(listener: (download: StartedDownload) => void): () => void {
  const hear = (event: Event) => listener((event as CustomEvent<StartedDownload>).detail);
  window.addEventListener(EVENT, hear);
  return () => window.removeEventListener(EVENT, hear);
}
