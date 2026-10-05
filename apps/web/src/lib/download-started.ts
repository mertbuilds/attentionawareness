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
  listen: (listener: Listener, takesUnheard: boolean) => () => void;
} {
  /** Each listener, and whether it answers a press or only hears of it. */
  const listeners = new Map<Listener, boolean>();
  /** A press nobody has answered yet, kept for the first who can. */
  let unheard: DownloadPress | undefined;

  return {
    announce(press) {
      let taken = false;
      for (const [listener, takes] of listeners) {
        listener(press);
        taken ||= takes;
      }
      if (!taken) {
        unheard = press;
      }
    },
    listen(listener, takesUnheard) {
      listeners.set(listener, takesUnheard);
      if (takesUnheard && unheard !== undefined) {
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
 * function is called. A popup, which answers the press, passes `true` for
 * `takesUnheard`: it is called at once for a press nobody has answered, and
 * a press it hears is answered. Whoever only needs to know of a press, as the
 * phone menu does to close, passes `false`: a press waits for a popup still,
 * and one that waits is never handed to it.
 */
export const onDownloadStarted = started.listen;

export const announcePhoneDownload = phone.announce;
/** The same, for every press on a download on a phone or a tablet. */
export const onPhoneDownload = phone.listen;
