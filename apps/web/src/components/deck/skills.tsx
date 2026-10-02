import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { clamp, easeInOut, motion, useMotionValueEvent, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useState } from 'react';
import { drawing, duration, easing } from '../../lib/motion.stylex.ts';
import { useLessMotion } from '../cost-story.tsx';
import { HEIGHT, WIDTH } from './box.ts';

/** What one skill takes: the folk figure for mastery. */
const HOURS = 10_000;
/** The ruler over each track: a fine mark every 250 hours, a longer one every thousand. */
const FINE = 250;
const LONG = 1000;
const FINE_LENGTH = 3;
const LONG_LENGTH = 6;
/** The track's two ends, how thick it is, and how far over it the ruler stands. */
const START = 16;
const END = WIDTH - START;
const TRACK = 6;
const RULER_GAP = 2;
/** The skill over the start of each ruler, and its hours over the end once the track is full. */
const LABEL_SIZE = 11;
const LABEL_GAP = 5;
/** The rows stand this far apart at most, inside this much of the box's height. */
const ROW_PITCH = 48;
const ROOM = 200;
/** All of it in seconds, and the part of each track's turn it spends filling: the rest is a beat before the next. */
const SECONDS = drawing.deck;
const FILL_SHARE = 0.84;

/** What the tracks are for, in turn and round again, and the hours each one took. */
export type SkillLabels = { hours: string; names: ReadonlyArray<string> };

const styles = create({
  // The hours, solid orange, a hair larger than the track so they cover its outline.
  fill: {
    fill: accent.base,
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 400,
    width: '100%',
  },
  // The hours wait unseen, and are gone again at once when the tracks empty.
  hours: {
    opacity: 0,
  },
  // A track full: its hours come in.
  hoursOn: {
    opacity: 1,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.slow,
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.smoothOut,
  },
  // A track's skill and its hours, small and quiet over the ruler.
  label: {
    fill: colors.muted,
    fontSize: LABEL_SIZE,
  },
  ruler: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
  },
  track: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
  },
});

/** The middle of each track, the rows centred in the box. */
function rowsFor(amount: number): Array<number> {
  const count = Math.max(0, Math.floor(amount));
  const pitch = Math.min(ROW_PITCH, ROOM / Math.max(1, count));
  const above = TRACK / 2 + RULER_GAP + LONG_LENGTH + LABEL_GAP + LABEL_SIZE;
  const height = (count - 1) * pitch + above + TRACK / 2;
  const top = (HEIGHT - height) / 2 + above;
  return Array.from({ length: count }, (_, index) => top + index * pitch);
}

/** How much of a track is filled `seconds` in: each has its turn, one after another, and eases full. */
function filledAt(index: number, count: number, seconds: number): number {
  const turn = SECONDS / count;
  return easeInOut(clamp(0, 1, (seconds - index * turn) / (turn * FILL_SHARE)));
}

/** The track's outline. */
function trackPath(y: number): string {
  return `M${START} ${y - TRACK / 2} H${END} V${y + TRACK / 2} H${START} Z`;
}

/** The marks over a track, one each 250 hours from the first to the last. */
function rulerPath(y: number): string {
  const foot = y - TRACK / 2 - RULER_GAP;
  return Array.from({ length: HOURS / FINE + 1 }, (_, step) => {
    const x = START + ((END - START) * step * FINE) / HOURS;
    const length = (step * FINE) % LONG === 0 ? LONG_LENGTH : FINE_LENGTH;
    return `M${x.toFixed(2)} ${foot} V${foot - length}`;
  }).join(' ');
}

/** The filled part of a track, over its outline. */
function fillPath(y: number, share: number): string {
  const width = share * (END - START + 1);
  return `M${START - 0.5} ${y - TRACK / 2 - 0.5} h${width.toFixed(2)} v${TRACK + 1} h${(-width).toFixed(2)} Z`;
}

/**
 * One skill: a ten-thousand-hour track under its ruler and its name, filling
 * orange in its turn, with its hours over the end once it is full. With less
 * motion it stands full.
 */
function Track({
  clock,
  count,
  hours,
  index,
  name,
  reduced,
  y,
}: {
  clock: MotionValue<number>;
  count: number;
  hours: string | undefined;
  index: number;
  name: string | undefined;
  reduced: boolean;
  y: number;
}) {
  const filled = useTransform(clock, (seconds) => filledAt(index, count, seconds));
  const bar = useTransform(filled, (share) => fillPath(y, share));
  const [full, setFull] = useState(() => filledAt(index, count, clock.get()) >= 1);
  useMotionValueEvent(clock, 'change', (seconds) => setFull(filledAt(index, count, seconds) >= 1));
  const labelY = y - TRACK / 2 - RULER_GAP - LONG_LENGTH - LABEL_GAP;
  return (
    <>
      {name === undefined ? null : (
        <text x={START} y={labelY} {...props(styles.label)}>
          {name}
        </text>
      )}
      {hours === undefined ? null : (
        <text
          textAnchor="end"
          x={END}
          y={labelY}
          {...props(styles.label, styles.hours, (reduced || full) && styles.hoursOn)}
        >
          {hours}
        </text>
      )}
      <path d={trackPath(y)} {...props(styles.track)} />
      <path d={rulerPath(y)} {...props(styles.ruler)} />
      <motion.path d={reduced ? fillPath(y, 1) : bar} {...props(styles.fill)} />
    </>
  );
}

/**
 * The world-class skills the hours would have bought: a ten-thousand-hour
 * track for each, named after a skill from `labels`, filling orange one after
 * another as far as `play` says, from 0 to 1. With less motion they stand
 * full.
 */
export function SkillsGraphic({
  amount,
  labels,
  play,
}: {
  amount: number;
  labels?: SkillLabels | undefined;
  play: MotionValue<number>;
}) {
  const reduced = useLessMotion();
  const clock = useTransform(play, (t) => t * SECONDS);
  const rows = rowsFor(amount);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      {rows.map((y, index) => (
        <Track
          clock={clock}
          count={rows.length}
          hours={labels?.hours}
          index={index}
          key={index}
          name={labels?.names[index % labels.names.length]}
          reduced={reduced}
          y={y}
        />
      ))}
    </svg>
  );
}
