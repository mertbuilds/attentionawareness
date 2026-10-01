import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useEffect, useState } from 'react';
import { drawing, easing } from '../../lib/motion.stylex.ts';
import { getLocale } from '../../paraglide/runtime.js';
import { ART_BOTTOM, DeckCount, HEIGHT, WIDTH } from './count.tsx';

/** The drawing plays once over this long each time it comes on. */
const PLAY_SECONDS = drawing.deck;
/** The inner kerb, and the lanes outside it. */
const KERB = 56;
const LANES = 4;
const LANE = 8;
/** The track, two straights and two bends around its middle, standing on the line the count is kept under. */
const CENTER_X = WIDTH / 2;
const CENTER_Y = ART_BOTTOM - KERB - LANES * LANE;
const HALF_STRAIGHT = 58;
/** The runner keeps to the middle of the inside lane, the one a lap is measured on. */
const RUN_RADIUS = KERB + LANE / 2;
const STRAIGHT = 2 * HALF_STRAIGHT;
const BEND = Math.PI * RUN_RADIUS;
const LAP = 2 * STRAIGHT + 2 * BEND;
/**
 * The laps the runner is seen to run: the first at a run, then a blur, and
 * the last easing over the line. The count runs with them to the whole figure.
 */
const LAPS_RUN = 8;
/** The tail reaches back to where the runner was this share of the run ago, and never round more than most of a lap. */
const TAIL = 1 / 12;
const TAIL_MAX = 0.85;
/** The tail fades out in this many pieces, each fainter than the one ahead of it. */
const TAIL_PIECES = 14;
/** How far apart the points a stretch of lane is drawn through stand. */
const SAMPLE = 3;
const RUNNER_RADIUS = 3.5;

type Point = { x: number; y: number };

/** Once the runner is home, a ring goes out from it now and then, and nothing else moves. */
const ripple = keyframes({
  from: { opacity: 0.6, transform: 'scale(1)' },
  to: { opacity: 0, transform: 'scale(3.2)' },
});

const styles = create({
  drawing: {
    display: 'block',
    height: 'auto',
    maxWidth: 360,
    overflow: 'visible',
    width: '100%',
  },
  finish: {
    stroke: colors.muted,
    strokeWidth: 1,
  },
  lane: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  laneFaint: {
    opacity: 0.5,
  },
  ripple: {
    animationDuration: '2.4s',
    animationIterationCount: 'infinite',
    animationName: ripple,
    animationTimingFunction: easing.smoothOut,
    fill: 'none',
    stroke: accent.base,
    strokeWidth: 0.75,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  runner: {
    fill: accent.base,
  },
  tail: {
    fill: 'none',
    stroke: accent.base,
    strokeWidth: 1.5,
  },
  // The inside lane, faintly orange as far as the runner has worn it.
  worn: {
    fill: 'none',
    opacity: 0.3,
    stroke: accent.base,
    strokeWidth: 1.5,
  },
});

/**
 * How far the drawing has played, from 0 to 1. It plays from the start each
 * time `play` turns on, and goes back to the start when it turns off. For a
 * reader who asked for less motion it stands at the end.
 */
function usePlayhead(play: boolean): number {
  const reduced = useReducedMotion();
  const clock = useMotionValue(0);
  const [at, setAt] = useState(0);
  useMotionValueEvent(clock, 'change', setAt);

  useEffect(() => {
    clock.set(0);
    if (!play || reduced === true) {
      return;
    }
    const controls = animate(clock, 1, { duration: PLAY_SECONDS, ease: 'linear' });
    return () => controls.stop();
  }, [clock, play, reduced]);

  return reduced === true ? 1 : at;
}

/** Slow off the line, fast in the middle, slow over it again. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
}

/** The laps run by the time the drawing is `at` of the way through. */
function lapsBy(at: number): number {
  return LAPS_RUN * easeInOut(Math.min(1, Math.max(0, at)));
}

/**
 * Where the runner is `distance` along the inside lane. A lap starts on the
 * line at the end of the home straight, under the middle, and runs the way a
 * race does: up the right bend, back along the far straight, down the left.
 */
function lapPoint(distance: number): Point {
  let along = ((distance % LAP) + LAP) % LAP;
  if (along < BEND) {
    const angle = Math.PI / 2 - (Math.PI * along) / BEND;
    return {
      x: CENTER_X + HALF_STRAIGHT + RUN_RADIUS * Math.cos(angle),
      y: CENTER_Y + RUN_RADIUS * Math.sin(angle),
    };
  }
  along -= BEND;
  if (along < STRAIGHT) {
    return { x: CENTER_X + HALF_STRAIGHT - along, y: CENTER_Y - RUN_RADIUS };
  }
  along -= STRAIGHT;
  if (along < BEND) {
    const angle = -Math.PI / 2 - (Math.PI * along) / BEND;
    return {
      x: CENTER_X - HALF_STRAIGHT + RUN_RADIUS * Math.cos(angle),
      y: CENTER_Y + RUN_RADIUS * Math.sin(angle),
    };
  }
  along -= BEND;
  return { x: CENTER_X - HALF_STRAIGHT + along, y: CENTER_Y + RUN_RADIUS };
}

/** A run of points as one path. */
function through(points: ReadonlyArray<Point>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

/** The inside lane from one distance along it to another, round the line as often as it takes. */
function stretch(from: number, to: number): string {
  const steps = Math.max(1, Math.ceil((to - from) / SAMPLE));
  return through(
    Array.from({ length: steps + 1 }, (_, step) => lapPoint(from + ((to - from) * step) / steps)),
  );
}

/** One edge of a lane, all the way round. */
function laneEdge(radius: number): string {
  const left = CENTER_X - HALF_STRAIGHT;
  const right = CENTER_X + HALF_STRAIGHT;
  return [
    `M${left} ${CENTER_Y - radius}`,
    `L${right} ${CENTER_Y - radius}`,
    `A${radius} ${radius} 0 0 1 ${right} ${CENTER_Y + radius}`,
    `L${left} ${CENTER_Y + radius}`,
    `A${radius} ${radius} 0 0 1 ${left} ${CENTER_Y - radius}`,
    'Z',
  ].join(' ');
}

const EDGES = Array.from({ length: LANES + 1 }, (_, index) => laneEdge(KERB + index * LANE));
/** The line across every lane at the end of the home straight, where each lap starts and ends. */
const FINISH = `M${CENTER_X + HALF_STRAIGHT} ${CENTER_Y + KERB} L${CENTER_X + HALF_STRAIGHT} ${CENTER_Y + KERB + LANES * LANE}`;

/**
 * A running track seen from above, and a runner lapping it: off the line at
 * a run, then so fast the tail behind it rings the lane, then easing back
 * over the line. The count under it climbs with the laps to `amount`. It
 * plays once each time `play` turns on and stands at the start while it is
 * off. For a reader who asked for less motion it stands finished.
 */
export function MarathonsGraphic({
  amount,
  count,
  play,
}: {
  amount: number;
  count: MotionValue<number>;
  play: boolean;
}) {
  const reduced = useReducedMotion();
  const at = usePlayhead(play);
  const ran = lapsBy(at);
  const tail = Math.min(TAIL_MAX, ran - lapsBy(at - TAIL));
  const head = ran * LAP;
  const piece = (tail * LAP) / TAIL_PIECES;
  const runner = lapPoint(head);
  const counted = (amount * ran) / LAPS_RUN;
  const number = new Intl.NumberFormat(getLocale());

  useEffect(() => {
    count.set(counted);
  }, [count, counted]);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.drawing)}>
      {EDGES.map((edge, index) => (
        <path
          d={edge}
          key={index}
          {...props(styles.lane, index > 0 && index < LANES && styles.laneFaint)}
        />
      ))}
      <path d={FINISH} {...props(styles.finish)} />
      {ran > 0 ? <path d={stretch(0, Math.min(1, ran) * LAP)} {...props(styles.worn)} /> : null}
      {piece > 0
        ? Array.from({ length: TAIL_PIECES }, (_, index) => (
            <path
              d={stretch(head - (index + 1) * piece, head - index * piece)}
              key={index}
              opacity={1 - index / TAIL_PIECES}
              {...props(styles.tail)}
            />
          ))
        : null}
      {at >= 1 && reduced !== true ? (
        <circle cx={runner.x} cy={runner.y} r={RUNNER_RADIUS} {...props(styles.ripple)} />
      ) : null}
      <circle cx={runner.x} cy={runner.y} r={RUNNER_RADIUS} {...props(styles.runner)} />
      <DeckCount>{number.format(Math.round(counted))}</DeckCount>
    </svg>
  );
}
