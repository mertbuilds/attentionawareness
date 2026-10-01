import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import {
  animate,
  cubicBezier,
  easeInOut,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SCROLL_METERS } from '../lib/attention-math.ts';
import { drawing, duration } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';

/** The drawing's own box, taller than it is wide, and the ground near its foot: the thumb stands under it. */
const WIDTH = 240;
const HEIGHT = 360;
const GROUND = 300;
/** The line rises left of the middle: the landmarks stand to its right, the counter to its left. */
const LINE_X = 48;
const TIP_RADIUS = 3.5;
/** The counter stands this far left of the line, and never lower than this over the ground. */
const COUNTER_GAP = 8;
const COUNTER_FLOOR = 12;
/**
 * The view starts this many meters tall, a person and a little sky. Once the
 * line outgrows that, the view zooms out to keep its tip this far up.
 */
const VIEW_START = 2.8;
const TIP_AT = 0.65;
/**
 * The swipes a day's scroll is shown in. Each takes the line this many times
 * as high as it stood, the first a hand's width and the last tens of meters,
 * so it climbs at the same pace on screen however far the view has zoomed out.
 */
const SWIPES = 20;
const GROWTH = 1.4;
/** How high the line stands after each swipe, from the ground to a day's scroll. */
const REACH: ReadonlyArray<number> = [
  0,
  ...Array.from({ length: SWIPES }, (_, swipe) => SCROLL_METERS * GROWTH ** (swipe + 1 - SWIPES)),
];
/**
 * A swipe's parts, as shares of it: the thumb pushes up until the first and
 * comes back down after, the feed coasts on until the second, and the view
 * starts catching up at the third.
 */
const PUSH = 0.35;
const COAST = 0.75;
const FOLLOW = 0.1;
/** How far up the thumb pushes, and how far under the ground its tip rests. */
const LIFT = 20;
const THUMB_REST = 5;
const SWIPE_SECONDS = drawing.thumb / SWIPES;
/** The thumb rests a moment before its first swipe; at the end the day fades out and back in. */
const REST_SECONDS = drawing.delay;
const FADE_SECONDS = Number.parseFloat(duration.slow) / 1000;
const LOOP_SECONDS = REST_SECONDS + drawing.thumb + drawing.thumbHold + 2 * FADE_SECONDS;
/** `easing.smoothOut`, the curve a scrolled feed coasts to a stop on. */
const coastOut = cubicBezier(0.22, 1, 0.36, 1);
/**
 * How tall the drawing stands beside the words on a wide screen, and on a
 * wide but short one, so all of it is in the window at once. Over the words
 * on a narrow screen it is a little shorter, and narrower than any phone's
 * column.
 */
const TALL = 380;
const TALL_SHORT = 260;
const TALL_NARROW = 320;
/** The sides fade out, so the landmarks come into the frame rather than being cut by it. */
const EDGE_MASK = 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)';

const GROUND_LINE = `M0 ${GROUND} L${WIDTH} ${GROUND}`;
/** The thumb from behind, its tip at the origin: the outline runs on under the frame. */
const THUMB =
  'M-14 110 C-14.5 60 -16 36 -15.5 21 C-15 8 -8 0 0 0 C8 0 15 8 15.5 21 C16 36 14.5 60 14 110';
const THUMB_DETAIL = [
  'M-8.5 23 L-8.5 11 C-8.5 6 -4.5 3.5 0 3.5 C4.5 3.5 8.5 6 8.5 11 L8.5 23 C8.5 27 4.5 29 0 29 C-4.5 29 -8.5 27 -8.5 23 Z',
  'M-7 45 C-3 47 3 47 7 45',
  'M-5 50 C-2 51.5 2 51.5 5 50',
].join(' ');

/**
 * The landmarks, in meters from the foot of the line, up from the ground: a
 * person, a house, a ten-storey block, and the Statue of Liberty, 93 meters
 * from the ground to the torch, standing at `STATUE_X`.
 */
const PERSON_HEAD = { r: 0.15, x: 0.7, y: 1.6 };
const STATUE_X = 38;
const STATUE_HEAD = { r: 1.9, x: 0, y: 82.4 };
const FLOORS = 10;
const FLOOR_METERS = 3;
const CROWN_RAYS = [50, 70, 90, 110, 130];

const LANDMARKS = [
  // The person.
  'M0.7 1.45 L0.7 0.9 M0.55 0 L0.7 0.9 L0.85 0 M0.52 0.98 L0.7 1.36 L0.88 0.98',
  // The house, two storeys: walls, roof and chimney.
  'M2.2 0 L2.2 5.2 M5.8 5.2 L5.8 0 M1.9 5.2 L4 8 L6.1 5.2 Z M5 6.67 L5 7.4 L5.4 7.4 L5.4 6.13',
  // The block and the plant room on its roof.
  `M8 0 L8 ${FLOORS * FLOOR_METERS} L16 ${FLOORS * FLOOR_METERS} L16 0`,
  `M10 ${FLOORS * FLOOR_METERS} L10 31.5 L13 31.5 L13 ${FLOORS * FLOOR_METERS}`,
].join(' ');

const LANDMARK_DETAIL = [
  // The house's door and windows.
  'M2.6 0 L2.6 2.1 L3.4 2.1 L3.4 0',
  'M4.3 1 L5.1 1 L5.1 2 L4.3 2 Z M2.6 3.2 L3.4 3.2 L3.4 4.2 L2.6 4.2 Z M4.3 3.2 L5.1 3.2 L5.1 4.2 L4.3 4.2 Z',
  // The block's door and floors.
  'M11.2 0 L11.2 2.4 L12.8 2.4 L12.8 0',
  ...Array.from(
    { length: FLOORS - 1 },
    (_, floor) => `M8 ${(floor + 1) * FLOOR_METERS} L16 ${(floor + 1) * FLOOR_METERS}`,
  ),
].join(' ');

/** The statue, about its own middle: the island's base, the pedestal, the figure with its torch and tablet. */
const STATUE = [
  'M-13 0 L-10.5 20 L10.5 20 L13 0',
  'M-8 20 L-6.6 43 L-7.6 44 L-7.6 47 L7.6 47 L7.6 44 L6.6 43 L8 20',
  'M-4.2 47 C-4.6 58 -4.3 70 -3.6 79 L-1.2 80.5 L1.2 80.5 L3.6 79 C4.3 70 4.6 58 4.2 47',
  'M-3.5 78.8 L-4.9 89.2 L-3.3 89.4 L-1.9 80',
  'M-5.4 89.4 L-2.8 89.6 L-3.4 91 L-4.8 90.9 Z',
  'M-4.6 91 Q-4.7 92.5 -4.05 93 Q-3.5 92.5 -3.6 91',
  'M2.2 66.5 L5.2 68.4 L4.6 74 L1.6 72.2 Z',
  ...CROWN_RAYS.map((degrees) => {
    const angle = (degrees * Math.PI) / 180;
    const ray = (reach: number) =>
      `${(STATUE_HEAD.x + reach * Math.cos(angle)).toFixed(2)} ${(STATUE_HEAD.y + reach * Math.sin(angle)).toFixed(2)}`;
    return `M${ray(2.3)} L${ray(4.3)}`;
  }),
].join(' ');

const STATUE_DETAIL = 'M-7.2 33 L7.2 33';

const styles = create({
  // The box the drawing is sized in, with the counter over it.
  box: {
    aspectRatio: `${WIDTH} / ${HEIGHT}`,
    flexShrink: 0,
    height: {
      '@media (max-width: 767px)': TALL_NARROW,
      '@media (min-width: 768px) and (max-height: 720px)': TALL_SHORT,
      default: TALL,
    },
    position: 'relative',
    userSelect: 'none',
    // The width follows the height through the aspect ratio.
    width: 'auto',
  },
  // How far the thumb has scrolled, small and quiet, level with the line's tip.
  counter: {
    color: colors.muted,
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translateY(-50%)',
    whiteSpace: 'nowrap',
  },
  drawing: {
    display: 'block',
    height: '100%',
    maskImage: EDGE_MASK,
    overflow: 'hidden',
    WebkitMaskImage: EDGE_MASK,
    width: '100%',
  },
  faint: {
    opacity: 0.5,
  },
  ground: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeWidth: 1,
  },
  landmark: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  // The distance scrolled, in the story's orange.
  line: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  // The thumb is filled with the page, so it passes in front of the ground and the line's foot.
  thumb: {
    fill: colors.bg,
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1.25,
  },
  thumbDetail: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1,
  },
  tip: {
    fill: accent.base,
  },
});

/** Where the drawing stands at a moment: the thumb's lift, the line's height, how much of it shows and the view's height, in meters. */
type Frame = { lift: number; meters: number; seen: number; view: number };

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** How tall the view is with the line this high: tall enough to keep its tip `TIP_AT` up. */
function viewFor(meters: number): number {
  return Math.max(VIEW_START, meters / TIP_AT);
}

/**
 * The climb `seconds` in: the swipe under way, the thumb up and back down,
 * the line coasting on after it, and the view catching up once it has.
 */
function climbAt(seconds: number): Frame {
  const swipe = Math.min(SWIPES - 1, Math.floor(seconds / SWIPE_SECONDS));
  const through = seconds >= drawing.thumb ? 1 : (seconds - swipe * SWIPE_SECONDS) / SWIPE_SECONDS;
  const from = REACH[swipe] ?? 0;
  const to = REACH[swipe + 1] ?? SCROLL_METERS;
  const lift =
    through < PUSH ? easeInOut(through / PUSH) : 1 - easeInOut((through - PUSH) / (1 - PUSH));
  return {
    lift,
    meters: from + (to - from) * coastOut(clamp(through / COAST)),
    seen: 1,
    view: viewFor(from + (to - from) * easeInOut(clamp((through - FOLLOW) / (1 - FOLLOW)))),
  };
}

const START = climbAt(0);
const END = climbAt(drawing.thumb);

/** The loop `seconds` in: a rest, the climb, a hold on a day's scroll, and a fade back to the start. */
function frameAt(seconds: number): Frame {
  const fadeIn = LOOP_SECONDS - FADE_SECONDS;
  const fadeOut = fadeIn - FADE_SECONDS;
  if (seconds >= fadeIn) {
    return { ...START, seen: clamp((seconds - fadeIn) / FADE_SECONDS) };
  }
  if (seconds >= fadeOut) {
    return { ...END, seen: 1 - clamp((seconds - fadeOut) / FADE_SECONDS) };
  }
  return climbAt(Math.max(0, seconds - REST_SECONDS));
}

/** Whether the tab is the one in front: a hidden tab plays nothing. */
function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function tabVisible(): boolean {
  return document.visibilityState === 'visible';
}

function tabVisibleOnServer(): boolean {
  return false;
}

/**
 * A thumb under a line, swiping up over and over. Each swipe scrolls the line
 * higher, and the view zooms out to keep up with it, past a person, a house
 * and a block, until it reaches the Statue of Liberty's torch: a day's
 * scroll. It holds there, fades and starts over. It runs only while it is
 * `shown`, on screen, in a tab in front, and holds still where it is
 * otherwise. For a reader who asked for less motion it stands at a day's
 * scroll.
 */
export function ThumbDistance({ shown }: { shown: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() === true;
  const onScreen = useInView(box);
  const tabShown = useSyncExternalStore(subscribeVisibility, tabVisible, tabVisibleOnServer);
  const clock = useMotionValue(0);
  const [at, setAt] = useState(0);
  // Each time round, the loop starts again from the top.
  const [loops, setLoops] = useState(0);
  const running = shown && onScreen && tabShown && !reduced;
  useMotionValueEvent(clock, 'change', setAt);

  // The clock runs on from wherever it was held, and round again at the end.
  useEffect(() => {
    if (!running) {
      return;
    }
    const controls = animate(clock, LOOP_SECONDS, {
      duration: LOOP_SECONDS - clock.get(),
      ease: 'linear',
      onComplete: () => {
        clock.set(0);
        setLoops((loop) => loop + 1);
      },
    });
    return () => controls.stop();
  }, [clock, loops, running]);

  const frame = reduced ? END : frameAt(at);
  const scale = GROUND / frame.view;
  const tip = GROUND - frame.meters * scale;
  const counterAt = Math.min(tip, GROUND - COUNTER_FLOOR);
  // Tenths of a meter while the line is short, whole meters once it is not.
  const tenths = Math.round(frame.meters * 10) / 10;
  const decimals = tenths < 10 ? 1 : 0;
  const meters = new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(decimals === 1 ? tenths : Math.round(frame.meters));

  return (
    <div aria-hidden="true" ref={box} {...props(styles.box)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.drawing)}>
        <path d={GROUND_LINE} {...props(styles.ground)} />
        <g opacity={frame.seen}>
          <g transform={`translate(${LINE_X} ${GROUND}) scale(${scale} ${-scale})`}>
            <path d={LANDMARKS} vectorEffect="non-scaling-stroke" {...props(styles.landmark)} />
            <path
              d={LANDMARK_DETAIL}
              vectorEffect="non-scaling-stroke"
              {...props(styles.landmark, styles.faint)}
            />
            <circle
              cx={PERSON_HEAD.x}
              cy={PERSON_HEAD.y}
              r={PERSON_HEAD.r}
              vectorEffect="non-scaling-stroke"
              {...props(styles.landmark)}
            />
            <g transform={`translate(${STATUE_X} 0)`}>
              <path d={STATUE} vectorEffect="non-scaling-stroke" {...props(styles.landmark)} />
              <path
                d={STATUE_DETAIL}
                vectorEffect="non-scaling-stroke"
                {...props(styles.landmark, styles.faint)}
              />
              <circle
                cx={STATUE_HEAD.x}
                cy={STATUE_HEAD.y}
                r={STATUE_HEAD.r}
                vectorEffect="non-scaling-stroke"
                {...props(styles.landmark)}
              />
            </g>
          </g>
          <path d={`M${LINE_X} ${GROUND} L${LINE_X} ${tip.toFixed(2)}`} {...props(styles.line)} />
          <circle cx={LINE_X} cy={tip} r={TIP_RADIUS} {...props(styles.tip)} />
        </g>
        <g transform={`translate(${LINE_X} ${GROUND + THUMB_REST - frame.lift * LIFT})`}>
          <path d={THUMB} {...props(styles.thumb)} />
          <path d={THUMB_DETAIL} {...props(styles.thumbDetail)} />
        </g>
      </svg>
      <span
        style={{
          insetBlockStart: `${(counterAt / HEIGHT) * 100}%`,
          insetInlineEnd: `${((WIDTH - LINE_X + COUNTER_GAP) / WIDTH) * 100}%`,
          opacity: frame.seen,
        }}
        {...props(styles.counter)}
      >
        {m.home_facts_finger_counter({ meters })}
      </span>
    </div>
  );
}
