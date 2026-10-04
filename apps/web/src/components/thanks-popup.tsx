import { accent } from '@attentionawareness/ui/accent.stylex';
import { usePostHog } from '@posthog/react';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { Heart } from 'reicon-react';
import { shareUrl } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';
import {
  PopupShell,
  ShareButton,
  popupActions,
  popupBody,
  popupHeart,
  popupWhy,
} from './popup-shell.tsx';

/** The site's address as a link shared from the thank-you carries it. */
const SHARE_URL = shareUrl('thanks');
/** The heart over the title, as tall as the title's letters. */
const HEART_SIZE = 20;

const styles = create({
  // The heart, in the one orange, before the words.
  heart: {
    color: accent.base,
  },
  // The heart and the words after it, on one line.
  title: {
    alignItems: 'center',
    display: 'flex',
    gap: '8px',
  },
});

/**
 * The thank-you after a support. The checkout sends the reader back to the
 * home page with `thanks=1` on its address, and `show` is that mark. The
 * popup opens once as the page comes alive, in the panel every popup has
 * (`popup-shell.tsx`), and `onShown` then takes the mark off the address, so
 * a reload or a shared address does not open it again. It offers one thing,
 * to share the site: the reader has just supported it.
 */
export function ThanksPopup({ onShown, show }: { onShown: () => void; show: boolean }) {
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  // Once for each load of the page, whatever the address says after.
  const shown = useRef(false);

  useEffect(() => {
    if (!show || shown.current) {
      return;
    }
    shown.current = true;
    setOpen(true);
    onShown();
    // After this turn: the analytics start in an effect of the root, which
    // runs after this one. No amount and no id goes with it.
    window.setTimeout(() => posthog.capture('support_completed'), 0);
  }, [onShown, posthog, show]);

  return (
    <PopupShell
      onClose={() => setOpen(false)}
      open={open}
      title={
        <span {...props(styles.title)}>
          <span {...props(popupHeart, styles.heart)}>
            <Heart aria-hidden="true" size={HEART_SIZE} weight="Filled" />
          </span>
          {m.thanks_popup_title()}
        </span>
      }
    >
      <p {...props(popupWhy)}>{m.thanks_popup_body()}</p>
      <p {...props(popupBody)}>{m.thanks_popup_more()}</p>
      <div {...props(popupActions)}>
        <ShareButton url={SHARE_URL} />
      </div>
    </PopupShell>
  );
}
