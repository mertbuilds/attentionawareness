import type { Track } from './download-press.ts';
import { onPhoneDownload } from './download-started.ts';
import { SECTION } from './sections.ts';
import { shareSheet, shareUrl } from './share.ts';

/** The link a phone sends on to a Mac: the site, open where the download stands on the home page. */
export const SEND_URL = shareUrl('phone', SECTION.wayOut);

/** How a link left a phone for a Mac: the system's share sheet, or the clipboard. */
export type ShareMethod = 'clipboard' | 'share_sheet';

/** What of the browser sends a link on. A browser without a share sheet has no `share`. */
export type Sender = {
  clipboard: { writeText: (text: string) => Promise<void> };
  share?: ((sheet: { title: string; url: string }) => Promise<void>) | undefined;
};

/** Whether the browser has a share sheet. */
export function canShare(sender: Sender): boolean {
  return sender.share !== undefined;
}

/**
 * Copies the link. It answers how the link left, or nothing when the
 * clipboard refused, and the event goes only when it left.
 */
export async function copyLink(
  sender: Sender,
  url: string,
  track: Track,
): Promise<ShareMethod | undefined> {
  try {
    await sender.clipboard.writeText(url);
  } catch {
    // The clipboard refused. The button keeps offering it.
    return undefined;
  }
  track('mac_download_link_shared', { share_method: 'clipboard' });
  return 'clipboard';
}

/**
 * Hands the link to the share sheet, which reaches a Mac by AirDrop or a
 * message. A reader who closes the sheet shared nothing. Without a sheet, or
 * with one that did not work, the link is copied.
 */
export async function shareLink(
  sender: Sender,
  sheet: { title: string; url: string },
  track: Track,
): Promise<ShareMethod | undefined> {
  if (sender.share !== undefined) {
    try {
      await sender.share(sheet);
      track('mac_download_link_shared', { share_method: 'share_sheet' });
      return 'share_sheet';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return undefined;
      }
    }
  }
  return copyLink(sender, sheet.url, track);
}

/**
 * What a press on a phone's download does when its popup did not load: the
 * link goes straight to the share sheet, or to the clipboard, so the button
 * is never dead. It answers every press until the returned function is
 * called, and one that was waiting.
 */
export function sendWithoutPopup(sender: Sender, title: string, track: Track): () => void {
  return onPhoneDownload(() => {
    void shareLink(sender, shareSheet(SEND_URL, title), track);
  }, true);
}
