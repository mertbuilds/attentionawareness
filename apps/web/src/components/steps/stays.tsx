import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { backOut, clamp } from 'motion/react';
import { drawing, easing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';
import { APPS, AppSquare, PHONE, PhoneFrame } from './phone.tsx';
import { stretch, usePlayhead } from './playhead.ts';

/** What is drawn on an app's square: something of the reader's own that it holds. */
type Glyph = 'message' | 'notes' | 'person' | 'photo';

/** The apps that hold something, by their place on the home screen; the rest are plain. */
const GLYPHS: ReadonlyMap<number, Glyph> = new Map([
  [0, 'photo'],
  [1, 'message'],
  [3, 'notes'],
  [6, 'person'],
  [9, 'photo'],
  [12, 'message'],
  [14, 'notes'],
  [21, 'photo'],
]);
const GLYPH_PATHS: Record<Glyph, string> = {
  message:
    'M-3.6 -0.6 C-3.6 -2.4 -1.9 -3.4 0 -3.4 C1.9 -3.4 3.6 -2.4 3.6 -0.6 C3.6 1.2 1.9 2.2 0 2.2 C-0.6 2.2 -1.2 2.1 -1.7 1.9 L-3.4 3 L-2.8 1.2 C-3.3 0.7 -3.6 0.1 -3.6 -0.6 Z',
  notes: 'M-3.5 -2.5 H3.5 M-3.5 0 H3.5 M-3.5 2.5 H1',
  person:
    'M1.6 -1.8 A1.6 1.6 0 1 1 -1.6 -1.8 A1.6 1.6 0 1 1 1.6 -1.8 Z M-3.4 3.6 C-3.4 1.4 -1.8 0.6 0 0.6 C1.8 0.6 3.4 1.4 3.4 3.6',
  photo:
    'M-4 3.4 L-1.2 0 L0.8 2 L2 0.8 L4 3.4 M3.4 -2.4 A1.1 1.1 0 1 1 1.2 -2.4 A1.1 1.1 0 1 1 3.4 -2.4 Z',
};
/** Every app dips at once, as though about to be wiped, and how far. */
const DIP = { from: 0.04, to: 0.22 };
const DIP_SCALE = 0.12;
const DIP_FADE = 0.5;
/** Then a row at a time from the top, each pops back into its place, a little past it and back. */
const RETURN = { from: 0.26, length: 0.2, row: 0.05 };
/** The shield over the phone's top corner, and the check drawn in it. */
const BADGE = { x: PHONE.x + PHONE.width, y: PHONE.y + 15 };
const BADGE_FROM = 0.6;
const BADGE_SCALE = 0.4;
const SHIELD = 'M0 -11 L9 -7.5 V0.5 C9 6 5 9.5 0 11.5 C-5 9.5 -9 6 -9 0.5 V-7.5 Z';
const CHECK = 'M-4 0.5 L-1 3.5 L4.5 -2.5';

/** Once the shield is up, a ring of it goes out now and then, and nothing else moves. */
const ripple = keyframes({
  from: { opacity: 0.5, transform: 'scale(1)' },
  to: { opacity: 0, transform: 'scale(1.9)' },
});

const styles = create({
  check: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.4,
  },
  glyph: {
    fill: 'none',
    opacity: 0.7,
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 0.8,
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 280,
    overflow: 'visible',
    width: '100%',
  },
  ripple: {
    animationDuration: '2.4s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: ripple,
    },
    animationTimingFunction: easing.smoothOut,
    fill: 'none',
    opacity: 0,
    stroke: accent.base,
    strokeWidth: 0.75,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  // The shield, filled with the page so the corner under it gives way to it.
  shield: {
    fill: colors.bg,
    stroke: accent.base,
    strokeLinejoin: 'round',
    strokeWidth: 1.4,
  },
});

/**
 * How far an app on `row` is from its place `at` into the play: 0 in place,
 * 1 dipped all the way, and a little under 0 as it pops back past its place.
 */
function loweredAt(at: number, row: number): number {
  const back = backOut(clamp(0, 1, (at - RETURN.from - row * RETURN.row) / RETURN.length));
  return stretch(at, DIP.from, DIP.to) * (1 - back);
}

/**
 * An iPhone's home screen, its photos, messages and notes on it: every app
 * dips as though about to be wiped, then pops back into its place a row at a
 * time, nothing lost, and an orange shield comes up over the corner. It plays
 * once each time `play` turns on and stands untouched while it is off. With
 * less motion it stands shielded.
 */
export function StaysGraphic({ play }: { play: boolean }) {
  const at = usePlayhead(play, drawing.stepStays);
  const shown = stretch(at, BADGE_FROM, BADGE_FROM + 0.22);
  const checked = stretch(at, BADGE_FROM + 0.12, BADGE_FROM + 0.34);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      <PhoneFrame />
      {APPS.map((app, index) => {
        const lowered = loweredAt(at, app.row);
        const glyph = GLYPHS.get(index);
        return (
          <g
            key={index}
            opacity={1 - DIP_FADE * Math.max(0, lowered)}
            transform={`translate(${app.x} ${app.y}) scale(${1 - DIP_SCALE * lowered})`}
          >
            <AppSquare />
            {glyph === undefined ? null : <path d={GLYPH_PATHS[glyph]} {...props(styles.glyph)} />}
          </g>
        );
      })}
      {shown > 0 ? (
        <g
          opacity={shown}
          transform={`translate(${BADGE.x} ${BADGE.y}) scale(${1 - BADGE_SCALE * (1 - shown)})`}
        >
          {at >= 1 ? <path d={SHIELD} {...props(styles.ripple)} /> : null}
          <path d={SHIELD} {...props(styles.shield)} />
          {checked > 0 ? (
            <path
              d={CHECK}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - checked}
              {...props(styles.check)}
            />
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}
