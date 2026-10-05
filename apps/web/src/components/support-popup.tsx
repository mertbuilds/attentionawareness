import { Button } from '@attentionawareness/ui';
import { props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { Heart } from 'reicon-react';
import { posthog } from '../lib/analytics.ts';
import { onDownloadStarted } from '../lib/download-started.ts';
import { shareUrl } from '../lib/share.ts';
import { supportUrl } from '../lib/support.ts';
import { m } from '../paraglide/messages.js';
import {
  POPUP_ICON_SIZE,
  PopupShell,
  ShareButton,
  popupActions,
  popupBody,
  popupHeart,
  popupWhy,
} from './popup-shell.tsx';

/** The site's address as a shared link carries it, so a visit from one is traced to the popup. */
const SHARE_URL = shareUrl('popup');
const SUPPORT_URL = supportUrl('download-popup');

/**
 * The thank-you after a download has started, with two ways to support the
 * work: the checkout, and sharing the site. One of it stands on every page,
 * and any download button on a computer opens it in the same press. The
 * button is a link to the file and the press goes on to it untouched, so the
 * popup never stands between the reader and the file. It opens after every
 * download, and nothing is kept of it: a download that starts while it is open
 * leaves it as it is. Escape, a press outside it and its close button close
 * it, and focus goes back to the button that started the download.
 *
 * The panel and the share button are the ones every popup has
 * (`popup-shell.tsx`).
 */
export function SupportPopup() {
  const [open, setOpen] = useState(false);
  // The button whose download this answers, and where on the site it stands.
  const button = useRef<HTMLElement | null>(null);
  const placement = useRef('');
  // Whether the popup is open, for the listener, which outlives a render.
  const shown = useRef(false);

  useEffect(
    () =>
      onDownloadStarted((download) => {
        // One popup at a time: open, it stays as it is.
        if (shown.current) {
          return;
        }
        button.current = download.button;
        placement.current = download.placement;
        shown.current = true;
        setOpen(true);
        posthog.capture('support_popup_shown', { placement: download.placement });
      }, true),
    [],
  );

  function close() {
    shown.current = false;
    setOpen(false);
  }

  return (
    <PopupShell
      // Back to the button that started the download. One that has gone with
      // the phone menu it stood in leaves focus to go where it was before.
      finalFocus={() => (button.current?.isConnected === true ? button.current : true)}
      onClose={() => {
        close();
        posthog.capture('support_popup_dismissed', { placement: placement.current });
      }}
      open={open}
      title={m.support_popup_title()}
    >
      <p {...props(popupBody)}>{m.support_popup_next()}</p>
      <p {...props(popupWhy)}>{m.support_popup_body()}</p>
      <div {...props(popupActions)}>
        <Button
          onClick={() => {
            posthog.capture('support_clicked', { placement: 'download_popup' });
            close();
          }}
          render={<a href={SUPPORT_URL} rel="noreferrer" target="_blank" />}
        >
          <span {...props(popupHeart)}>
            <Heart aria-hidden="true" size={POPUP_ICON_SIZE} weight="Filled" />
          </span>
          {m.home_support_cta()}
        </Button>
        <ShareButton
          onShare={(method) => posthog.capture('support_popup_share_clicked', { method })}
          url={SHARE_URL}
          variant="outline"
        />
      </div>
    </PopupShell>
  );
}
