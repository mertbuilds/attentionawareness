import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { subscribeTheme } from '../lib/theme.ts';

/** The paper itself: a shade off the page in both themes. */
const PAPER = `color-mix(in srgb, ${colors.bg} 92%, ${colors.fg})`;
/** Paper grain: one tile of fractal noise, faint, laid over the ground. */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.16 0'/></filter><rect width='160' height='160' filter='url(%23g)'/></svg>\")";

type PaperTheme = 'dark' | 'light';

/** The die a scrap is cut with, and the press its lines are printed on. */
const EDGE_FILTER_ID = 'bill-edge';
const INK_FILTER_ID = 'bill-ink';
/**
 * A scrap floats over the page: a tight shadow where it touches it, a wide
 * soft one under it. Both are chained after the edge filter, so they follow
 * the torn outline instead of a rectangle. A white page takes half the weight;
 * the dark pair on it reads as dirt rather than as shadow.
 */
const PAPER_FILTER = {
  dark: `url(#${EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25)) drop-shadow(0 8px 20px rgba(0, 0, 0, 0.35))`,
  light: `url(#${EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12)) drop-shadow(0 8px 20px rgba(0, 0, 0, 0.18))`,
} as const;

const styles = create({
  // The back of the scrap: the ground it is printed on, and the only layer the
  // edge filter touches. The lines sit over it untouched, so a torn outline
  // never smears a letter.
  back: {
    backgroundColor: PAPER,
    backgroundImage: PAPER_GRAIN,
    filter: `url(#${EDGE_FILTER_ID})`,
    inset: 0,
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: 0,
  },
  backDark: {
    filter: PAPER_FILTER.dark,
  },
  backLight: {
    filter: PAPER_FILTER.light,
  },
  // The die and the press, parked in the page so a scrap can point at them. An
  // SVG has to be rendered for its filters to resolve, so this one is drawn at
  // nothing rather than hidden.
  filterDefs: {
    display: 'block',
    height: 0,
    width: 0,
  },
  // Everything printed on the scrap, pressed into it: the ink filter roughens
  // the glyph edges and takes a few percent off the coverage, the way a till
  // head that has printed all day lays it down.
  ink: {
    filter: `url(#${INK_FILTER_ID})`,
    position: 'relative',
    zIndex: 1,
  },
  // Light ink on dark paper: multiplying would wipe it out, so it is only
  // thinned a little.
  inkDark: {
    opacity: 0.94,
  },
  // Dark ink on light paper: multiplied, so the grain under it comes through
  // the letters.
  inkLight: {
    mixBlendMode: 'multiply',
  },
  // The box a scrap is laid in: the paper is laid against it, and the ink
  // multiplies with the paper under it and with nothing else.
  root: {
    isolation: 'isolate',
    position: 'relative',
  },
});

/** What a scrap's own box needs, wherever the scrap is used. */
export const paperRoot: StyleXStyles = styles.root;

/** The paper the theme is asking for, read off the document the CSS reads. */
function readPaperTheme(): PaperTheme | null {
  const forced = document.documentElement.dataset['theme'];
  if (forced === 'dark' || forced === 'light') {
    return forced;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme changes from the switch in the footer, or from the system itself. */
function subscribePaperTheme(onChange: () => void): () => void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  dark.addEventListener('change', onChange);
  const unsubscribe = subscribeTheme(onChange);
  return () => {
    dark.removeEventListener('change', onChange);
    unsubscribe();
  };
}

/**
 * The server has no theme to read, and it renders that same answer while
 * hydrating, which keeps hydration quiet.
 */
const noPaperTheme = (): PaperTheme | null => null;

/**
 * The die and the press every scrap on the page shares, drawn at nothing and
 * pointed at by id. The steps of the way out render them once, and every scrap a tip opens
 * on refers to them.
 *
 * `bill-edge` cuts the paper: low fractal noise pushed through a displacement
 * map, so the outline wanders a few pixels the way a torn edge does. It is put
 * on the back layer alone, never on the lines.
 *
 * `bill-ink` prints them: a high noise displaces the glyphs by about a pixel,
 * and the same noise, turned into an alpha mask, takes a few percent of the
 * coverage back out in patches. Together they are a till head laying ink down,
 * not a blur.
 */
export function BillFilters() {
  return (
    <svg aria-hidden="true" height="0" width="0" {...props(styles.filterDefs)}>
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          height="120%"
          id={EDGE_FILTER_ID}
          width="120%"
          x="-10%"
          y="-10%"
        >
          <feTurbulence
            baseFrequency="0.03 0.04"
            numOctaves="2"
            result="edgeNoise"
            seed="7"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="edgeNoise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          colorInterpolationFilters="sRGB"
          height="104%"
          id={INK_FILTER_ID}
          width="104%"
          x="-2%"
          y="-2%"
        >
          <feTurbulence
            baseFrequency="0.9"
            numOctaves="1"
            result="inkNoise"
            seed="3"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="inkNoise"
            result="rough"
            scale="1"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          {/* The noise again as an alpha mask, between 0.90 and 0.96: the ink
          is a touch thinner in some patches than in others, never gone. */}
          <feColorMatrix
            in="inkNoise"
            result="coverage"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0 0.9"
          />
          <feComposite in="rough" in2="coverage" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * A scrap of paper the size of a note with something printed on it: the torn
 * back layer, the shadow it floats on, and the ink over it. The box around it
 * is the caller's, and it carries `paperRoot`.
 */
export function PaperSheet({
  children,
  style,
}: {
  children: ReactNode;
  /** The layout the printed side takes inside the box. */
  style?: StyleXStyles;
}) {
  const theme = useSyncExternalStore(subscribePaperTheme, readPaperTheme, noPaperTheme);
  return (
    <>
      <div
        aria-hidden="true"
        {...props(
          styles.back,
          theme === 'dark' && styles.backDark,
          theme === 'light' && styles.backLight,
        )}
      />
      <div
        {...props(
          styles.ink,
          theme === 'dark' && styles.inkDark,
          theme === 'light' && styles.inkLight,
          style,
        )}
      >
        {children}
      </div>
    </>
  );
}
