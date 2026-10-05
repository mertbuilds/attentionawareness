import { Button } from '@attentionawareness/ui';
import { props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { Share } from 'reicon-react';
import { posthog } from '../lib/analytics.ts';
import type { Track } from '../lib/download-press.ts';
import { onPhoneDownload } from '../lib/download-started.ts';
import { SECTION } from '../lib/sections.ts';
import { canShare, copyLink, shareLink } from '../lib/send-to-mac.ts';
import { shareSheet, shareUrl } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';
import {
  COPIED_MS,
  POPUP_ICON_SIZE,
  PopupShell,
  popupActions,
  popupBody,
  popupWhy,
} from './popup-shell.tsx';

/** The link a phone sends on to a Mac: the site, open where the download stands on the home page. */
const SEND_URL = shareUrl('phone', SECTION.wayOut);

const track: Track = (event, properties) => posthog.capture(event, properties);

/**
 * The two ways to send the link on: the share sheet, which reaches a Mac by
 * AirDrop or a message, and the clipboard. A browser without a share sheet has
 * the copy alone. The copy says in place that the link is copied, for a
 * moment, aloud too.
 */
function SendActions() {
  const [copied, setCopied] = useState(false);
  const sheet = canShare(navigator);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function share() {
    const method = await shareLink(navigator, shareSheet(SEND_URL, m.site_name()), track);
    if (method === 'clipboard') {
      setCopied(true);
    }
  }

  async function copy() {
    const method = await copyLink(navigator, SEND_URL, track);
    if (method !== undefined) {
      setCopied(true);
    }
  }

  return (
    <div {...props(popupActions)}>
      {sheet && (
        <Button onClick={() => void share()}>
          <Share aria-hidden="true" size={POPUP_ICON_SIZE} />
          {m.support_popup_share()}
        </Button>
      )}
      <Button onClick={() => void copy()} variant={sheet ? 'outline' : 'default'}>
        <span aria-live="polite">{copied ? m.mac_download_copied() : m.mac_download_copy()}</span>
      </Button>
    </div>
  );
}

/**
 * What a download button opens on a phone or a tablet, where the app cannot
 * run: it says so, and sends the site's link on to a Mac. One of it stands on
 * every page, and no download starts under it. Escape, a press outside it and
 * its close button close it, and focus goes back to the button that opened it.
 *
 * The panel is the one every popup has (`popup-shell.tsx`).
 */
export function PhoneDownloadPopup() {
  const [open, setOpen] = useState(false);
  // The button that opened it, and where on the site it stands.
  const button = useRef<HTMLElement | null>(null);
  const placement = useRef('');
  // Whether the popup is open, for the listener, which outlives a render.
  const shown = useRef(false);

  useEffect(
    () =>
      onPhoneDownload((press) => {
        if (shown.current) {
          return;
        }
        button.current = press.button;
        placement.current = press.placement;
        shown.current = true;
        setOpen(true);
        posthog.capture('phone_download_modal_shown', { placement: press.placement });
      }),
    [],
  );

  return (
    <PopupShell
      // Back to the button that opened it. One that has gone with the phone
      // menu it stood in leaves focus to go where it was before.
      finalFocus={() => (button.current?.isConnected === true ? button.current : true)}
      onClose={() => {
        shown.current = false;
        setOpen(false);
        posthog.capture('phone_download_modal_dismissed', { placement: placement.current });
      }}
      open={open}
      title={m.phone_download_title()}
    >
      <p {...props(popupBody)}>{m.phone_download_body()}</p>
      <p {...props(popupWhy)}>{m.phone_download_next()}</p>
      <SendActions />
    </PopupShell>
  );
}
