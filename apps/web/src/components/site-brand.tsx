import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { duration, easing } from '../lib/motion.stylex.ts';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';
import { BrandMark } from './brand-mark.tsx';

const MARK_SIZE = 24;
/** The strip's ground once the page runs under it: the page, thinned, and blurred behind. */
const SURFACE = `color-mix(in srgb, ${colors.bg} 85%, transparent)`;
const SURFACE_BLUR = 'blur(12px)';

const styles = create({
  // Wider than a phone, only the name, fixed in the corner over the page. On a
  // phone, a strip across the window: it starts under the work-in-progress
  // strip, stays at the top once that has scrolled away, and gives its own
  // room back through its margin, so the page under it starts where it did.
  bar: {
    alignItems: 'center',
    borderBlockEndColor: 'transparent',
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: {
      '@media (min-width: 640px)': 0,
      default: 1,
    },
    boxSizing: 'border-box',
    display: 'flex',
    height: {
      '@media (min-width: 640px)': 'auto',
      default: brandBar.height,
    },
    insetBlockStart: {
      '@media (min-width: 640px)': `calc(${spacing.s4} + ${wip.height})`,
      default: 0,
    },
    insetInlineStart: {
      '@media (min-width: 640px)': spacing.s4,
      default: null,
    },
    marginBlockEnd: {
      '@media (min-width: 640px)': 0,
      default: `calc(-1 * ${brandBar.height})`,
    },
    paddingInline: {
      '@media (min-width: 640px)': 0,
      default: spacing.s4,
    },
    position: {
      '@media (min-width: 640px)': 'fixed',
      default: 'sticky',
    },
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.quick,
    },
    transitionProperty: 'background-color, border-color, backdrop-filter',
    transitionTimingFunction: easing.out,
    zIndex: 30,
  },
  // Clear while the page is at its top, so the strip is only the name over the
  // grid. Once the page runs under it, a phone gets the ground and the hairline.
  barScrolled: {
    backdropFilter: {
      '@media (min-width: 640px)': 'none',
      default: SURFACE_BLUR,
    },
    backgroundColor: {
      '@media (min-width: 640px)': 'transparent',
      default: SURFACE,
    },
    borderBlockEndColor: {
      '@media (min-width: 640px)': 'transparent',
      default: colors.border,
    },
    WebkitBackdropFilter: {
      '@media (min-width: 640px)': 'none',
      default: SURFACE_BLUR,
    },
  },
  link: {
    alignItems: 'center',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    display: 'inline-flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    textDecorationLine: 'none',
    textTransform: 'lowercase',
  },
});

/** Whether the page has left its top, which is when a phone's strip needs its ground. */
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

/** The name, top left on every page, and the way home. */
export function SiteBrand() {
  const scrolled = useScrolled();

  return (
    <header {...props(styles.bar, scrolled && styles.barScrolled)}>
      <a data-plain="" href="/" {...props(styles.link)}>
        <BrandMark size={MARK_SIZE} />
        {m.site_name()}
      </a>
    </header>
  );
}
