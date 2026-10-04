import { Button } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Heart } from 'reicon-react';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { morph } from '../lib/morph.ts';
import { duration, easing } from '../lib/motion.stylex.ts';
import { SECTION } from '../lib/sections.ts';
import { m } from '../paraglide/messages.js';
import { BrandMark } from './brand-mark.tsx';
import { MacCta, sendLabel, ShareCta, useMacDownload, useSendToMac } from './mac-download.tsx';
import { SiteMenu } from './site-menu.tsx';

const MARK_SIZE = 24;
/** The heart before the support link, as tall as the link's letters are set. */
const HEART_SIZE = 14;
/** A line as heavy as the letters beside it, in the icon's own 24-unit grid. */
const HEART_STROKE = 2.25;
/**
 * The pill holds the download, 28px tall, with this much room around it, so
 * the pill is as round as the button plus the room.
 */
const PILL_INSET = 6;
const PILL_HEIGHT = 28 + 2 * PILL_INSET;
/**
 * In the pill the mark is a circle as far from the pill's end as from its
 * top and its foot, the same room the download has at the other end, so both
 * ends are round inside round: the circle's radius is the pill's less that
 * room.
 */
const PILL_MARK = PILL_HEIGHT - 2 * PILL_INSET;
/**
 * How far down the page the pill takes over, and how far back up the open
 * header returns. The gap between them keeps a page resting near one line
 * from flipping between the two.
 */
const PILL_FROM = 48;
const OPEN_FROM = 16;
/**
 * The header's links, in the order they stand: the home page's sections, by
 * the ids it gives them, then the blog, a page of its own. `name` is what the
 * morph carries each one by.
 */
const LINKS = [
  { hash: `#${SECTION.wayOut}`, label: m.nav_how, name: 'header-how' },
  { hash: `#${SECTION.support}`, heart: true, label: m.nav_support, name: 'header-support' },
  { hash: `#${SECTION.story}`, label: m.nav_why, name: 'header-why' },
  { hash: `#${SECTION.faq}`, label: m.nav_faq, name: 'header-faq' },
  { label: m.nav_blog, name: 'header-blog', path: '/blog' },
] as const;

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
  // in the middle of the strip between two equal sides. A window too narrow
  // for the links keeps the name and, at the other edge, the menu's button.
  barOpen: {
    columnGap: spacing.s4,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'minmax(0, 1fr) auto minmax(0, 1fr)',
      default: 'minmax(0, 1fr) auto',
    },
    paddingInline: spacing.s4,
  },
  // The pill: the mark, the links and the download, in the middle of
  // the strip and only as wide as they are. On a narrow window it is the mark,
  // the download and the menu's button.
  barPill: {
    alignSelf: 'center',
    display: 'flex',
    gap: {
      '@media (min-width: 768px)': spacing.s6,
      default: spacing.s3,
    },
    height: PILL_HEIGHT,
    justifySelf: 'center',
    paddingBlock: PILL_INSET,
    paddingInline: PILL_INSET,
  },
  brand: {
    alignItems: 'center',
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
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
  // A narrow window's open strip has room for the name or the download, not
  // both. The name stays; the download is in the menu there, and comes back
  // in the pill, which has no name.
  downloadRoomy: {
    display: {
      '@media (min-width: 768px)': 'inline-flex',
      default: 'none',
    },
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
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
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
  // The support link and the heart before it, in one row and one colour.
  linkHeart: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  // In the pill the way home is the mark alone, so its focus line is round too.
  brandPill: {
    borderRadius: '50%',
  },
  // The mark, as an item of its own, so it can move without the name. It is
  // cut to the tile's own corner in the open strip, and to a circle in the
  // pill. The morph carries it live, from the one shape to the other.
  mark: {
    borderRadius: '12.5%',
    display: 'flex',
    overflow: 'hidden',
  },
  markRound: {
    borderRadius: '50%',
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
  // The links in a row, on a window wide enough for all of them beside the
  // name. Under that they are in the menu.
  nav: {
    alignItems: 'center',
    display: {
      '@media (min-width: 768px)': 'flex',
      default: 'none',
    },
    gap: spacing.s6,
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
 * The name, top left on every page and the way home, the home page's
 * sections, its support link with a heart before it, and the blog in the
 * middle, and the download across from the name. Once the page has run a
 * little way under it, the same items gather into a pill in the middle, the
 * mark alone for the name, and round there, as the pill's end and the
 * download at the other end are. A window too narrow for the links has the menu's
 * button of two lines at the far edge instead, and the links in the menu it
 * opens. The download starts the file at once, as every download on the site
 * does; on a phone or a tablet, which cannot run the app, it is the share
 * link that sends the page on to a Mac instead.
 */
export function SiteHeader() {
  const [pill, setPill] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLSpanElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const home = useLocation({ select: (location) => location.pathname === '/' });
  // On the home page a bare hash scrolls in place; with the path in front the
  // browser would load the page again and drop its query.
  const page = home ? '' : '/';
  const download = useMacDownload('header');
  const sendToMac = useSendToMac();
  const links = LINKS.map((link) => ({
    heart: 'heart' in link,
    href: 'path' in link ? link.path : page + link.hash,
    label: link.label(),
    name: link.name,
  }));

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
        live: mark.current === null ? [] : [mark.current],
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

  const morphStyle = [
    styles.download,
    !pill && styles.downloadRoomy,
    styles.morph('header-download'),
  ];
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
        <ShareCta label={sendLabel(sendToMac.copied)} />
      </Button>
    );
  } else if (download.kind === 'reading') {
    // The server cannot tell a phone, so it draws both and the mark the head
    // script puts on a phone's root shows the one that will stay.
    downloadButton = (
      <Button data-morph="header-download" disabled style={morphStyle}>
        <span data-aa-computer="">
          <MacCta label={m.nav_download()} />
        </span>
        <span data-aa-phone="">
          <ShareCta label={m.mac_download_share()} />
        </span>
      </Button>
    );
  } else {
    downloadButton = (
      <Button
        data-morph="header-download"
        onClick={download.start}
        render={<a download={download.filename} href={download.url} />}
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
        <a
          aria-label={m.site_name()}
          data-plain=""
          href="/"
          {...props(styles.brand, pill && styles.brandPill)}
        >
          <span ref={mark} {...props(styles.mark, pill && styles.markRound)}>
            <BrandMark size={pill ? PILL_MARK : MARK_SIZE} />
          </span>
          <span
            data-morph="header-name"
            {...props(styles.name, styles.morph('header-name'), pill && styles.hidden)}
          >
            {m.site_name()}
          </span>
        </a>
        <nav aria-label={m.nav_site()} {...props(styles.nav)}>
          {links.map((link) => (
            <a
              data-morph={link.name}
              data-plain=""
              href={link.href}
              key={link.name}
              {...props(styles.link, link.heart && styles.linkHeart, styles.morph(link.name))}
            >
              {link.heart && (
                <Heart aria-hidden="true" size={HEART_SIZE} strokeWidth={HEART_STROKE} />
              )}
              {link.label}
            </a>
          ))}
        </nav>
        {downloadButton}
        <SiteMenu anchor={bar} links={links} morph="header-menu" />
      </div>
    </header>
  );
}
