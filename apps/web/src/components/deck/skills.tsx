import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import {
  animate,
  clamp,
  easeInOut,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useEffect } from 'react';
import { drawing } from '../../lib/motion.stylex.ts';
import { getLocale } from '../../paraglide/runtime.js';
import { DeckCount, HEIGHT, WIDTH } from './count.tsx';

/** What one skill takes: the folk figure for mastery. */
const HOURS = 10_000;
/** The ruler over each track: a fine mark every 250 hours, a longer one every thousand. */
const FINE = 250;
const LONG = 1000;
const FINE_LENGTH = 3;
const LONG_LENGTH = 6;
/** The track's two ends, how thick it is, and how far over it the ruler stands. */
const START = 16;
const END = 224;
const TRACK = 6;
const RULER_GAP = 2;
/** The count stands right-aligned after the track, level with it. */
const COUNT_END = 308;
/** While a track fills its count is faint, and full once the track is. */
const COUNTING = 0.45;
/** The rows stand this far apart at most, inside this much of the box's height. */
const ROW_PITCH = 48;
const ROOM = 200;
/** All of it in seconds, and the part of each track's turn it spends filling: the rest is a beat before the next. */
const SECONDS = drawing.deck;
const FILL_SHARE = 0.84;

const styles = create({
  // The hours, solid orange, a hair larger than the track so they cover its outline.
  fill: {
    fill: accent.base,
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 360,
    width: '100%',
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
  const above = TRACK / 2 + RULER_GAP + LONG_LENGTH;
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
 * One skill: a ten-thousand-hour track under its ruler, filling orange in its
 * turn, and the hours counted up after it to the full figure. With less
 * motion it stands full.
 */
function Track({
  clock,
  count,
  index,
  reduced,
  y,
}: {
  clock: MotionValue<number>;
  count: number;
  index: number;
  reduced: boolean;
  y: number;
}) {
  const number = new Intl.NumberFormat(getLocale());
  const filled = useTransform(clock, (seconds) => filledAt(index, count, seconds));
  const bar = useTransform(filled, (share) => fillPath(y, share));
  const hours = useTransform(filled, (share) => number.format(Math.round(share * HOURS)));
  const shown = useTransform(filled, (share): number =>
    share >= 1 ? 1 : share > 0 ? COUNTING : 0,
  );
  return (
    <>
      <path d={trackPath(y)} {...props(styles.track)} />
      <path d={rulerPath(y)} {...props(styles.ruler)} />
      <motion.path d={reduced ? fillPath(y, 1) : bar} {...props(styles.fill)} />
      <DeckCount anchor="end" opacity={reduced ? 1 : shown} x={COUNT_END} y={y}>
        {reduced ? number.format(HOURS) : hours}
      </DeckCount>
    </>
  );
}

/** The skills counted `seconds` in: each track as far as it has filled, so the count lands with the last. */
function masteredAt(tracks: number, seconds: number): number {
  return Array.from({ length: tracks }, (_, index) => filledAt(index, tracks, seconds)).reduce(
    (sum, share) => sum + share,
    0,
  );
}

/**
 * The world-class skills the hours would have bought: a ten-thousand-hour
 * track for each, filling orange one after another, each counted to the full
 * figure as it completes. When `play` turns on it plays once from the start;
 * when it turns off the tracks are empty again. With less motion they stand
 * full.
 */
export function SkillsGraphic({
  amount,
  count,
  play,
}: {
  amount: number;
  count: MotionValue<number>;
  play: boolean;
}) {
  const reduced = useReducedMotion() === true;
  // Done until the page says otherwise, so a page that has not run its script
  // shows every track full.
  const clock = useMotionValue(SECONDS);
  const rows = rowsFor(amount);
  const tracks = rows.length;

  useEffect(() => {
    count.set(masteredAt(tracks, clock.get()));
    return clock.on('change', (seconds) => count.set(masteredAt(tracks, seconds)));
  }, [clock, count, tracks]);

  useEffect(() => {
    if (reduced) {
      return;
    }
    clock.set(0);
    if (!play) {
      return;
    }
    const controls = animate(clock, SECONDS, { duration: SECONDS, ease: 'linear' });
    return () => controls.stop();
  }, [clock, play, reduced]);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      {rows.map((y, index) => (
        <Track
          clock={clock}
          count={rows.length}
          index={index}
          key={index}
          reduced={reduced}
          y={y}
        />
      ))}
    </svg>
  );
}
