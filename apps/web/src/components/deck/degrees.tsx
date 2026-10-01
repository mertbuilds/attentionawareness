import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import {
  animate,
  clamp,
  easeOut,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useEffect, useId } from 'react';
import { drawing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';

/**
 * The caps go up from behind the shelf, out of sight under it, and come down
 * on it. Each leaves from a little way toward its own slot, so the arcs fan
 * out instead of bunching in the middle, and all leave a little to the left
 * of that, so the fan is not a mirror image of itself.
 */
const SHELF_Y = 202;
const THROW_Y = SHELF_Y + 40;
const THROW_SPREAD = 0.35;
const THROW_LEAN = -16;
/**
 * The room either side of the row, and the most caps a row holds before the
 * next stands over it: few enough that each cap is large enough to read.
 */
const SIDE = 14;
const COLUMNS = 5;
/**
 * A cap in its own units, the middle of its board at the origin: the board
 * seen from a little above, half as wide and half as deep, the crown under
 * it, and the cord out to the right corner, where the tassel hangs.
 */
const BOARD = { depth: 6, width: 14 };
const CROWN = { bottom: 9, bulge: 13, width: 8 };
const CORD_END = { x: 12, y: 0.4 };
const BUTTON = 0.9;
const HANG = 6.5;
const TASSEL = 3;
/** Where the crown's sides come out from under the board's front edges. */
const CROWN_TOP = BOARD.depth * (1 - CROWN.width / BOARD.width);
/** How far the crown reaches under the board's middle: the lowest point of its curve. */
const CAP_DEPTH = (CROWN.bottom + CROWN.bulge) / 2;
/** A cap and the gap after it at full size, the largest a few caps are drawn, and a row over the last. */
const CAP_PITCH = 32;
const LARGEST = 1.6;
const ROW_PITCH = 22;
/** The timeline in seconds: all of it, one throw's flight, and the hop it lands with. */
const SECONDS = drawing.deck;
const FLIGHT = SECONDS / 3;
const HOP_SECONDS = SECONDS * 0.075;
/** The orange cap waits this many gaps instead of one, a beat after the rest. */
const LAST_WAIT = 1.8;
/** The top of a throw: the orange cap goes highest, the others a step lower in turn. */
const APEX = 30;
const APEX_STEP = 10;
const APEX_VARIANTS = 3;
/** In the air a cap turns once, swells toward the eye at the top of its arc, and lands with a small hop. */
const TURN = 2 * Math.PI;
const SWELL = 0.18;
const HOP = 2.5;
/** Each throw leaves its arc behind as a dotted line, drawn through this many points. */
const TRAIL_STEPS = 48;

/** Once everything has landed, the orange cap's tassel swings, a few degrees each way. */
const swing = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(0deg)' },
  '12.5%': { transform: 'rotate(5.7deg)' },
  '25%': { transform: 'rotate(8deg)' },
  '37.5%': { transform: 'rotate(5.7deg)' },
  '50%': { transform: 'rotate(0deg)' },
  '62.5%': { transform: 'rotate(-5.7deg)' },
  '75%': { transform: 'rotate(-8deg)' },
  '87.5%': { transform: 'rotate(-5.7deg)' },
});

const styles = create({
  // The board and the crown are solid, so a cap in the air passes in front of
  // one on the shelf rather than through it.
  body: {
    fill: colors.bg,
  },
  cap: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.2,
  },
  capLast: {
    stroke: accent.base,
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 400,
    width: '100%',
  },
  shelf: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
  },
  swing: {
    animationDelay: `${drawing.deck}s`,
    animationDuration: '3s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: swing,
    },
    animationTimingFunction: 'linear',
  },
  tassel: {
    strokeLinecap: 'butt',
    strokeWidth: 2.2,
  },
  // The way each cap went, a faint dotted line, the way the walk to the Moon
  // is drawn: the orange cap's in orange. They stay behind the caps.
  trail: {
    fill: 'none',
    opacity: 0.2,
    stroke: colors.muted,
    strokeDasharray: '0 5',
    strokeLinecap: 'round',
    strokeWidth: 1,
  },
  trailLast: {
    opacity: 0.5,
    stroke: accent.base,
  },
});

type Point = { x: number; y: number };
/**
 * One cap's throw: how high it goes, where and when it leaves, how large it
 * is drawn and where it lands.
 */
type Throw = { apex: number; from: Point; launch: number; scale: number; slot: Point };
/** Where a cap is at a moment: its board's middle, its size, and how far it has turned. */
type Pose = { at: Point; scale: number; turn: number };

/**
 * Every cap's throw. They land left to right, a row at a time from the
 * bottom, and leave one after another; the last, the orange one, a beat after
 * the rest, so it is the one the drawing ends on.
 */
function throwsFor(amount: number): Array<Throw> {
  const count = Math.max(0, Math.floor(amount));
  const columns = Math.max(1, Math.min(count, COLUMNS));
  const scale = Math.min(LARGEST, (WIDTH - 2 * SIDE) / columns / CAP_PITCH);
  const pitch = CAP_PITCH * scale;
  const last = count - 1;
  const gaps = last > 0 ? last - 1 + LAST_WAIT : 1;
  const gap = (SECONDS - FLIGHT - HOP_SECONDS) / gaps;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, count - row * columns);
    const x = WIDTH / 2 + ((index % columns) - (inRow - 1) / 2) * pitch;
    return {
      apex: index === last ? APEX : APEX + (1 + (index % APEX_VARIANTS)) * APEX_STEP,
      from: { x: WIDTH / 2 + (x - WIDTH / 2) * THROW_SPREAD + THROW_LEAN, y: THROW_Y },
      launch: (index === last && last > 0 ? gaps : index) * gap,
      scale,
      slot: { x, y: SHELF_Y - (CAP_DEPTH + row * ROW_PITCH) * scale },
    };
  });
}

/** How far through its flight a cap is `seconds` in. */
function flownAt(cap: Throw, seconds: number): number {
  return clamp(0, 1, (seconds - cap.launch) / FLIGHT);
}

/** The point `t` of the way through a throw, on a parabola from the hand to the slot. */
function flightPoint(cap: Throw, t: number): Point {
  const lift = (cap.from.y + cap.slot.y) / 2 - cap.apex;
  return {
    x: cap.from.x + (cap.slot.x - cap.from.x) * t,
    y: cap.from.y + (cap.slot.y - cap.from.y) * t - 4 * lift * t * (1 - t),
  };
}

/**
 * Where a cap is `seconds` in: waiting under the box, in the air, or on the
 * shelf after its hop. It turns the way it flies, fast off the hand and
 * slowing into the landing, and swells a little at the top of its arc.
 */
function poseAt(cap: Throw, seconds: number): Pose {
  const landed = seconds - cap.launch - FLIGHT;
  if (landed >= 0) {
    const hop = Math.sin(Math.PI * clamp(0, 1, landed / HOP_SECONDS));
    return {
      at: { x: cap.slot.x, y: cap.slot.y - HOP * cap.scale * hop },
      scale: cap.scale,
      turn: 0,
    };
  }
  const t = flownAt(cap, seconds);
  const way = Math.sign(cap.slot.x - cap.from.x) || 1;
  return {
    at: flightPoint(cap, t),
    scale: cap.scale * (1 + SWELL * Math.sin(Math.PI * t)),
    turn: way * TURN * easeOut(t),
  };
}

/** The arc a cap has flown `seconds` in, from the hand to where it is. */
function trailPath(cap: Throw, seconds: number): string {
  const t = flownAt(cap, seconds);
  const steps = Math.ceil(t * TRAIL_STEPS);
  return Array.from(
    { length: steps === 0 ? 0 : steps + 1 },
    (_, step) =>
      `${step === 0 ? 'M' : 'L'}${xy(flightPoint(cap, Math.min(t, step / TRAIL_STEPS)))}`,
  ).join(' ');
}

/** A point of the cap's own drawing, where the pose puts it in the box. */
function place(pose: Pose, point: Point): Point {
  const cos = Math.cos(pose.turn);
  const sin = Math.sin(pose.turn);
  return {
    x: pose.at.x + pose.scale * (point.x * cos - point.y * sin),
    y: pose.at.y + pose.scale * (point.x * sin + point.y * cos),
  };
}

function xy({ x, y }: Point): string {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

/**
 * The crown and the board. Both are drawn the same way round, so where they
 * overlap the fill stays solid instead of cutting a hole.
 */
function bodyPath(pose: Pose): string {
  const at = (x: number, y: number) => xy(place(pose, { x, y }));
  return [
    `M${at(CROWN.width, CROWN_TOP)} L${at(CROWN.width, CROWN.bottom)}`,
    `Q${at(0, CROWN.bulge)} ${at(-CROWN.width, CROWN.bottom)} L${at(-CROWN.width, CROWN_TOP)}`,
    `M${at(-BOARD.width, 0)} L${at(0, -BOARD.depth)} L${at(BOARD.width, 0)} L${at(0, BOARD.depth)} Z`,
  ].join(' ');
}

/** The button in the board's middle, and the cord from it to the corner. */
function cordPath(pose: Pose): string {
  const radius = BUTTON * pose.scale;
  const { x, y } = pose.at;
  return [
    `M${xy({ x: x - radius, y })}`,
    `a${radius.toFixed(2)} ${radius.toFixed(2)} 0 1 0 ${(2 * radius).toFixed(2)} 0`,
    `a${radius.toFixed(2)} ${radius.toFixed(2)} 0 1 0 ${(-2 * radius).toFixed(2)} 0`,
    `M${xy(pose.at)} L${xy(place(pose, CORD_END))}`,
  ].join(' ');
}

/** The tassel's string, hanging straight down from the corner however the cap has turned. */
function hangPath(pose: Pose): string {
  const from = place(pose, CORD_END);
  return `M${xy(from)} L${xy({ x: from.x, y: from.y + HANG * pose.scale })}`;
}

/** The tassel itself, at the end of the string. */
function tasselPath(pose: Pose): string {
  const from = place(pose, CORD_END);
  const top = from.y + HANG * pose.scale;
  return `M${xy({ x: from.x, y: top })} L${xy({ x: from.x, y: top + TASSEL * pose.scale })}`;
}

/** The arc a cap leaves behind it, as far as the clock has flown it. With less motion it stands whole. */
function Trail({
  cap,
  clock,
  last,
  reduced,
}: {
  cap: Throw;
  clock: MotionValue<number>;
  last: boolean;
  reduced: boolean;
}) {
  const trail = useTransform(clock, (seconds) => trailPath(cap, seconds));
  return (
    <motion.path
      d={reduced ? trailPath(cap, SECONDS) : trail}
      {...props(styles.trail, last && styles.trailLast)}
    />
  );
}

/**
 * One cap, drawn where the clock puts it. With less motion it stands on the
 * shelf. The orange one's tassel swings from its corner once it has landed.
 */
function Cap({
  cap,
  clock,
  last,
  reduced,
  swinging,
}: {
  cap: Throw;
  clock: MotionValue<number>;
  last: boolean;
  reduced: boolean;
  swinging: boolean;
}) {
  const pose = useTransform(clock, (seconds) => poseAt(cap, seconds));
  const body = useTransform(pose, bodyPath);
  const cord = useTransform(pose, cordPath);
  const hang = useTransform(pose, hangPath);
  const tassel = useTransform(pose, tasselPath);
  const landed = poseAt(cap, SECONDS);
  const corner = place(landed, CORD_END);
  return (
    <g {...props(styles.cap, last && styles.capLast)}>
      <motion.path d={reduced ? bodyPath(landed) : body} {...props(styles.body)} />
      <motion.path d={reduced ? cordPath(landed) : cord} />
      <g
        style={{ transformOrigin: `${corner.x}px ${corner.y}px` }}
        {...props(swinging && styles.swing)}
      >
        <motion.path d={reduced ? hangPath(landed) : hang} />
        <motion.path d={reduced ? tasselPath(landed) : tassel} {...props(styles.tassel)} />
      </g>
    </g>
  );
}

/**
 * The degrees the hours would have bought: a mortarboard for each, tossed up
 * one at a time, turning once in the air and landing in rows on a shelf, the
 * last one orange. When `play` turns on it plays once from the start; when it
 * turns off the caps are back out of sight. With less motion the rows stand
 * done.
 */
export function DegreesGraphic({ amount, play }: { amount: number; play: boolean }) {
  const reduced = useReducedMotion() === true;
  // Done until the page says otherwise, so a page that has not run its script
  // shows the whole row.
  const clock = useMotionValue(SECONDS);
  const above = `${useId()}-above`;
  const throws = throwsFor(amount);
  const last = throws.length - 1;

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
      {/* Everything that flies is cut off at the shelf, so the caps come up
      from behind it. A stroke's width under it is kept for the ones landed on it. */}
      <clipPath id={above}>
        <rect height={SHELF_Y + 1} width={WIDTH} />
      </clipPath>
      <path d={`M${SIDE} ${SHELF_Y} H${WIDTH - SIDE}`} {...props(styles.shelf)} />
      <g clipPath={`url(#${above})`}>
        {throws.map((cap, index) => (
          <Trail cap={cap} clock={clock} key={index} last={index === last} reduced={reduced} />
        ))}
        {throws.map((cap, index) => (
          <Cap
            cap={cap}
            clock={clock}
            key={index}
            last={index === last}
            reduced={reduced}
            swinging={play && !reduced && index === last}
          />
        ))}
      </g>
    </svg>
  );
}
