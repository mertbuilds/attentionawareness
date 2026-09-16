import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { subscribeTheme } from '../lib/theme.ts';

/** The paper itself: a shade off the page in both themes. */
const PAPER = `color-mix(in srgb, ${colors.bg} 92%, ${colors.fg})`;
/** Paper grain: one tile of fractal noise, faint, laid over the ground. */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.16 0'/></filter><rect width='160' height='160' filter='url(%23g)'/></svg>\")";
/**
 * The paper the shader draws, one pair per theme. `back` is what PAPER above
 * resolves to (`--kya-bg` mixed 92% with `--kya-fg`): #ebebeb on light, #141414
 * on dark. `front` is the light a fold catches, one shade over it. Both are
 * written out because a shader takes a color, not a `color-mix()`.
 */
const PAPER_SHADER = {
  dark: { back: '#141414', front: '#262626' },
  light: { back: '#ebebeb', front: '#ffffff' },
} as const;

type PaperTheme = keyof typeof PAPER_SHADER;

/** One sheet, milled the same way every time. */
const PAPER_SEED = 5.8;
/** Enough pixels for a 480px sheet at 3x, and no more: a phone draws it too. */
const PAPER_PIXELS = 1_500_000;

/** The dies a sheet is cut with, and the press its lines are printed on. */
const EDGE_FILTER_ID = 'bill-edge';
const SCRAP_EDGE_FILTER_ID = 'bill-edge-scrap';
const INK_FILTER_ID = 'bill-ink';
/**
 * A sheet floats over the page: a tight shadow where it touches it, a wide
 * soft one under it. Both are chained after the edge filter, so they follow
 * the torn outline instead of a rectangle. A white page takes half the weight;
 * the dark pair on it reads as dirt rather than as shadow. A scrap is small,
 * so it is cut finer and sits lower.
 */
const PAPER_FILTER = {
  scrap: {
    dark: `url(#${SCRAP_EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25)) drop-shadow(0 8px 20px rgba(0, 0, 0, 0.35))`,
    light: `url(#${SCRAP_EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12)) drop-shadow(0 8px 20px rgba(0, 0, 0, 0.18))`,
  },
  sheet: {
    dark: `url(#${EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25)) drop-shadow(0 12px 32px rgba(0, 0, 0, 0.35))`,
    light: `url(#${EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12)) drop-shadow(0 12px 32px rgba(0, 0, 0, 0.18))`,
  },
} as const;

/**
 * The texture is WebGL, so it is loaded only where there is a canvas to draw
 * into: the client, and only after it has hydrated.
 */
const PaperTexture = lazy(async () => {
  const shaders = await import('@paper-design/shaders-react');
  return { default: shaders.PaperTexture };
});

const styles = create({
  // The back of the sheet: the ground it is printed on, and the only layer the
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
    filter: PAPER_FILTER.sheet.dark,
  },
  backLight: {
    filter: PAPER_FILTER.sheet.light,
  },
  backScrap: {
    filter: `url(#${SCRAP_EDGE_FILTER_ID})`,
  },
  backScrapDark: {
    filter: PAPER_FILTER.scrap.dark,
  },
  backScrapLight: {
    filter: PAPER_FILTER.scrap.light,
  },
  // The two dies and the press, parked in the page so a sheet can point at
  // them. An SVG has to be rendered for its filters to resolve, so this one is
  // drawn at nothing rather than hidden.
  filterDefs: {
    display: 'block',
    height: 0,
    width: 0,
  },
  // Everything printed on the sheet, pressed into it: the ink filter roughens
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
  // Dark ink on light paper: multiplied, so the grain and the folds under it
  // come through the letters.
  inkLight: {
    mixBlendMode: 'multiply',
  },
  // The surface the shader draws, filling the back layer.
  paper: {
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
  },
  // The box a sheet is laid in: the paper is laid against it, and the ink
  // multiplies with the paper under it and with nothing else.
  root: {
    isolation: 'isolate',
    position: 'relative',
  },
  shader: {
    height: '100%',
    width: '100%',
  },
});

/** What a sheet's own box needs, wherever the sheet is used. */
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
 * The server has no canvas and no theme to read, and it renders that same
 * answer while hydrating, which is what keeps the paper out of the first frame
 * and hydration quiet.
 */
const noPaperTheme = (): PaperTheme | null => null;

/**
 * The surface of the sheet: fibers, crumples and four soft folds, drawn once
 * and left alone. It is behind every line and it never takes a click.
 */
function PaperSurface({ theme }: { theme: PaperTheme }) {
  const paper = PAPER_SHADER[theme];
  return (
    <div {...props(styles.paper)}>
      <Suspense fallback={null}>
        <PaperTexture
          colorBack={paper.back}
          colorFront={paper.front}
          contrast={0.25}
          crumples={0.2}
          crumpleSize={0.35}
          drops={0.1}
          fade={0}
          fiber={0.25}
          fiberSize={0.2}
          fit="cover"
          foldCount={4}
          folds={0.4}
          maxPixelCount={PAPER_PIXELS}
          roughness={0.35}
          scale={0.7}
          seed={PAPER_SEED}
          {...props(styles.shader)}
        />
      </Suspense>
    </div>
  );
}

/**
 * The dies every sheet on the page shares, drawn at nothing and pointed at by
 * id. They belong to the bill, which is the first paper on the page and the
 * only thing a scrap of it can open from, so the bill renders them once and
 * everything else refers to them.
 *
 * `bill-edge` cuts the paper: low fractal noise pushed through a displacement
 * map, so the outline wanders a few pixels the way a torn edge does. It is put
 * on the back layer alone, never on the lines. `bill-edge-scrap` is the same
 * cut at a smaller scale, for a piece the size of a note.
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
          height="110%"
          id={EDGE_FILTER_ID}
          width="110%"
          x="-5%"
          y="-5%"
        >
          <feTurbulence
            baseFrequency="0.015 0.02"
            numOctaves="2"
            result="edgeNoise"
            seed="7"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="edgeNoise"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          colorInterpolationFilters="sRGB"
          height="120%"
          id={SCRAP_EDGE_FILTER_ID}
          width="120%"
          x="-10%"
          y="-10%"
        >
          <feTurbulence
            baseFrequency="0.03 0.04"
            numOctaves="2"
            result="scrapNoise"
            seed="7"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="scrapNoise"
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
 * A piece of paper with something printed on it: the torn back layer, the
 * shadow it floats on, and the ink over it. The box around it is the caller's,
 * and it carries `paperRoot`.
 *
 * A whole sheet takes the shader as well. A scrap does not: a tip opens and
 * closes on every hover, and a WebGL context per hover is a cost a note the
 * size of a hand does not earn.
 */
export function PaperSheet({
  children,
  scrap = false,
  style,
}: {
  children: ReactNode;
  /** A piece the size of a note: cut finer, sitting lower, without a shader. */
  scrap?: boolean;
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
          scrap && styles.backScrap,
          !scrap && theme === 'dark' && styles.backDark,
          !scrap && theme === 'light' && styles.backLight,
          scrap && theme === 'dark' && styles.backScrapDark,
          scrap && theme === 'light' && styles.backScrapLight,
        )}
      >
        {scrap || theme === null ? null : <PaperSurface theme={theme} />}
      </div>
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
