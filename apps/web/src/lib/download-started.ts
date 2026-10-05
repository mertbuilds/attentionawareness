/**
 * How a download button tells the rest of the page what its press did,
 * without either knowing the other: the button says so, and whoever listens
 * hears where on the site it stood and which button it was. A press on a
 * computer starts the file. A press on a phone or a tablet starts nothing and
 * asks for the popup that sends the link on to a Mac. Each has its own
 * listeners, so the popup after a download never hears a phone.
 */
export type DownloadPress = {
  /** The button that was pressed, for focus to go back to. */
  button: HTMLElement;
  /** Where on the site the download stands. */
  placement: string;
};

type Listener = (press: DownloadPress) => void;

function channel(): {
  announce: (press: DownloadPress) => void;
  listen: (listener: Listener) => () => void;
} {
  const listeners = new Set<Listener>();
  /** A press before anyone listened, kept for the first to come. */
  let unheard: DownloadPress | undefined;

  return {
    announce(press) {
      if (listeners.size === 0) {
        unheard = press;
        return;
      }
      for (const listener of listeners) {
        listener(press);
      }
    },
    listen(listener) {
      listeners.add(listener);
      if (unheard !== undefined) {
        const press = unheard;
        unheard = undefined;
        listener(press);
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const started = channel();
const phone = channel();

export const announceDownload = started.announce;
/**
 * Calls `listener` for every download that starts, until the returned
 * function is called, and at once for one that started before anyone listened.
 */
export const onDownloadStarted = started.listen;

export const announcePhoneDownload = phone.announce;
/** The same, for every press on a download on a phone or a tablet. */
export const onPhoneDownload = phone.listen;
