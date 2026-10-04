import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, radius } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { easing } from '../lib/motion.stylex.ts';

/**
 * The other uses' glyphs, each telling its case in one small motion. They
 * are drawn in the manner of Lucide's icons (https://lucide.dev, ISC License,
 * Copyright (c) Lucide Icons and Contributors) on its 24-unit grid: an eye
 * that gets struck through, a grid of apps that loses one, a lock that
 * closes, a briefcase that latches. Each is drawn as it stands once its
 * motion is over, so the server, a reader who asked for less motion, and the
 * time before it plays all show it finished; the motion runs from a start
 * kept in its keyframes.
 */

/** The plate, and the glyph on it, in pixels. */
const PLATE = 36;
const GLYPH = 22;
/** How long a part's motion takes, in milliseconds. */
const PLAY = 750;
/** How long a part may wait before it moves, in milliseconds. */
const WAIT = { late: 150, later: 300 } as const;
/** How long a glyph's whole motion takes, its latest part included, in milliseconds. */
export const GLYPH_TIME = PLAY + WAIT.later;

/** A line drawn by a pen, from its start to its end. */
const draw = keyframes({
  from: { strokeDashoffset: 1 },
});
/** A part that goes: there, then gone. */
const vanish = keyframes({
  '0%': { opacity: 1, transform: 'scale(1)' },
  '100%': { opacity: 0, transform: 'scale(0.4)' },
  '35%': { opacity: 1, transform: 'scale(1)' },
});
/** A part that comes once the rest has moved. */
const appear = keyframes({
  '0%': { opacity: 0 },
  '60%': { opacity: 0 },
});
/** A part that drops into place: a lock's shackle, a briefcase's clasp. */
const drop = keyframes({
  '0%': { transform: 'translateY(-3.5px)' },
  '45%': { transform: 'translateY(-3.5px)' },
});

const styles = create({
  // A line of the glyph, in the one orange.
  line: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.75,
  },
  // A filled part, in the orange too.
  solid: {
    fill: accent.base,
  },
  // The space a crossed out part leaves, drawn as a quiet dashed outline.
  slot: {
    fill: 'none',
    stroke: accent.base,
    strokeDasharray: '2 2',
    strokeWidth: 1.25,
  },
  // A soft square of the orange the glyph stands on, in the page's corner.
  plate: {
    alignItems: 'center',
    backgroundColor: `color-mix(in srgb, ${accent.base} 12%, ${colors.bg})`,
    borderRadius: radius.base,
    display: 'flex',
    flexShrink: 0,
    height: PLATE,
    justifyContent: 'center',
    width: PLATE,
  },
  svg: {
    display: 'block',
    overflow: 'visible',
  },
  // How every motion runs, only while the glyph plays.
  late: {
    animationDelay: `${WAIT.late}ms`,
  },
  later: {
    animationDelay: `${WAIT.later}ms`,
  },
  moving: {
    animationDuration: `${PLAY}ms`,
    animationFillMode: 'backwards',
    animationTimingFunction: easing.smoothOut,
  },
  // The motions themselves, none of them with less motion.
  appear: {
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: appear,
    },
  },
  draw: {
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: draw,
    },
  },
  drop: {
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: drop,
    },
  },
  vanish: {
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: vanish,
    },
  },
  // A line the pen draws: its length counts as one.
  pen: {
    strokeDasharray: 1,
  },
  // A part that moves about its own middle.
  own: {
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
});

/** Which glyph a case wears. */
export type GlyphName = 'apps' | 'eye' | 'lock' | 'work';

/** The parts of each glyph, as they stand once its motion is over. */
function parts(name: GlyphName, play: boolean): ReactNode {
  type Motion = 'appear' | 'draw' | 'drop' | 'vanish';
  const moving = (motion: Motion, wait?: 'late' | 'later') =>
    play && [styles.moving, styles[motion], wait !== undefined && styles[wait]];
  switch (name) {
    case 'eye':
      // An eye, then a line drawn through it.
      return (
        <>
          <path
            d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
            {...props(styles.line)}
          />
          <circle cx={12} cy={12} r={2.75} {...props(styles.line)} />
          <path
            d="M4 4l16 16"
            pathLength={1}
            {...props(styles.line, styles.pen, moving('draw', 'late'))}
          />
        </>
      );
    case 'apps':
      // Four apps, and one of them goes, leaving its place empty.
      return (
        <>
          <rect height={7} rx={1.75} width={7} x={3.5} y={3.5} {...props(styles.line)} />
          <rect height={7} rx={1.75} width={7} x={3.5} y={13.5} {...props(styles.line)} />
          <rect height={7} rx={1.75} width={7} x={13.5} y={13.5} {...props(styles.line)} />
          <rect
            height={7}
            rx={1.75}
            width={7}
            x={13.5}
            y={3.5}
            {...props(styles.slot, moving('appear'))}
          />
          <rect
            height={7}
            opacity={0}
            rx={1.75}
            width={7}
            x={13.5}
            y={3.5}
            {...props(styles.line, styles.own, moving('vanish'))}
          />
        </>
      );
    case 'lock':
      // A lock whose shackle comes down and closes, and its keyhole.
      return (
        <>
          <rect height={10} rx={2} width={15} x={4.5} y={11} {...props(styles.line)} />
          <path d="M8 11V7.5a4 4 0 0 1 8 0V11" {...props(styles.line, moving('drop'))} />
          <path
            d="M12 14.75v2.5"
            pathLength={1}
            {...props(styles.line, styles.pen, moving('draw', 'later'))}
          />
        </>
      );
    case 'work':
      // A briefcase whose clasp comes down as its band is drawn.
      return (
        <>
          <rect height={13} rx={2} width={18} x={3} y={7} {...props(styles.line)} />
          <path d="M9 7V5.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2V7" {...props(styles.line)} />
          <path d="M3 13h18" pathLength={1} {...props(styles.line, styles.pen, moving('draw'))} />
          <rect
            height={3.5}
            rx={0.75}
            width={4}
            x={10}
            y={11.25}
            {...props(styles.solid, moving('drop'))}
          />
        </>
      );
  }
}

/**
 * A case's glyph on its plate. `play` runs its motion from the start, and a
 * new `run` runs it again: the glyph is drawn anew, so its motion starts over.
 */
export function UseGlyph({ name, play, run }: { name: GlyphName; play: boolean; run: number }) {
  return (
    <span aria-hidden="true" {...props(styles.plate)}>
      <svg height={GLYPH} key={run} viewBox="0 0 24 24" width={GLYPH} {...props(styles.svg)}>
        {parts(name, play)}
      </svg>
    </span>
  );
}
