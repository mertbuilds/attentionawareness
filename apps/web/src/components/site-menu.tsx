import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { Popover } from '@base-ui/react/popover';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Heart } from 'reicon-react';
import { onDownloadStarted } from '../lib/download-started.ts';
import { blur, distance, duration, easing, scale } from '../lib/motion.stylex.ts';
import { WIDE_QUERY } from '../lib/wide.ts';
import { m } from '../paraglide/messages.js';
import { MacDownload } from './mac-download.tsx';

/** How far the page may run under an open menu before the menu closes, in pixels. */
const SCROLL_CLOSE = 24;
/** One item of the menu after the one before it, in milliseconds, as they come in. */
const STAGGER = Number.parseFloat(duration.stagger);
/** The heart before the support link, as tall as the header draws it. */
const HEART_SIZE = 16;
/** A line as heavy as the two lines of the button, in the icon's own 24-unit grid. */
const HEART_STROKE = 2.25;
/** The manual way, on a page of its own. */
const GUIDE_PATH = '/guide';
/** How far each line of the button stands from the middle, in pixels. */
const LINE_OFFSET = 3.5;

/** One of the header's links, as the menu lists it. */
export type MenuLink = {
  /** Whether the heart stands before it. */
  heart?: boolean;
  href: string;
  label: string;
};

/** An item of the menu coming in: a short rise out of a blur. */
const itemIn = keyframes({
  from: {
    filter: `blur(${blur.small})`,
    opacity: 0,
    transform: `translateY(${distance.base})`,
  },
});

const styles = create({
  // Waits for a delay the item sets, by its place in the menu.
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  // The two lines, and the cross they turn into. It is a phone's control: a
  // wide window has the links themselves and no button. The pseudo-element
  // takes the touch a finger's width around it.
  button: {
    '::before': {
      content: '',
      inset: '-8px',
      position: 'absolute',
    },
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
    display: {
      '@media (min-width: 768px)': 'none',
      default: 'flex',
    },
    flexShrink: 0,
    height: 28,
    justifyContent: 'center',
    justifySelf: 'end',
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    padding: 0,
    position: 'relative',
    width: 28,
  },
  buttonOpen: {
    color: colors.fg,
  },
  // The download, or on a phone the way to send the link on, as wide as the
  // menu so it is the plainest thing to press.
  download: {
    alignItems: 'stretch',
    marginBlockStart: spacing.s2,
  },
  // The manual way, quieter than the links over it.
  guide: {
    color: colors.muted,
    fontSize: font.sizeSm,
  },
  // One row of the menu, tall enough for a thumb.
  item: {
    alignItems: 'center',
    color: colors.fg,
    display: 'flex',
    fontSize: font.sizeMd,
    gap: spacing.s2,
    minHeight: 44,
    outlineColor: colors.muted,
    outlineOffset: -2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
  },
  // Each item comes in a step after the one before it. They leave with the
  // panel, all at once.
  itemIn: {
    animationDuration: duration.fast,
    animationFillMode: 'backwards',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: itemIn,
    },
    animationTimingFunction: easing.smoothOut,
  },
  // One line of the button, a hairline in the ink of the links.
  line: {
    backgroundColor: 'currentColor',
    borderRadius: 1,
    height: 1.5,
    position: 'absolute',
    // Back to two lines quicker than they crossed.
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.quick,
    },
    transitionProperty: 'transform',
    transitionTimingFunction: easing.smoothOut,
    width: 16,
  },
  lineLower: {
    transform: `translateY(${LINE_OFFSET}px)`,
  },
  lineLowerOpen: {
    transform: 'rotate(-45deg)',
  },
  lineOpen: {
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
  },
  lineUpper: {
    transform: `translateY(-${LINE_OFFSET}px)`,
  },
  lineUpperOpen: {
    transform: 'rotate(45deg)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  // The button is an item the header's morph carries, by this name.
  morph: (name: string) => ({
    viewTransitionName: name,
  }),
  // The panel under the header: it comes down a little from the button it
  // opens from, out of nothing and a touch small, and leaves quicker than it
  // came. With less motion it is there or it is not. It is never taller than
  // the room under the header: in a window too short for all of it, a phone
  // on its side, it scrolls in itself, and the page under it stays where it
  // is.
  panel: {
    backgroundColor: colors.bg,
    borderColor: `color-mix(in srgb, ${colors.fg} 10%, transparent)`,
    borderRadius: 16,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: `0 8px 32px ${colors.shadow}`,
    boxSizing: 'border-box',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    maxHeight: 'var(--available-height)',
    opacity: {
      ':is([data-ending-style])': 0,
      ':is([data-starting-style])': 0,
      default: 1,
    },
    outlineStyle: 'none',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    paddingBlockEnd: spacing.s4,
    paddingBlockStart: spacing.s2,
    paddingInline: spacing.s4,
    transform: {
      ':is([data-ending-style])': `scale(${scale.tiny})`,
      ':is([data-starting-style])': `translateY(calc(-1 * ${distance.base})) scale(${scale.medium})`,
      default: 'none',
    },
    transformOrigin: 'top right',
    transitionDuration: {
      ':is([data-ending-style])': duration.quick,
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: easing.smoothOut,
    // The window's width, less a margin at each side.
    width: `calc(100vw - 2 * ${spacing.s4})`,
  },
  // Over the page and the header, and gone with the button on a wide window.
  positioner: {
    display: {
      '@media (min-width: 768px)': 'none',
      default: 'block',
    },
    zIndex: 40,
  },
  // A line between the places on the site and what the reader can do.
  rule: {
    backgroundColor: colors.border,
    height: 1,
    marginBlock: spacing.s2,
  },
});

/** One row of the menu, in its place in the order they come in by. */
function Item({
  children,
  href,
  onPick,
  place,
  quiet = false,
}: {
  children: ReactNode;
  href: string;
  onPick: () => void;
  place: number;
  quiet?: boolean;
}) {
  return (
    <a
      data-plain=""
      href={href}
      onClick={onPick}
      {...props(styles.item, quiet && styles.guide, styles.itemIn, styles.after(place * STAGGER))}
    >
      {children}
    </a>
  );
}

/**
 * The header's menu on a phone: a button of two lines at the header's far
 * edge, and the panel it opens under the header, in the open strip and in the
 * pill alike. The panel holds the header's links, the blog, the manual way
 * and the download, which on a phone sends the link on to a Mac. The lines
 * cross as it opens, the panel comes down from the button and its items follow
 * a step apart; it closes quicker than it opens. A link, Escape, a press
 * outside it, the page running on under it or a wider window all close it,
 * and focus goes into the panel and back to the button. The page behind stays
 * free to scroll: this is a panel, not a sheet.
 */
export function SiteMenu({
  anchor,
  links,
  morph,
}: {
  /** The header's row, which the panel hangs under. */
  anchor: RefObject<HTMLElement | null>;
  /** The header's own links, in the header's order. */
  links: ReadonlyArray<MenuLink>;
  /** The name the header's morph carries the button by. */
  morph: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    const from = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - from) > SCROLL_CLOSE) {
        close();
      }
    };
    const wide = window.matchMedia(WIDE_QUERY);
    window.addEventListener('scroll', onScroll, { passive: true });
    wide.addEventListener('change', close);
    // A download that starts from the menu puts the menu away.
    const stop = onDownloadStarted(close);
    return () => {
      window.removeEventListener('scroll', onScroll);
      wide.removeEventListener('change', close);
      stop();
    };
  }, [open]);

  const pick = () => setOpen(false);

  return (
    <Popover.Root onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        aria-label={open ? m.nav_menu_close() : m.nav_menu_open()}
        data-morph={morph}
        {...props(styles.button, open && styles.buttonOpen, styles.morph(morph))}
      >
        <span
          aria-hidden="true"
          {...props(
            styles.line,
            styles.lineUpper,
            open && styles.lineOpen,
            open && styles.lineUpperOpen,
          )}
        />
        <span
          aria-hidden="true"
          {...props(
            styles.line,
            styles.lineLower,
            open && styles.lineOpen,
            open && styles.lineLowerOpen,
          )}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="center"
          anchor={anchor}
          positionMethod="fixed"
          side="bottom"
          sideOffset={8}
          {...props(styles.positioner)}
        >
          <Popover.Popup aria-label={m.nav_menu()} {...props(styles.panel)}>
            <nav {...props(styles.list)}>
              {links.map((link, place) => (
                <Item href={link.href} key={link.href} onPick={pick} place={place}>
                  {link.heart === true && (
                    <Heart aria-hidden="true" size={HEART_SIZE} strokeWidth={HEART_STROKE} />
                  )}
                  {link.label}
                </Item>
              ))}
            </nav>
            <div aria-hidden="true" {...props(styles.rule)} />
            <Item href={GUIDE_PATH} onPick={pick} place={links.length} quiet>
              {m.nav_manual()}
            </Item>
            <div {...props(styles.itemIn, styles.after((links.length + 1) * STAGGER))}>
              <MacDownload placement="header" style={styles.download} />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
