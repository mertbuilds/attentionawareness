import { colors, font, palette, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState } from 'react';
import { useIsMobile } from '../lib/use-is-mobile.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { Sheet } from './sheet.tsx';

/**
 * The popover hangs a few pixels under its button, so the pointer crosses bare
 * page on its way in. This is how long that trip is allowed to take: an
 * unhurried hand takes longer than a quick one, and the trip itself is bridged
 * by the popovers, so the wait can be generous.
 */
const HELP_GRACE_MS = 250;
/** The report the average day in the help box is taken from. */

/** The popover rises the last few pixels into place under its button. */
const helpEnter = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

/**
 * The clip that shows where the real number lives, one recording per locale.
 * The video wins when the reader's locale has one, English stands in when it
 * does not, the gif is the fallback under that, and with none of them the
 * popover holds its placeholder. The gif widens to `string` so the branches
 * keep type-checking whichever one carries a url.
 */
const SCREEN_TIME_VIDEO_URLS: Record<string, string> = {
  en: '/media/screentime-en.mp4',
  tr: '/media/screentime-tr.mp4',
};
const SCREEN_TIME_GIF_URL: string = '';

const styles = create({
  helpButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: {
      ':focus-visible': colors.fg,
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: font.weightRegular,
    height: 20,
    justifyContent: 'center',
    letterSpacing: 'normal',
    lineHeight: 1,
    padding: 0,
    width: 20,
  },
  // What the slot says while it waits for a clip to be shot.
  helpClip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    height: '100%',
    justifyContent: 'center',
    textAlign: 'center',
    width: '100%',
  },
  helpMedia: {
    display: 'block',
    height: '100%',
    objectFit: 'cover',
    width: '100%',
  },
  // Hangs under the button, aligned to its left edge. It sits inside a heading,
  // so it takes back the type the heading set.
  helpPopover: {
    // The 8px of bare page under the button, covered by the box itself, so a
    // pointer crossing into the box never leaves the pair.
    '::before': {
      content: '',
      height: 8,
      insetBlockStart: -8,
      insetInlineEnd: 0,
      insetInlineStart: 0,
      position: 'absolute',
    },
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    animationName: helpEnter,
    animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      '@media (prefers-color-scheme: dark)': '0 12px 40px rgba(0, 0, 0, 0.35)',
      default: '0 12px 40px rgba(0, 0, 0, 0.12)',
    },
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontWeight: font.weightRegular,
    gap: spacing.s2,
    insetBlockStart: 'calc(100% + 8px)',
    insetInlineStart: 0,
    letterSpacing: 'normal',
    // A phone is narrower than the box, and nothing on the page may scroll
    // sideways.
    maxWidth: 'calc(100vw - 32px)',
    padding: spacing.s3,
    position: 'absolute',
    textAlign: 'start',
    // The clip is what the box is for: 200px of it, plus the 12px of padding
    // on each side. The words wrap to that, rather than the box widening.
    width: 224,
    zIndex: 20,
  },
  // Given the whole width of a sheet, the clip takes as much of it as it was
  // shot at and no more.
  helpSheetSlot: {
    alignSelf: 'center',
    maxWidth: 320,
    width: '100%',
  },
  // The clip is shot on a phone, so the slot it fills is portrait. Black
  // stands behind it in both themes, the way a player letterboxes.
  helpSlot: {
    alignSelf: 'center',
    aspectRatio: '720 / 1120',
    backgroundColor: palette.black,
    borderRadius: 12,
    display: 'flex',
    overflow: 'hidden',
    width: 200,
  },
  helpText: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    // Narrow box, and a path like a setting name has nowhere to break.
    overflowWrap: 'anywhere',
    textWrap: 'pretty',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: font.weightMedium,
    lineHeight: 1.4,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  // Rides at the end of the question, and anchors the popover under it.
  helpWrap: {
    display: 'inline-flex',
    marginInlineStart: spacing.s2,
    position: 'relative',
    verticalAlign: 'middle',
  },
});

/** The screen-time recording the reader's locale is shot in. */
function screenTimeVideoUrl(): string {
  return SCREEN_TIME_VIDEO_URLS[getLocale()] ?? SCREEN_TIME_VIDEO_URLS.en ?? '';
}

/**
 * The recording of Screen Time being opened, in the slot it was shot for. The
 * video wins where the reader's locale has one, the gif stands in under it,
 * and with neither the slot holds the placeholder.
 */
function ScreenTimeClip({ style, videoUrl }: { style?: StyleXStyles; videoUrl: string }) {
  return (
    <span {...props(styles.helpSlot, style)}>
      {videoUrl === '' ? (
        SCREEN_TIME_GIF_URL === '' ? (
          <span {...props(styles.helpClip)}>{m.home_math_help_clip()}</span>
        ) : (
          <img
            alt={m.home_math_help_body()}
            src={SCREEN_TIME_GIF_URL}
            {...props(styles.helpMedia)}
          />
        )
      ) : (
        <video
          autoPlay
          // A new locale is a new recording, so the element starts over.
          key={videoUrl}
          loop
          muted
          playsInline
          preload="metadata"
          src={videoUrl}
          {...props(styles.helpMedia)}
        />
      )}
    </span>
  );
}

/**
 * The question mark at the end of the question. On a wide page hover, focus or
 * a tap opens a popover that says where the real number lives and shows it
 * being found; a pointer that leaves gets a moment to reach the popover before
 * it closes, because the two do not touch. A phone has no room for a box
 * hanging off a button, so there the same question opens a sheet.
 */
export function ScreenTimeHelp() {
  const videoUrl = screenTimeVideoUrl();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A grace period that outlives the popover must not fire into nothing.
  useEffect(
    () => () => {
      if (grace.current !== null) {
        clearTimeout(grace.current);
      }
    },
    [],
  );

  // Dismissed from outside itself: a pointer anywhere else, or Escape. The
  // sheet answers both on its own, so this is the popover's alone.
  useEffect(() => {
    if (!open || isMobile) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (wrap.current?.contains(event.target as Node | null) !== true) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobile, open]);

  function clearGrace() {
    if (grace.current !== null) {
      clearTimeout(grace.current);
      grace.current = null;
    }
  }

  function show() {
    clearGrace();
    setOpen(true);
  }

  function hide() {
    clearGrace();
    setOpen(false);
  }

  function hideAfterGrace() {
    clearGrace();
    grace.current = setTimeout(() => setOpen(false), HELP_GRACE_MS);
  }

  return (
    <span
      onPointerEnter={(event) => {
        if (!isMobile && event.pointerType !== 'touch') {
          show();
        }
      }}
      onPointerLeave={(event) => {
        if (!isMobile && event.pointerType !== 'touch') {
          hideAfterGrace();
        }
      }}
      ref={wrap}
      {...props(styles.helpWrap)}
    >
      <button
        aria-describedby={open && !isMobile ? popoverId : undefined}
        aria-label={m.home_math_help_label()}
        // The sheet takes the focus with it, and a blur that closes it would
        // shut it on the way in. The popover hangs inside this wrapper, so
        // only focus that lands outside the pair is a reason to close.
        onBlur={
          isMobile
            ? undefined
            : (event) => {
                if (wrap.current?.contains(event.relatedTarget) !== true) {
                  hide();
                }
              }
        }
        onClick={show}
        onFocus={isMobile ? undefined : show}
        type="button"
        {...props(styles.helpButton)}
      >
        ?
      </button>
      {isMobile ? (
        <Sheet onOpenChange={setOpen} open={open} title={m.home_math_help_title()}>
          <span {...props(styles.helpText)}>{m.home_math_help_body()}</span>
          <ScreenTimeClip style={styles.helpSheetSlot} videoUrl={videoUrl} />
        </Sheet>
      ) : open ? (
        <span
          id={popoverId}
          // A press inside the box keeps the button's focus, so the blur that
          // would shut the box under the pointer never fires.
          onPointerDown={(event) => event.preventDefault()}
          role="tooltip"
          {...props(styles.helpPopover)}
        >
          <span {...props(styles.helpTitle)}>{m.home_math_help_title()}</span>
          <span {...props(styles.helpText)}>{m.home_math_help_body()}</span>
          <ScreenTimeClip videoUrl={videoUrl} />
        </span>
      ) : null}
    </span>
  );
}
