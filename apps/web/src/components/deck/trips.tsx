import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getLocale } from '../../paraglide/runtime.js';

/** The drawing plays once over this long each time it comes on. */
const PLAY_SECONDS = 2.4;
/** The map, in the drawing's own 320 by 240 box, with room over it for the flights and under it for the count. */
const WIDTH = 320;
const HEIGHT = 240;
/**
 * The land, a mark for every five degrees of longitude and latitude that is
 * mostly land, from 80 degrees north to 55 south: the Antarctic is left off.
 * Rasterized once from Natural Earth's 1:110m land.
 */
const LAND: ReadonlyArray<string> = [
  '.............#..#####.##########......##...............###..............',
  '...........####.#####....#######..................############.###......',
  '...#################.##..#####.........#################################',
  '...###############..###...##.........###################################',
  '....#...##########..####...........#.###########################...##...',
  '..........###############.........###############################..#....',
  '...........#############...........#############################........',
  '...........###########............#############################.#.......',
  '...........##########.............####..####################.#.#........',
  '............########..............#####.#..#################..#.........',
  '.............####..#.............###########################............',
  '...............##................###############..#########.............',
  '...............####..............##############...###..###..............',
  '..................##.............#############.....#...###..............',
  '....................#####........#############..........................',
  '....................######............#######..........##.##............',
  '....................########..........######............#.##..###.......',
  '....................#########.........######....................##......',
  '....................#########.........######..................#.........',
  '.....................#######..........######.#..............#####.......',
  '......................######...........####..#.............#######......',
  '......................####.............####................########.....',
  '.....................#####.............###.................########.....',
  '.....................####.......................................##......',
  '.....................##...............................................#.',
  '.....................##.................................................',
  '.....................##.................................................',
];
const DEGREES = 5;
const NORTH = 80;
const PITCH = 4.4;
const DOT_RADIUS = 1.1;
const MAP_X = (WIDTH - (LAND[0]?.length ?? 0) * PITCH) / 2;
const MAP_Y = 40;
const MAP_BOTTOM = MAP_Y + LAND.length * PITCH;
/** A flight bows up off the straight line between its cities, by this much of that line at its middle. */
const ARC_RISE = 0.22;
const ARC_STEPS = 40;
/** The flights leave one after another, each in the air this long. */
const FLIGHT_SECONDS = 0.7;
/** A flight that has landed steps back to this, so the one in the air leads. */
const LANDED_OPACITY = 0.35;
const FADE_SECONDS = 0.6;
/** A city's mark pops up as a flight leaves or lands there. */
const POP_SECONDS = 0.25;
const CITY_RADIUS = 1.6;
const PLANE_RADIUS = 2.2;
const COUNT_SIZE = 28;
const COUNT_Y = MAP_BOTTOM + 34;

type Point = { x: number; y: number };
type Route = { lengths: ReadonlyArray<number>; points: ReadonlyArray<Point> };

/** Once the last flight is down, a ring goes out from where it landed now and then. */
const ripple = keyframes({
  from: { opacity: 0.6, transform: 'scale(1)' },
  to: { opacity: 0, transform: 'scale(3.2)' },
});

const styles = create({
  city: {
    fill: accent.base,
  },
  // The count of trips, under the map.
  count: {
    fill: colors.fg,
    fontSize: COUNT_SIZE,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  },
  drawing: {
    display: 'block',
    height: 'auto',
    maxWidth: 360,
    overflow: 'visible',
    width: '100%',
  },
  flight: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.25,
  },
  land: {
    fill: colors.muted,
    opacity: 0.5,
  },
  ripple: {
    animationDuration: '2.4s',
    animationIterationCount: 'infinite',
    animationName: ripple,
    animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    fill: 'none',
    stroke: accent.base,
    strokeWidth: 0.75,
    transformBox: 'fill-box',
    transformOrigin: 'center',
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

function clamp(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** Slow off the ground, fast at height, slow down onto it again. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Up a little past its size and back, the way a mark is set down. Never under
 * nothing, which rounding would otherwise give it at the very start.
 */
function easeOutBack(t: number): number {
  const overshoot = 1.7;
  return Math.max(0, 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2);
}

/** Where a place is on the map, at its longitude and latitude. */
function place(longitude: number, latitude: number): Point {
  return {
    x: MAP_X + ((longitude + 180) / DEGREES) * PITCH,
    y: MAP_Y + ((NORTH - latitude) / DEGREES) * PITCH,
  };
}

/** Every mark of land as one path: a small circle drawn as two half turns. */
const LAND_PATH = LAND.flatMap((row, rowIndex) =>
  [...row].flatMap((cell, column) => {
    if (cell !== '#') {
      return [];
    }
    const x = MAP_X + (column + 0.5) * PITCH - DOT_RADIUS;
    const y = MAP_Y + (rowIndex + 0.5) * PITCH;
    return [
      `M${x.toFixed(2)} ${y.toFixed(2)}a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${2 * DOT_RADIUS} 0a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${-2 * DOT_RADIUS} 0`,
    ];
  }),
).join('');

const CITIES = {
  bali: place(115.2, -8.7),
  cairo: place(31.2, 30),
  capeTown: place(18.4, -33.9),
  dubai: place(55.3, 25.2),
  istanbul: place(29, 41),
  lisbon: place(-9.1, 38.7),
  london: place(-0.1, 51.5),
  mexicoCity: place(-99.1, 19.4),
  mumbai: place(72.9, 19.1),
  newYork: place(-74, 40.7),
  reykjavik: place(-21.9, 64.1),
  rio: place(-43.2, -22.9),
  sanFrancisco: place(-122.4, 37.8),
  sydney: place(151.2, -33.9),
  tokyo: place(139.7, 35.7),
};

/** The flights, in the order they leave, from one corner of the map to another and back. */
const FLIGHTS: ReadonlyArray<[keyof typeof CITIES, keyof typeof CITIES]> = [
  ['london', 'newYork'],
  ['tokyo', 'bali'],
  ['lisbon', 'rio'],
  ['dubai', 'sydney'],
  ['sanFrancisco', 'mexicoCity'],
  ['cairo', 'capeTown'],
  ['reykjavik', 'istanbul'],
  ['mumbai', 'tokyo'],
];
/** How long after the first flight leaves each next one does, so the last lands as the drawing ends. */
const STAGGER = (PLAY_SECONDS - FLIGHT_SECONDS) / (FLIGHTS.length - 1);

/** A flight's way as a run of points, bowed up off the straight line between its cities. */
function route(from: Point, to: Point): Route {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Square to the line, on its upper side.
  const side = dx >= 0 ? 1 : -1;
  const bend = {
    x: (from.x + to.x) / 2 + side * dy * 2 * ARC_RISE,
    y: (from.y + to.y) / 2 - side * dx * 2 * ARC_RISE,
  };
  const points = Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
    const t = step / ARC_STEPS;
    const start = (1 - t) ** 2;
    const middle = 2 * (1 - t) * t;
    const end = t ** 2;
    return {
      x: start * from.x + middle * bend.x + end * to.x,
      y: start * from.y + middle * bend.y + end * to.y,
    };
  });
  const lengths = points.reduce<Array<number>>((sums, point, index) => {
    const previous = points[index - 1];
    sums.push(
      previous === undefined
        ? 0
        : (sums[index - 1] ?? 0) + Math.hypot(point.x - previous.x, point.y - previous.y),
    );
    return sums;
  }, []);
  return { lengths, points };
}

const ROUTES = FLIGHTS.map(([from, to]) => ({
  from: CITIES[from],
  key: `${from}-${to}`,
  to: CITIES[to],
  way: route(CITIES[from], CITIES[to]),
}));

/** A run of points as one path. */
function through(points: ReadonlyArray<Point>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

/** The way flown, `share` of it, and the point the plane is at. */
function flown(way: Route, share: number): { path: string; point: Point } {
  const total = way.lengths.at(-1) ?? 0;
  const along = clamp(share) * total;
  const behind = Math.max(
    1,
    way.lengths.findIndex((length) => length >= along),
  );
  const from = way.points[behind - 1] ?? { x: 0, y: 0 };
  const to = way.points[behind] ?? from;
  const fromLength = way.lengths[behind - 1] ?? 0;
  const span = (way.lengths[behind] ?? fromLength) - fromLength;
  const t = span > 0 ? (along - fromLength) / span : 0;
  const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  return { path: through([...way.points.slice(0, behind), point]), point };
}

/**
 * A dotted map of the world, and flights drawn across it one after another,
 * each from one city to another and down on a small mark. A flight steps back
 * once it has landed, so the one in the air leads. The count under the map
 * climbs with them to `amount`. It plays once each time `play` turns on and
 * stands empty while it is off. For a reader who asked for less motion it
 * stands finished.
 */
export function TripsGraphic({ amount, play }: { amount: number; play: boolean }) {
  const reduced = useReducedMotion();
  const at = usePlayhead(play);
  const seconds = at * PLAY_SECONDS;
  const flights = ROUTES.map((flight, index) => {
    const leaves = index * STAGGER;
    return {
      ...flight,
      departed: clamp((seconds - leaves) / POP_SECONDS),
      share: easeInOut(clamp((seconds - leaves) / FLIGHT_SECONDS)),
      since: seconds - leaves - FLIGHT_SECONDS,
    };
  });
  const count = Math.round(
    (amount * flights.reduce((sum, flight) => sum + flight.share, 0)) / FLIGHTS.length,
  );
  const last = flights.at(-1);
  const number = new Intl.NumberFormat(getLocale());

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.drawing)}>
      <path d={LAND_PATH} {...props(styles.land)} />
      {flights.map(({ departed, from, key, share, since, to, way }) => {
        if (departed <= 0) {
          return null;
        }
        const { path, point } = flown(way, share);
        const landed = since >= 0;
        return (
          <g key={key}>
            <path
              d={path}
              opacity={landed ? 1 - (1 - LANDED_OPACITY) * easeOut(clamp(since / FADE_SECONDS)) : 1}
              {...props(styles.flight)}
            />
            <circle
              cx={from.x}
              cy={from.y}
              r={CITY_RADIUS * easeOutBack(departed)}
              {...props(styles.city)}
            />
            <circle
              cx={landed ? to.x : point.x}
              cy={landed ? to.y : point.y}
              r={landed ? CITY_RADIUS * easeOutBack(clamp(since / POP_SECONDS)) : PLANE_RADIUS}
              {...props(styles.city)}
            />
          </g>
        );
      })}
      {at >= 1 && reduced !== true && last !== undefined ? (
        <circle cx={last.to.x} cy={last.to.y} r={CITY_RADIUS} {...props(styles.ripple)} />
      ) : null}
      <text
        dominantBaseline="central"
        textAnchor="middle"
        x={WIDTH / 2}
        y={COUNT_Y}
        {...props(styles.count)}
      >
        {number.format(count)}
      </text>
    </svg>
  );
}
