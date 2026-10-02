import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useInView } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import {
  BookOpen,
  Briefcase,
  Brush,
  Call,
  Camera,
  ChartLine,
  MusicNote,
  Video,
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
  brush: 1100,
  call: 900,
  camera: 700,
  learn: 900,
  music: 1100,
  numbers: 900,
  video: 1600,
  work: 800,
};

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
/** The camera gives under the shutter. */
const shutter = keyframes({
  '0%': { transform: 'none' },
  '20%': { transform: 'scale(0.92)' },
  '55%': { transform: 'scale(1.02)' },
  '100%': { transform: 'none' },
});
/** The lens flashes as it does, and the flash fades. */
const flash = keyframes({
  '0%': { opacity: 0 },
  '18%': { opacity: 0 },
  '26%': { opacity: 0.9 },
  '100%': { opacity: 0 },
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
/** The briefcase is picked up by its handle, swings a little and is set down. */
const lift = keyframes({
  '0%': { transform: 'none' },
  '30%': { transform: 'translateY(-3px) rotate(-4deg)' },
  '55%': { transform: 'translateY(0.75px) rotate(1.5deg)' },
  '75%': { transform: 'translateY(-0.5px) rotate(-0.5deg)' },
  '100%': { transform: 'none' },
});
/** The chart's line draws itself from left to right. */
const chartDraw = keyframes({
  '0%': { strokeDashoffset: 1 },
  '100%': { strokeDashoffset: 0 },
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
/** The record dot comes on, pulses twice and goes off. */
const recording = keyframes({
  '0%': { opacity: 0, transform: 'scale(0.5)' },
  '10%': { opacity: 1, transform: 'none' },
  '30%': { opacity: 0.35 },
  '50%': { opacity: 1 },
  '70%': { opacity: 0.35 },
  '85%': { opacity: 1 },
  '100%': { opacity: 0, transform: 'none' },
});

/* oxlint-enable perfectionist/sort-objects */

const styles = create({
  // Waits for a delay the tile sets, by its place in the grid.
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  // The chart's own line is cut away, leaving its axes, and drawn again in
  // the same line over them, so it can draw itself.
  axes: {
    clipPath: 'polygon(0 0, 4.5px 0, 4.5px 17px, 100% 17px, 100% 100%, 0 100%)',
  },
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
  camera: {
    transformOrigin: '12px 13px',
  },
  cameraPlay: {
    animationDuration: `${PLAYS.camera}ms`,
    animationName: shutter,
  },
  chartPlay: {
    animationDuration: `${PLAYS.numbers}ms`,
    animationName: chartDraw,
  },
  // The one orange in the grid.
  dot: {
    fill: accent.base,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  dotPlay: {
    animationDuration: `${PLAYS.video}ms`,
    animationName: recording,
  },
  // The flash in the lens, in the page's ink: light on a dark page, a blink
  // of the shutter on a light one.
  flash: {
    fill: colors.fg,
  },
  flashPlay: {
    animationDuration: `${PLAYS.camera}ms`,
    animationName: flash,
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
    animationDuration: `${PLAYS.learn}ms`,
    animationName: pageTurn,
  },
  // Every part of a drawing plays once, holding its first frame through the
  // wait and its last after it, which is where it rests.
  play: {
    animationFillMode: 'both',
    animationTimingFunction: easing.smoothOut,
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
  // Picked up by the handle.
  work: {
    transformOrigin: '12px 3px',
  },
  workPlay: {
    animationDuration: `${PLAYS.work}ms`,
    animationName: lift,
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

function CameraMark({ delay, play }: Played) {
  return (
    <>
      <Camera
        aria-hidden="true"
        size={SIZE}
        {...props(
          styles.icon,
          styles.camera,
          play && [styles.play, styles.cameraPlay, styles.after(delay)],
        )}
      />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <circle
          cx={12}
          cy={13}
          r={3}
          {...props(
            styles.flash,
            styles.unseen,
            play && [styles.play, styles.flashPlay, styles.after(delay)],
          )}
        />
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

function WorkMark({ delay, play }: Played) {
  return (
    <Briefcase
      aria-hidden="true"
      size={SIZE}
      {...props(
        styles.icon,
        styles.work,
        play && [styles.play, styles.swing, styles.workPlay, styles.after(delay)],
      )}
    />
  );
}

function NumbersMark({ delay, play }: Played) {
  return (
    <>
      <ChartLine aria-hidden="true" size={SIZE} {...props(styles.icon, styles.axes)} />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <path
          d="M6 15L11.5 9.5L15.5 13.5L21 8"
          pathLength={1}
          strokeDasharray="1 1"
          {...props(styles.line, play && [styles.play, styles.chartPlay, styles.after(delay)])}
        />
      </svg>
    </>
  );
}

function LearnMark({ delay, play }: Played) {
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

function VideoMark({ delay, play }: Played) {
  return (
    <>
      <Video aria-hidden="true" size={SIZE} {...props(styles.icon)} />
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.marks)}>
        <circle
          cx={9.25}
          cy={12}
          r={2.25}
          {...props(
            styles.dot,
            styles.unseen,
            play && [styles.play, styles.swing, styles.dotPlay, styles.after(delay)],
          )}
        />
      </svg>
    </>
  );
}

/** What the phone is still for, each with its icon and the drawing it plays. */
const USES = [
  { Mark: BrushMark, text: m.home_uses_make },
  { Mark: CameraMark, text: m.home_uses_photos },
  { Mark: CallMark, text: m.home_uses_call },
  { Mark: WorkMark, text: m.home_uses_work },
  { Mark: NumbersMark, text: m.home_uses_numbers },
  { Mark: LearnMark, text: m.home_uses_learn },
  { Mark: MusicMark, text: m.home_uses_music },
  { Mark: VideoMark, text: m.home_uses_video },
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
