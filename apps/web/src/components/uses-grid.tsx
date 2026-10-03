import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useInView } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import {
  BookOpen,
  Brush,
  Call,
  ChatRound,
  Expand,
  Lightbulb,
  MusicNote,
  Rocket,
} from 'reicon-react';
import { blur, distance, duration, easing } from '../lib/motion.stylex.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { m } from '../paraglide/messages.js';

/** A use's icon, in pixels, at the icons' own 1.5px line. */
const SIZE = 24;
/** How much of the grid has to be on screen before it comes in. */
const SEEN = 0.3;
/**
 * The grid's times, in milliseconds. The tiles rise one after another,
 * `stagger` apart, the motion scale's large stagger, and each icon plays its
 * drawing `lead` into its tile's rise. The drawings tell rather than respond,
 * so like the hero's phone they keep their own lengths, each under `PLAYS`.
 */
const TIMES = { lead: 250, stagger: 80 };
const PLAYS = {
  book: 900,
  brush: 1100,
  bulb: 1000,
  call: 900,
  chat: 700,
  expand: 1400,
  music: 1100,
  rocket: 1100,
};
/** The chat's dots type twice, each `CHAT_STAGGER` after the one before it. */
const CHAT_TYPES = 2;
const CHAT_STAGGER = 120;
/** The chat's three dots, where the icon with dots draws them. */
const CHAT_DOTS = [8, 12, 16];

/** A tile rising into place, out of a blur. */
const rise = keyframes({
  from: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});

/* oxlint-disable perfectionist/sort-objects -- a drawing's frames read in the order they play */

/** The brush tilts back, then sweeps forward and settles. */
const brushTilt = keyframes({
  '0%': { transform: 'none' },
  '25%': { transform: 'rotate(-12deg)' },
  '60%': { transform: 'translateX(1.5px) rotate(5deg)' },
  '82%': { transform: 'rotate(-1.5deg)' },
  '100%': { transform: 'none' },
});
/** The stroke it leaves under it, drawn with the sweep and gone after. */
const brushStroke = keyframes({
  '0%': { opacity: 0, strokeDashoffset: 1 },
  '22%': { opacity: 0, strokeDashoffset: 1 },
  '24%': { opacity: 1 },
  '62%': { strokeDashoffset: 0 },
  '80%': { opacity: 1 },
  '100%': { opacity: 0, strokeDashoffset: 0 },
});
/** The rocket crouches, lifts off up its own line and settles back. */
const launch = keyframes({
  '0%': { transform: 'none' },
  '15%': { transform: 'translate(-0.75px, 0.75px)' },
  '45%': { transform: 'translate(2.5px, -2.5px)' },
  '75%': { transform: 'translate(-0.5px, 0.5px)' },
  '100%': { transform: 'none' },
});
/** Its exhaust, drawn out behind it as it lifts and gone after. */
const exhaust = keyframes({
  '0%': { opacity: 0, strokeDashoffset: 1 },
  '15%': { opacity: 0, strokeDashoffset: 1 },
  '20%': { opacity: 1 },
  '45%': { strokeDashoffset: 0 },
  '60%': { opacity: 1 },
  '85%': { opacity: 0, strokeDashoffset: 0 },
  '100%': { opacity: 0, strokeDashoffset: 0 },
});
/** A dot in the chat rises and drops, as dots do while someone types. */
const typing = keyframes({
  '0%': { transform: 'none' },
  '30%': { transform: 'translateY(-2px)' },
  '60%': { transform: 'none' },
  '100%': { transform: 'none' },
});
/** The handset rings, each swing smaller than the last. */
const ring = keyframes({
  '0%': { transform: 'none' },
  '8%': { transform: 'rotate(-14deg)' },
  '18%': { transform: 'rotate(12deg)' },
  '28%': { transform: 'rotate(-10deg)' },
  '38%': { transform: 'rotate(8deg)' },
  '48%': { transform: 'rotate(-4deg)' },
  '58%': { transform: 'none' },
  '100%': { transform: 'none' },
});
/** Its two signal arcs, the near one first, going out as they fade. */
const signalNear = keyframes({
  '0%': { opacity: 0, transform: 'scale(0.8)' },
  '15%': { opacity: 0, transform: 'scale(0.8)' },
  '30%': { opacity: 1, transform: 'none' },
  '70%': { opacity: 0 },
  '100%': { opacity: 0 },
});
const signalFar = keyframes({
  '0%': { opacity: 0, transform: 'scale(0.8)' },
  '30%': { opacity: 0, transform: 'scale(0.8)' },
  '45%': { opacity: 1, transform: 'none' },
  '85%': { opacity: 0 },
  '100%': { opacity: 0 },
});
/** The right page turns over onto the left one and settles into it. */
const pageTurn = keyframes({
  '0%': { opacity: 0, transform: 'none' },
  '12%': { opacity: 1, transform: 'none' },
  '70%': { opacity: 1, transform: 'scaleX(-1)' },
  '100%': { opacity: 0, transform: 'scaleX(-1)' },
});
/** The notes beat once, and two small ones float up out of them. */
const beat = keyframes({
  '0%': { transform: 'none' },
  '14%': { transform: 'scale(1.06)' },
  '40%': { transform: 'none' },
  '100%': { transform: 'none' },
});
const noteFirst = keyframes({
  '0%': { opacity: 0, transform: 'translateY(2px)' },
  '20%': { opacity: 1 },
  '100%': { opacity: 0, transform: 'translate(1px, -9px) rotate(-10deg)' },
});
const noteSecond = keyframes({
  '0%': { opacity: 0, transform: 'translateY(2px)' },
  '25%': { opacity: 0, transform: 'translateY(2px)' },
  '45%': { opacity: 1 },
  '100%': { opacity: 0, transform: 'translate(2px, -8px) rotate(8deg)' },
});
/** The bulb lights up and dims again. */
const glow = keyframes({
  '0%': { opacity: 0 },
  '20%': { opacity: 0 },
  '35%': { opacity: 1 },
  '65%': { opacity: 1 },
  '100%': { opacity: 0 },
});
/** Its rays shine out from it as it lights, and fade. */
const shine = keyframes({
  '0%': { opacity: 0, transform: 'none' },
  '25%': { opacity: 0, transform: 'none' },
  '35%': { opacity: 1 },
  '80%': { opacity: 0, transform: 'scale(1.3)' },
  '100%': { opacity: 0, transform: 'scale(1.3)' },
});
/** The corners draw a breath in, out to make room, and back. */
const breathe = keyframes({
  '0%': { transform: 'none' },
  '45%': { transform: 'scale(1.12)' },
  '80%': { transform: 'scale(0.98)' },
  '100%': { transform: 'none' },
});

/* oxlint-enable perfectionist/sort-objects */

const styles = create({
  // Waits for a delay the tile sets, by its place in the grid.
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  brush: {
    transformOrigin: '6px 18px',
  },
  brushPlay: {
    animationDuration: `${PLAYS.brush}ms`,
    animationName: brushTilt,
  },
  brushStrokePlay: {
    animationDuration: `${PLAYS.brush}ms`,
    animationName: brushStroke,
  },
  call: {
    transformOrigin: '12px 12px',
  },
  callPlay: {
    animationDuration: `${PLAYS.call}ms`,
    animationName: ring,
  },
  // A dot in the chat, in the icon's ink.
  chatDot: {
    fill: 'currentColor',
  },
  chatDotPlay: {
    animationDuration: `${PLAYS.chat}ms`,
    animationIterationCount: CHAT_TYPES,
    animationName: typing,
  },
  exhaustPlay: {
    animationDuration: `${PLAYS.rocket}ms`,
    animationName: exhaust,
  },
  // The corners breathe from the middle of the icon.
  expand: {
    transformOrigin: '12px 12px',
  },
  expandPlay: {
    animationDuration: `${PLAYS.expand}ms`,
    animationName: breathe,
  },
  // The light in the bulb: the one orange in the grid.
  glow: {
    fill: accent.base,
  },
  glowPlay: {
    animationDuration: `${PLAYS.bulb}ms`,
    animationName: glow,
  },
  icon: {
    display: 'block',
  },
  // A mark in the icons' own line.
  line: {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.5,
  },
  // The marks over an icon, in its grid, free to go past its edges.
  marks: {
    height: SIZE,
    insetBlockStart: 0,
    insetInlineStart: 0,
    overflow: 'visible',
    pointerEvents: 'none',
    position: 'absolute',
    width: SIZE,
  },
  music: {
    transformOrigin: '12px 20px',
  },
  musicPlay: {
    animationDuration: `${PLAYS.music}ms`,
    animationName: beat,
  },
  note: {
    fill: 'currentColor',
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  noteFirstPlay: {
    animationDuration: `${PLAYS.music}ms`,
    animationName: noteFirst,
  },
  noteSecondPlay: {
    animationDuration: `${PLAYS.music}ms`,
    animationName: noteSecond,
  },
  // A page turning on the spine, filled with the page so the one under it is
  // covered where it passes.
  page: {
    fill: colors.bg,
    transformBox: 'view-box',
    transformOrigin: '12px 12px',
  },
  pagePlay: {
    animationDuration: `${PLAYS.book}ms`,
    animationName: pageTurn,
  },
  // Every part of a drawing plays once, unless it says otherwise, holding its
  // first frame through the wait and its last after it, which is where it
  // rests.
  play: {
    animationFillMode: 'both',
    animationTimingFunction: easing.smoothOut,
  },
  // The rays go out from the middle of the bulb.
  rays: {
    transformBox: 'view-box',
    transformOrigin: '12px 12px',
  },
  raysPlay: {
    animationDuration: `${PLAYS.bulb}ms`,
    animationName: shine,
  },
  rocketPlay: {
    animationDuration: `${PLAYS.rocket}ms`,
    animationName: launch,
  },
  // The arcs go out from the corner the handset rings in.
  signal: {
    transformBox: 'view-box',
    transformOrigin: '13px 11px',
  },
  signalFarPlay: {
    animationDuration: `${PLAYS.call}ms`,
    animationName: signalFar,
  },
  signalNearPlay: {
    animationDuration: `${PLAYS.call}ms`,
    animationName: signalNear,
  },
  // An icon's own box, and the marks drawn on it in its 24-unit grid.
  stage: {
    color: colors.muted,
    display: 'block',
    flexShrink: 0,
    height: SIZE,
    position: 'relative',
    width: SIZE,
  },
  // A drawing that swings back and forth eases both ways at every turn.
  swing: {
    animationTimingFunction: 'ease-in-out',
  },
  // A mark that is only there while its drawing plays.
  unseen: {
    opacity: 0,
  },
  // One thing the phone is for: a quiet tile, its icon over its line. A
  // pointer on it brings its edge up a step and lifts it a little.
  use: {
    borderColor: {
      ':hover': {
        '@media (hover: hover)': `color-mix(in srgb, ${colors.fg} 15%, ${colors.border})`,
        default: null,
      },
      default: colors.border,
    },
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeMd,
    gap: spacing.s4,
    lineHeight: 1.4,
    padding: {
      '@media (min-width: 768px)': spacing.s6,
      default: spacing.s4,
    },
    textWrap: 'pretty',
    transitionDuration: duration.fast,
    // The lift moves the tile by `translate`, so it never meets the rise,
    // which moves it by `transform`.
    transitionProperty: 'border-color, translate',
    transitionTimingFunction: easing.smoothOut,
    translate: {
      ':hover': {
        '@media (hover: hover) and (prefers-reduced-motion: no-preference)': '0 -2px',
        default: null,
      },
      default: null,
    },
  },
  // Below the fold once the page has come alive, a tile waits out of sight
  // for its rise.
  useHidden: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
  useRise: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: rise,
    animationTimingFunction: easing.smoothOut,
  },
  // Two to a row on a phone, all four across once the column has room.
  uses: {
    display: 'grid',
    gap: spacing.s3,
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'repeat(4, minmax(0, 1fr))',
      default: 'repeat(2, minmax(0, 1fr))',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
});

/** Whether a tile's drawing plays, and after how long. */
type Played = { delay: number; play: boolean };

function BrushMark({ delay, play }: Played) {
  return (
    <>
      <Brush
        aria-hidden="true"
        size={SIZE}
        {...props(
          styles.icon,
          styles.brush,
          play && [styles.play, styles.swing, styles.brushPlay, styles.after(delay)],
        )}
      />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <path
          d="M3 24.75c1.5-1.25 3-1.25 4.5 0s3 1.25 4.5 0"
          pathLength={1}
          strokeDasharray="1 1"
          {...props(
            styles.line,
            styles.unseen,
            play && [styles.play, styles.brushStrokePlay, styles.after(delay)],
          )}
        />
      </svg>
    </>
  );
}

/** Three short lines behind the rocket's tail, along the way it flies. */
const EXHAUST = ['M5.5 15.5L3 18', 'M7.25 17.25L3.75 20.75', 'M9 19L6.5 21.5'];

function RocketMark({ delay, play }: Played) {
  return (
    <>
      <Rocket
        aria-hidden="true"
        size={SIZE}
        {...props(
          styles.icon,
          play && [styles.play, styles.swing, styles.rocketPlay, styles.after(delay)],
        )}
      />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        {EXHAUST.map((d) => (
          <path
            d={d}
            key={d}
            pathLength={1}
            strokeDasharray="1 1"
            {...props(
              styles.line,
              styles.unseen,
              play && [styles.play, styles.exhaustPlay, styles.after(delay)],
            )}
          />
        ))}
      </svg>
    </>
  );
}

function ChatMark({ delay, play }: Played) {
  return (
    <>
      <ChatRound aria-hidden="true" size={SIZE} {...props(styles.icon)} />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        {CHAT_DOTS.map((cx, index) => (
          <circle
            cx={cx}
            cy={12}
            key={cx}
            r={1}
            {...props(
              styles.chatDot,
              play && [styles.play, styles.chatDotPlay, styles.after(delay + index * CHAT_STAGGER)],
            )}
          />
        ))}
      </svg>
    </>
  );
}

function CallMark({ delay, play }: Played) {
  return (
    <>
      <Call
        aria-hidden="true"
        size={SIZE}
        {...props(
          styles.icon,
          styles.call,
          play && [styles.play, styles.swing, styles.callPlay, styles.after(delay)],
        )}
      />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <path
          d="M13 6.5a4.5 4.5 0 0 1 4.5 4.5"
          {...props(
            styles.line,
            styles.signal,
            styles.unseen,
            play && [styles.play, styles.signalNearPlay, styles.after(delay)],
          )}
        />
        <path
          d="M13 2.75a8.25 8.25 0 0 1 8.25 8.25"
          {...props(
            styles.line,
            styles.signal,
            styles.unseen,
            play && [styles.play, styles.signalFarPlay, styles.after(delay)],
          )}
        />
      </svg>
    </>
  );
}

function BookMark({ delay, play }: Played) {
  return (
    <>
      <BookOpen aria-hidden="true" size={SIZE} {...props(styles.icon)} />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <path
          d="M12 5.5C13.1 4.15 14.7 3.5 16.4 3.5C18.1 3.5 19.75 4 21.16 4.94L21.46 5.14C21.79 5.36 22 5.74 22 6.15V19.28C22 19.8 21.4 20.1 20.98 19.83C19.68 18.96 18.17 18.5 16.62 18.5H16.15C14.75 18.5 13.4 18.97 12.3 19.85L12 20.1Z"
          {...props(
            styles.line,
            styles.page,
            styles.unseen,
            play && [styles.play, styles.swing, styles.pagePlay, styles.after(delay)],
          )}
        />
      </svg>
    </>
  );
}

function MusicMark({ delay, play }: Played) {
  return (
    <>
      <MusicNote
        aria-hidden="true"
        size={SIZE}
        {...props(
          styles.icon,
          styles.music,
          play && [styles.play, styles.musicPlay, styles.after(delay)],
        )}
      />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <g transform="translate(25.5 13)">
          <g
            {...props(
              styles.note,
              styles.unseen,
              play && [styles.play, styles.noteFirstPlay, styles.after(delay)],
            )}
          >
            <circle r={1.5} />
            <path d="M0.75 0V-5.5L3 -4.25" {...props(styles.line)} />
          </g>
        </g>
        <g transform="translate(30 9)">
          <g
            {...props(
              styles.note,
              styles.unseen,
              play && [styles.play, styles.noteSecondPlay, styles.after(delay)],
            )}
          >
            <circle r={1.5} />
            <path d="M0.75 0V-5.5L3 -4.25" {...props(styles.line)} />
          </g>
        </g>
      </svg>
    </>
  );
}

/** The bulb's rays, where the icon draws them. */
const RAYS = [
  'M12 1V2.33',
  'M19.78 4.22L18.84 5.16',
  'M23 12H21.67',
  'M4.22 4.22L5.16 5.16',
  'M1 12H2.33',
];

function BulbMark({ delay, play }: Played) {
  return (
    <>
      <Lightbulb aria-hidden="true" size={SIZE} {...props(styles.icon)} />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <circle
          cx={12}
          cy={11.75}
          r={3}
          {...props(
            styles.glow,
            styles.unseen,
            play && [styles.play, styles.glowPlay, styles.after(delay)],
          )}
        />
        <g
          {...props(
            styles.rays,
            styles.unseen,
            play && [styles.play, styles.raysPlay, styles.after(delay)],
          )}
        >
          {RAYS.map((d) => (
            <path d={d} key={d} {...props(styles.line)} />
          ))}
        </g>
      </svg>
    </>
  );
}

function ExpandMark({ delay, play }: Played) {
  return (
    <Expand
      aria-hidden="true"
      size={SIZE}
      {...props(
        styles.icon,
        styles.expand,
        play && [styles.play, styles.swing, styles.expandPlay, styles.after(delay)],
      )}
    />
  );
}

/** What the phone is still for, each with its icon and the drawing it plays. */
const USES = [
  { Mark: BrushMark, text: m.home_uses_sketch },
  { Mark: RocketMark, text: m.home_uses_ship },
  { Mark: ChatMark, text: m.home_uses_ask },
  { Mark: BookMark, text: m.home_uses_read },
  { Mark: MusicMark, text: m.home_uses_melody },
  { Mark: CallMark, text: m.home_uses_call },
  { Mark: BulbMark, text: m.home_uses_learn },
  { Mark: ExpandMark, text: m.home_uses_room },
];

/**
 * Plays a tile's drawing again from its start, without the wait it first
 * played after, when a mouse comes onto the tile, unless it is still playing.
 * A touch has no hover, so a tap leaves it be.
 */
function replay(event: PointerEvent<HTMLLIElement>) {
  if (event.pointerType !== 'mouse') {
    return;
  }
  const tile = event.currentTarget;
  // The tile's own rise and hover are left out: what is left is its drawing.
  const own = new Set(tile.getAnimations());
  const parts = tile.getAnimations({ subtree: true }).filter((part) => !own.has(part));
  if (parts.some((part) => part.playState === 'running')) {
    return;
  }
  for (const part of parts) {
    part.currentTime = part.effect?.getTiming().delay ?? 0;
    part.play();
  }
}

/**
 * What the phone is for once the feeds are off it, a tile each. The first
 * time the grid comes on screen the tiles rise into place one after another,
 * out of a blur, and each icon plays a small drawing of what it does, again
 * whenever a mouse comes onto its tile.
 *
 * The server draws the tiles in place, so they never wait on the script. Only
 * a grid still under the fold once the page has come alive hides them for
 * the rise; one already on screen stays as it is and only its icons play.
 * With less motion the tiles stand still.
 */
export function UsesGrid() {
  const grid = useRef<HTMLUListElement>(null);
  const seen = useInView(grid, { amount: SEEN, once: true });
  const reduced = useLessMotion();
  const [below, setBelow] = useState(false);

  // Measured once, as the page comes alive and before it paints again: only a
  // grid wholly under the window is hidden, where nobody sees it go.
  useLayoutEffect(() => {
    const top = grid.current?.getBoundingClientRect().top;
    if (top !== undefined && top > window.innerHeight) {
      setBelow(true);
    }
  }, []);

  const rising = below && !reduced;
  const play = seen && !reduced;

  return (
    <ul ref={grid} {...props(styles.uses)}>
      {USES.map(({ Mark, text }, index) => {
        const wait = index * TIMES.stagger;
        return (
          <li
            key={text()}
            onPointerEnter={replay}
            {...props(
              styles.use,
              rising && (seen ? [styles.useRise, styles.after(wait)] : styles.useHidden),
            )}
          >
            <span {...props(styles.stage)}>
              <Mark delay={rising ? wait + TIMES.lead : wait} play={play} />
            </span>
            {text()}
          </li>
        );
      })}
    </ul>
  );
}
