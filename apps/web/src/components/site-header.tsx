import { Button } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { morph } from '../lib/morph.ts';
import { duration, easing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { BrandMark } from './brand-mark.tsx';
import { MacCta, useMacDownload, useSendToMac } from './mac-download.tsx';

const MARK_SIZE = 24;
/**
 * The pill holds the download, 28px tall, with this much room around it, so
 * the pill is as round as the button plus the room.
 */
const PILL_INSET = 6;
const PILL_HEIGHT = 28 + 2 * PILL_INSET;
/**
 * How far down the page the pill takes over, and how far back up the open
 * header returns. The gap between them keeps a page resting near one line
 * from flipping between the two.
 */
const PILL_FROM = 48;
const OPEN_FROM = 16;
/** The home page's sections, by the ids it gives them. */
const HOW_HASH = '#way-out';
const SUPPORT_HASH = '#support';
const WHY_HASH = '#story';

const styles = create({
  // The row of items, laid out as the open strip or as the pill. Every item
  // stands above the ground drawn behind them.
  bar: {
    alignItems: 'center',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    position: 'relative',
  },
  // Open: the name at one edge and the download at the other, and the links
  // in the middle of the strip between two equal sides. On a phone the one
  // link left goes over to the download, so the name keeps the room.
  barOpen: {
    columnGap: spacing.s4,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'minmax(0, 1fr) auto minmax(0, 1fr)',
      default: 'minmax(0, 1fr) auto auto',
    },
    paddingInline: spacing.s4,
  },
  // The pill: the mark, the links and the download, in the middle of
  // the strip and only as wide as they are.
  barPill: {
    alignSelf: 'center',
    display: 'flex',
    gap: {
      '@media (min-width: 640px)': spacing.s6,
      default: spacing.s4,
    },
    height: PILL_HEIGHT,
    justifySelf: 'center',
    paddingBlock: PILL_INSET,
    paddingInlineEnd: PILL_INSET,
    paddingInlineStart: spacing.s2,
  },
  brand: {
    alignItems: 'center',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    display: 'inline-flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    gap: spacing.s2,
    justifySelf: 'start',
    // Held to its grid cell, so the name is cut short there instead of
    // running under the links.
    maxWidth: '100%',
    minWidth: 0,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    position: 'relative',
    textDecorationLine: 'none',
    textTransform: 'lowercase',
  },
  // The download at the far edge, filled in both layouts, so it only travels
  // between them. It keeps the button's own type, as every download on the
  // page does.
  download: {
    justifySelf: 'end',
  },
  // The strip at the top of the window: it starts under the work-in-progress
  // strip, stays at the top once that has scrolled away, and gives its own
  // room back through its margin, so the page under it starts where it did.
  // Only the row takes the pointer, so the page under the pill's sides stays
  // in reach.
  header: {
    display: 'grid',
    height: brandBar.height,
    insetBlockStart: 0,
    marginBlockEnd: `calc(-1 * ${brandBar.height})`,
    pointerEvents: 'none',
    position: 'sticky',
    zIndex: 30,
  },
  hidden: {
    display: 'none',
  },
  link: {
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
    transitionDuration: duration.quick,
    transitionProperty: 'color',
    transitionTimingFunction: easing.out,
    whiteSpace: 'nowrap',
  },
  // How it works and why go on a phone, so the name, the support link and
  // the download keep one line. The pill has no name to make room for, so there
  // only how it works goes.
  linkWide: {
    display: {
      '@media (min-width: 640px)': 'inline',
      default: 'none',
    },
  },
  // The mark, as an item of its own, so it can move without the name.
  mark: {
    display: 'flex',
  },
  // An item the morph carries, by the name a view transition knows it by.
  morph: (name: string) => ({
    viewTransitionName: name,
  }),
  // The name gives way before the links do, on a window too narrow for both.
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nav: {
    alignItems: 'center',
    display: 'flex',
    gap: {
      '@media (min-width: 640px)': spacing.s6,
      default: spacing.s4,
    },
    position: 'relative',
  },
  // The ground behind the row: nothing while the header is open, and the
  // pill once it gathers, the page blurred through a tint of it, a hairline
  // at its edge and a soft shadow under it. Where the reader asked for less
  // transparency it is solid.
  surface: {
    backdropFilter: {
      '@media (prefers-reduced-transparency: reduce)': 'none',
      default: 'blur(16px) saturate(1.4)',
    },
    backgroundColor: {
      '@media (prefers-reduced-transparency: reduce)': colors.bg,
      default: `color-mix(in srgb, ${colors.bg} 65%, transparent)`,
    },
    borderColor: `color-mix(in srgb, ${colors.fg} 10%, transparent)`,
    borderRadius: 0,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: `0 8px 32px ${colors.shadow}`,
    boxSizing: 'border-box',
    inset: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    WebkitBackdropFilter: {
      '@media (prefers-reduced-transparency: reduce)': 'none',
      default: 'blur(16px) saturate(1.4)',
    },
  },
  surfacePill: {
    borderRadius: PILL_HEIGHT / 2,
    opacity: 1,
  },
});

/**
 * The name, top left on every page and the way home, the home page's two
 * sections and its support link in the middle, and the download across from
 * the name. Once the page has run a little way under it, the same items gather
 * into a pill in the middle, the mark alone for the name. The download starts
 * the file at once, as every download on the site does; on a phone or a
 * tablet, which cannot run the app, it sends the link on to a Mac instead.
 */
export function SiteHeader() {
  const [pill, setPill] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLSpanElement>(null);
  const home = useLocation({ select: (location) => location.pathname === '/' });
  // On the home page a bare hash scrolls in place; with the path in front the
  // browser would load the page again and drop its query.
  const page = home ? '' : '/';
  const download = useMacDownload('header');
  const sendToMac = useSendToMac();

  // The pill takes over past one line and gives way above another. Only a
  // change between the two moves anything; the page as it first loads is
  // drawn as it is.
  useEffect(() => {
    let current = false;
    function update(first: boolean) {
      const next = window.scrollY > (current ? OPEN_FROM : PILL_FROM);
      if (next === current) {
        return;
      }
      current = next;
      const root = bar.current;
      const ground = surface.current;
      if (first || root === null || ground === null) {
        setPill(next);
        return;
      }
      morph({
        gather: next,
        root,
        surface: ground,
        update: () => flushSync(() => setPill(next)),
      });
    }
    update(true);
    const onScroll = () => update(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const morphStyle = [styles.download, styles.morph('header-download')];
  let downloadButton: ReactNode;
  if (download.kind === 'unreleased') {
    downloadButton = (
      <Button data-morph="header-download" disabled style={morphStyle}>
        {m.mac_download_unreleased()}
      </Button>
    );
  } else if (download.kind === 'send') {
    downloadButton = (
      <Button data-morph="header-download" onClick={() => void sendToMac.send()} style={morphStyle}>
        <MacCta label={sendToMac.copied ? m.mac_download_copied() : m.nav_download()} />
      </Button>
    );
  } else if (download.kind === 'reading') {
    downloadButton = (
      <Button data-morph="header-download" disabled style={morphStyle}>
        <MacCta label={m.nav_download()} />
      </Button>
    );
  } else {
    downloadButton = (
      <Button
        data-morph="header-download"
        onClick={download.start}
        render={<a download href={download.url} />}
        style={morphStyle}
      >
        <MacCta label={m.nav_download()} />
      </Button>
    );
  }

  return (
    <header {...props(styles.header)}>
      <div ref={bar} {...props(styles.bar, pill ? styles.barPill : styles.barOpen)}>
        <span
          aria-hidden="true"
          ref={surface}
          {...props(styles.surface, pill && styles.surfacePill)}
        />
        <a aria-label={m.site_name()} data-plain="" href="/" {...props(styles.brand)}>
          <span data-morph="header-mark" {...props(styles.mark, styles.morph('header-mark'))}>
            <BrandMark size={MARK_SIZE} />
          </span>
          <span
            data-morph="header-name"
            {...props(styles.name, styles.morph('header-name'), pill && styles.hidden)}
          >
            {m.site_name()}
          </span>
        </a>
        <nav {...props(styles.nav)}>
          <a
            data-morph="header-how"
            data-plain=""
            href={page + HOW_HASH}
            {...props(styles.link, styles.linkWide, styles.morph('header-how'))}
          >
            {m.nav_how()}
          </a>
          <a
            data-morph="header-support"
            data-plain=""
            href={page + SUPPORT_HASH}
            {...props(styles.link, styles.morph('header-support'))}
          >
            {m.nav_support()}
          </a>
          <a
            data-morph="header-why"
            data-plain=""
            href={page + WHY_HASH}
            {...props(styles.link, !pill && styles.linkWide, styles.morph('header-why'))}
          >
            {m.nav_why()}
          </a>
        </nav>
        {downloadButton}
      </div>
    </header>
  );
}
