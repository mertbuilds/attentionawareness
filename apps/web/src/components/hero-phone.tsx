import { accent, tint } from '@attentionawareness/ui/accent.stylex';
import { colors, font } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { cancelFrame, easeInOut, frame } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import type { WideLine } from '../lib/use-seen.ts';
import { useTabHidden } from '../lib/use-tab-hidden.ts';
import { m } from '../paraglide/messages.js';
import {
  AppGlyph,
  AppSquare,
  FeedIcon,
  type Glyph,
  ICON,
  PHONE,
  PhoneFrame,
} from './steps/phone.tsx';
import { stretch } from './steps/playhead.ts';

/**
 * The colour a row's time is drawn in on the week's bars, from the foot of a
 * bar up: the neutral ink and the drawings' three quiet hues.
 */
const HUES = ['ink', 'green', 'gold', 'sky'] as const;
type Hue = (typeof HUES)[number];

/**
 * The phone's most used apps, the longest first: its name, its minutes a day
 * and its hue on the week's bars. A feed goes, and is drawn by its bundle id;
 * its name is a brand, the same in every language. An app that stays is drawn
 * by its glyph, and its name is a message, read when the row is drawn. The list, the daily average and
 * the bars all come from this table, so the average is what the rows still in
 * it add up to: 5 hours 30 with all eight, 1 hour 45 with the four that stay.
 */
type Row = { hue: Hue; minutes: number } & (
  | { feed: string; name: string }
  | { glyph: Glyph; name: () => string }
);
const ROWS: ReadonlyArray<Row> = [
  { feed: 'com.zhiliaoapp.musically', hue: 'sky', minutes: 90, name: 'TikTok' },
  { feed: 'com.burbn.instagram', hue: 'sky', minutes: 65, name: 'Instagram' },
  { feed: 'com.google.ios.youtube', hue: 'gold', minutes: 45, name: 'YouTube' },
  { glyph: 'messages', hue: 'green', minutes: 40, name: m.hero_phone_app_messages },
  { feed: 'com.atebits.Tweetie2', hue: 'sky', minutes: 25, name: 'X' },
  { glyph: 'notes', hue: 'ink', minutes: 25, name: m.hero_phone_app_notes },
  { glyph: 'maps', hue: 'ink', minutes: 20, name: m.hero_phone_app_maps },
  { glyph: 'music', hue: 'gold', minutes: 20, name: m.hero_phone_app_music },
];
/** The rows that go, in the order they stand, which is the order they go in. */
const GOING = ROWS.flatMap((row, index) => ('feed' in row ? [index] : []));

function sum(numbers: ReadonlyArray<number>): number {
  return numbers.reduce((total, each) => total + each, 0);
}

/** The daily average with every row in the list, in minutes. */
const BEFORE = sum(ROWS.map((row) => row.minutes));
const LONGEST = Math.max(...ROWS.map((row) => row.minutes));

/**
 * The loop, seven seconds a turn, and when each part of it plays, in
 * milliseconds from the start of the turn. It tells rather than responds, so
 * like the steps' drawings it keeps its own times rather than the page's
 * motion scale. The turn starts on the phone's Screen Time with every app in
 * the list and the daily average at what it was, which is the frame the
 * server draws, so the loop sets off from what is already on the page. After
 * a short beat the feeds are blocked one after another, each in a beat of its
 * own (`BEAT`). Once the last has gone, what the average was comes up under
 * it. The result stands, and then crossfades back to the start.
 */
const LOOP = 7000;
const AT = {
  back: [6400, 7000],
  was: [3400, 3700],
} as const;
/**
 * One feed's beat, the first at `from` and the next `every` after it, and
 * when each part of it plays, from the beat's own start: the row is struck
 * out in the accent, it slides away, the daily average counts down by its
 * time as the week's bars shrink, and the rows under it close up.
 */
const BEAT = {
  close: [320, 700],
  count: [200, 650],
  every: 700,
  from: 600,
  mark: [0, 220],
  out: [200, 480],
} as const;
/**
 * Where the phone stands until the loop first sets off: the start of the
 * turn, the average at what it was. It is what the server draws and what a
 * page without scripts keeps.
 */
const START = 0;
/**
 * Where the phone stands for good for a reader who asked for less motion: the
 * result, the lower screen time with what it was under it. The server cannot
 * know who asked, so until the loop sets off it draws this frame too, beside
 * the one at `START`, and the page's styles show whichever fits the reader
 * (`atStart`, `atRest`).
 */
const REST = 4000;
/** The stretches where nothing moves: the average at what it was, and the result. */
const STILL = [
  [0, BEAT.from],
  [AT.was[1], AT.back[0]],
] as const;
/**
 * The phone's width on a wide window: at most `PHONE_MAX`, less on a short
 * one, and never under `PHONE_MIN`. `PHONE_CLEARANCE` is the height around it
 * on the first screen: the header, the hero's padding and room under its foot.
 */
const PHONE_MAX = 272;
const PHONE_MIN = 200;
const PHONE_CLEARANCE = 176;

/**
 * The phone's Screen Time, in the phone's units: its name over a card that
 * holds the daily average, what it was, and the week's seven bars with their
 * days under them.
 */
const PANEL = { height: 59, inset: 6, radius: 6, width: 64, x: PHONE.x + 8, y: 38 };
const TEXT_X = PANEL.x + PANEL.inset;
const TITLE = { size: 5.5, y: PANEL.y - 5 };
const LABEL = { size: 4.2, y: PANEL.y + 9 };
/**
 * The daily average is as large as the card lets it be: with every digit at
 * the widest one's width it runs from one inset to the other, over the bars.
 */
const NUMBER = { size: 14, y: PANEL.y + 22.5 };
const WAS = { size: 4.2, y: PANEL.y + 29 };
/** The bars stand on a line over the days' letters, the longest day's this high at the start. */
const BARS = { base: PANEL.y + 50, max: 17, width: 5 };
const BAR_PITCH = (PANEL.width - 2 * PANEL.inset - BARS.width) / 6;
const DAY = { size: 3.2, y: PANEL.y + 55 };
/** Each day's screen time as a share of the daily average. The seven add up to seven. */
const DAYS = [0.9, 1.1, 0.82, 1.2, 1, 1.14, 0.84] as const;
/** How high a bar stands for each minute of its day. */
const MINUTE = BARS.max / (BEFORE * Math.max(...DAYS));
/** A space as wide as a figure, where the tens of the minutes are missing. */
const FIGURE_SPACE = ' ';

/**
 * The most used list under the card: its name, then a row every `pitch`. The
 * screen has room for `shown` rows, so the last apps that stay come into view
 * as the feeds over them go.
 */
const LIST = { pitch: 10.2, shown: 5, width: PANEL.width - 2, x: PANEL.x + 1, y: PANEL.y + 71.5 };
const LIST_NAME = { size: 4.2, y: LIST.y - 4 };
/**
 * A row, from its own top: the app's icon, and beside it the name and the
 * time on one line over a bar as long as the app's share of the longest.
 */
const ROW = { bar: 5.2, barHeight: 1.3, icon: 7, size: 3.8, strike: 2.1, text: 10, y: 3.4 };
const ROW_BAR = LIST.width - ROW.text;
/** How far to the side a blocked row slides as it goes. */
const ROW_SLIDE = 3;

const styles = create({
  // Until the loop sets off, Screen Time is drawn twice, and which one shows
  // is the reader's own setting, known to the styles before any script: the
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
  // The week's average, a dashed line across the bars.
  averageLine: {
    fill: 'none',
    stroke: colors.muted,
    strokeDasharray: '3 3',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // What a blocked row is marked with: its bar, and the line through it.
  blocked: {
    fill: accent.base,
  },
  // The card the numbers stand on, a hairline as wide as the phone's own.
  card: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  day: {
    fill: colors.muted,
    fontWeight: font.weightRegular,
    textAnchor: 'middle',
  },
  // The phone's outline, in the flow, so the phone takes its height from its
  // width.
  frame: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    width: '100%',
  },
  // The page's ground inside the phone, so the hero's paper stops at its edge.
  ground: {
    fill: colors.bg,
  },
  hero: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  // The small words on the panel, in the muted ink.
  muted: {
    fill: colors.muted,
    fontWeight: font.weightRegular,
  },
  name: {
    fill: colors.fg,
    fontWeight: font.weightRegular,
  },
  // The daily average, the one thing on the panel to read. Its digits are all
  // one width and its minutes always take two figures' room (`time`), so the
  // words after them hold still while it counts down.
  number: {
    fill: colors.fg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.02em',
  },
  // As wide as the column lets it, up to a size that still leaves the words
  // around it room. On a wide window it is also held short enough to clear
  // the fold; the phone is twice as tall as it is wide.
  phone: {
    maxWidth: {
      '@media (max-width: 359px)': 200,
      '@media (min-width: 640px)': `clamp(${PHONE_MIN}px, calc((100svh - ${PHONE_CLEARANCE}px) / 2), ${PHONE_MAX}px)`,
      default: 224,
    },
    position: 'relative',
    width: '100%',
  },
  strike: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke',
  },
  // A row's time, at the row's end, its digits all one width.
  time: {
    fill: colors.muted,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightRegular,
    textAnchor: 'end',
  },
  // The panel's name.
  title: {
    fill: colors.fg,
    fontWeight: font.weightMedium,
  },
});

/** A row's hue, on its own bar and on its share of each day's. */
const hues = create({
  gold: { fill: tint.gold },
  green: { fill: tint.green },
  ink: { fill: colors.muted },
  sky: { fill: tint.sky },
});

/**
 * How far into its turn the loop is, in milliseconds. Until it first runs it
 * stands at `START`, the average at what it was, which is what the server
 * draws, so the page a script comes alive on is the page the server sent. The
 * first time it runs it sets off from that same frame, so nothing jumps and
 * the first feed's beat is the first thing that moves. It moves with the clock only
 * while `running` and holds where it is otherwise, so it goes on from there
 * rather than leaping ahead by the time it stood. While the phone stands
 * still the page is not drawn again.
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
 * by `now`: nothing for an app that stays, which has no beat.
 */
function beat(
  now: number,
  index: number,
  [from, to]: readonly [number, number],
  ease?: (share: number) => number,
): number {
  const order = GOING.indexOf(index);
  if (order < 0) {
    return 0;
  }
  const start = BEAT.from + order * BEAT.every;
  return stretch(now, start + from, start + to, ease);
}

/**
 * A time of `minutes`, in the words the phone's own Screen Time uses. Past the
 * hour, minutes under ten stand after `pad`: for the daily average a figure
 * space, as wide as the figure that is not there, so the string is as long as
 * with two and holds still while it counts.
 */
function time(minutes: number, pad = '0'): string {
  const whole = Math.round(minutes);
  if (whole < 60) {
    return m.hero_phone_minutes({ minutes: whole });
  }
  return m.hero_phone_time({
    hours: Math.floor(whole / 60),
    minutes: String(whole % 60).padStart(2, pad),
  });
}

/**
 * The phone's Screen Time as it stands at `now`: the daily average, which is
 * what the rows still in the list add up to, the week's bars with each hue's
 * share of every day, the dashed line of the average across them, and the
 * most used list. A feed whose beat has come is struck out, slides away and
 * takes its time off the average and the bars, and the rows under it close
 * up. Once all have gone, the line that says what the average was comes up.
 */
function ScreenTime({ now }: { now: number }) {
  const rows = ROWS.map((row, index) => ({
    ...row,
    closed: beat(now, index, BEAT.close, easeInOut),
    left: row.minutes * (1 - beat(now, index, BEAT.count, easeInOut)),
    marked: beat(now, index, BEAT.mark),
    out: beat(now, index, BEAT.out, easeInOut),
  }));
  const average = sum(rows.map((row) => row.left));
  const stack = HUES.map((hue) => ({
    hue,
    minutes: sum(rows.filter((row) => row.hue === hue).map((row) => row.left)),
  }));
  const was = stretch(now, AT.was[0], AT.was[1]);
  const averageY = BARS.base - average * MINUTE;
  const days = m.hero_phone_days().split(' ');

  return (
    <>
      <text fontSize={TITLE.size} x={PANEL.x + 1} y={TITLE.y} {...props(styles.title)}>
        {m.hero_phone_panel()}
      </text>
      <rect
        height={PANEL.height}
        rx={PANEL.radius}
        width={PANEL.width}
        x={PANEL.x}
        y={PANEL.y}
        {...props(styles.card)}
      />
      <text fontSize={LABEL.size} x={TEXT_X} y={LABEL.y} {...props(styles.muted)}>
        {m.hero_phone_average()}
      </text>
      <text fontSize={NUMBER.size} x={TEXT_X} y={NUMBER.y} {...props(styles.number)}>
        {time(average, FIGURE_SPACE)}
      </text>
      {was > 0 ? (
        <text fontSize={WAS.size} opacity={was} x={TEXT_X} y={WAS.y} {...props(styles.muted)}>
          {m.hero_phone_was({ time: time(BEFORE) })}
        </text>
      ) : null}
      {DAYS.map((share, day) => {
        const x = TEXT_X + day * BAR_PITCH;
        return (
          <g key={day}>
            {stack.map((part, level) => {
              const height = part.minutes * share * MINUTE;
              const under = sum(stack.slice(0, level).map((below) => below.minutes));
              return (
                <rect
                  height={height}
                  key={part.hue}
                  width={BARS.width}
                  x={x}
                  y={BARS.base - under * share * MINUTE - height}
                  {...props(hues[part.hue])}
                />
              );
            })}
            <text fontSize={DAY.size} x={x + BARS.width / 2} y={DAY.y} {...props(styles.day)}>
              {days[day]}
            </text>
          </g>
        );
      })}
      <line
        x1={TEXT_X - 2}
        x2={PANEL.x + PANEL.width - PANEL.inset + 2}
        y1={averageY}
        y2={averageY}
        {...props(styles.averageLine)}
      />
      <text fontSize={LIST_NAME.size} x={LIST.x} y={LIST_NAME.y} {...props(styles.muted)}>
        {m.hero_phone_most_used()}
      </text>
      {rows.map((row, index) => {
        const slot = sum(rows.slice(0, index).map((over) => 1 - over.closed));
        const shown = (1 - row.out) * (1 - stretch(slot, LIST.shown - 1, LIST.shown));
        if (shown <= 0) {
          return null;
        }
        const bar = (ROW_BAR * row.minutes) / LONGEST;
        return (
          <g
            key={'feed' in row ? row.feed : row.glyph}
            opacity={shown}
            transform={`translate(${LIST.x - ROW_SLIDE * row.out} ${LIST.y + slot * LIST.pitch})`}
          >
            <g transform={`translate(${ROW.icon / 2} ${ROW.icon / 2}) scale(${ROW.icon / ICON})`}>
              {'feed' in row ? (
                <FeedIcon bundleId={row.feed} hairline />
              ) : (
                <>
                  <AppSquare hairline />
                  <AppGlyph glyph={row.glyph} hairline />
                </>
              )}
            </g>
            <text fontSize={ROW.size} x={ROW.text} y={ROW.y} {...props(styles.name)}>
              {'feed' in row ? row.name : row.name()}
            </text>
            <text fontSize={ROW.size} x={LIST.width} y={ROW.y} {...props(styles.time)}>
              {time(row.minutes)}
            </text>
            <rect
              height={ROW.barHeight}
              rx={ROW.barHeight / 2}
              width={bar}
              x={ROW.text}
              y={ROW.bar}
              {...props(hues[row.hue])}
            />
            {row.marked > 0 ? (
              <>
                <rect
                  height={ROW.barHeight}
                  opacity={row.marked}
                  rx={ROW.barHeight / 2}
                  width={bar}
                  x={ROW.text}
                  y={ROW.bar}
                  {...props(styles.blocked)}
                />
                <line
                  x1={ROW.text}
                  x2={ROW.text + (LIST.width - ROW.text) * row.marked}
                  y1={ROW.strike}
                  y2={ROW.strike}
                  {...props(styles.strike)}
                />
              </>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

/** On a wide window the loop sets off with any of the phone in the window, as it did before `SEEN`. */
const WIDE_SEEN: WideLine = {};

/**
 * The hero's iPhone and what the page promises, told on its Screen Time: the
 * most used apps in a list under the daily average and the week's bars. The
 * four feeds are blocked one after another. Each is struck out and leaves the
 * list, the apps under it move up, and the daily average and the bars fall by
 * its time, from five and a half hours to an hour and three quarters. The
 * result stands a moment with what the average was under it, then crossfades
 * back to the full list and it plays again.
 *
 * For the crossfade the start of the turn is drawn under the result, and the
 * result fades away over it on a ground of its own, so what the two share
 * holds still. Until the phone is first in view it stands at the start of the
 * turn, the average at what it was, which is what the server draws and what a
 * page without scripts keeps. The loop sets off from that frame once the
 * phone is in view and holds where it is while it is off screen or the tab is
 * put away. With less motion the phone stays at the result, the lower screen
 * time and what it was. The server cannot know that, so while the phone waits
 * at the start the result is drawn with it and the styles show the one the
 * reader's setting asks for: a reader with less motion sees the result from
 * the first paint on.
 */
export function HeroPhone() {
  const phone = useRef<HTMLDivElement>(null);
  const seen = useSeen(phone, { desktop: WIDE_SEEN });
  const hidden = useTabHidden();
  const reduced = useLessMotion();
  const looped = useLoop(seen && !hidden && !reduced);
  const now = reduced ? REST : looped;
  const waiting = now === START && !reduced;
  const back = stretch(now, AT.back[0], AT.back[1], easeInOut);
  const ground = (
    <rect
      height={PHONE.height}
      rx={PHONE.radius}
      width={PHONE.width}
      x={PHONE.x}
      y={PHONE.y}
      {...props(styles.ground)}
    />
  );

  return (
    <div {...props(styles.hero)}>
      <div aria-label={m.hero_phone_label()} ref={phone} role="img" {...props(styles.phone)}>
        <svg
          aria-hidden="true"
          viewBox={`${PHONE.x} ${PHONE.y} ${PHONE.width} ${PHONE.height}`}
          {...props(styles.frame)}
        >
          {ground}
          {back > 0 ? <ScreenTime now={START} /> : null}
          <g opacity={1 - back} {...props(waiting && styles.atStart)}>
            {back > 0 ? ground : null}
            <ScreenTime now={now} />
          </g>
          {waiting ? (
            <g {...props(styles.atRest)}>
              <ScreenTime now={REST} />
            </g>
          ) : null}
          <PhoneFrame dock={0} hairline />
        </svg>
      </div>
    </div>
  );
}
