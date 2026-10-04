import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { cancelFrame, easeInOut, frame } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import type { WideLine } from '../lib/use-seen.ts';
import { useTabHidden } from '../lib/use-tab-hidden.ts';
import { m } from '../paraglide/messages.js';
import { Cable } from './steps/cable.tsx';
import { Laptop, MAC_PLUG } from './steps/laptop.tsx';
import { MacApp } from './steps/mac-app.tsx';
import {
  APPS,
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
 * The home screen, a row at a time from the top: the four feeds by their
 * bundle ids, in among the seven apps that stay, each by its glyph. The feeds
 * go in the order they stand.
 */
const HOME: ReadonlyArray<{ feed: string } | { glyph: Glyph }> = [
  { feed: 'com.zhiliaoapp.musically' },
  { glyph: 'camera' },
  { feed: 'com.burbn.instagram' },
  { glyph: 'music' },
  { glyph: 'notes' },
  { feed: 'com.google.ios.youtube' },
  { glyph: 'maps' },
  { glyph: 'messages' },
  { feed: 'com.atebits.Tweetie2' },
  { glyph: 'phone' },
  { glyph: 'bank' },
];
const GOING = HOME.flatMap((app, slot) => ('feed' in app ? [{ bundleId: app.feed, slot }] : []));
const STAYING = HOME.flatMap((app, slot) => ('glyph' in app ? [{ glyph: app.glyph, slot }] : []));

/**
 * The loop, a little under twelve seconds a turn, and when each part of it
 * plays, in milliseconds from the start of the turn. It tells rather than
 * responds, so like the steps' drawings it keeps its own times rather than
 * the page's motion scale. The phone stands full, feeds and all. A small Mac
 * comes up in front of it, the app's mark and its button on its screen, and
 * the cable runs from the Mac into the phone. The button is pressed and a
 * pulse runs down the cable. The feeds go one after another, the apps that
 * stay close up, the cable comes out and the Mac goes. Then the home screen
 * gives way to the phone's Screen Time, where the daily average counts down
 * and the week's bars shrink with it. The result stands, with what it was
 * under it, before the full home screen crossfades back in.
 */
const LOOP = 11_600;
const AT = {
  back: [11_200, 11_600],
  cableIn: [2250, 2900],
  cableOut: [6100, 6600],
  dip: [3200, 3280],
  drop: [7900, 9700],
  macIn: [1800, 2300],
  macOut: [6500, 7000],
  macPlug: [2200, 2300],
  panelIn: [7000, 7600],
  phonePlugIn: [2800, 2950],
  phonePlugOut: [6100, 6250],
  press: [3200, 3300],
  ring: [3200, 3700],
  travel: [3400, 3900],
  undip: [3280, 3440],
  was: [9700, 10_000],
} as const;
/** The feeds go one after another, each over `fade`; the apps that stay close up `stagger` apart. */
const FEEDS_GO = { fade: 400, from: 3850, stagger: 150 };
const APPS_CLOSE = { from: 4950, slide: 700, stagger: 40 };
/**
 * Where the phone stands for a reader who asked for less motion: the result,
 * the lower screen time with what it was under it. Nobody else is shown it
 * before the loop has played up to it.
 */
const REST = 10_200;
/** The stretches where nothing moves: the full phone before the Mac, and the result. */
const STILL = [
  [0, AT.macIn[0]],
  [AT.was[1], AT.back[0]],
] as const;
/**
 * The phone's width on a wide window: at most `PHONE_MAX`, less on a short
 * one, and never under `PHONE_MIN`. `PHONE_CLEARANCE` is the height around it
 * on the first screen: the header, the hero's padding, and the Mac's foot and
 * the cable under the phone's own.
 */
const PHONE_MAX = 272;
const PHONE_MIN = 200;
const PHONE_CLEARANCE = 176;

/** How blurred a feed is, and how small, by the time it is gone. */
const GONE_BLUR = 3;
const GONE_SCALE = 0.85;
/** How small the home screen is by the time it has given way to Screen Time. */
const BACK_SCALE = 0.94;

/**
 * Where the Mac stands, in the phone's units: the laptop drawn in its own
 * units, sized by `scale` and moved by `x` and `y`, in front of the phone's
 * foot, its left side out past the phone's edge and its foot just below the
 * phone's. It is large enough for its screen to be read, and stops short of
 * the port, so the cable has room to turn up into it. It comes up into place
 * by `RISE`.
 */
const MAC = { scale: 0.42, x: 44.5, y: 124.5 };
const RISE = 4;
/**
 * How far the phone moves aside for the Mac where the hero is one column, as
 * a share of its own width: half of what the Mac stands out past its edge by.
 */
const MAC_ASIDE = 18.5;
/** The plug in the phone's port, flush with the phone's foot, in the phone's units. */
const PHONE_PLUG = { height: 3, radius: 1, width: 7 };
/**
 * How far under the plug the cable sags on its way in, in the phone's units.
 * In the Mac's units: how far it runs level out of the laptop and into its
 * low run, and the bend it turns up into the plug by.
 */
const SAG_DEPTH = 3;
const REACH = 8;
const BEND = 7;
/** A quarter circle's control points stand this share of its radius from its ends. */
const ARC = 0.552;

/** A point in the phone's units, in the Mac's, where the cable is drawn at the Mac's line width. */
function onMac(x: number, y: number): { x: number; y: number } {
  return { x: (x - MAC.x) / MAC.scale, y: (y - MAC.y) / MAC.scale };
}

const PORT_X = PHONE.x + PHONE.width / 2;
const FOOT = PHONE.y + PHONE.height;
const PLUG_TOP = onMac(PORT_X - PHONE_PLUG.width / 2, FOOT);
const PLUG_END = onMac(PORT_X, FOOT + PHONE_PLUG.height);
const SAG = onMac(PORT_X, FOOT + PHONE_PLUG.height + SAG_DEPTH).y;
/** Where the cable's low run ends and its bend up into the plug starts. */
const BEND_X = PLUG_END.x - BEND;
/** Where the cable leaves the laptop: the outer end of the plug in its side. */
const CABLE_START = { x: MAC_PLUG.x + MAC_PLUG.width, y: MAC_PLUG.y + MAC_PLUG.height / 2 };
/**
 * The cable: out of the laptop's side, down under the phone's foot, then one
 * bend that never passes the port and straight up into the plug's middle.
 */
const CABLE = [
  `M${CABLE_START.x} ${CABLE_START.y}`,
  `C${CABLE_START.x + REACH} ${CABLE_START.y} ${BEND_X - REACH} ${SAG} ${BEND_X} ${SAG}`,
  `C${BEND_X + ARC * BEND} ${SAG} ${PLUG_END.x} ${SAG - BEND + ARC * BEND} ${PLUG_END.x} ${SAG - BEND}`,
  `V${PLUG_END.y}`,
].join(' ');

/** An app's box, as a share of the phone's width and of its height. */
const SIDE = {
  height: `${(ICON / PHONE.height) * 100}%`,
  width: `${(ICON / PHONE.width) * 100}%`,
};

/**
 * The phone's Screen Time, in the phone's units: its name over a card that
 * holds the daily average, what it was, and the week's seven bars. It stops
 * above the Mac, which stands in front of the phone's foot.
 */
const PANEL = { height: 86, inset: 6, radius: 6, width: 64, x: PHONE.x + 8, y: 42 };
const TEXT_X = PANEL.x + PANEL.inset;
const TITLE = { size: 5.5, y: PANEL.y - 6 };
const LABEL = { size: 4.2, y: PANEL.y + 11 };
const NUMBER = { size: 12, y: PANEL.y + 25 };
const WAS = { size: 4.2, y: PANEL.y + 32.5 };
/** The bars stand on a line near the card's foot, the tallest this high. */
const BARS = { base: PANEL.y + PANEL.height - 8, max: 34, width: 5 };
const BAR_PITCH = (PANEL.width - 2 * PANEL.inset - BARS.width) / 6;
/** The daily average before and after, in minutes: 5 hours 30 and 1 hour 45. */
const BEFORE = 330;
const AFTER = 105;
/**
 * Each day's bar as a share of the tallest, before and after. The week's
 * average falls by the same share as the number over it.
 */
const DAYS = [
  [0.78, 0.26],
  [0.92, 0.31],
  [0.7, 0.22],
  [1, 0.34],
  [0.85, 0.28],
  [0.95, 0.36],
  [0.74, 0.25],
] as const;
/** One day's bar starts to shrink this much of the drop after the day before it. */
const DAY_AFTER = 0.05;
/** How far below its place the panel starts as it rises in. */
const PANEL_RISE = 6;

const styles = create({
  // An app's box, put in place by its transform.
  app: {
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  appAt: (width: string, height: string, transform: string) => ({
    height,
    transform,
    width,
  }),
  // A feed on its way out, blurring and shrinking as it fades.
  appGoing: (opacity: number, filter: string) => ({
    filter,
    opacity,
  }),
  // A day's bar: orange while the day is long, the muted ink once it is short.
  bar: (long: string) => ({
    fill: `color-mix(in srgb, ${accent.base} ${long}, ${colors.muted})`,
  }),
  // The card the numbers stand on, a hairline as wide as the phone's own.
  card: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // The phone's outline, in the flow, so the phone takes its height from its
  // width. The Mac stands out past its edge.
  frame: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  icon: {
    display: 'block',
    height: '100%',
    overflow: 'visible',
    width: '100%',
  },
  layer: {
    inset: 0,
    position: 'absolute',
  },
  layerAt: (opacity: number, transform: string) => ({
    opacity,
    transform,
  }),
  // The small words on the panel, in the muted ink.
  muted: {
    fill: colors.muted,
    fontWeight: font.weightRegular,
  },
  // The daily average, the one thing on the panel to read. Its digits keep
  // their own widths: it is a number being read, not a column of them.
  number: {
    fill: colors.fg,
    fontVariantNumeric: 'proportional-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.02em',
  },
  // As wide as the column lets it, up to a size that still leaves the words
  // around it room. On a wide window it is also held short enough that the
  // Mac at its foot clears the fold; the phone is twice as tall as it is wide.
  // Where the hero is one column the Mac's side stands out to the left of the
  // phone by 37% of the phone's width, so the phone is moved right by half of
  // that and the two stand in the middle together. A window too narrow for
  // both at that size gets a smaller phone. On a phone that move is the
  // loop's own (`phoneAside`).
  phone: {
    maxWidth: {
      '@media (max-width: 359px)': 200,
      '@media (min-width: 640px)': `clamp(${PHONE_MIN}px, calc((100svh - ${PHONE_CLEARANCE}px) / 2), ${PHONE_MAX}px)`,
      default: 224,
    },
    position: 'relative',
    width: '100%',
  },
  // On a phone the phone stands in the middle while it is alone, and moves
  // aside by `aside` of that half as the Mac comes, so what is on show is in
  // the middle all the way through. From the phone's width up it stands where
  // it always did: aside in one column, and in its own column from 900px.
  phoneAside: (aside: number) => ({
    translate: {
      '@media (min-width: 768px) and (max-width: 899.98px)': `${MAC_ASIDE}% 0`,
      '@media (min-width: 900px)': '0 0',
      default: `${MAC_ASIDE * aside}% 0`,
    },
  }),
  plug: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  // The panel's name.
  title: {
    fill: colors.fg,
    fontWeight: font.weightMedium,
  },
});

/**
 * How far into its turn the loop is, in milliseconds. It starts from the
 * start of the turn, the full home screen, which is what the server draws,
 * so the page a script comes alive on is the page the server sent. It moves
 * with the clock only while `running` and holds where it is otherwise, so it
 * goes on from there rather than leaping ahead by the time it stood. While
 * the phone stands still the page is not drawn again.
 */
function useLoop(running: boolean): number {
  const [now, setNow] = useState(0);
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

/** How far `now` is into the part of the loop between `from` and `to`, eased. */
function within(
  now: number,
  [from, to]: readonly [number, number],
  ease?: (share: number) => number,
): number {
  return stretch(now, from, to, ease);
}

/** Where an app's box stands on the home screen's `slot`, as shares of its own side. */
function spot(slot: number): { left: number; top: number } {
  const app = APPS[slot];
  if (app === undefined) {
    return { left: 0, top: 0 };
  }
  return {
    left: ((app.x - ICON / 2 - PHONE.x) / ICON) * 100,
    top: ((app.y - ICON / 2 - PHONE.y) / ICON) * 100,
  };
}

/**
 * The transform that stands an app's box `moved` of the way from the home
 * screen's slot `from` to its slot `to`, at `size`. It moves the box by
 * shares of its own side, so the phone can be drawn at any width.
 */
function standOn(from: number, to = from, moved = 0, size = 1): string {
  const start = spot(from);
  const end = spot(to);
  const left = start.left + (end.left - start.left) * moved;
  const top = start.top + (end.top - start.top) * moved;
  return `translate(${left}%, ${top}%) scale(${size})`;
}

/** One app's square, drawn in a box of its own around its middle. */
function AppIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`${-ICON / 2} ${-ICON / 2} ${ICON} ${ICON}`}
      {...props(styles.icon)}
    >
      {children}
    </svg>
  );
}

function KeptIcon({ glyph }: { glyph: Glyph }) {
  return (
    <AppIcon>
      <AppSquare hairline />
      <AppGlyph glyph={glyph} hairline />
    </AppIcon>
  );
}

/** A daily average of `minutes`, in the words the phone's own Screen Time uses. */
function average(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole === BEFORE) {
    return m.hero_phone_before();
  }
  if (whole === AFTER) {
    return m.hero_phone_after();
  }
  return m.hero_phone_time({ hours: Math.floor(whole / 60), minutes: whole % 60 });
}

/**
 * The phone's Screen Time, `dropped` of the way from the week before to the
 * week after: the daily average counting down, the seven days' bars shrinking
 * one a little after another, and, as far as `was`, the line that says what
 * the average was.
 */
function ScreenTime({ dropped, was }: { dropped: number; was: number }) {
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
        {average(BEFORE - (BEFORE - AFTER) * dropped)}
      </text>
      {was > 0 ? (
        <text fontSize={WAS.size} opacity={was} x={TEXT_X} y={WAS.y} {...props(styles.muted)}>
          {m.hero_phone_was({ time: m.hero_phone_before() })}
        </text>
      ) : null}
      {DAYS.map(([before, after], day) => {
        const late = day * DAY_AFTER;
        const short = stretch(dropped, late, late + 1 - (DAYS.length - 1) * DAY_AFTER);
        const height = BARS.max * (before - (before - after) * short);
        return (
          <rect
            height={height}
            key={day}
            rx={1.5}
            width={BARS.width}
            x={TEXT_X + day * BAR_PITCH}
            y={BARS.base - height}
            {...props(styles.bar(`${Math.round((1 - short) * 100)}%`))}
          />
        );
      })}
    </>
  );
}

/** On a wide window the loop sets off with any of the phone in the window, as it did before `SEEN`. */
const WIDE_SEEN: WideLine = {};

/**
 * The hero's iPhone and what the page promises, told on it: the full home
 * screen, then a small Mac in front of it with the cable run into the phone,
 * its button pressed, the four feeds blurring away one after another and the
 * apps that stay sliding up to close the gaps. The cable comes out and the
 * Mac goes. Then the home screen gives way to the phone's Screen Time, and
 * the daily average counts down from five and a half hours to an hour and
 * three quarters as the week's bars shrink. The result stands a moment before
 * the full home screen crossfades back and it plays again.
 *
 * The home screen is put back where it started while Screen Time stands over
 * it, unseen, so the full one is what crossfades back in. The loop sets off
 * once the phone is in view and holds while it is off screen or the tab is
 * put away. It starts from the full home screen, which is what the server
 * draws and what a page without scripts keeps. With less motion the phone
 * stands at the result instead, the lower screen time and what it was, once
 * the page has come alive.
 */
export function HeroPhone() {
  const phone = useRef<HTMLDivElement>(null);
  const seen = useSeen(phone, { desktop: WIDE_SEEN });
  const hidden = useTabHidden();
  const reduced = useLessMotion();
  const looped = useLoop(seen && !hidden && !reduced);
  const now = reduced ? REST : looped;

  // Until Screen Time has come in over it the home screen plays. From then on
  // it waits at the start, unseen, until it crossfades back in.
  const playing = now < AT.panelIn[1];
  const panelIn = within(now, AT.panelIn);
  const back = within(now, AT.back);
  const home = playing ? 1 - panelIn : back;
  const panel = panelIn * (1 - back);
  const mac = within(now, AT.macIn) * (1 - within(now, AT.macOut));
  const rise = RISE * (1 - within(now, AT.macIn));
  const aside = within(now, AT.macIn, easeInOut) * (1 - within(now, AT.macOut, easeInOut));
  const cable = within(now, AT.cableIn, easeInOut) * (1 - within(now, AT.cableOut, easeInOut));
  const phonePlug = within(now, AT.phonePlugIn) * (1 - within(now, AT.phonePlugOut));
  const travel = within(now, AT.travel, easeInOut);
  const pressed = within(now, AT.press);
  const dip = within(now, AT.dip) - within(now, AT.undip);
  const ring = within(now, AT.ring);

  return (
    <div {...props(styles.hero)}>
      <div
        aria-label={m.hero_phone_label()}
        ref={phone}
        role="img"
        {...props(styles.phone, styles.phoneAside(aside))}
      >
        <svg
          aria-hidden="true"
          viewBox={`${PHONE.x} ${PHONE.y} ${PHONE.width} ${PHONE.height}`}
          {...props(styles.frame)}
        >
          <PhoneFrame dock={1 - panel} hairline />
          {panel > 0 ? (
            <g opacity={panel} transform={`translate(0 ${PANEL_RISE * (1 - panelIn)})`}>
              <ScreenTime dropped={within(now, AT.drop, easeInOut)} was={within(now, AT.was)} />
            </g>
          ) : null}
          {cable > 0 || phonePlug > 0 ? (
            <g transform={`translate(${MAC.x} ${MAC.y}) scale(${MAC.scale})`}>
              <rect
                height={PHONE_PLUG.height / MAC.scale}
                opacity={phonePlug}
                rx={PHONE_PLUG.radius / MAC.scale}
                vectorEffect="non-scaling-stroke"
                width={PHONE_PLUG.width / MAC.scale}
                x={PLUG_TOP.x}
                y={PLUG_TOP.y}
                {...props(styles.plug)}
              />
              <Cable d={CABLE} drawn={cable} travel={travel} />
            </g>
          ) : null}
          {mac > 0 ? (
            <g opacity={mac} transform={`translate(${MAC.x} ${MAC.y + rise}) scale(${MAC.scale})`}>
              <Laptop hairline plugged={within(now, AT.macPlug)} solid>
                <MacApp dip={dip} pressed={pressed} ring={ring} screen="press" />
              </Laptop>
            </g>
          ) : null}
        </svg>
        {home > 0 ? (
          <div
            {...props(
              styles.layer,
              styles.layerAt(home, `scale(${1 - (1 - BACK_SCALE) * (playing ? panelIn : 0)})`),
            )}
          >
            {GOING.map((app, order) => {
              const start = FEEDS_GO.from + order * FEEDS_GO.stagger;
              const gone = playing ? stretch(now, start, start + FEEDS_GO.fade) : 0;
              return (
                <div
                  key={app.bundleId}
                  {...props(
                    styles.app,
                    styles.appAt(
                      SIDE.width,
                      SIDE.height,
                      standOn(app.slot, app.slot, 0, 1 - (1 - GONE_SCALE) * gone),
                    ),
                    styles.appGoing(1 - gone, gone > 0 ? `blur(${GONE_BLUR * gone}px)` : 'none'),
                  )}
                >
                  <AppIcon>
                    <FeedIcon bundleId={app.bundleId} hairline />
                  </AppIcon>
                </div>
              );
            })}
            {STAYING.map((app, place) => {
              const start = APPS_CLOSE.from + place * APPS_CLOSE.stagger;
              const moved = playing ? stretch(now, start, start + APPS_CLOSE.slide) : 0;
              return (
                <div
                  key={app.glyph}
                  {...props(
                    styles.app,
                    styles.appAt(SIDE.width, SIDE.height, standOn(app.slot, place, moved)),
                  )}
                >
                  <KeptIcon glyph={app.glyph} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
