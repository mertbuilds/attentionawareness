import { colors } from '@attentionawareness/ui/tokens.stylex';
import type { PaperTextureProps } from '@paper-design/shaders-react';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { FC, ReactNode, RefObject } from 'react';
import { duration, easing } from '../lib/motion.stylex.ts';
import { subscribeTheme } from '../lib/theme.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';

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
/** One sheet, milled the same way every time. */
const PAPER_SEED = 5.8;
/** Enough pixels for a column-wide sheet, and no more: a phone draws it too. */
const PAPER_PIXELS = 1_500_000;
/** How far off screen, in window heights, a letter may be and still keep its texture drawn. */
const NEAR = '50% 0px';

type PaperTheme = keyof typeof PAPER_SHADER;

/** The dies a scrap and a whole sheet are cut with, and the press a scrap's lines are printed on. */
const EDGE_FILTER_ID = 'bill-edge';
const SHEET_EDGE_FILTER_ID = 'bill-edge-sheet';
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

/** A whole sheet is cut coarser than a scrap and floats higher, on the same two weights of shadow. */
const SHEET_FILTER = {
  dark: `url(#${SHEET_EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25)) drop-shadow(0 12px 32px rgba(0, 0, 0, 0.35))`,
  light: `url(#${SHEET_EDGE_FILTER_ID}) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12)) drop-shadow(0 12px 32px rgba(0, 0, 0, 0.18))`,
} as const;

/** What stands in for the texture when its code cannot be had: nothing, over the plain paper. */
const NoTexture: FC<PaperTextureProps> = () => null;

/**
 * The texture is WebGL, so it is loaded only where there is a canvas to draw
 * into, and only once a letter is near the window: the page's first paint
 * never waits for it. It is an extra: a chunk that does not load leaves the
 * plain paper, and never takes the page down with it.
 */
const PaperTexture = lazy(async (): Promise<{ default: FC<PaperTextureProps> }> => {
  try {
    // Named in the import itself, so the chunk carries this one shader and
    // not the library's others.
    const { PaperTexture: texture } = await import('@paper-design/shaders-react');
    return { default: texture };
  } catch {
    return { default: NoTexture };
  }
});

/**
 * Holds what is drawn inside it to itself: if the texture throws as it is
 * drawn, a browser whose WebGL gives out part way, it draws nothing in its
 * place, and the sheet stays the plain paper with its words.
 */
class OrNothing extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The texture comes in over the plain paper under it rather than at once. */
const appear = keyframes({
  from: { opacity: 0 },
});

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
  // A letter's sheet: the same paper, cut with the coarser die.
  backLetter: {
    filter: `url(#${SHEET_EDGE_FILTER_ID})`,
  },
  backLetterDark: {
    filter: SHEET_FILTER.dark,
  },
  backLetterLight: {
    filter: SHEET_FILTER.light,
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
  // What is written on a letter. The ink is put on block by block rather
  // than on this layer (`data-paper` in `app.css`): a letter is long, and
  // one filter over all of it would be drawn again whenever a part of it
  // changed. It comes after the paper and is positioned, so
  // it is drawn over it, but it takes no z-index: that would close it off as
  // a layer of its own, and the blocks' ink would multiply with nothing
  // instead of with the paper under them.
  letterInk: {
    position: 'relative',
  },
  // The surface the shader draws, filling the back layer.
  paper: {
    animationDuration: duration.slow,
    animationName: appear,
    animationTimingFunction: easing.smoothOut,
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
  },
  // The box a scrap is laid in: the paper is laid against it, and the ink
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

/** Whether this browser can draw the texture at all. Asked once, and only in a browser. */
let webgl: boolean | undefined;
function canDrawPaper(): boolean {
  if (webgl === undefined) {
    try {
      webgl = document.createElement('canvas').getContext('webgl2') !== null;
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

/**
 * Whether the element in `ref` is on screen or within half a window of it.
 * The texture is drawn only then, so a letter far up or down the page holds
 * no canvas, and it is already there by the time the letter scrolls in.
 */
function useNear(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const watch = new IntersectionObserver(
      (entries) => setNear(entries.at(-1)?.isIntersecting === true),
      { rootMargin: NEAR },
    );
    watch.observe(element);
    return () => watch.disconnect();
  }, [ref]);

  return near;
}

/**
 * The surface of a sheet: fibers, crumples and four soft folds, drawn once
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
 * The dies and the press every piece of paper on the page shares, drawn at
 * nothing and pointed at by id. The steps of the way out render them once,
 * and every scrap a tip opens on, and the letter, refer to them.
 *
 * `bill-edge` cuts a scrap: low fractal noise pushed through a displacement
 * map, so the outline wanders a few pixels the way a torn edge does. It is put
 * on the back layer alone, never on the lines. `bill-edge-sheet` is the same
 * cut at a larger scale, for a whole sheet.
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
          height="110%"
          id={SHEET_EDGE_FILTER_ID}
          width="110%"
          x="-5%"
          y="-5%"
        >
          <feTurbulence
            baseFrequency="0.015 0.02"
            numOctaves="2"
            result="sheetNoise"
            seed="7"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="sheetNoise"
            scale="7"
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

/**
 * A whole sheet with a letter on it: the paper, a shade off the page in both
 * themes as a scrap is, torn at its edge and floating on its shadow, and what
 * is written on it in the theme's ink. It follows the theme the reader chose,
 * not only the system's: light paper and dark ink on the light theme, gray
 * paper and light ink on the dark one. Every title, paragraph and picture on
 * it is printed the way a scrap's lines are: pressed through the ink filter,
 * multiplied into the light paper or thinned a little on the dark one. That,
 * and a muted ink and hairlines a step stronger than the page's, is in
 * `app.css` under `data-paper`, by the `data-ink` this sheet states.
 *
 * The paper's texture is a shader, loaded and drawn only while the letter is
 * near the window, never for a reader who asked for less motion and never
 * where the browser has no WebGL. Under it, and in its place then, the sheet
 * is the plain paper with its grain and its torn edge, which is also what the
 * server draws.
 */
export function PaperLetter({
  children,
  ink,
  style,
}: {
  children: ReactNode;
  /** The layout what is written takes inside the sheet. */
  ink?: StyleXStyles;
  /** The sheet's own box: its padding and its width. */
  style?: StyleXStyles;
}) {
  const theme = useSyncExternalStore(subscribePaperTheme, readPaperTheme, noPaperTheme);
  const sheet = useRef<HTMLDivElement>(null);
  const near = useNear(sheet);
  const reduced = useLessMotion();
  const textured = theme !== null && near && !reduced && canDrawPaper();

  return (
    <div
      data-ink={theme ?? undefined}
      data-paper="letter"
      ref={sheet}
      {...props(styles.root, style)}
    >
      <div
        aria-hidden="true"
        {...props(
          styles.back,
          styles.backLetter,
          theme === 'dark' && styles.backLetterDark,
          theme === 'light' && styles.backLetterLight,
        )}
      >
        {textured ? (
          <OrNothing key={theme}>
            <PaperSurface theme={theme} />
          </OrNothing>
        ) : null}
      </div>
      <div {...props(styles.letterInk, ink)}>{children}</div>
    </div>
  );
}
