import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { cancelFrame, frame } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { duration, easing } from '../lib/motion.stylex.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import { useTabHidden } from '../lib/use-tab-hidden.ts';
import { m } from '../paraglide/messages.js';
import { stretch } from './steps/playhead.ts';

/** The drawing's own box, and the bar across the top of the window. */
const WIDTH = 320;
const HEIGHT = 208;
const BAR = 26;
const CORNER = 10;

/**
 * A site's turn, in milliseconds, and when each part of it plays. The page
 * stands with its feeds on it, the feeds go one after another, what stays
 * closes up, and the clean page stands a moment before the next site's page
 * crossfades in over it. Like the other drawings it tells rather than
 * responds, so it keeps its own times rather than the page's motion scale.
 */
const TURN = 3600;
const GO = { fade: 400, from: 1200, stagger: 60 };
const CLOSE = [1700, 2400] as const;
const NEXT = [3250, 3600] as const;
/** The stretches of a turn where nothing moves, in which the page is not drawn again. */
const STILL = [
  [0, GO.from],
  [CLOSE[1], NEXT[0]],
] as const;
/** Where the loop stands for a reader who asked for less motion: the first site, clean. */
const REST = 3000;
/** A site's icon in the address bar, its corners cut as an app icon's are: a quarter of its side. */
const FAVICON = { radius: 2.5, size: 10, x: 96, y: 8 };
/** How small a feed is, and how blurred, by the time it is gone. */
const GONE_SCALE = 0.94;
const GONE_BLUR = 2;
/** A site's name in the row over the drawing: how tall it is, and how wide its border. */
const PILL = { border: 1, height: 28 };
/**
 * The line that runs round the playing site's name, and on to the next. Of a
 * turn's time, the last `bridge` milliseconds are the crossing to the next
 * name; before that the line goes once round its own. The line behind it, on
 * the name it came from, is taken back over `retract` of the turn. `swing` is
 * how far the crossing's curve is pulled down and up, in pixels.
 */
const LINE = { bridge: 300, retract: 0.5, swing: 20 };
/** How tall the touch a name takes is, in pixels: a finger's height. */
const TOUCH = 44;

/** When a part leaves, by its place in the order, and how far it moves up once the feeds have left. */
type Mark = {
  /** It is not there until the feeds have gone: what takes a feed's place. */
  come?: boolean;
  go?: number;
  up?: number;
};
/** A part of a page: a line of words, a round picture, or a box. */
type Part = Mark &
  (
    | { h?: number; kind: 'bar'; w: number; x: number; y: number }
    | { kind: 'dot'; r: number; x: number; y: number }
    | { h: number; kind: 'box'; r: number; w: number; x: number; y: number }
  );

/** One entry of a site's menu down its left side: its icon and its name. */
function entry(y: number, mark: Mark = {}): Array<Part> {
  return [
    { kind: 'dot', r: 3, x: 17, y, ...mark },
    { kind: 'bar', w: 26, x: 25, y: y - 1.5, ...mark },
  ];
}

/** A row of three videos, each with a line of title under it. */
function videos(y: number, mark: Mark = {}): Array<Part> {
  return [0, 1, 2].flatMap((place): Array<Part> => {
    const x = 68 + place * 82;
    return [
      { h: 40, kind: 'box', r: 4, w: 74, x, y, ...mark },
      { kind: 'bar', w: 48, x, y: y + 45, ...mark },
    ];
  });
}

/**
 * The three sites the extension ships rules for, drawn as plain shapes: the
 * layout of each, and on it the parts the extension hides. `icon` is the
 * site's own app icon in `public/media/apps`, by bundle id.
 */
const SITES: ReadonlyArray<{
  /** What the extension hides on the site and what stays, in a sentence or two. */
  does: () => string;
  icon: string;
  name: () => string;
  parts: ReadonlyArray<Part>;
}> = [
  // A video site: the row of short videos goes, with its entry in the menu,
  // and the rows of videos under it move up.
  {
    does: m.home_ext_does_youtube,
    icon: 'com.google.ios.youtube',
    name: m.home_ext_site_youtube,
    parts: [
      { h: 12, kind: 'box', r: 6, w: 120, x: 120, y: 34 },
      ...entry(42),
      ...entry(56, { go: 0 }),
      ...entry(70, { up: 14 }),
      ...entry(84, { up: 14 }),
      ...entry(98, { up: 14 }),
      ...videos(56),
      { go: 1, kind: 'bar', w: 30, x: 68, y: 112 },
      ...[0, 1, 2, 3, 4].map((place): Part => ({
        go: 2 + place,
        h: 46,
        kind: 'box',
        r: 4,
        w: 27,
        x: 68 + place * 33,
        y: 120,
      })),
      ...videos(178, { up: 66 }),
      ...videos(244, { up: 66 }),
    ],
  },
  // A photo site: the short videos' entry in the menu goes, and the people it
  // suggests. Stories, posts and the reader's own profile stay.
  {
    does: m.home_ext_does_instagram,
    icon: 'com.burbn.instagram',
    name: m.home_ext_site_instagram,
    parts: [
      ...entry(42),
      ...entry(58),
      ...entry(74),
      ...entry(90, { go: 0 }),
      ...entry(106, { up: 16 }),
      ...entry(122, { up: 16 }),
      ...[0, 1, 2, 3, 4].map((place): Part => ({ kind: 'dot', r: 8, x: 108 + place * 27, y: 46 })),
      { kind: 'dot', r: 5, x: 102, y: 68 },
      { kind: 'bar', w: 40, x: 112, y: 66.5 },
      { h: 100, kind: 'box', r: 4, w: 130, x: 96, y: 78 },
      { kind: 'dot', r: 5, x: 102, y: 192 },
      { kind: 'bar', w: 34, x: 112, y: 190.5 },
      { kind: 'dot', r: 6, x: 248, y: 42 },
      { kind: 'bar', w: 36, x: 258, y: 40.5 },
      { go: 1, kind: 'bar', w: 44, x: 242, y: 60 },
      ...[0, 1, 2, 3].flatMap((place): Array<Part> => {
        const y = 76 + place * 15;
        return [
          { go: 2 + place, kind: 'dot', r: 4, x: 246, y },
          { go: 2 + place, kind: 'bar', w: 28, x: 254, y: y - 1.5 },
          { go: 2 + place, h: 8, kind: 'box', r: 4, w: 16, x: 292, y: y - 4 },
        ];
      }),
    ],
  },
  // A site of short posts: the tab that is chosen for the reader goes, and
  // the box of trends. The tab of the people they follow stays, and gets the
  // underline.
  {
    does: m.home_ext_does_x,
    icon: 'com.atebits.Tweetie2',
    name: m.home_ext_site_x,
    parts: [
      ...entry(42),
      ...entry(58),
      ...entry(74),
      ...entry(90),
      ...entry(106),
      { h: 12, kind: 'box', r: 6, w: 44, x: 12, y: 124 },
      { go: 0, kind: 'bar', w: 28, x: 98, y: 37 },
      { go: 0, h: 2, kind: 'bar', w: 40, x: 92, y: 46 },
      { kind: 'bar', w: 36, x: 172, y: 37 },
      { come: true, h: 2, kind: 'bar', w: 40, x: 170, y: 46 },
      { h: 1, kind: 'bar', w: 158, x: 72, y: 50 },
      ...[0, 1, 2].flatMap((place): Array<Part> => {
        const y = 60 + place * 46;
        return [
          { kind: 'dot', r: 6, x: 84, y: y + 6 },
          { kind: 'bar', w: 40, x: 96, y },
          { kind: 'bar', w: 120, x: 96, y: y + 10 },
          { kind: 'bar', w: 84, x: 96, y: y + 18 },
          { h: 1, kind: 'bar', w: 158, x: 72, y: y + 34 },
        ];
      }),
      { h: 12, kind: 'box', r: 6, w: 66, x: 242, y: 34 },
      { go: 1, h: 92, kind: 'box', r: 6, w: 66, x: 242, y: 54 },
      { go: 1, kind: 'bar', w: 30, x: 250, y: 64 },
      ...[0, 1, 2, 3].flatMap((place): Array<Part> => {
        const y = 78 + place * 16;
        return [
          { go: 2 + place, kind: 'bar', w: 44, x: 250, y },
          { go: 2 + place, kind: 'bar', w: 26, x: 250, y: y + 6 },
        ];
      }),
    ],
  },
];
const LOOP = TURN * SITES.length;

const styles = create({
  // The drawing under the row of sites it plays.
  browser: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  // The points stand a step further under the drawing than the names over it.
  pointsGap: {
    marginBlockStart: spacing.s3,
  },
  // What the extension does on one site: the site's name, then a quiet line,
  // a step smaller than the page's prose so the drawing over them leads. The
  // ones whose site is not playing stand back.
  point: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    opacity: 0.5,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.slow,
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.inOut,
  },
  pointBody: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  pointPlaying: {
    opacity: 1,
  },
  pointTitle: {
    fontSize: font.sizeMd,
    fontWeight: font.weightRegular,
    lineHeight: 1.5,
    margin: 0,
  },
  // Three side by side where they fit, one under the other on a phone.
  points: {
    display: 'grid',
    gap: {
      '@media (min-width: 768px)': spacing.s6,
      default: spacing.s4,
    },
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'repeat(3, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // The edge of a site's icon, so a white or a black one still holds its shape.
  edge: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // A feed: in the one orange, so it is seen before it goes.
  feed: {
    fill: `color-mix(in srgb, ${accent.base} 10%, transparent)`,
    stroke: accent.base,
  },
  feedWords: {
    fill: accent.base,
  },
  graphic: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    width: '100%',
  },
  // The window and what stays on the page: hairlines in the muted ink, as wide
  // on the screen however large the drawing is.
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // One site in the row over the drawing: its icon and its name, quiet until
  // its page is the one playing. The pseudo-element takes the touch a
  // finger's height around it, so the pill stays as slim as it looks.
  site: {
    '::before': {
      content: '',
      // From the pill's padding edge: half of what the touch is taller by,
      // and the border.
      insetBlock: -((TOUCH - PILL.height) / 2 + PILL.border),
      insetInline: 0,
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: {
      ':hover': colors.muted,
      default: colors.border,
    },
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: PILL.border,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: 'inherit',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    height: PILL.height,
    lineHeight: 1,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    paddingInlineEnd: spacing.s3,
    paddingInlineStart: spacing.s2,
    position: 'relative',
    transitionDuration: duration.quick,
    transitionProperty: 'border-color, color',
    transitionTimingFunction: easing.out,
  },
  // The app icon's corner, a quarter of its side, and an edge, so a white or a
  // black icon still holds its shape on the page.
  siteIcon: {
    borderRadius: 4,
    boxSizing: 'border-box',
    display: 'block',
    height: 16,
    outlineColor: colors.border,
    outlineOffset: -1,
    outlineStyle: 'solid',
    outlineWidth: 1,
    width: 16,
  },
  // The site whose page is playing: its name in the ink. Its border stays
  // quiet under the line that is drawn round it. With less motion no line is
  // drawn, and the whole border is in the ink.
  sitePlaying: {
    borderColor: {
      '@media (prefers-reduced-motion: reduce)': colors.fg,
      default: colors.border,
    },
    color: colors.fg,
  },
  // The row of names. The line's sheet is laid against it.
  sites: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
    position: 'relative',
  },
  // A feed on its way out, blurring as it fades.
  going: (filter: string) => ({
    filter,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  }),
  // The sheet the line is drawn on, over the whole row of names. It takes no
  // room and no press. With less motion there is no line.
  trace: {
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    height: '100%',
    inset: 0,
    overflow: 'visible',
    pointerEvents: 'none',
    position: 'absolute',
    width: '100%',
  },
  // The line itself, in the ink, as wide as a name's border and round at its
  // ends. The loop's own clock says which stretches of it are lit.
  traceLine: {
    fill: 'none',
    stroke: colors.fg,
    strokeLinecap: 'round',
    strokeWidth: `${PILL.border}px`,
    vectorEffect: 'non-scaling-stroke',
    visibility: 'hidden',
  },
  // A line of words, a quiet stroke of its own.
  words: {
    fill: colors.border,
  },
});

/** A name's box in its row, in pixels. */
type Box = { height: number; left: number; top: number; width: number };
/**
 * The line over the row, as the stretches it is made of, two to a name: the
 * way round the name, then the crossing to the next. Each has its path and
 * its length in pixels. A crossing of no length is no crossing. They are
 * stretches of their own because a dash pattern starts over at every break
 * in a path, so one path with breaks in it cannot be lit stretch by stretch.
 */
type Stretch = { d: string; length: number };
type Route = ReadonlyArray<{ bridge: Stretch; loop: Stretch }>;

/** How long a cubic curve is, measured over short straight steps. */
function curveLength(points: ReadonlyArray<readonly [number, number]>): number {
  const [a, b, c, d] = points;
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    return 0;
  }
  const at = (t: number, axis: 0 | 1) =>
    (1 - t) ** 3 * a[axis] +
    3 * (1 - t) ** 2 * t * b[axis] +
    3 * (1 - t) * t ** 2 * c[axis] +
    t ** 3 * d[axis];
  let length = 0;
  for (let step = 1; step <= 32; step += 1) {
    length += Math.hypot(
      at(step / 32, 0) - at((step - 1) / 32, 0),
      at(step / 32, 1) - at((step - 1) / 32, 1),
    );
  }
  return length;
}

/**
 * The line's path over a row of names. It goes down the middle of each
 * name's border, so it covers the border exactly. Round each name it starts
 * at the middle of the left end and comes back to it: clockwise round the
 * first, the other way round the second, and so on in turn. So the line
 * reaches the middle of a name's right end heading down or up, and the next
 * name is entered at the middle of its left end heading the same way. The
 * crossing between them leaves and arrives along those two headings, in a
 * curve that swings one way and back, and the two ways round read as an S.
 *
 * A way round is one closed loop, not a loop and a half: the crossing is a
 * stretch of its own that starts where the loop passes the right end, so no
 * part of a border is in the path twice. There is no crossing from the last
 * name back to the first, and none to a name that has wrapped to another row.
 */
function routeOf(boxes: ReadonlyArray<Box>): Route {
  const half = PILL.border / 2;
  return boxes.map((box, index) => {
    const left = box.left + half;
    const right = box.left + box.width - half;
    const top = box.top + half;
    const foot = box.top + box.height - half;
    const middle = (top + foot) / 2;
    const radius = (foot - top) / 2;
    // Clockwise goes up first; the other way goes down first.
    const clockwise = index % 2 === 0;
    const [first, second] = clockwise ? [top, foot] : [foot, top];
    const sweep = clockwise ? 1 : 0;
    const arc = (x: number, y: number) => `A${radius} ${radius} 0 0 ${sweep} ${x} ${y}`;
    const loop = {
      d: `M${left} ${middle}${arc(left + radius, first)}H${right - radius}${arc(right, middle)}${arc(right - radius, second)}H${left + radius}${arc(left, middle)}`,
      length: 2 * (right - left - 2 * radius) + 2 * Math.PI * radius,
    };
    const next = boxes[index + 1];
    let bridge: Stretch = { d: '', length: 0 };
    if (next !== undefined && Math.abs(next.top - box.top) < 1) {
      const to = next.left + half;
      // It leaves heading the way the loop passes the right end.
      const swing = clockwise ? LINE.swing : -LINE.swing;
      bridge = {
        d: `M${right} ${middle}C${right} ${middle + swing} ${to} ${middle - swing} ${to} ${middle}`,
        length: curveLength([
          [right, middle],
          [right, middle + swing],
          [to, middle - swing],
          [to, middle],
        ]),
      };
    }
    return { bridge, loop };
  });
}

/** A crossing sets off slowly and arrives slowly. */
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Lights one stretch from `from` to `to`, as shares of it, or none of it. */
function light(path: SVGPathElement | undefined, stretch: Stretch, from: number, to: number) {
  if (path === undefined) {
    return;
  }
  const length = (to - from) * stretch.length;
  if (length < 0.01) {
    path.style.visibility = 'hidden';
    return;
  }
  // One dash, then a gap longer than the stretch, so the dash never comes
  // round again; pushed along to where the lit part starts.
  path.style.visibility = 'visible';
  path.style.strokeDasharray = `${length.toFixed(2)} ${(stretch.length + 1).toFixed(2)}`;
  path.style.strokeDashoffset = (-from * stretch.length).toFixed(2);
}

/**
 * Lights the stretches of the line on `sheet` that `at` milliseconds into the
 * loop calls for. On the playing name: the way round it, as far as the turn
 * has got, whole by the time the crossing starts, and then the crossing as
 * far as it has got. On the name before it, unless the loop was sent here
 * (`fresh`): what the line's tail has not yet taken back, from the loop's
 * start round, and the crossing once the tail is past the right end.
 */
function trace(sheet: SVGSVGElement | null, route: Route | null, at: number, fresh: boolean) {
  const paths = sheet?.querySelectorAll<SVGPathElement>('path');
  if (paths === undefined || route === null || paths.length !== route.length * 2) {
    return;
  }
  const turn = Math.floor(at / TURN) % route.length;
  const before = (turn + route.length - 1) % route.length;
  const into = at % TURN;
  const round = TURN - LINE.bridge;
  const back = fresh ? 1 : Math.min(1, into / (TURN * LINE.retract));
  for (const [index, leg] of route.entries()) {
    const loop = paths[index * 2];
    const bridge = paths[index * 2 + 1];
    if (index === turn) {
      light(loop, leg.loop, 0, Math.min(1, into / round));
      light(bridge, leg.bridge, 0, into > round ? easeInOut((into - round) / LINE.bridge) : 0);
    } else if (index === before) {
      light(loop, leg.loop, back, 1);
      // The crossing hangs off the right end, half way round.
      light(bridge, leg.bridge, Math.min(1, Math.max(0, (back - 0.5) * 4)), 1);
    } else {
      light(loop, leg.loop, 0, 0);
      light(bridge, leg.bridge, 0, 0);
    }
  }
}

/**
 * How far into the loop the drawing is, in milliseconds, and a way to send it
 * to another point of the loop, from where it goes on. It moves with the clock
 * only while `running` and holds where it is otherwise; as it turns `rewound`
 * it goes back to the start, so it plays from there next. Sent somewhere while
 * it is rewound, it stands there, and plays from there. While the page stands
 * still it is not drawn again.
 *
 * The same clock lights the line on the sheet `line`, along `route`,
 * on every frame, the still ones too, and after every render, so the line and
 * the page it times can never be apart: it reaches the next name as the turn
 * ends, and holds, jumps and goes back to the start with the loop. It writes
 * to the line itself and renders nothing.
 */
function useLoop(
  running: boolean,
  rewound: boolean,
  line: RefObject<SVGSVGElement | null>,
  route: RefObject<Route | null>,
): [number, (to: number) => void] {
  const [now, setNow] = useState(0);
  const clock = useRef(0);
  // Whether the loop was sent to this turn, by a press or by going back to
  // its start, and did not come to it from the turn before: then no line is
  // left on the name before it.
  const fresh = useRef(true);
  // Whether it was rewound at the last render. As it turns rewound, what is
  // drawn goes back to the start with the clock, in the same render, so no
  // frame shows where the loop had been.
  const [was, setWas] = useState(rewound);
  if (was !== rewound) {
    setWas(rewound);
    if (rewound) {
      setNow(0);
    }
  }

  useLayoutEffect(() => {
    if (rewound) {
      clock.current = 0;
      fresh.current = true;
    }
  }, [rewound]);

  // After every render: the row may have been measured anew.
  useLayoutEffect(() => {
    trace(line.current, route.current, clock.current, fresh.current);
  });

  useEffect(() => {
    if (!running) {
      return;
    }
    let last: number | undefined;
    function tick({ timestamp }: { timestamp: number }) {
      const was = clock.current;
      const first = last === undefined;
      const next = (was + (last === undefined ? 0 : timestamp - last)) % LOOP;
      last = timestamp;
      clock.current = next;
      const at = next % TURN;
      const from = was % TURN;
      if (Math.floor(next / TURN) !== Math.floor(was / TURN)) {
        fresh.current = false;
      }
      trace(line.current, route.current, next, fresh.current);
      // The first frame is always drawn: it is where the loop takes up again.
      if (first || !STILL.some(([start, end]) => from >= start && at >= from && at < end)) {
        setNow(next);
      }
    }
    frame.update(tick, true);
    return () => cancelFrame(tick);
  }, [line, route, running]);

  function jump(to: number) {
    clock.current = to;
    fresh.current = true;
    setNow(to);
  }

  return [now, jump];
}

/** One site's page, `at` milliseconds into its turn. */
function Page({ at, site }: { at: number; site: number }) {
  const parts = SITES[site]?.parts ?? [];
  const closed = stretch(at, CLOSE[0], CLOSE[1]);

  return parts.map((part, index) => {
    const start = GO.from + (part.go ?? 0) * GO.stagger;
    const gone = part.go === undefined ? 0 : stretch(at, start, start + GO.fade);
    if (gone >= 1 || (part.come === true && closed <= 0)) {
      return null;
    }
    const feed = part.go !== undefined;
    const y = part.y - (part.up ?? 0) * closed;
    const opacity = part.come === true ? closed : 1 - gone;
    const look =
      gone > 0
        ? {
            ...props(
              part.kind === 'bar' ? styles.feedWords : [styles.line, styles.feed],
              styles.going(`blur(${GONE_BLUR * gone}px)`),
            ),
            transform: `scale(${1 - (1 - GONE_SCALE) * gone})`,
          }
        : props(
            part.kind === 'bar'
              ? [styles.words, feed && styles.feedWords]
              : [styles.line, feed && styles.feed],
          );
    if (part.kind === 'dot') {
      return <circle cx={part.x} cy={y} key={index} opacity={opacity} r={part.r} {...look} />;
    }
    const height = part.kind === 'bar' ? (part.h ?? 3) : part.h;
    return (
      <rect
        height={height}
        key={index}
        opacity={opacity}
        rx={part.kind === 'bar' ? height / 2 : part.r}
        width={part.w}
        x={part.x}
        y={y}
        {...look}
      />
    );
  });
}

/**
 * A browser window, drawn in the page's hairlines, and what the extension
 * does in it: a site's page with its feeds in orange, the feeds blurring away
 * one after another, and the rest of the page closing up. It does this for
 * the three sites it ships rules for, one after another, each under its own
 * icon in the address bar, and starts over. The row over the window names the
 * three, as tabs, and marks the one playing: a line in the ink is drawn round
 * its name over the time its page is shown, then crosses to the next name in
 * a short curve, and as it gets there the next site's turn starts and the
 * line behind it is taken back. Pressing a name sends the
 * drawing to that site, with the line at its start, and it goes on from
 * there, or stands there until the drawing is on screen and can play. The
 * left and right arrows go from one name to the next. It plays
 * while it is on screen, holds while the tab is put away, the line with it,
 * and goes back to its start off screen. The server draws the first site
 * with its feeds on it, and with less motion a site stands clean and the
 * playing name has its whole border in the ink.
 */
export function ExtensionBrowser() {
  const drawing = useRef<SVGSVGElement>(null);
  const seen = useSeen(drawing);
  const hidden = useTabHidden();
  const reduced = useLessMotion();
  const line = useRef<SVGSVGElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const route = useRef<Route | null>(null);
  // The line's path, drawn anew when the row of names is measured anew.
  const [paths, setPaths] = useState<ReadonlyArray<string>>([]);
  const [looped, jump] = useLoop(seen && !hidden && !reduced, !seen, line, route);

  // The names are as wide as their words, so the line's path is read off the
  // row as it is laid out, and again whenever a name or the row changes size:
  // a narrower window, a font that lands, another language.
  useLayoutEffect(() => {
    const list = row.current;
    if (list === null) {
      return;
    }
    const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
    const measure = () => {
      const next = routeOf(
        tabs.map((tab) => ({
          height: tab.offsetHeight,
          left: tab.offsetLeft,
          top: tab.offsetTop,
          width: tab.offsetWidth,
        })),
      );
      route.current = next;
      setPaths(next.flatMap((leg) => [leg.loop.d, leg.bridge.d]));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(list);
    for (const tab of tabs) {
      watch.observe(tab);
    }
    return () => watch.disconnect();
  }, []);
  // With less motion the site the reader picked stands clean.
  const now = reduced ? Math.floor(looped / TURN) * TURN + REST : looped;
  const clip = useId();
  const corners = useId();
  const tabs = useId();
  const panel = useId();

  const site = Math.floor(now / TURN) % SITES.length;
  const next = (site + 1) % SITES.length;
  const at = now % TURN;
  // The next site's page comes in over this one at the end of the turn.
  const leaving = stretch(at, NEXT[0], NEXT[1]);
  const pages = [
    { at, opacity: 1 - leaving, site },
    { at: 0, opacity: leaving, site: next },
  ];

  // The arrows go from one site's name to the next, and round, as tabs do.
  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const to = (index + step + SITES.length) % SITES.length;
    jump(to * TURN);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      .item(to)
      .focus();
  }

  return (
    <div {...props(styles.browser)}>
      <div aria-label={m.home_ext_sites()} ref={row} role="tablist" {...props(styles.sites)}>
        {SITES.map((entry, index) => (
          <button
            aria-controls={panel}
            aria-selected={index === site}
            id={`${tabs}-${index}`}
            key={entry.icon}
            onClick={() => jump(index * TURN)}
            onKeyDown={(event) => onKey(event, index)}
            role="tab"
            type="button"
            {...props(styles.site, index === site && styles.sitePlaying)}
          >
            <img
              alt=""
              height={16}
              src={`/media/apps/${entry.icon}.webp`}
              width={16}
              {...props(styles.siteIcon)}
            />
            {entry.name()}
          </button>
        ))}
        {reduced ? null : (
          <svg aria-hidden="true" focusable="false" ref={line} {...props(styles.trace)}>
            {paths.map((d, index) => (
              <path d={d} key={index} {...props(styles.traceLine)} />
            ))}
          </svg>
        )}
      </div>
      <div aria-labelledby={`${tabs}-${site}`} id={panel} role="tabpanel">
        <svg
          aria-label={m.home_ext_drawing()}
          ref={drawing}
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          {...props(styles.graphic)}
        >
          <defs>
            <clipPath id={clip}>
              <rect height={HEIGHT - BAR - 1} width={WIDTH - 2} x={1} y={BAR} />
            </clipPath>
            <clipPath id={corners}>
              <rect
                height={FAVICON.size}
                rx={FAVICON.radius}
                width={FAVICON.size}
                x={FAVICON.x}
                y={FAVICON.y}
              />
            </clipPath>
          </defs>
          <rect
            height={HEIGHT - 1}
            rx={CORNER}
            width={WIDTH - 1}
            x={0.5}
            y={0.5}
            {...props(styles.line)}
          />
          <path d={`M0.5 ${BAR} H${WIDTH - 0.5}`} {...props(styles.line)} />
          {[14, 24, 34].map((x) => (
            <circle cx={x} cy={BAR / 2} key={x} r={3} {...props(styles.line)} />
          ))}
          <rect height={14} rx={7} width={136} x={92} y={6} {...props(styles.line)} />
          {pages.map((page) =>
            page.opacity > 0 ? (
              <g key={page.site} opacity={page.opacity}>
                <image
                  clipPath={`url(#${corners})`}
                  height={FAVICON.size}
                  href={`/media/apps/${SITES[page.site]?.icon}.webp`}
                  width={FAVICON.size}
                  x={FAVICON.x}
                  y={FAVICON.y}
                />
                <rect
                  height={FAVICON.size}
                  rx={FAVICON.radius}
                  width={FAVICON.size}
                  x={FAVICON.x}
                  y={FAVICON.y}
                  {...props(styles.edge)}
                />
                <rect height={3} rx={1.5} width={56} x={110} y={11.5} {...props(styles.words)} />
                <g clipPath={`url(#${clip})`}>
                  <Page at={page.at} site={page.site} />
                </g>
              </g>
            ) : null,
          )}
        </svg>
      </div>
      {/* What it does on each site, the playing one in full ink. */}
      <ul {...props(styles.points, styles.pointsGap)}>
        {SITES.map((entry, index) => (
          <li key={entry.icon} {...props(styles.point, index === site && styles.pointPlaying)}>
            <h3 {...props(styles.pointTitle)}>{entry.name()}</h3>
            <p {...props(styles.pointBody)}>{entry.does()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
