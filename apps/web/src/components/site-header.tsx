import { Button } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { duration, easing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { BrandMark } from './brand-mark.tsx';

const MARK_SIZE = 24;
/** The strip's ground once the page runs under it: the page, thinned, and blurred behind. */
const SURFACE = `color-mix(in srgb, ${colors.bg} 70%, transparent)`;
const SURFACE_BLUR = 'blur(12px) saturate(1.2)';
/** The home page's sections, by the ids it gives them. */
const HOW_HASH = '#way-out';
const PRICING_HASH = '#pricing';
const WHY_HASH = '#story';
/** The home page's first screen, which holds its download. */
const HERO_HASH = '#download';

const styles = create({
  // A strip across the window: it starts under the work-in-progress strip,
  // stays at the top once that has scrolled away, and gives its own room back
  // through its margin, so the page under it starts where it did. The name
  // stands at one edge and the download at the other, and the links in the
  // middle of the strip between two equal sides. On a phone the one link left
  // goes over to the download, so the name keeps the room.
  bar: {
    alignItems: 'center',
    boxSizing: 'border-box',
    columnGap: spacing.s4,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'minmax(0, 1fr) auto minmax(0, 1fr)',
      default: 'minmax(0, 1fr) auto auto',
    },
    height: brandBar.height,
    insetBlockStart: 0,
    marginBlockEnd: `calc(-1 * ${brandBar.height})`,
    paddingInline: spacing.s4,
    position: 'sticky',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.quick,
    },
    transitionProperty: 'background-color, backdrop-filter',
    transitionTimingFunction: easing.out,
    zIndex: 30,
  },
  // Clear while the page is at its top, so the strip is only the name and the
  // links over the grid. Once the page runs under it, the blurred ground, and
  // no line under it.
  barScrolled: {
    backdropFilter: SURFACE_BLUR,
    backgroundColor: SURFACE,
    WebkitBackdropFilter: SURFACE_BLUR,
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
    minWidth: 0,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
    textTransform: 'lowercase',
  },
  // The button's label at the strip's one weight, at the far edge.
  download: {
    fontWeight: font.weightRegular,
    justifySelf: 'end',
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
  // How it works and why go on a phone, so the name, the price and the
  // download keep one line.
  linkWide: {
    display: {
      '@media (min-width: 640px)': 'inline',
      default: 'none',
    },
  },
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
  },
});

/** Whether the page has left its top, which is when the strip needs its ground. */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function update() {
      setScrolled(window.scrollY > 0);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return scrolled;
}

/**
 * The name, top left on every page and the way home, the home page's two
 * sections and its price in the middle, and the download across from the
 * name. On the home page the download goes back up to the first screen, where
 * it stands; on any other page it goes to how it works, which ends in it.
 */
export function SiteHeader() {
  const scrolled = useScrolled();
  const home = useLocation({ select: (location) => location.pathname === '/' });
  // On the home page a bare hash scrolls in place; with the path in front the
  // browser would load the page again and drop its query.
  const page = home ? '' : '/';

  return (
    <header {...props(styles.bar, scrolled && styles.barScrolled)}>
      <a data-plain="" href="/" {...props(styles.brand)}>
        <BrandMark size={MARK_SIZE} />
        <span {...props(styles.name)}>{m.site_name()}</span>
      </a>
      <nav {...props(styles.nav)}>
        <a data-plain="" href={page + HOW_HASH} {...props(styles.link, styles.linkWide)}>
          {m.nav_how()}
        </a>
        <a data-plain="" href={page + PRICING_HASH} {...props(styles.link)}>
          {m.nav_pricing()}
        </a>
        <a data-plain="" href={page + WHY_HASH} {...props(styles.link, styles.linkWide)}>
          {m.nav_why()}
        </a>
      </nav>
      <Button
        render={<a href={home ? HERO_HASH : page + HOW_HASH} />}
        style={styles.download}
        variant="outline"
      >
        {m.nav_download()}
      </Button>
    </header>
  );
}
