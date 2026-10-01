import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AVERAGE_HOURS, WAKING_HOURS } from '../lib/attention-math.ts';
import { drawing, duration } from '../lib/motion.stylex.ts';

/**
 * The hourglass in its own 120 by 200 box: a cap at the top and one at the
 * foot, the glass between them, and its neck at the middle.
 */
const WIDTH = 120;
const HEIGHT = 200;
const MIDDLE = WIDTH / 2;
const NECK_Y = HEIGHT / 2;
const CAP_HEIGHT = 7;
const CAP_RADIUS = 2;
/** The two posts that hold the caps apart, this far in from the caps' ends. */
const POST_INSET = 7;
/** A bulb, from the neck to a cap, and its half-width at the neck and at its widest. */
const BULB_HEIGHT = NECK_Y - CAP_HEIGHT;
const NECK_HALF = 3.2;
const BULB_HALF = 44;
/**
 * A bulb's side follows this much of half a sine wave out from the neck, so
 * past its widest it turns back in toward the cap. It is raised to `SWELL`,
 * under one, so it rounds out rather than running in straight.
 */
const SHOULDER = 0.7;
const SWELL = 0.85;
/** Each side of the glass is drawn as a run of points about this far apart. */
const SIDE_STEP = 1;
/**
 * A quarter of an hour a grain: the waking day is 64 of them, and the
 * screen's share of it is as many as the average day's hours make.
 */
const GRAINS_PER_HOUR = 4;
const GRAINS = WAKING_HOURS * GRAINS_PER_HOUR;
const SPENT = Math.round(GRAINS * (AVERAGE_HOURS / WAKING_HOURS));
/** Every grain is a phone: a tall rounded rectangle. A pile keeps them this far apart. */
const GRAIN_WIDTH = 4.4;
const GRAIN_HEIGHT = 7.6;
const GRAIN_RADIUS = 1.3;
const PITCH_X = 6;
const PITCH_Y = 8.4;
/** The air a grain keeps from the glass. */
const WALL_GAP = 0.8;
/**
 * How far a grain lies off true, as an angle and a nudge: a little in the top
 * bulb, where the day lies in order, more in the heap under it.
 */
const TOP_TILT = 0.08;
const HEAP_TILT = 0.2;
const NUDGE = 0.4;
/**
 * The top drains from the middle of its surface first, so a dip opens there,
 * and the heap rises in the middle first, so it stands as a mound. This is how
 * much a grain's distance off the middle counts against its height in each.
 */
const DIP = 0.5;
const MOUND = 0.6;
/**
 * A grain comes out of the neck here, just under it, at this speed, and
 * gathers pace from there, in the box's units a second.
 */
const OUTLET = NECK_Y + GRAIN_HEIGHT / 2;
const FALL_SPEED = 60;
const GRAVITY = 600;
/** A grain that lands on the heap rolls down its side to where it rests, over this long. */
const ROLL = 0.22;
/** A grain fades out of the top bulb over this long before it comes out of the neck. */
const LEAVE_FADE = 0.15;
/**
 * One turn of the glass, in seconds. Most of the screen's share pours through
 * in `drawing.hourglass`, slow at both ends, and the last few drip through
 * after it one at a time. The glass stands still a moment, turns over, and
 * fills again for the next day.
 */
const DRIPS = 3;
const POURED = SPENT - DRIPS;
const DRIP_GAP = 1.3;
const STILL = 0.7;
const TURN_AT = drawing.hourglass + DRIPS * DRIP_GAP + STILL;
const TURN = 1;
const REFILL = 0.4;
const CYCLE = TURN_AT + TURN + REFILL;
/** The glass waits for its sentence to rise into place before it pours, as every drawing does. */
const START = -drawing.delay;
/** How long the beat takes to fade out. The glass fills again once it has. */
const FADE_OUT_MS = Number.parseFloat(duration.quick);
/** A screen denser than this gains nothing a grain this small could show. */
const MAX_DENSITY = 2;
/** A frame that comes late moves the glass on no more than this, so no grain skips its fall. */
const LONGEST_FRAME = 0.1;
/**
 * How tall the glass stands beside the words on a wide screen, and on a wide
 * but short one. Under the words on a narrow one it takes the room it is
 * given: as tall as that is, unless that would make it wider than it is.
 */
const TALL = 430;
const TALL_SHORT = 300;
const TALL_NARROW = `min(100cqh, 100cqw * ${HEIGHT} / ${WIDTH})`;

/** A place a grain lies: where, at what angle, how high in its pile and how far off the middle. */
type Place = { angle: number; height: number; off: number; x: number; y: number };
/** A grain as it is drawn: in the top bulb it is an hour still to come, and orange once it is spent. */
type Grain = { alpha: number; angle: number; spent: boolean; x: number; y: number };

/** A number between -1 and 1 that is the same for the same grain every time. */
function scatter(index: number, salt: number): number {
  const wave = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453;
  return (wave - Math.floor(wave)) * 2 - 1;
}

/** Slow out of a stop and slow into the next, from 0 to 1. */
function smooth(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * The glass's half-width `rise` up or down from the neck. The bulb's own width
 * and the neck's are taken as the two sides of a right angle, so the glass
 * narrows into the neck in a smooth waist rather than to a point.
 */
function halfWidth(rise: number): number {
  const along = Math.min(1, Math.max(0, rise / BULB_HEIGHT));
  return Math.hypot(NECK_HALF, BULB_HALF * Math.sin(Math.PI * SHOULDER * along) ** SWELL);
}

/**
 * The places a grain can lie in a bulb, a row at a time up from `floor` to
 * `ceiling`, the rows in a brick pattern. Each row is as wide as the glass
 * leaves room for over a grain's whole height, and runs from the middle out.
 */
function places(floor: number, ceiling: number, tilt: number, salt: number): Array<Place> {
  const found: Array<Place> = [];
  for (let row = 0; floor - (row + 1) * PITCH_Y >= ceiling; row++) {
    const y = floor - GRAIN_HEIGHT / 2 - row * PITCH_Y;
    const room =
      Math.min(
        halfWidth(Math.abs(y - GRAIN_HEIGHT / 2 - NECK_Y)),
        halfWidth(Math.abs(y + GRAIN_HEIGHT / 2 - NECK_Y)),
      ) -
      WALL_GAP -
      GRAIN_WIDTH / 2;
    const shift = row % 2 === 0 ? 0 : PITCH_X / 2;
    const reach = Math.ceil(room / PITCH_X) + 1;
    const offsets = Array.from({ length: 2 * reach + 1 }, (_, step) => (step - reach) * PITCH_X)
      .map((offset) => offset + shift)
      .filter((offset) => Math.abs(offset) <= room)
      .sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    for (const offset of offsets) {
      const index = found.length;
      found.push({
        angle: scatter(index, salt) * tilt,
        height: row * PITCH_Y,
        off: Math.abs(offset),
        x: MIDDLE + offset + scatter(index, salt + 1) * NUDGE,
        y: y + scatter(index, salt + 2) * NUDGE,
      });
    }
  }
  return found;
}

/** When the `index`th grain to go comes out of the neck: the pour, slow at both ends, then the drips. */
function leavesAt(index: number): number {
  if (index >= POURED) {
    return drawing.hourglass + (index - POURED + 0.5) * DRIP_GAP;
  }
  // The pour runs as a wave's crest: out of a standstill, quickest at its
  // middle, and back down. How much of it has run by `u` of the way through
  // is `u - sin(2πu) / 2π`, found for this grain's share by halving.
  const share = (index + 0.5) / POURED;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    if (middle - Math.sin(2 * Math.PI * middle) / (2 * Math.PI) < share) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low * drawing.hourglass;
}

/** How long a grain takes to fall `drop` from the outlet. */
function fallTime(drop: number): number {
  return (Math.sqrt(FALL_SPEED ** 2 + 2 * GRAVITY * drop) - FALL_SPEED) / GRAVITY;
}

/**
 * The day in the top bulb, filled up from the neck, each grain with when it
 * leaves: the screen's share from the middle of the surface down, and the
 * rest never.
 */
const TOP: ReadonlyArray<Place & { leaves: number }> = (() => {
  const day = places(NECK_Y - WALL_GAP, CAP_HEIGHT, TOP_TILT, 1).slice(0, GRAINS);
  const order = day.toSorted((a, b) => b.height - DIP * b.off - (a.height - DIP * a.off));
  return day.map((place) => {
    const rank = order.indexOf(place);
    return { ...place, leaves: rank < SPENT ? leavesAt(rank) : Number.POSITIVE_INFINITY };
  });
})();

/**
 * The heap the spent grains make in the bottom bulb, in the order they land.
 * Each falls from the neck onto the top of the heap so far, then rolls down
 * its side to where it rests.
 */
const HEAP = (() => {
  const room = places(HEIGHT - CAP_HEIGHT, OUTLET, HEAP_TILT, 7);
  const heap = room
    .toSorted((a, b) => a.height + MOUND * a.off - (b.height + MOUND * b.off))
    .slice(0, SPENT);
  return heap.map((place, index) => {
    const summit = Math.min(...heap.slice(0, index).map((under) => under.y));
    const perch = Math.min(place.y, summit - GRAIN_HEIGHT);
    const leaves = leavesAt(index);
    const falls = fallTime(perch - OUTLET);
    const rolls = place.y - perch > 0.5 || Math.abs(place.x - MIDDLE) > 0.5 ? ROLL : 0;
    return { ...place, falls, leaves, perch, rolls, sway: scatter(index, 11) * NUDGE };
  });
})();

/** The grains `local` seconds into a turn of the glass, before it turns over. */
function grainsAt(local: number): Array<Grain> {
  const grains: Array<Grain> = [];
  for (const place of TOP) {
    if (local < place.leaves) {
      grains.push({
        alpha: Math.min(1, (place.leaves - local) / LEAVE_FADE),
        angle: place.angle,
        spent: false,
        x: place.x,
        y: place.y,
      });
    }
  }
  const falling: Array<Grain> = [];
  for (const grain of HEAP) {
    const since = local - grain.leaves;
    if (since < 0) {
      continue;
    }
    if (since < grain.falls) {
      falling.push({
        alpha: 1,
        angle: grain.angle * (since / grain.falls),
        spent: true,
        x: MIDDLE + grain.sway,
        y: OUTLET + FALL_SPEED * since + (GRAVITY * since * since) / 2,
      });
      continue;
    }
    const rolled =
      grain.rolls === 0 ? 1 : 1 - (1 - Math.min(1, (since - grain.falls) / grain.rolls)) ** 2;
    grains.push({
      alpha: 1,
      angle: grain.angle,
      spent: true,
      x: MIDDLE + grain.sway + (grain.x - MIDDLE - grain.sway) * rolled,
      y: grain.perch + (grain.y - grain.perch) * rolled,
    });
  }
  return [...grains, ...falling];
}

/**
 * The glass `at` seconds after it started to play: how far over it is turned,
 * from 0 to 1, how strongly its grains show, and where they are. Before it
 * starts it stands full. Once it has turned over it is full again, fading in,
 * and the next day starts.
 */
function frameAt(at: number): { alpha: number; grains: Array<Grain>; turn: number } {
  const local = at < 0 ? 0 : at % CYCLE;
  if (local >= TURN_AT + TURN) {
    return { alpha: smooth((local - TURN_AT - TURN) / REFILL), grains: grainsAt(0), turn: 0 };
  }
  const turn = Math.max(0, (local - TURN_AT) / TURN);
  return {
    alpha: 1 - smooth(turn * 2),
    grains: grainsAt(Math.min(local, TURN_AT)),
    turn,
  };
}

/** Where the right side of the glass runs, from the top cap to the foot. */
const SIDE: ReadonlyArray<{ x: number; y: number }> = (() => {
  const steps = Math.ceil(BULB_HEIGHT / SIDE_STEP);
  return Array.from({ length: 2 * steps + 1 }, (_, step) => {
    const y = NECK_Y + ((step - steps) / steps) * BULB_HEIGHT;
    return { x: MIDDLE + halfWidth(Math.abs(y - NECK_Y)), y };
  });
})();

/** Both sides of the glass, each one line from cap to cap. */
const GLASS_PATH = [SIDE, SIDE.map(({ x, y }) => ({ x: WIDTH - x, y }))]
  .map((side) =>
    side
      .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' '),
  )
  .join(' ');
const POSTS_PATH = [POST_INSET, WIDTH - POST_INSET]
  .map((x) => `M${x} ${CAP_HEIGHT} V${HEIGHT - CAP_HEIGHT}`)
  .join(' ');

const styles = create({
  // The posts, a step fainter than the glass and the caps.
  faint: {
    opacity: 0.5,
  },
  frame: {
    display: 'block',
    height: '100%',
    overflow: 'visible',
    width: '100%',
  },
  // The grains, drawn over the glass in the same box. The hours still to
  // come are drawn in its colour.
  grains: {
    color: colors.muted,
    height: '100%',
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: 'absolute',
    width: '100%',
  },
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  // The box the hourglass is sized in. It turns over as a whole.
  shell: {
    aspectRatio: `${WIDTH} / ${HEIGHT}`,
    flexShrink: 0,
    height: {
      '@media (max-width: 767px)': TALL_NARROW,
      '@media (min-width: 768px) and (max-height: 720px)': TALL_SHORT,
      default: TALL,
    },
    position: 'relative',
    // The width follows the height through the aspect ratio.
    width: 'auto',
  },
});

/**
 * The glass `at` seconds in, painted: the grains on the canvas, a hairline
 * outline for the hours still to come and solid orange for the spent ones,
 * and the turn on the box that holds the glass and the canvas both.
 */
function paint(canvas: HTMLCanvasElement, glass: HTMLElement | null, at: number) {
  const context = canvas.getContext('2d');
  if (context === null || canvas.width === 0 || canvas.clientWidth === 0) {
    return;
  }
  const { alpha, grains, turn } = frameAt(at);
  if (glass !== null) {
    // As it turns it is drawn smaller, just enough that its corners never
    // reach past its own box, so it keeps clear of the words and the window.
    const angle = smooth(turn) * Math.PI;
    const fit = WIDTH / (WIDTH * Math.abs(Math.cos(angle)) + HEIGHT * Math.abs(Math.sin(angle)));
    glass.style.transform = turn === 0 ? '' : `rotate(${angle}rad) scale(${Math.min(1, fit)})`;
  }
  const unit = canvas.width / WIDTH;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (alpha === 0) {
    return;
  }
  context.fillStyle = accent.base;
  context.strokeStyle = getComputedStyle(canvas).color;
  context.lineWidth = WIDTH / canvas.clientWidth;
  for (const grain of grains) {
    const cos = Math.cos(grain.angle) * unit;
    const sin = Math.sin(grain.angle) * unit;
    context.setTransform(cos, sin, -sin, cos, grain.x * unit, grain.y * unit);
    context.globalAlpha = alpha * grain.alpha;
    context.beginPath();
    context.roundRect(-GRAIN_WIDTH / 2, -GRAIN_HEIGHT / 2, GRAIN_WIDTH, GRAIN_HEIGHT, GRAIN_RADIUS);
    if (grain.spent) {
      context.fill();
    } else {
      context.stroke();
    }
  }
}

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
 * The waking day in an hourglass, a phone for every quarter of an hour. Once
 * `play` comes on the screen's share of it pours through the neck, turning
 * orange as it goes, and heaps up in the bottom bulb; the last few drip
 * through after it, then the glass turns over and the next day starts. It
 * runs only while it plays in a tab in front, and once its beat has faded out
 * it is full again for next time. For a reader who asked for less motion it
 * stands with the day's share already run through.
 */
export function Hourglass({ play }: { play: boolean }) {
  const reduced = useReducedMotion() === true;
  const tabShown = useSyncExternalStore(subscribeVisibility, tabVisible, tabVisibleOnServer);
  const glass = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // How far the glass has played, in seconds. It stands still while the glass
  // is paused, so it goes on from there.
  const clock = useRef(START);

  // The canvas is drawn at the screen's own density, and again whenever its
  // box changes size.
  useEffect(() => {
    const element = canvas.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const density = Math.min(window.devicePixelRatio, MAX_DENSITY);
      element.width = Math.round(element.clientWidth * density);
      element.height = Math.round(element.clientHeight * density);
      paint(element, glass.current, clock.current);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // With less motion the glass stands run through. Otherwise it runs while it
  // plays in a tab in front and holds where it is while it does not, and once
  // its beat has faded out it is full again for next time.
  useEffect(() => {
    const element = canvas.current;
    if (element === null) {
      return;
    }
    if (reduced) {
      clock.current = TURN_AT;
      paint(element, glass.current, TURN_AT);
      return;
    }
    if (!play) {
      const timer = setTimeout(() => {
        clock.current = START;
        paint(element, glass.current, START);
      }, FADE_OUT_MS);
      return () => clearTimeout(timer);
    }
    if (!tabShown) {
      return;
    }
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      clock.current += Math.min(LONGEST_FRAME, (now - last) / 1000);
      last = now;
      paint(element, glass.current, clock.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [play, reduced, tabShown]);

  return (
    <div aria-hidden="true" ref={glass} {...props(styles.shell)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.frame)}>
        <path
          d={POSTS_PATH}
          vectorEffect="non-scaling-stroke"
          {...props(styles.line, styles.faint)}
        />
        <path d={GLASS_PATH} vectorEffect="non-scaling-stroke" {...props(styles.line)} />
        <rect
          height={CAP_HEIGHT}
          rx={CAP_RADIUS}
          vectorEffect="non-scaling-stroke"
          width={WIDTH}
          {...props(styles.line)}
        />
        <rect
          height={CAP_HEIGHT}
          rx={CAP_RADIUS}
          vectorEffect="non-scaling-stroke"
          width={WIDTH}
          y={HEIGHT - CAP_HEIGHT}
          {...props(styles.line)}
        />
      </svg>
      <canvas ref={canvas} {...props(styles.grains)} />
    </div>
  );
}
