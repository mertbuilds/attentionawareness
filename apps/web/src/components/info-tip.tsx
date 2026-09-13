import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useIsMobile } from '../lib/use-is-mobile.ts';
import { Sheet } from './sheet.tsx';

/** How long a pointer may take to cross from the button into the box. */
const GRACE_MS = 250;

const enter = keyframes({
  from: { opacity: 0, transform: 'translateY(4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const styles = create({
  button: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    color: {
      ':focus-visible': colors.fg,
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: 16,
    justifyContent: 'center',
    padding: 0,
    width: 16,
  },
  glyph: {
    height: 10,
    width: 10,
  },
  popover: {
    // The 8px of bare page over the button, covered by the box itself, so a
    // pointer crossing into the box never leaves the pair.
    '::after': {
      content: '',
      height: 8,
      insetBlockEnd: -8,
      insetInlineEnd: 0,
      insetInlineStart: 0,
      position: 'absolute',
    },
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    animationName: enter,
    animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: {
      '@media (prefers-color-scheme: dark)': '0 12px 40px rgba(0, 0, 0, 0.35)',
      default: '0 12px 40px rgba(0, 0, 0, 0.12)',
    },
    boxSizing: 'border-box',
    color: colors.muted,
    fontFamily: font.family,
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    insetBlockEnd: 'calc(100% + 8px)',
    insetInlineStart: 0,
    letterSpacing: 'normal',
    lineHeight: 1.5,
    padding: spacing.s3,
    position: 'absolute',
    textAlign: 'start',
    textTransform: 'none',
    textWrap: 'pretty',
    width: 260,
    zIndex: 20,
  },
  sheetText: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textTransform: 'none',
  },
  // Centred on the cap height of the line it follows, which sits a touch
  // above the box's own middle in a shouted receipt.
  wrap: {
    display: 'inline-flex',
    position: 'relative',
    transform: 'translateY(-1px)',
    verticalAlign: 'middle',
  },
});

/**
 * A small "i" beside a line, and the explanation behind it. On a wide page
 * hover or focus opens a box over the button, and a pointer that leaves gets
 * a moment to reach it; a phone opens a sheet instead.
 */
export function InfoTip({ children, label }: { children: ReactNode; label: string }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (grace.current !== null) {
        clearTimeout(grace.current);
      }
    },
    [],
  );

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
    grace.current = setTimeout(() => setOpen(false), GRACE_MS);
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
      {...props(styles.wrap)}
    >
      <button
        aria-describedby={open && !isMobile ? popoverId : undefined}
        aria-label={label}
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
        {...props(styles.button)}
      >
        <svg aria-hidden="true" viewBox="0 0 10 10" {...props(styles.glyph)}>
          <circle cx="5" cy="2.2" fill="currentColor" r="1" />
          <path
            d="M5 4.2v4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
      </button>
      {isMobile ? (
        <Sheet onOpenChange={setOpen} open={open} title={label}>
          <p {...props(styles.sheetText)}>{children}</p>
        </Sheet>
      ) : open ? (
        <span
          id={popoverId}
          onPointerDown={(event) => event.preventDefault()}
          role="tooltip"
          {...props(styles.popover)}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
