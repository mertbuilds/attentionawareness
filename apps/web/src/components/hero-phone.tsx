import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { cancelFrame, easeInOut, frame, useInView } from 'motion/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useLessMotion } from '../lib/use-less-motion.ts';
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
 * The loop, nine seconds a turn, and when each part of it plays, in
 * milliseconds from the start of the turn. It tells rather than responds, so
 * like the steps' drawings it keeps its own times rather than the page's
 * motion scale. The phone stands full, feeds and all. A small Mac comes up in
 * front of it, the Mac app on its screen with the feeds ticked, and the cable
 * runs from the Mac into the phone. The app's button is pressed and a pulse
 * runs down the cable. The feeds go one after another, the apps that stay
 * close up, the cable comes out and the Mac goes. The clean phone stands a
 * moment before the full one crossfades back in.
 */
const LOOP = 9000;
const AT = {
  back: [8600, 9000],
  cableIn: [2250, 2900],
  cableOut: [6100, 6600],
  dip: [3200, 3280],
  macIn: [1800, 2300],
  macOut: [6500, 7000],
  macPlug: [2200, 2300],
  phonePlugIn: [2800, 2950],
  phonePlugOut: [6100, 6250],
  press: [3200, 3300],
  ring: [3200, 3700],
  travel: [3400, 3900],
  undip: [3280, 3440],
} as const;
/** The feeds go one after another, each over `fade`; the apps that stay close up `stagger` apart. */
const FEEDS_GO = { fade: 400, from: 3850, stagger: 150 };
const APPS_CLOSE = { from: 4950, slide: 700, stagger: 40 };
/**
 * From here the clean screen stands in for the live one, which goes back to
 * the start unseen, and the clean screen gives way over `CLEAN_OUT` once the
 * full one starts to come back.
 */
const SWAP = 7000;
const CLEAN_OUT = 150;
/** Where the loop stands for a reader who asked for less motion: the clean phone, alone. */
const REST = 8000;
/** The stretches where nothing moves: the full phone before the Mac, and the clean one after it. */
const STILL = [
  [0, AT.macIn[0]],
  [AT.macOut[1], AT.back[0]],
] as const;

/** How blurred a feed is, and how small, by the time it is gone. */
const GONE_BLUR = 3;
const GONE_SCALE = 0.85;

/**
 * Where the Mac stands, in the phone's units: the laptop drawn in its own
 * units, sized by `scale` and moved by `x` and `y`, in front of the phone's
 * foot, its left side out past the phone's edge and its foot just below the
 * phone's. It comes up into place by `RISE`.
 */
const MAC = { scale: 0.3, x: 59.8, y: 138.1 };
const RISE = 4;
/** The plug in the phone's port, flush with the phone's foot, in the phone's units. */
const PHONE_PLUG = { height: 3, radius: 1, width: 7 };
/**
 * How far under the plug the cable sags on its way in, in the phone's units.
 * In the Mac's units: how far it runs level out of the laptop and into its
 * low run, and the bend it turns up into the plug by.
 */
const SAG_DEPTH = 3;
const REACH = 15;
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
  caption: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  // The phone's outline, in the flow, so the phone takes its height from its
  // width. The Mac stands out past its edge.
  frame: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    width: '100%',
  },
  // The phone, and under it the stat, clear of the cable that runs under the
  // phone's foot.
  hero: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
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
  layerAt: (opacity: number) => ({
    opacity,
  }),
  // As wide as the column lets it, up to a size that still leaves the words
  // around it room.
  phone: {
    maxWidth: {
      '@media (min-width: 640px)': 272,
      default: 224,
    },
    position: 'relative',
    width: '100%',
  },
  plug: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  stat: {
    fontSize: font.sizeLg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    lineHeight: 1.3,
    margin: 0,
  },
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    textAlign: 'center',
  },
});

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function tabHidden(): boolean {
  return document.visibilityState === 'hidden';
}

function hiddenOnServer(): boolean {
  return false;
}

/**
 * How far into its turn the loop is, in milliseconds. It moves with the clock
 * only while `running` and holds where it is otherwise, so it goes on from
 * there rather than leaping ahead by the time it stood. While the phone stands
 * still the page is not drawn again.
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

/**
 * The hero's iPhone and the way the feeds come off it: the full home screen,
 * then a small Mac in front of it with the cable run into the phone, the Mac
 * app's button pressed, the four feeds blurring away one after another and
 * the apps that stay sliding up to close the gaps. The cable
 * comes out, the Mac goes, and the clean phone stands a moment before the full
 * one crossfades back and it plays again. Under it, the daily screen time
 * before and after.
 *
 * The clean screen is drawn over the live one and stands in for it at the
 * loop's end, so the live one can be put back where it started unseen and the
 * full screen crossfades in over the clean one. The loop holds while the
 * phone is off screen or the tab is put away. The server draws the full
 * screen, and with less motion the clean one stands there, the Mac gone.
 */
export function HeroPhone() {
  const phone = useRef<HTMLDivElement>(null);
  const seen = useInView(phone);
  const hidden = useSyncExternalStore(subscribeVisibility, tabHidden, hiddenOnServer);
  const reduced = useLessMotion();
  const looped = useLoop(seen && !hidden && !reduced);
  const now = reduced ? REST : looped;

  // Before the swap the live screen plays. After it the live one waits at the
  // start, unseen, until it crossfades back in over the clean one.
  const playing = now < SWAP;
  const live = playing ? 1 : within(now, AT.back);
  const clean = playing ? 0 : 1 - stretch(now, AT.back[0], AT.back[0] + CLEAN_OUT);
  const mac = within(now, AT.macIn) * (1 - within(now, AT.macOut));
  const rise = RISE * (1 - within(now, AT.macIn));
  const cable = within(now, AT.cableIn, easeInOut) * (1 - within(now, AT.cableOut, easeInOut));
  const phonePlug = within(now, AT.phonePlugIn) * (1 - within(now, AT.phonePlugOut));
  const travel = within(now, AT.travel, easeInOut);
  const pressed = within(now, AT.press);
  const dip = within(now, AT.dip) - within(now, AT.undip);
  const ring = within(now, AT.ring);

  return (
    <div {...props(styles.hero)}>
      <div aria-label={m.hero_phone_label()} ref={phone} role="img" {...props(styles.phone)}>
        <svg
          aria-hidden="true"
          viewBox={`${PHONE.x} ${PHONE.y} ${PHONE.width} ${PHONE.height}`}
          {...props(styles.frame)}
        >
          <PhoneFrame hairline />
          {cable > 0 || phonePlug > 0 ? (
            <g transform={`translate(${MAC.x} ${MAC.y}) scale(${MAC.scale})`}>
              <rect
                height={PHONE_PLUG.height / MAC.scale}
                opacity={phonePlug}
                rx={PHONE_PLUG.radius / MAC.scale}
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
              <Laptop plugged={within(now, AT.macPlug)} solid>
                <MacApp dip={dip} pressed={pressed} ring={ring} screen="apps" />
              </Laptop>
            </g>
          ) : null}
        </svg>
        <div {...props(styles.layer, styles.layerAt(live))}>
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
        <div {...props(styles.layer, styles.layerAt(clean))}>
          {STAYING.map((app, place) => (
            <div
              key={app.glyph}
              {...props(styles.app, styles.appAt(SIDE.width, SIDE.height, standOn(place)))}
            >
              <KeptIcon glyph={app.glyph} />
            </div>
          ))}
        </div>
      </div>
      <div {...props(styles.stats)}>
        <p {...props(styles.stat)}>{m.hero_phone_stat()}</p>
        <p {...props(styles.caption)}>{m.hero_phone_stat_caption()}</p>
      </div>
    </div>
  );
}
