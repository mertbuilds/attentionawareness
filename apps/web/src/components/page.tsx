import { Separator } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, keyframes, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { distance, duration, easing } from '../lib/motion.stylex.ts';
import { ink } from '../lib/reading.stylex.ts';
import { GridTexture } from './grid-texture.tsx';
import { SiteFooter } from './site-footer.tsx';

/**
 * The ruling is full under the title and gone before the band ends, so the
 * first line of the page's own text always stands on plain ground.
 */
const MASK = 'linear-gradient(to bottom, black 0%, black 30%, transparent 92%)';
/** A warm light in the band's far corner: the brand's orange, barely there. */
const GLOW = `radial-gradient(ellipse 60% 90% at 88% 0%, color-mix(in srgb, ${accent.base} 14%, transparent), transparent 70%)`;

const rise = keyframes({
  from: {
    opacity: 0,
    transform: `translateY(${distance.base})`,
  },
});

/** Each part of a page's head comes in a little after the one above it. */
const STAGGER = ['0ms', '60ms', '120ms'];

export const page = create({
  // A paragraph whose box sets the room around it, as in a page's head.
  flush: {
    margin: 0,
  },
  // A heading inside a page's column: medium, never bold.
  sectionTitle: {
    color: colors.fg,
    fontSize: {
      '@media (min-width: 640px)': 26,
      default: 22,
    },
    fontWeight: font.weightMedium,
    letterSpacing: '-0.015em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // A heading, then what it says, close under it.
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  text: {
    color: ink.text,
    fontSize: {
      '@media (min-width: 640px)': 18,
      default: 17,
    },
    lineHeight: 1.65,
    margin: 0,
    textWrap: 'pretty',
  },
});

const styles = create({
  band: {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    paddingBlockEnd: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    // Clear of the header strip over the top of the window, and a step more.
    paddingBlockStart: {
      '@media (min-width: 640px)': `calc(${brandBar.height} + 72px)`,
      default: `calc(${brandBar.height} + ${spacing.s8})`,
    },
    paddingInline: spacing.s4,
    position: 'relative',
    width: '100%',
  },
  // The 404 has nothing under its head, so the band takes the room the
  // footer leaves and sets the words in its middle.
  bandFill: {
    alignItems: 'center',
    flexGrow: 1,
    // It centres its words in whatever room is left, so it needs little of
    // its own: the footer then fits under it in a desktop window.
    paddingBlockEnd: spacing.s8,
    paddingBlockStart: `calc(${brandBar.height} + ${spacing.s8})`,
  },
  bandGlow: {
    backgroundImage: GLOW,
    inset: 0,
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: -1,
  },
  // The home page's graph paper, the size of the band and no more, its
  // squares centred on the page.
  bandGrid: {
    backgroundPosition: 'center top',
    height: 'auto',
    insetBlockEnd: 0,
    maskImage: MASK,
    WebkitMaskImage: MASK,
  },
  callout: {
    backgroundColor: `color-mix(in srgb, ${accent.base} 6%, ${colors.bg})`,
    borderColor: accent.base,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    padding: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
  },
  card: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: `0 1px 2px ${colors.shadow}, 0 12px 32px -20px ${colors.shadow}`,
    boxSizing: 'border-box',
    padding: {
      '@media (min-width: 640px)': spacing.s6,
      default: spacing.s4,
    },
  },
  column: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
    width: '100%',
  },
  // About 66 characters a line at the reading size.
  columnReading: {
    maxWidth: `calc(680px + 2 * ${spacing.s4})`,
  },
  columnWide: {
    maxWidth: `calc(760px + 2 * ${spacing.s4})`,
  },
  enter: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: rise,
    },
    animationTimingFunction: easing.smoothOut,
  },
  head: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 680,
    width: '100%',
  },
  headCentered: {
    alignItems: 'center',
    textAlign: 'center',
  },
  headWide: {
    maxWidth: 760,
  },
  intro: {
    color: ink.lead,
    display: 'flex',
    flexDirection: 'column',
    fontSize: {
      '@media (min-width: 640px)': 20,
      default: 18,
    },
    gap: spacing.s3,
    lineHeight: 1.5,
    textWrap: 'pretty',
  },
  meta: {
    alignItems: 'center',
    color: colors.muted,
    columnGap: spacing.s3,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.5,
    listStyle: 'none',
    margin: 0,
    marginBlockStart: spacing.s2,
    padding: 0,
    rowGap: spacing.s1,
  },
  metaItem: {
    alignItems: 'center',
    columnGap: spacing.s3,
    display: 'inline-flex',
  },
  // A small orange dot between two facts on the line.
  metaDot: {
    backgroundColor: accent.base,
    borderRadius: '50%',
    height: 4,
    width: 4,
  },
  // The orange the prose rules in `app.css` read, handed in from its one source.
  prose: {
    '--prose-accent': accent.base,
    '--prose-accent-soft': accent.soft,
  },
  root: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    // The padding counts inside the window's height, so a short page's footer
    // stands at the window's foot rather than a scroll below it.
    boxSizing: 'border-box',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    // The stacking context that keeps the band's paper over the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: firstThatWorks('100svh', '100vh'),
    overflowX: 'clip',
    paddingBlockEnd: spacing.s16,
    position: 'relative',
  },
  title: {
    fontSize: {
      '@media (min-width: 640px)': 48,
      default: 34,
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.03em',
    lineHeight: 1.06,
    margin: 0,
    textWrap: 'balance',
  },
  // The orange square the title starts from, one cell of graph paper inked in.
  // It stands at the middle of the title's first line, and a second line
  // starts under the first, not under the square.
  titleMark: {
    backgroundColor: accent.base,
    borderRadius: 2,
    flexShrink: 0,
    height: '0.26em',
    marginTop: 'calc((1lh - 0.26em) / 2)',
    width: '0.26em',
  },
  titleRow: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: '0.32em',
  },
});

/** The plain ground a page stands on: the band at the top, then its column. */
export function PageRoot({ children }: { children: ReactNode }) {
  return <main {...props(styles.root)}>{children}</main>;
}

/**
 * The head of a page: the graph paper, with a warm light in its far corner,
 * behind the title, what follows it and the line of facts.
 * The paper fades before the band ends, so no line of the text under it is
 * ever drawn on the ruling.
 */
export function PageHeader({
  centered = false,
  children,
  fill = false,
  meta = [],
  title,
  wide = false,
}: {
  centered?: boolean;
  children?: ReactNode;
  /** Take every bit of the window the footer does not: for a page with nothing under its head. */
  fill?: boolean;
  meta?: ReadonlyArray<ReactNode>;
  title: string;
  wide?: boolean;
}) {
  return (
    <header {...props(styles.band, fill && styles.bandFill)}>
      <div aria-hidden="true" {...props(styles.bandGlow)} />
      <GridTexture style={styles.bandGrid} />
      <div {...props(styles.head, wide && styles.headWide, centered && styles.headCentered)}>
        <h1
          style={{ animationDelay: STAGGER[0] }}
          {...props(styles.enter, styles.title, styles.titleRow)}
        >
          <span aria-hidden="true" {...props(styles.titleMark)} />
          <span>{title}</span>
        </h1>
        {children !== undefined && (
          <div style={{ animationDelay: STAGGER[1] }} {...props(styles.enter, styles.intro)}>
            {children}
          </div>
        )}
        {meta.length > 0 && (
          <ul style={{ animationDelay: STAGGER[2] }} {...props(styles.enter, styles.meta)}>
            {meta.map((fact, index) => (
              // The facts are fixed for the page, so their place is their key.
              <li key={index} {...props(styles.metaItem)}>
                {index > 0 && <span aria-hidden="true" {...props(styles.metaDot)} />}
                {fact}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

/**
 * The column a page's own content stands in, on plain ground. `reading` is
 * the measure for long text; `wide` is for numbers, tools and cards.
 */
export function PageColumn({
  children,
  width = 'reading',
}: {
  children: ReactNode;
  width?: 'reading' | 'wide';
}) {
  return (
    <div {...props(styles.column, width === 'reading' ? styles.columnReading : styles.columnWide)}>
      {children}
    </div>
  );
}

/** The foot of every page: a rule and the site's footer. */
export function PageFoot() {
  return (
    <>
      <Separator />
      <SiteFooter />
    </>
  );
}

/** A note the reader must not miss, in the orange: a warning, an ask. */
export function Callout({
  as: Tag = 'aside',
  children,
}: {
  as?: 'aside' | 'section' | 'nav';
  children: ReactNode;
}) {
  return <Tag {...props(styles.callout)}>{children}</Tag>;
}

/**
 * Long text, set by the prose rules in `app.css`: either the HTML a post was
 * compiled to, or the page's own elements. `small` is the quieter size, for
 * a list of sources.
 */
export function Prose({
  as: Tag = 'div',
  children,
  html,
  small = false,
}: {
  as?: 'article' | 'div';
  children?: ReactNode;
  html?: string;
  small?: boolean;
}) {
  const box = { 'data-prose': small ? 'small' : '', ...props(styles.prose) };
  if (html !== undefined) {
    // Only HTML this repo compiled from its own files (`vite.blog.ts`) comes in here.
    return <Tag dangerouslySetInnerHTML={{ __html: html }} {...box} />;
  }
  return <Tag {...box}>{children}</Tag>;
}

/** A calm raised surface: the page's ground, a hairline and a soft shadow. */
export const card = styles.card;
