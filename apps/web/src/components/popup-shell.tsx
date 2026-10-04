import { Button, Dialog, DialogClose, DialogContent, DialogTitle } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Share } from 'reicon-react';
import { blur, distance, duration, easing, scale } from '../lib/motion.stylex.ts';
import { shareSheet } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';

/** How long the share button says the link was copied, in milliseconds. */
const COPIED_MS = 2000;
/** An icon on a popup's button, as tall as the button's letters are set. */
export const POPUP_ICON_SIZE = 14;

/** The heart's one beat: past its size and back. */
const beat = keyframes({
  '0%': { transform: 'scale(1)' },
  '100%': { transform: 'scale(1)' },
  '40%': { transform: 'scale(1.3)' },
});

const styles = create({
  // The two ways to support, side by side. In a narrow window they stand one
  // under the other, each as wide as the panel.
  actions: {
    alignItems: {
      '@media (max-width: 479px)': 'stretch',
      default: 'center',
    },
    display: 'flex',
    flexDirection: {
      '@media (max-width: 479px)': 'column',
      default: 'row',
    },
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
    boxShadow: `0 0 0 1px ${colors.border}, 0 12px 40px ${colors.shadow}`,
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

/** What a popup's own lines and buttons are set in, the same in every popup. */
export const popupActions: StyleXStyles = styles.actions;
export const popupBody: StyleXStyles = styles.body;
export const popupHeart: StyleXStyles = styles.heart;
export const popupWhy: StyleXStyles = styles.why;

/**
 * The panel the site's popups share: it opens over the dimmed page in the
 * middle of the window, with its title and a close button in its corner.
 * Escape, a press outside it and the close button close it. `finalFocus` says
 * where focus goes then; left out, it goes back to where it was.
 */
export function PopupShell({
  children,
  finalFocus,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  finalFocus?: ComponentProps<typeof DialogContent>['finalFocus'];
  onClose: () => void;
  open: boolean;
  title: ReactNode;
}) {
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent
        // A popup's lines are its own paragraphs, not one description.
        aria-describedby={undefined}
        {...(finalFocus === undefined ? {} : { finalFocus })}
        overlayStyle={styles.backdrop}
        showCloseButton={false}
        style={styles.panel}
      >
        <DialogTitle style={styles.title}>{title}</DialogTitle>
        {children}
        <DialogClose aria-label={m.sheet_close()} {...props(styles.close)}>
          ×
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A popup's share button. It hands `url` and the site's name to the system's
 * share sheet where the browser has one, and no sentence with them: a sheet
 * may join a sentence to the address. Where it has none the address goes to
 * the clipboard, and the button says so for a moment, aloud too. `onShare`
 * hears which of the two it was.
 */
export function ShareButton({
  onShare,
  url,
  variant,
}: {
  onShare?: (method: 'copy' | 'native') => void;
  url: string;
  variant?: ComponentProps<typeof Button>['variant'];
}) {
  const [copied, setCopied] = useState(false);

  // The button goes back to its own word a moment after the link was copied.
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function share() {
    // Not every browser on a computer has a share sheet.
    const sheet: typeof navigator.share | undefined = navigator.share;
    if (sheet !== undefined) {
      onShare?.('native');
      try {
        await navigator.share(shareSheet(url, m.site_name()));
        return;
      } catch (error) {
        // The reader closed the sheet: nothing to say. Anything else, and the
        // sheet did not work, so the link is copied as it is without one.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }
    onShare?.('copy');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The clipboard refused. The button keeps offering it.
    }
  }

  return (
    <Button onClick={() => void share()} {...(variant === undefined ? {} : { variant })}>
      <Share aria-hidden="true" size={POPUP_ICON_SIZE} />
      <span aria-live="polite">{copied ? m.mac_download_copied() : m.support_popup_share()}</span>
    </Button>
  );
}
