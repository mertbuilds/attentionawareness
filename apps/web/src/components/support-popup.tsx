import { Button, Dialog, DialogClose, DialogContent, DialogTitle } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { usePostHog } from '@posthog/react';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { Heart } from 'reicon-react';
import { onDownloadStarted } from '../lib/download-started.ts';
import { blur, distance, duration, easing, scale } from '../lib/motion.stylex.ts';
import { supportUrl } from '../lib/support.ts';
import { m } from '../paraglide/messages.js';

/**
 * How long after the click the popup waits, in milliseconds: the browser shows
 * its own sign of the download first, so the popup never looks like it stands
 * between the reader and the file.
 */
const OPEN_DELAY = 800;
const SUPPORT_URL = supportUrl('download-popup');
/** The heart on the support button, as tall as the button's letters are set. */
const HEART_SIZE = 14;

/** The heart's one beat: past its size and back. */
const beat = keyframes({
  '0%': { transform: 'scale(1)' },
  '100%': { transform: 'scale(1)' },
  '40%': { transform: 'scale(1.3)' },
});

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
    marginBlockStart: spacing.s2,
  },
  // The page behind goes dim as the panel opens over it and clears as it
  // closes, the closing quicker than the opening.
  backdrop: {
    animationName: 'none',
    opacity: {
      ':is([data-ending-style])': 0,
      ':is([data-starting-style])': 0,
      default: 1,
    },
    transitionDuration: {
      ':is([data-ending-style])': duration.quick,
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.smoothOut,
  },
  body: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  close: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: 20,
    height: 32,
    insetBlockStart: spacing.s3,
    insetInlineEnd: spacing.s3,
    justifyContent: 'center',
    lineHeight: 1,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    padding: 0,
    position: 'absolute',
    width: 32,
  },
  // The heart beats once, after the panel has settled. It sits in a wrapper
  // because a browser draws a scaled icon soft where the icon itself is scaled.
  heart: {
    animationDelay: duration.slow,
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: beat,
    },
    animationTimingFunction: easing.bounce,
    display: 'flex',
  },
  // The panel: it rises a little into the middle of the window, out of a blur
  // and from a touch small, and leaves quicker than it came, only shrinking
  // and fading. The dialog centres it with a transform, so every state spells
  // that out too. With less motion it is there or it is not.
  panel: {
    animationName: 'none',
    boxShadow: {
      '@media (prefers-color-scheme: dark)': `0 0 0 1px ${colors.border}, 0 12px 40px rgba(0, 0, 0, 0.35)`,
      default: `0 0 0 1px ${colors.border}, 0 12px 40px rgba(0, 0, 0, 0.12)`,
    },
    display: 'flex',
    filter: {
      ':is([data-ending-style])': 'blur(0)',
      ':is([data-starting-style])': `blur(${blur.small})`,
      default: 'blur(0)',
    },
    flexDirection: 'column',
    fontFamily: font.family,
    gap: spacing.s3,
    opacity: {
      ':is([data-ending-style])': 0,
      ':is([data-starting-style])': 0,
      default: 1,
    },
    padding: spacing.s6,
    transform: {
      ':is([data-ending-style])': `translate(-50%, -50%) scale(${scale.large})`,
      ':is([data-starting-style])': `translate(-50%, calc(-50% + ${distance.medium})) scale(${scale.large})`,
      default: 'translate(-50%, -50%)',
    },
    transitionDuration: {
      ':is([data-ending-style])': duration.quick,
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
    transitionProperty: 'opacity, transform, filter',
    transitionTimingFunction: easing.smoothOut,
  },
  // Clear of the close button in the corner.
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    paddingInlineEnd: spacing.s8,
  },
  // Why the popup is here, in the ink, where the line above it is muted.
  why: {
    color: colors.fg,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
});

/**
 * The thank-you after a download has started, with the way to support the
 * work. One of it stands on every page, and any download button on a computer
 * opens it, a moment after its file has started, so the file is never held up.
 * It opens after every download, and nothing is kept of it: a download that
 * starts while it is open, or about to open, leaves it as it is. Escape, a
 * press outside it, its close button and "Maybe later" all close it, and
 * focus goes back to the button that started the download.
 */
export function SupportPopup() {
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  // The button whose download this answers, and where on the site it stands.
  const button = useRef<HTMLElement | null>(null);
  const placement = useRef('');
  // Whether the popup is open, for the listener, which outlives a render.
  const shown = useRef(false);

  useEffect(() => {
    let timer: number | undefined;
    const stop = onDownloadStarted((download) => {
      // One popup at a time: open, or about to open, it stays as it is.
      if (shown.current || timer !== undefined) {
        return;
      }
      button.current = download.button;
      placement.current = download.placement;
      timer = window.setTimeout(() => {
        timer = undefined;
        shown.current = true;
        setOpen(true);
        posthog.capture('support_popup_shown', { placement: download.placement });
      }, OPEN_DELAY);
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [posthog]);

  function close() {
    shown.current = false;
    setOpen(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          close();
          posthog.capture('support_popup_dismissed', { placement: placement.current });
        }
      }}
      open={open}
    >
      <DialogContent
        // The popup's two lines are its own paragraphs, not one description.
        aria-describedby={undefined}
        // Back to the button that started the download. One that has gone with
        // the phone menu it stood in leaves focus to go where it was before.
        finalFocus={() => (button.current?.isConnected === true ? button.current : true)}
        overlayStyle={styles.backdrop}
        showCloseButton={false}
        style={styles.panel}
      >
        <DialogTitle style={styles.title}>{m.support_popup_title()}</DialogTitle>
        <p {...props(styles.body)}>{m.support_popup_next()}</p>
        <p {...props(styles.why)}>{m.support_popup_body()}</p>
        <div {...props(styles.actions)}>
          <Button
            onClick={() => {
              posthog.capture('support_clicked', { placement: 'download_popup' });
              close();
            }}
            render={<a href={SUPPORT_URL} rel="noreferrer" target="_blank" />}
          >
            <span {...props(styles.heart)}>
              <Heart aria-hidden="true" size={HEART_SIZE} weight="Filled" />
            </span>
            {m.home_support_cta()}
          </Button>
          <DialogClose render={<Button variant="ghost">{m.support_popup_later()}</Button>} />
        </div>
        <DialogClose aria-label={m.sheet_close()} {...props(styles.close)}>
          ×
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
