import { announceDownload, announcePhoneDownload } from './download-started.ts';
import type { Release } from './mac-release.ts';

/** Where on the site a download stands, which its event carries. */
export type Placement = 'blog' | 'closing' | 'download' | 'header' | 'hero';

/** Sends one event with its properties. */
export type Track = (event: string, properties: Record<string, string>) => void;

/** The part of a press that a download reads: the button it was on. */
type Press = { currentTarget: HTMLElement };

/**
 * What a download does: nothing before the first release, nothing yet while
 * `latest.json` is read, on a computer start the file, and on a phone or a
 * tablet, which cannot run the app, open the popup that sends the link on to
 * a Mac.
 */
export type Download =
  | { kind: 'unreleased' }
  | { kind: 'reading' }
  | { kind: 'phone'; open: (event: Press) => void }
  | {
      /** The name the browser saves the file under. */
      filename: string;
      kind: 'file';
      start: (event: Press) => void;
      url: string;
    };

/**
 * What the download at `placement` does for `release` (undefined while it is
 * read, null when there is none). A phone has no file and no address to
 * start, and its press sends no `mac_download_started`.
 */
export function downloadFor(
  release: Release | null | undefined,
  mobile: boolean,
  placement: Placement,
  track: Track,
): Download {
  if (release === null) {
    return { kind: 'unreleased' };
  }
  if (release === undefined) {
    return { kind: 'reading' };
  }
  if (mobile) {
    return {
      kind: 'phone',
      open: (event) => announcePhoneDownload({ button: event.currentTarget, placement }),
    };
  }
  return {
    filename: release.filename,
    kind: 'file',
    // The click goes on to the file untouched. The page is only told that it
    // has started, and by which button.
    start: (event) => {
      track('mac_download_started', { placement });
      announceDownload({ button: event.currentTarget, placement });
    },
    url: release.url,
  };
}
