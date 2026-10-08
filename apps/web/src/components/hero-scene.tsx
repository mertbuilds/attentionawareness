import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, palette } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { cancelFrame, easeInOut, frame } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import type { WideLine } from '../lib/use-seen.ts';
import { useTabHidden } from '../lib/use-tab-hidden.ts';
import { m } from '../paraglide/messages.js';
import {
  AppGlyph,
  APPS,
  AppSquare,
  FeedIcon,
  type Glyph,
  ICON,
  PHONE,
  PhoneFrame,
} from './steps/phone.tsx';
import { stretch } from './steps/playhead.ts';

/**
 * What is blocked, in the order it is blocked: the minutes a day it took, and
 * what it is. A feed is an app, drawn by its bundle id, and `slot` is where
 * its icon stands on the phone's home screen (`APPS`). The last is a website,
 * by its address. Both names are the same in every language. The list in the
 * Mac app's window, on a wide window and on a phone, the phone's home screen
 * and the daily average all come from this table, the feeds first.
 */
type Row = { minutes: number } & ({ feed: string; name: string; slot: number } | { site: string });
const ROWS: ReadonlyArray<Row> = [
  { feed: 'com.zhiliaoapp.musically', minutes: 80, name: 'TikTok', slot: 9 },
  { feed: 'com.burbn.instagram', minutes: 60, name: 'Instagram', slot: 12 },
  { feed: 'com.google.ios.youtube', minutes: 40, name: 'YouTube', slot: 15 },
  { feed: 'com.atebits.Tweetie2', minutes: 25, name: 'X', slot: 18 },
  { minutes: 20, site: 'reddit.com' },
];
const FEEDS = ROWS.filter((row) => 'feed' in row).length;

function sum(numbers: ReadonlyArray<number>): number {
  return numbers.reduce((total, each) => total + each, 0);
}

/** The minutes a day that go to everything that stays on the phone. */
const KEPT_MINUTES = 105;
/** The daily average with nothing blocked, in minutes: 5 hours 30. */
const BEFORE = KEPT_MINUTES + sum(ROWS.map((row) => row.minutes));

/**
 * The home screen under the widget, which takes its first two rows of four:
 * the apps that stay, by their glyphs, in the squares the feeds leave free.
 * The last four are the dock's, the browser among them.
 */
const WIDGET_SLOTS = 8;
const KEPT: ReadonlyArray<Glyph> = [
  'camera',
  'photos',
  'maps',
  'clock',
  'notes',
  'bank',
  'mail',
  'contacts',
  'phone',
  'browser',
  'messages',
  'music',
];
const TAKEN = new Set(ROWS.flatMap((row) => ('feed' in row ? [row.slot] : [])));
const FREE = APPS.filter((_, slot) => slot >= WIDGET_SLOTS && !TAKEN.has(slot));
const STAYING = KEPT.flatMap((glyph, index) => {
  const app = FREE[index];
  return app === undefined ? [] : [{ glyph, ...app }];
});

/**
 * The loop, a little under eight seconds a turn, and when each part of it
 * plays, in milliseconds from the start of the turn. It tells rather than
 * responds, so like the steps' drawings it keeps its own times rather than
 * the page's motion scale. The turn starts with nothing added in the Mac
 * app's window, every app on the phone and the daily average at what it was,
 * which is the frame the server draws, so the loop sets off from what is
 * already on the page. After a short beat the rows are blocked one after
 * another, each in a beat of its own (`BEAT`). Once the last is blocked, what
 * the average was comes up under it. The result stands, and then crossfades
 * back to the start.
 */
const LOOP = 7600;
const AT = {
  back: [6900, 7600],
  was: [4300, 4600],
} as const;
/**
 * One row's beat, the first at `from` and the next `every` after it, and when
 * each part of it plays, from the beat's own start: the row is added on the
 * Mac, a pulse runs down the cable, the app or the address is marked on the
 * phone, the app goes and leaves its empty square, and the daily average
 * counts down by the row's time.
 */
const BEAT = {
  count: [420, 740],
  every: 740,
  from: 600,
  mark: [360, 500],
  on: [0, 180],
  out: [540, 740],
  pulse: [120, 440],
} as const;
/**
 * Where the scene stands until the loop first sets off: the start of the
 * turn, the average at what it was. It is what the server draws and what a
 * page without scripts keeps.
 */
const START = 0;
/**
 * Where the scene stands for good for a reader who asked for less motion: the
 * result, every row added, the feeds gone and the lower screen time with what
 * it was under it. The server cannot know who asked, so until the loop sets
 * off it draws this frame too, over the one at `START`, and the page's styles
 * show whichever fits the reader (`atStart`, `atRest`).
 */
const REST = 5200;
/** The stretches where nothing moves: the scene as it was, and the result. */
const STILL = [
  [0, BEAT.from],
  [AT.was[1], AT.back[0]],
] as const;

/**
 * The scene on a wide window, in pixels at its full size, the hero's whole
 * width: the MacBook in the middle with the app's window on its display, the
 * iPhone standing in front of its right edge and a step lower, and the cable
 * from the port in the left end of the MacBook's base (`port`, the plug's
 * outer end), along the desk under it and up into the plug in the phone's
 * foot (`plug`, the middle of its top). `mac` and `phone` are where the two
 * stand and how wide they are.
 */
const WIDE = {
  cable: 'M66 555 C6 555 6 628 120 628 H900 C975 628 975 628 975 605',
  height: 636,
  mac: { width: 900, x: 80 },
  phone: { width: 210, x: 870, y: 173 },
  plug: { x: 975, y: 593 },
  port: { x: 66, y: 555 },
  width: 1160,
};
/**
 * The scene on a phone, the same three things in the column's width: the
 * MacBook across it, the iPhone in front of its right third and a step
 * lower, far larger against the MacBook than on a wide window so its screen
 * time still reads, and the cable the same way round.
 */
const NARROW = {
  cable: 'M0 210 C-14 210 -10 236 0 250 C40 310 290 366 290 322',
  height: 344,
  mac: { width: 340, x: 10 },
  phone: { width: 140, x: 220, y: 30 },
  plug: { x: 290, y: 310 },
  port: { x: 0, y: 210 },
  width: 360,
};
/** A phone's scene is drawn no wider than this, in the middle of the column. */
const NARROW_MAX = 480;
type Layout = typeof WIDE;
/**
 * The pulse, as shares of the cable: a short bright head and the fainter
 * trail behind it.
 */
const PULSE = { head: 0.03, trail: 0.2 };
/** The plug at the cable's end, under the phone's foot. */
const PLUG = { height: 12, radius: 3, width: 14 };
/** The plug at the cable's start, in the end of the MacBook's base. */
const PORT = { height: 9, radius: 2.5, width: 14 };

/**
 * The MacBook, seen from the front, in units of its own: the lid, 280
 * across, with the display a thin bezel inside it, the notch with the camera
 * in the middle of the display's top, the menu bar as deep as the notch, and
 * under the lid the front edge of the base, wider than the lid by `over` at
 * each end, with the lip a thumb opens the lid by.
 */
const LID = { bezel: 3, height: 181, radius: 6, width: 280 };
const GLASS = {
  height: LID.height - 2 * LID.bezel,
  width: LID.width - 2 * LID.bezel,
  x: LID.bezel,
  y: LID.bezel,
};
const NOTCH = { height: 5.5, lens: 0.9, radius: 2, width: 28 };
const MENU_Y = 10;
const DECK = { height: 8, lip: 40, over: 10, radius: 6 };
const LID_PATH = `M0 ${LID.height} V${LID.radius} Q0 0 ${LID.radius} 0 H${LID.width - LID.radius} Q${LID.width} 0 ${LID.width} ${LID.radius} V${LID.height}`;
const NOTCH_PATH = (() => {
  const left = (LID.width - NOTCH.width) / 2;
  const right = left + NOTCH.width;
  const foot = GLASS.y + NOTCH.height;
  return `M${left} ${GLASS.y - 0.5} V${foot - NOTCH.radius} Q${left} ${foot} ${left + NOTCH.radius} ${foot} H${right - NOTCH.radius} Q${right} ${foot} ${right} ${foot - NOTCH.radius} V${GLASS.y - 0.5}`;
})();
const DECK_PATH = (() => {
  const left = -DECK.over;
  const right = LID.width + DECK.over;
  const foot = LID.height + DECK.height;
  return `M${left} ${LID.height} H${right} V${foot - DECK.radius} Q${right} ${foot} ${right - DECK.radius} ${foot} H${left + DECK.radius} Q${left} ${foot} ${left} ${foot - DECK.radius} Z`;
})();
const LIP_PATH = (() => {
  const left = (LID.width - DECK.lip) / 2;
  const right = left + DECK.lip;
  const foot = LID.height + 3;
  return `M${left} ${LID.height} Q${left} ${foot} ${left + 3} ${foot} H${right - 3} Q${right} ${foot} ${right} ${LID.height}`;
})();
/** The MacBook's whole drawing: the base's width, and the lid over the base. */
const MAC = {
  height: LID.height + DECK.height,
  width: LID.width + 2 * DECK.over,
  x: -DECK.over,
};

/** The app's name, on its window's bar. A brand, the same in every language. */
const APP_NAME = 'attention awareness';
/**
 * The Mac app's window on its Choose Restrictions step, on a wide window, in
 * the MacBook's units: in the middle of the desktop under the menu bar, clear
 * of the iPhone in front of the display's right edge. The bar with the three
 * buttons and the app's name, then the column the step stands in, `inset`
 * from the window's sides.
 */
const WINDOW = { height: 144, inset: 9, radius: 3.5, width: 172 };
const WINDOW_AT = {
  x: (LID.width - WINDOW.width) / 2,
  y: (MENU_Y + GLASS.y + GLASS.height - WINDOW.height) / 2,
};
const COLUMN = WINDOW.width - 2 * WINDOW.inset;
const BAR = { height: 10, light: 1.7, lights: [7, 12.6, 18.2], size: 3.6 };
/** The step's title, and the name over each part of it. */
const TITLE = { size: 6, y: 22.5 };
const PART = { size: 4.4 };
const APPS_NAME_Y = 33;
/** The field that searches the App Store, with the words that wait in it. */
const FIELD = { height: 9, radius: 2, size: 3.8, text: 3, y: 36.5 };
/** The card the apps stand in, a row every `pitch`, and the website's card under its own name. */
const CARD = { pad: 3, pitch: 10, radius: 2.5, y: 49 };
const CARD_HEIGHT = 2 * CARD.pad + FEEDS * CARD.pitch;
const SITES_NAME_Y = CARD.y + CARD_HEIGHT + 11;
const SITE_CARD = { height: 13, y: SITES_NAME_Y + 3.5 };
/**
 * A row's measures, from where the row starts: the icon, the name beside it,
 * and at the row's end the button that adds it (`add`), which gives way to a
 * tick, `tick` times its drawn size, and a word once it is added.
 */
type Line = {
  add: { height: number; radius: number; size: number; width: number };
  icon: number;
  name: number;
  size: number;
  tick: number;
};
const LINE: Line = {
  add: { height: 6.6, radius: 1.8, size: 3.6, width: 13 },
  icon: 7,
  name: 11,
  size: 4.4,
  tick: 1,
};
/** How far a row stands inside its card. */
const LINE_INSET = 4;
const TICK = 'M-1.5 0.1 L-0.4 1.2 L1.6 -1.2';
/** How far before the row's end the tick's middle and the word's end stand, at the tick's drawn size. */
const ADDED = { tick: 1.6, word: 5 };
/** The app's one filled button, at the end of the column's foot. */
const BUTTON = { height: 10, size: 4.2, width: 27, y: 128 };
/**
 * The window on a phone, where the step's own words would be too small to
 * read: the bar, then only the rows, fewer things and each far larger, in
 * the part of the display the iPhone leaves free. In the MacBook's units.
 */
const SHORT = {
  height: 158,
  inset: 7,
  pad: 1.5,
  pitch: 29,
  radius: 4,
  width: 161,
  x: 9,
  y: 16,
};
const SHORT_LINE: Line = {
  add: { height: 14, radius: 4, size: 8.5, width: 30 },
  icon: 15,
  name: 21,
  size: 10.5,
  tick: 2.2,
};

/**
 * The Screen Time widget on the phone's home screen, in the phone's units,
 * over the first two rows of apps: its name, the daily average and what the
 * average was.
 */
const WIDGET = { height: 33, inset: 5, radius: 6, width: 64, x: PHONE.x + 8, y: 30 };
const WIDGET_X = WIDGET.x + WIDGET.inset;
const NAME = { size: 4, y: WIDGET.y + 8 };
const LABEL = { size: 3.6, y: WIDGET.y + 13.5 };
const NUMBER = { size: 12, y: WIDGET.y + 25 };
const WAS = { size: 3.6, y: WIDGET.y + 30 };
/** A space as wide as a figure, where the tens of the minutes are missing. */
const FIGURE_SPACE = ' ';
/** How much of a feed's icon is left to see under its mark. */
const MARKED = 0.35;
/**
 * The address the browser is at, in a pill between the apps and the dock,
 * over the browser's own icon: the address at its start and, once the site is
 * blocked, a padlock and a word at its end.
 */
const PILL = { height: 10, inset: 5.5, size: 4.2, width: 64, x: PHONE.x + 8, y: 126.5 };
const PILL_Y = PILL.y + PILL.height / 2;
/** How long the line through the address is, about as long as the address. */
const ADDRESS = 21.5;
const LOCK = 'M-1.8 -0.3 H1.8 V2.1 H-1.8 Z M-1 -0.3 V-1.1 A1 1 0 0 1 1 -1.1 V-0.3';
const LOCK_X = PILL.x + PILL.width - PILL.inset - 1.8;

const styles = create({
  // The word a row wears once it is added, and the word on a blocked address.
  accentWord: {
    fill: accent.base,
    fontWeight: font.weightRegular,
  },
  // Until the loop sets off, each part is drawn twice, and which one shows is
  // the reader's own setting, known to the styles before any script: the
  // result with less motion, the start of the turn otherwise.
  atRest: {
    display: {
      '@media (prefers-reduced-motion: reduce)': 'inline',
      default: 'none',
    },
  },
  atStart: {
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'inline',
    },
  },
  // The app's one filled button, in the orange the app itself fills it with.
  button: {
    fill: accent.base,
  },
  buttonWord: {
    fill: palette.white,
    fontWeight: font.weightMedium,
    textAnchor: 'middle',
  },
  cable: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  // What is raised inside the window, and the widget on the home screen: a
  // card, a hairline around it.
  card: {
    fill: colors.raised,
    stroke: colors.border,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // A word in the middle of what holds it: the window's name, the word on a button.
  centered: {
    textAnchor: 'middle',
  },
  ended: {
    textAnchor: 'end',
  },
  // The MacBook's desktop behind the app's window, a step off the page's
  // ground so the window stands out on it, a hairline where the bezel ends.
  desktop: {
    fill: `color-mix(in srgb, ${colors.fg} 6%, ${colors.bg})`,
    stroke: colors.border,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // The outline of what stands on the desk: the MacBook's lid and base, and
  // the app's window, as dark as the phone's.
  edge: {
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // The page's ground inside the phone, the MacBook and the window, so the
  // hero's paper stops at their edges.
  ground: {
    fill: colors.bg,
  },
  hero: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  // The three buttons on the window's bar and the camera in the notch, as
  // quiet dots.
  light: {
    fill: colors.border,
  },
  // A quiet line: the bar's edge, the menu bar's, a button's outline and the
  // lip in the base.
  line: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // What marks a blocked thing on the phone, and the tick of an added row.
  mark: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke',
  },
  // The small words, in the muted ink.
  muted: {
    fill: colors.muted,
    fontWeight: font.weightRegular,
  },
  name: {
    fill: colors.fg,
    fontWeight: font.weightRegular,
  },
  // The MacBook: in the middle of the scene, as wide as each layout draws it.
  mac: {
    insetBlockStart: 0,
    insetInlineStart: {
      '@media (min-width: 900px)': `${(WIDE.mac.x / WIDE.width) * 100}%`,
      default: `${(NARROW.mac.x / NARROW.width) * 100}%`,
    },
    width: {
      '@media (min-width: 900px)': `${(WIDE.mac.width / WIDE.width) * 100}%`,
      default: `${(NARROW.mac.width / NARROW.width) * 100}%`,
    },
  },
  // On a phone only, and on a wide window only: the cable and the app's
  // window are drawn for both.
  narrowOnly: {
    display: {
      '@media (min-width: 900px)': 'none',
      default: 'block',
    },
  },
  // The daily average, the one thing on the widget to read. Its digits are
  // all one width and its minutes always take two figures' room (`time`), so
  // the words after them hold still while it counts down.
  number: {
    fill: colors.fg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.02em',
  },
  // A part of the scene, placed in it by its own style. Its lines may run a
  // hair past its box.
  part: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    position: 'absolute',
  },
  // The iPhone: in front of the MacBook's right edge and a step lower.
  phone: {
    insetBlockStart: {
      '@media (min-width: 900px)': `${(WIDE.phone.y / WIDE.height) * 100}%`,
      default: `${(NARROW.phone.y / NARROW.height) * 100}%`,
    },
    insetInlineStart: {
      '@media (min-width: 900px)': `${(WIDE.phone.x / WIDE.width) * 100}%`,
      default: `${(NARROW.phone.x / NARROW.width) * 100}%`,
    },
    width: {
      '@media (min-width: 900px)': `${(WIDE.phone.width / WIDE.width) * 100}%`,
      default: `${(NARROW.phone.width / NARROW.width) * 100}%`,
    },
  },
  plug: {
    fill: colors.bg,
    stroke: colors.muted,
    strokeWidth: 1.5,
  },
  pulse: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
  },
  pulseHead: {
    strokeWidth: 4,
  },
  pulseTrail: {
    strokeOpacity: 0.5,
    strokeWidth: 2,
  },
  // The whole scene, the box its parts are placed in: as wide as the hero
  // lets it, up to its full size, and the same shape at every width.
  scene: {
    aspectRatio: {
      '@media (min-width: 900px)': `${WIDE.width} / ${WIDE.height}`,
      default: `${NARROW.width} / ${NARROW.height}`,
    },
    maxWidth: {
      '@media (min-width: 900px)': WIDE.width,
      default: NARROW_MAX,
    },
    position: 'relative',
    width: '100%',
  },
  // The empty square a blocked app leaves on the home screen.
  slot: {
    fill: 'none',
    stroke: colors.muted,
    strokeDasharray: '3 3',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // The names in the window: the step's title and each part's.
  title: {
    fill: colors.fg,
    fontWeight: font.weightMedium,
  },
  // The cable's own box is the whole scene.
  whole: {
    height: '100%',
    insetBlockStart: 0,
    insetInlineStart: 0,
    width: '100%',
  },
  wideOnly: {
    display: {
      '@media (min-width: 900px)': 'block',
      default: 'none',
    },
  },
});

/**
 * How far into its turn the loop is, in milliseconds. Until it first runs it
 * stands at `START`, the average at what it was, which is what the server
 * draws, so the page a script comes alive on is the page the server sent. The
 * first time it runs it sets off from that same frame, so nothing jumps and
 * the first row's beat is the first thing that moves. It moves with the clock
 * only while `running` and holds where it is otherwise, so it goes on from
 * there rather than leaping ahead by the time it stood. While the scene
 * stands still the page is not drawn again.
 */
function useLoop(running: boolean): number {
  const [now, setNow] = useState<number>(START);
  const clock = useRef(0);

  useEffect(() => {
    if (!running) {
      return;
    }
    let last: number | undefined;
    function tick({ timestamp }: { timestamp: number }) {
      const was = clock.current;
      const next = (was + (last === undefined ? 0 : timestamp - last)) % LOOP;
      last = timestamp;
      clock.current = next;
      if (!STILL.some(([from, to]) => was >= from && next >= was && next < to)) {
        setNow(next);
      }
    }
    frame.update(tick, true);
    return () => cancelFrame(tick);
  }, [running]);

  return now;
}

/**
 * How far the part `[from, to]` of the beat of the row at `index` has played
 * by `now`.
 */
function beat(
  now: number,
  index: number,
  [from, to]: readonly [number, number],
  ease?: (share: number) => number,
): number {
  const start = BEAT.from + index * BEAT.every;
  return stretch(now, start + from, start + to, ease);
}

/**
 * A time of `minutes`, in the words the phone's own Screen Time uses. Minutes
 * under ten stand after `pad`: for the daily average a figure space, as wide
 * as the figure that is not there, so the string is as long as with two and
 * holds still while it counts.
 */
function time(minutes: number, pad = '0'): string {
  const whole = Math.round(minutes);
  return m.hero_phone_time({
    hours: Math.floor(whole / 60),
    minutes: String(whole % 60).padStart(2, pad),
  });
}

/**
 * One row of the list, around its own middle, from `start` to `end`: the
 * icon, the name and the button that adds it. Added as far as `on`, the
 * button gives way to a tick and the word.
 */
function Entry({
  end,
  line,
  on,
  row,
  start,
}: {
  end: number;
  line: Line;
  on: number;
  row: Row;
  start: number;
}) {
  const { add } = line;
  return (
    <>
      <g transform={`translate(${start + line.icon / 2} 0) scale(${line.icon / ICON})`}>
        {'feed' in row ? (
          <FeedIcon bundleId={row.feed} hairline />
        ) : (
          <>
            <AppSquare hairline />
            <AppGlyph glyph="browser" hairline />
          </>
        )}
      </g>
      <text fontSize={line.size} x={start + line.name} y={line.size * 0.35} {...props(styles.name)}>
        {'feed' in row ? row.name : row.site}
      </text>
      {on < 1 ? (
        <g opacity={1 - on}>
          <rect
            height={add.height}
            rx={add.radius}
            width={add.width}
            x={end - add.width}
            y={-add.height / 2}
            {...props(styles.line)}
          />
          <text
            fontSize={add.size}
            x={end - add.width / 2}
            y={add.size * 0.35}
            {...props(styles.name, styles.centered)}
          >
            {m.hero_phone_add()}
          </text>
        </g>
      ) : null}
      {on > 0 ? (
        <g opacity={on}>
          <path
            d={TICK}
            transform={`translate(${end - ADDED.tick * line.tick} 0) scale(${line.tick})`}
            {...props(styles.mark)}
          />
          <text
            fontSize={add.size}
            x={end - ADDED.word * line.tick}
            y={add.size * 0.35}
            {...props(styles.accentWord, styles.ended)}
          >
            {m.hero_phone_added()}
          </text>
        </g>
      ) : null}
    </>
  );
}

/** A window's own outline and its bar, with the three buttons on it. */
function WindowFrame({ height, radius, width }: { height: number; radius: number; width: number }) {
  return (
    <>
      <rect height={height} rx={radius} width={width} {...props(styles.ground, styles.edge)} />
      <path d={`M0 ${BAR.height} H${width}`} {...props(styles.line)} />
      {BAR.lights.map((x) => (
        <circle cx={x} cy={BAR.height / 2} key={x} r={BAR.light} {...props(styles.light)} />
      ))}
    </>
  );
}

/**
 * The Mac app's window as it stands at `now`, on the step that chooses what
 * to block: the search over the apps it found, the website under them, each
 * with the button that adds it, and the button that installs the lot. A row
 * whose beat has come is added.
 */
function MacWindow({ now }: { now: number }) {
  const end = WINDOW.width - WINDOW.inset;
  return (
    <>
      <WindowFrame height={WINDOW.height} radius={WINDOW.radius} width={WINDOW.width} />
      <text
        fontSize={BAR.size}
        x={WINDOW.width / 2}
        y={BAR.height / 2 + BAR.size * 0.35}
        {...props(styles.muted, styles.centered)}
      >
        {APP_NAME}
      </text>
      <text fontSize={TITLE.size} x={WINDOW.inset} y={TITLE.y} {...props(styles.title)}>
        {m.hero_phone_window_title()}
      </text>
      <text fontSize={PART.size} x={WINDOW.inset} y={APPS_NAME_Y} {...props(styles.title)}>
        {m.hero_phone_apps()}
      </text>
      <rect
        height={FIELD.height}
        rx={FIELD.radius}
        width={COLUMN}
        x={WINDOW.inset}
        y={FIELD.y}
        {...props(styles.card)}
      />
      <text
        fontSize={FIELD.size}
        x={WINDOW.inset + FIELD.text}
        y={FIELD.y + FIELD.height / 2 + FIELD.size * 0.35}
        {...props(styles.muted)}
      >
        {m.hero_phone_search()}
      </text>
      <rect
        height={CARD_HEIGHT}
        rx={CARD.radius}
        width={COLUMN}
        x={WINDOW.inset}
        y={CARD.y}
        {...props(styles.card)}
      />
      <text fontSize={PART.size} x={WINDOW.inset} y={SITES_NAME_Y} {...props(styles.title)}>
        {m.hero_phone_websites()}
      </text>
      <rect
        height={SITE_CARD.height}
        rx={CARD.radius}
        width={COLUMN}
        x={WINDOW.inset}
        y={SITE_CARD.y}
        {...props(styles.card)}
      />
      {ROWS.map((row, index) => {
        const y =
          'feed' in row
            ? CARD.y + CARD.pad + (index + 0.5) * CARD.pitch
            : SITE_CARD.y + SITE_CARD.height / 2;
        return (
          <g key={'feed' in row ? row.feed : row.site} transform={`translate(0 ${y})`}>
            <Entry
              end={end - LINE_INSET}
              line={LINE}
              on={beat(now, index, BEAT.on)}
              row={row}
              start={WINDOW.inset + LINE_INSET}
            />
          </g>
        );
      })}
      <rect
        height={BUTTON.height}
        rx={BUTTON.height / 2}
        width={BUTTON.width}
        x={end - BUTTON.width}
        y={BUTTON.y}
        {...props(styles.button)}
      />
      <text
        fontSize={BUTTON.size}
        x={end - BUTTON.width / 2}
        y={BUTTON.y + BUTTON.height / 2 + BUTTON.size * 0.35}
        {...props(styles.buttonWord)}
      >
        {m.hero_phone_install()}
      </text>
    </>
  );
}

/**
 * The same window on a phone, as it stands at `now`: under its bar only the
 * rows, one under another with a line between two, each with the button that
 * adds it. A row whose beat has come is added.
 */
function ShortWindow({ now }: { now: number }) {
  return (
    <>
      <WindowFrame height={SHORT.height} radius={SHORT.radius} width={SHORT.width} />
      {ROWS.map((row, index) => {
        const top = BAR.height + SHORT.pad + index * SHORT.pitch;
        return (
          <g key={'feed' in row ? row.feed : row.site}>
            {index > 0 ? (
              <path
                d={`M${SHORT.inset} ${top} H${SHORT.width - SHORT.inset}`}
                {...props(styles.line)}
              />
            ) : null}
            <g transform={`translate(0 ${top + SHORT.pitch / 2})`}>
              <Entry
                end={SHORT.width - SHORT.inset}
                line={SHORT_LINE}
                on={beat(now, index, BEAT.on)}
                row={row}
                start={SHORT.inset}
              />
            </g>
          </g>
        );
      })}
    </>
  );
}

/**
 * The MacBook itself, open on the desk and seen from the front, with nothing
 * on its display yet: the lid, the desktop inside its bezel, the menu bar's
 * line, the notch and its camera, and the front edge of the base with its
 * lip. The page's ground fills it, so the hero's paper stops at its edge.
 */
function MacBook() {
  return (
    <>
      <path d={LID_PATH} {...props(styles.ground, styles.edge)} />
      <rect
        height={GLASS.height}
        rx={LID.radius - LID.bezel}
        width={GLASS.width}
        x={GLASS.x}
        y={GLASS.y}
        {...props(styles.desktop)}
      />
      <path d={`M${GLASS.x} ${MENU_Y} H${GLASS.x + GLASS.width}`} {...props(styles.line)} />
      <path d={NOTCH_PATH} {...props(styles.ground, styles.line)} />
      <circle
        cx={LID.width / 2}
        cy={GLASS.y + NOTCH.height / 2 - 0.4}
        r={NOTCH.lens}
        {...props(styles.light)}
      />
      <path d={DECK_PATH} {...props(styles.ground, styles.edge)} />
      <path d={LIP_PATH} {...props(styles.line)} />
    </>
  );
}

/**
 * The iPhone's home screen as it stands at `now`: the Screen Time widget with
 * the daily average, which is what it was less the time of every row blocked
 * so far, the apps, and the address the browser is at. A feed whose beat has
 * come is struck through in the accent and goes, and its empty square stays
 * where it stood. The website's beat leaves the browser alone and blocks the
 * address: a line through it, a padlock and the word. Once every row is
 * blocked, the line that says what the average was comes up.
 */
function Home({ now }: { now: number }) {
  const average =
    BEFORE - sum(ROWS.map((row, index) => row.minutes * beat(now, index, BEAT.count, easeInOut)));
  const was = stretch(now, AT.was[0], AT.was[1]);
  return (
    <>
      <rect
        height={PHONE.height}
        rx={PHONE.radius}
        width={PHONE.width}
        x={PHONE.x}
        y={PHONE.y}
        {...props(styles.ground)}
      />
      <rect
        height={WIDGET.height}
        rx={WIDGET.radius}
        width={WIDGET.width}
        x={WIDGET.x}
        y={WIDGET.y}
        {...props(styles.card)}
      />
      <text fontSize={NAME.size} x={WIDGET_X} y={NAME.y} {...props(styles.title)}>
        {m.hero_phone_panel()}
      </text>
      <text fontSize={LABEL.size} x={WIDGET_X} y={LABEL.y} {...props(styles.muted)}>
        {m.hero_phone_average()}
      </text>
      <text fontSize={NUMBER.size} x={WIDGET_X} y={NUMBER.y} {...props(styles.number)}>
        {time(average, FIGURE_SPACE)}
      </text>
      {was > 0 ? (
        <text fontSize={WAS.size} opacity={was} x={WIDGET_X} y={WAS.y} {...props(styles.muted)}>
          {m.hero_phone_was({ time: time(BEFORE) })}
        </text>
      ) : null}
      {STAYING.map((app) => (
        <g key={app.glyph} transform={`translate(${app.x} ${app.y})`}>
          <AppSquare hairline />
          <AppGlyph glyph={app.glyph} hairline />
        </g>
      ))}
      {ROWS.map((row, index) => {
        const marked = beat(now, index, BEAT.mark);
        if (!('feed' in row)) {
          const blocked = beat(now, index, BEAT.out);
          return (
            <g key={row.site}>
              <rect
                height={PILL.height}
                rx={PILL.height / 2}
                width={PILL.width}
                x={PILL.x}
                y={PILL.y}
                {...props(styles.card)}
              />
              <text
                fontSize={PILL.size}
                x={PILL.x + PILL.inset}
                y={PILL_Y + PILL.size * 0.35}
                {...props(marked > 0 ? styles.muted : styles.name)}
              >
                {row.site}
              </text>
              {marked > 0 ? (
                <path
                  d={`M${PILL.x + PILL.inset - 1} ${PILL_Y} h${(ADDRESS + 2) * marked}`}
                  {...props(styles.mark)}
                />
              ) : null}
              {blocked > 0 ? (
                <g opacity={blocked}>
                  <path
                    d={LOCK}
                    transform={`translate(${LOCK_X} ${PILL_Y - 0.5})`}
                    {...props(styles.mark)}
                  />
                  <text
                    fontSize={LINE.add.size}
                    x={LOCK_X - 3.6}
                    y={PILL_Y + LINE.add.size * 0.35}
                    {...props(styles.accentWord, styles.ended)}
                  >
                    {m.hero_phone_blocked()}
                  </text>
                </g>
              ) : null}
            </g>
          );
        }
        const app = APPS[row.slot];
        if (app === undefined) {
          return null;
        }
        const out = beat(now, index, BEAT.out, easeInOut);
        const half = ICON / 2;
        return (
          <g key={row.feed} transform={`translate(${app.x} ${app.y})`}>
            {out > 0 ? (
              <rect
                height={ICON}
                opacity={out}
                rx={3}
                width={ICON}
                x={-half}
                y={-half}
                {...props(styles.slot)}
              />
            ) : null}
            {out < 1 ? (
              <g opacity={1 - out}>
                <g opacity={1 - (1 - MARKED) * marked}>
                  <FeedIcon bundleId={row.feed} hairline />
                </g>
                {marked > 0 ? (
                  <path
                    d={`M${-half - 1.5} ${half + 1.5} l${(ICON + 3) * marked} ${-(ICON + 3) * marked}`}
                    {...props(styles.mark)}
                  />
                ) : null}
              </g>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

/**
 * The cable from the MacBook to the iPhone, for one of the scene's two
 * layouts, in a box that is the whole scene, with a plug at each end: one in
 * the end of the MacBook's base, one under the phone's foot. While a row's
 * pulse is on its way, a small orange head and its trail run the cable's
 * length.
 */
function Cable({ layout, now, style }: { layout: Layout; now: number; style: StyleXStyles }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      {...props(styles.part, styles.whole, style)}
    >
      <path d={layout.cable} {...props(styles.cable)} />
      <rect
        height={PORT.height}
        rx={PORT.radius}
        width={PORT.width}
        x={layout.port.x}
        y={layout.port.y - PORT.height / 2}
        {...props(styles.plug)}
      />
      <rect
        height={PLUG.height}
        rx={PLUG.radius}
        width={PLUG.width}
        x={layout.plug.x - PLUG.width / 2}
        y={layout.plug.y}
        {...props(styles.plug)}
      />
      {ROWS.map((row, index) => {
        const travel = beat(now, index, BEAT.pulse, easeInOut);
        if (travel <= 0 || travel >= 1) {
          return null;
        }
        const head = travel * (1 + PULSE.trail);
        return (
          <g key={'feed' in row ? row.feed : row.site}>
            <path
              d={layout.cable}
              pathLength={1}
              strokeDasharray={`${PULSE.trail} 2`}
              strokeDashoffset={PULSE.trail - head}
              {...props(styles.pulse, styles.pulseTrail)}
            />
            <path
              d={layout.cable}
              pathLength={1}
              strokeDasharray={`${PULSE.head} 2`}
              strokeDashoffset={PULSE.head - head}
              {...props(styles.pulse, styles.pulseHead)}
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * One part of the scene through the turn. For the crossfade the start of the
 * turn is drawn under the part as it stands at `now`, which fades away over
 * it on a ground of its own, so what the two share holds still. While the
 * scene waits at the start, the result is drawn with it and the styles show
 * the one the reader's setting asks for.
 */
function Turn({
  back,
  now,
  part,
  waiting,
}: {
  back: number;
  now: number;
  part: (now: number) => ReactNode;
  waiting: boolean;
}) {
  return (
    <>
      {back > 0 ? part(START) : null}
      <g opacity={1 - back} {...props(waiting && styles.atStart)}>
        {part(now)}
      </g>
      {waiting ? <g {...props(styles.atRest)}>{part(REST)}</g> : null}
    </>
  );
}

function macWindow(now: number): ReactNode {
  return <MacWindow now={now} />;
}

function shortWindow(now: number): ReactNode {
  return <ShortWindow now={now} />;
}

function home(now: number): ReactNode {
  return <Home now={now} />;
}

/** On a wide window the loop sets off with any of the scene in the window, as it did before `SEEN`. */
const WIDE_SEEN: WideLine = {};

/**
 * The hero's drawing and what the page promises, in one scene as wide as the
 * hero: a MacBook with the Mac app's window on its display, the list of what
 * to block in it, the iPhone it acts on standing in front, and the cable
 * between the two. The four feeds and one website are added on the Mac one
 * after another. Each sends a pulse down the cable. On the phone a feed's
 * icon is struck through and goes, leaving its empty square; the website's
 * address is struck through and locked, and the browser stays. With each,
 * the daily average on the phone's Screen Time widget falls by that row's
 * time, from five and a half hours to an hour and three quarters. The result
 * stands a moment with what the average was under it, then crossfades back
 * to the start and it plays again.
 *
 * On a phone the scene is the same, drawn for the column: the iPhone larger
 * against the MacBook, and the window down to its rows, so both still read.
 * The window is drawn for both widths and the styles show the one that fits.
 *
 * Until the scene is first in view it stands at the start of the turn, which
 * is what the server draws and what a page without scripts keeps. The loop
 * sets off from that frame once the scene is in view and holds where it is
 * while it is off screen or the tab is put away. With less motion the scene
 * stays at the result. The server cannot know that, so while the scene waits
 * at the start the result is drawn with it and the styles show the one the
 * reader's setting asks for: a reader with less motion sees the result from
 * the first paint on.
 */
export function HeroScene() {
  const scene = useRef<HTMLDivElement>(null);
  const seen = useSeen(scene, { desktop: WIDE_SEEN });
  const hidden = useTabHidden();
  const reduced = useLessMotion();
  const looped = useLoop(seen && !hidden && !reduced);
  const now = reduced ? REST : looped;
  const waiting = now === START && !reduced;
  const back = stretch(now, AT.back[0], AT.back[1], easeInOut);

  return (
    <div {...props(styles.hero)}>
      <div aria-label={m.hero_phone_label()} ref={scene} role="img" {...props(styles.scene)}>
        <Cable layout={WIDE} now={now} style={styles.wideOnly} />
        <Cable layout={NARROW} now={now} style={styles.narrowOnly} />
        <svg
          aria-hidden="true"
          viewBox={`${MAC.x} 0 ${MAC.width} ${MAC.height}`}
          {...props(styles.part, styles.mac)}
        >
          <MacBook />
          <g transform={`translate(${WINDOW_AT.x} ${WINDOW_AT.y})`} {...props(styles.wideOnly)}>
            <Turn back={back} now={now} part={macWindow} waiting={waiting} />
          </g>
          <g transform={`translate(${SHORT.x} ${SHORT.y})`} {...props(styles.narrowOnly)}>
            <Turn back={back} now={now} part={shortWindow} waiting={waiting} />
          </g>
        </svg>
        <svg
          aria-hidden="true"
          viewBox={`${PHONE.x} ${PHONE.y} ${PHONE.width} ${PHONE.height}`}
          {...props(styles.part, styles.phone)}
        >
          <Turn back={back} now={now} part={home} waiting={waiting} />
          <PhoneFrame hairline />
        </svg>
      </div>
    </div>
  );
}
