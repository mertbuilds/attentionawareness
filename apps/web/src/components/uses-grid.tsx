import { accent, tint } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { inView, useInView } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { blur, clock, distance, drawing, duration, easing } from '../lib/motion.stylex.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useTabHidden } from '../lib/use-tab-hidden.ts';
import { m } from '../paraglide/messages.js';

/**
 * A tile comes in once its top is this far up the window, so the tiles of a
 * row, whatever their height, come in together.
 */
const SEEN = '0px 0px -10% 0px';
/**
 * The grid's times, in milliseconds. Tiles that come on screen together rise
 * one after another, `stagger` apart, the motion scale's large stagger. Gains
 * already on screen as the page comes alive start their drawings `apart`.
 */
const TIMES = { apart: 240, stagger: 80 };
/**
 * The share of its turn a gain's drawing takes to go back to where it starts.
 * A gain that rises starts its turn this much early, so it comes up with its
 * drawing already at the start.
 */
const UNDONE = 0.04;
/** Where the loss goes in the words a screen reader hears, so they keep their own order. */
const LOSS_SLOT = '\u0000';
/** A loss's icon, in pixels, the size of the sheet it is drawn on. */
const ICON = 24;
/** The line across a loss's icon, corner to corner. */
const SLASH = 'M3.5 3.5L20.5 20.5';
/** The orange line a loss is struck through with. */
const STRIKE = '1.5px';
/** How full the side project's bar is before it fills. */
const BAR_FROM = 0.2;
/**
 * How far to the left of where they stand the walker starts, and how far up
 * they come in the middle of a step, in the drawing's units.
 */
const WALK = 20;
const BOB = 1.4;
/**
 * Each drawing's box, in the units it is drawn in: the part of a 160 by 100
 * sheet it stands on, with a little air around it.
 */
const VIEWS = {
  book: '14 2 132 90',
  call: '40 2 80 96',
  outside: '2 8 156 82',
  project: '4 4 152 92',
};
/**
 * The drawings are drawn larger or smaller with their tile, so their lines
 * keep the page's own width, as the hero's phone does, rather than growing
 * and shrinking with them.
 */
const HAIRLINE = 'non-scaling-stroke';

/** A tile rising into place, out of a blur. */
const rise = keyframes({
  from: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});

/*
 * A gain's drawing plays over and over on its tile's own time, a turn every
 * three to four seconds and no two tiles alike, so they never fall into step.
 * A turn starts and ends as the drawing stands, so it goes round without a
 * seam: in its first 4% whatever the turn draws is taken back, then it is
 * drawn again, and for the rest of the turn the drawing stands finished. The
 * steps below are shares of a turn, written with two digits so they stay in
 * the order they play in.
 */

/** A line of code wiped, then typed again from its left end. */
const type = keyframes({
  '00%': { transform: 'scaleX(1)' },
  '04%': { transform: 'scaleX(0)' },
  '22%': { transform: 'scaleX(0)' },
  '30%': { transform: 'scaleX(1)' },
  to: { transform: 'scaleX(1)' },
});
/** The side project's bar emptied, then filled to its end. */
const fill = keyframes({
  '00%': { transform: 'scaleX(1)' },
  '04%': { transform: `scaleX(${BAR_FROM})` },
  '14%': { transform: `scaleX(${BAR_FROM})` },
  '46%': { transform: 'scaleX(1)' },
  to: { transform: 'scaleX(1)' },
});
/** A mark that says it is done, the tick by the bar and the dot on the call: taken away, then popped back. */
const pop = keyframes({
  '00%': { opacity: 1, transform: 'scale(1)' },
  '04%': { opacity: 0, transform: 'scale(0.4)' },
  '46%': { opacity: 0, transform: 'scale(0.4)' },
  '52%': { opacity: 1, transform: 'scale(1.15)' },
  '57%': { opacity: 1, transform: 'scale(1)' },
  to: { opacity: 1, transform: 'scale(1)' },
});
/**
 * A page of the book turned from the right to the left: it narrows to the
 * spine as its far edge lifts, then widens on the other side as it comes
 * down. It is only seen while it turns.
 */
const turnOver = keyframes({
  '00%': { opacity: 0, transform: 'scaleX(1) skewY(0deg)' },
  '12%': { opacity: 0, transform: 'scaleX(1) skewY(0deg)' },
  '14%': { opacity: 1, transform: 'scaleX(1) skewY(0deg)' },
  '23%': { opacity: 1, transform: 'scaleX(0.7) skewY(-16deg)' },
  '30%': { opacity: 1, transform: 'scaleX(0) skewY(-22deg)' },
  '37%': { opacity: 1, transform: 'scaleX(-0.7) skewY(-16deg)' },
  '46%': { opacity: 1, transform: 'scaleX(-1) skewY(0deg)' },
  '50%': { opacity: 0, transform: 'scaleX(-1) skewY(0deg)' },
  to: { opacity: 0, transform: 'scaleX(-1) skewY(0deg)' },
});
/** A page's lines gone under the turning page, then the next page's lines coming in. */
const renew = keyframes({
  '00%': { opacity: 1 },
  '02%': { opacity: 0 },
  '14%': { opacity: 0 },
  '26%': { opacity: 1 },
  to: { opacity: 1 },
});
/** The light around the moon and the sun, swelling and settling once a turn. */
const glow = keyframes({
  '00%': { opacity: 0.5, transform: 'scale(1)' },
  '50%': { opacity: 1, transform: 'scale(1.18)' },
  to: { opacity: 0.5, transform: 'scale(1)' },
});
/** A star going dim and bright, twice a turn. */
const twinkle = keyframes({
  '00%': { opacity: 1, transform: 'scale(1)' },
  '25%': { opacity: 0.25, transform: 'scale(0.6)' },
  '50%': { opacity: 1, transform: 'scale(1)' },
  '75%': { opacity: 0.25, transform: 'scale(0.6)' },
  to: { opacity: 1, transform: 'scale(1)' },
});
/** The phone shaking as it rings, twice, then still. */
const ring = keyframes({
  '00%': { transform: 'rotate(0deg)' },
  '10%': { transform: 'rotate(0deg)' },
  '13%': { transform: 'rotate(-3deg)' },
  '16%': { transform: 'rotate(3deg)' },
  '19%': { transform: 'rotate(-3deg)' },
  '22%': { transform: 'rotate(3deg)' },
  '25%': { transform: 'rotate(0deg)' },
  '31%': { transform: 'rotate(0deg)' },
  '34%': { transform: 'rotate(-3deg)' },
  '37%': { transform: 'rotate(3deg)' },
  '40%': { transform: 'rotate(-3deg)' },
  '43%': { transform: 'rotate(3deg)' },
  '46%': { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(0deg)' },
});
/** The sound around the phone: off, on with each ring, and on for good once the call is through. */
const sound = keyframes({
  '00%': { opacity: 1 },
  '04%': { opacity: 0 },
  '10%': { opacity: 0 },
  '13%': { opacity: 1 },
  '22%': { opacity: 1 },
  '26%': { opacity: 0 },
  '31%': { opacity: 0 },
  '34%': { opacity: 1 },
  '43%': { opacity: 1 },
  '47%': { opacity: 0 },
  '52%': { opacity: 0 },
  '57%': { opacity: 1 },
  to: { opacity: 1 },
});
/** A voice on the call: nothing while it rings, then up and down as someone talks, and settling. */
const talk = keyframes({
  '00%': { opacity: 1, transform: 'scaleY(1)' },
  '04%': { opacity: 0, transform: 'scaleY(0.2)' },
  '60%': { opacity: 0, transform: 'scaleY(0.2)' },
  '64%': { opacity: 1, transform: 'scaleY(1.3)' },
  '70%': { opacity: 1, transform: 'scaleY(0.5)' },
  '76%': { opacity: 1, transform: 'scaleY(1.4)' },
  '82%': { opacity: 1, transform: 'scaleY(0.6)' },
  '88%': { opacity: 1, transform: 'scaleY(1.25)' },
  '94%': { opacity: 1, transform: 'scaleY(0.7)' },
  to: { opacity: 1, transform: 'scaleY(1)' },
});
/**
 * The walker gone from where they stand, back at the start, and walking there
 * again in four steps, up a little in the middle of each as the legs pass.
 */
const walk = keyframes({
  '00%': { opacity: 1, transform: 'translate(0px, 0px)' },
  '03%': { opacity: 0, transform: 'translate(0px, 0px)' },
  '04%': { opacity: 0, transform: `translate(-${WALK}px, 0px)` },
  '08%': { opacity: 1, transform: `translate(-${WALK}px, 0px)` },
  '10%': { opacity: 1, transform: `translate(-${WALK}px, 0px)` },
  '16%': { opacity: 1, transform: `translate(-${WALK * 0.875}px, -${BOB}px)` },
  '22%': { opacity: 1, transform: `translate(-${WALK * 0.75}px, 0px)` },
  '28%': { opacity: 1, transform: `translate(-${WALK * 0.625}px, -${BOB}px)` },
  '34%': { opacity: 1, transform: `translate(-${WALK * 0.5}px, 0px)` },
  '40%': { opacity: 1, transform: `translate(-${WALK * 0.375}px, -${BOB}px)` },
  '46%': { opacity: 1, transform: `translate(-${WALK * 0.25}px, 0px)` },
  '52%': { opacity: 1, transform: `translate(-${WALK * 0.125}px, -${BOB}px)` },
  '58%': { opacity: 1, transform: 'translate(0px, 0px)' },
  to: { opacity: 1, transform: 'translate(0px, 0px)' },
});
/** The leg and the arm behind the walker swung forward and back, a step each way, twice. */
const stepForward = keyframes({
  '00%': { transform: 'rotate(0deg)' },
  '10%': { transform: 'rotate(0deg)' },
  '22%': { transform: 'rotate(-28deg)' },
  '34%': { transform: 'rotate(0deg)' },
  '46%': { transform: 'rotate(-28deg)' },
  '58%': { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(0deg)' },
});
/** The leg and the arm in front of the walker swung back and forward, in step with the others. */
const stepBack = keyframes({
  '00%': { transform: 'rotate(0deg)' },
  '10%': { transform: 'rotate(0deg)' },
  '22%': { transform: 'rotate(32deg)' },
  '34%': { transform: 'rotate(0deg)' },
  '46%': { transform: 'rotate(32deg)' },
  '58%': { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(0deg)' },
});
/** The sun's rays going round by one ray a turn, so the turn ends as it started. */
const spin = keyframes({
  '00%': { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(45deg)' },
});
/** A cloud drifting off and back. */
const drift = keyframes({
  '00%': { transform: 'translateX(0px)' },
  '50%': { transform: 'translateX(8px)' },
  to: { transform: 'translateX(0px)' },
});

/*
 * A loss plays once, as its tile rises, and then stays as it ends: its icon
 * moves a little, the line is drawn across it, and its words are struck
 * through. The steps below are shares of that one play.
 */

/** The couch's cushion sinking under someone, and coming back up. */
const sink = keyframes({
  '00%': { transform: 'scaleY(1)' },
  '10%': { transform: 'scaleY(1)' },
  '18%': { transform: 'scaleY(0.4)' },
  '26%': { transform: 'scaleY(0.75)' },
  '32%': { transform: 'scaleY(0.5)' },
  '40%': { transform: 'scaleY(0.5)' },
  '47%': { transform: 'scaleY(1)' },
  to: { transform: 'scaleY(1)' },
});
/** The light of a video on the phone in bed. */
const flicker = keyframes({
  '00%': { fillOpacity: 0.35 },
  '10%': { fillOpacity: 0.35 },
  '14%': { fillOpacity: 0 },
  '18%': { fillOpacity: 0.6 },
  '22%': { fillOpacity: 0.1 },
  '26%': { fillOpacity: 0.5 },
  '30%': { fillOpacity: 0 },
  '34%': { fillOpacity: 0.6 },
  '38%': { fillOpacity: 0.15 },
  '44%': { fillOpacity: 0.35 },
  to: { fillOpacity: 0.35 },
});
/** The play button asking to be pressed, twice. */
const pulse = keyframes({
  '00%': { transform: 'scale(1)' },
  '10%': { transform: 'scale(1)' },
  '19%': { transform: 'scale(1.4)' },
  '28%': { transform: 'scale(1)' },
  '37%': { transform: 'scale(1.4)' },
  '46%': { transform: 'scale(1)' },
  to: { transform: 'scale(1)' },
});
/** A head turned down to the phone, held there, and up again. */
const look = keyframes({
  '00%': { transform: 'translate(0px, 0px)' },
  '10%': { transform: 'translate(0px, 0px)' },
  '20%': { transform: 'translate(-1.5px, 1.5px)' },
  '38%': { transform: 'translate(-1.5px, 1.5px)' },
  '46%': { transform: 'translate(0px, 0px)' },
  to: { transform: 'translate(0px, 0px)' },
});
/** The phone brought up to the face, held there, and down again. */
const lift = keyframes({
  '00%': { transform: 'translateY(0px)' },
  '10%': { transform: 'translateY(0px)' },
  '20%': { transform: 'translateY(-1.5px)' },
  '38%': { transform: 'translateY(-1.5px)' },
  '46%': { transform: 'translateY(0px)' },
  to: { transform: 'translateY(0px)' },
});
/** The line across a loss's icon, drawn once the icon has moved. */
const cross = keyframes({
  '00%': { strokeDashoffset: 1.02 },
  '46%': { strokeDashoffset: 1.02 },
  '58%': { strokeDashoffset: 0 },
  to: { strokeDashoffset: 0 },
});
/** The strike through a loss's words, drawn line after line once its icon is crossed. */
const strike = keyframes({
  '00%': { backgroundSize: `0% ${STRIKE}` },
  '54%': { backgroundSize: `0% ${STRIKE}` },
  '84%': { backgroundSize: `100% ${STRIKE}` },
  to: { backgroundSize: `100% ${STRIKE}` },
});

const styles = create({
  // Waits for a delay the tile sets, by when it came on screen.
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  // A tile's place in the grid, by name.
  area: (name: string) => ({
    gridArea: name,
  }),
  // The drawing over a gain, in the middle of the room its words leave.
  art: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
  },
  // The side project's bar and the round mark at its end once it is full, and
  // the ribbon in the book.
  bar: {
    fill: accent.base,
  },
  cross: {
    animationName: cross,
  },
  // The line across a loss's icon is drawn from its top end: one dash as long
  // as the line, and a gap long enough that no second dash ever starts.
  crossed: {
    strokeDasharray: '1 3',
  },
  // Each drawing at its tile's width, never past its own size.
  drawing: {
    display: 'block',
    height: 'auto',
    maxHeight: 168,
    maxWidth: 168,
    overflow: 'visible',
    width: '100%',
  },
  drawingBig: {
    maxWidth: 288,
  },
  drift: {
    animationName: drift,
    animationTimingFunction: easing.inOut,
  },
  // How long a turn of a gain's drawing takes, in seconds.
  every: (seconds: number) => ({
    [clock.every]: `${seconds}s`,
  }),
  // The drawings' faint parts: a display, a page's lines, the far arcs.
  faint: {
    opacity: 0.5,
  },
  fill: {
    animationName: fill,
    transformBox: 'fill-box',
    transformOrigin: 'left center',
  },
  flicker: {
    animationName: flicker,
  },
  // What the phone is for again: its drawing over its words, in the page's ink.
  gain: {
    borderStyle: 'solid',
    gap: spacing.s4,
    padding: {
      '@media (min-width: 768px)': spacing.s6,
      default: spacing.s4,
    },
  },
  gainText: {
    fontSize: {
      '@media (min-width: 768px)': font.sizeLg,
      default: font.sizeMd,
    },
    lineHeight: 1.3,
    textWrap: 'balance',
  },
  glow: {
    animationName: glow,
    animationTimingFunction: easing.inOut,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  // The sun and the moon, their line and the wash inside it.
  gold: {
    stroke: tint.gold,
  },
  goldWash: {
    fill: `color-mix(in srgb, ${tint.gold} 26%, ${colors.bg})`,
  },
  // A call that went through, and its voice.
  green: {
    stroke: tint.green,
  },
  greenDot: {
    fill: tint.green,
    stroke: colors.bg,
    strokeWidth: 1.25,
  },
  // A tree's leaves, and the face the phone calls.
  greenWash: {
    fill: `color-mix(in srgb, ${tint.green} 16%, ${colors.bg})`,
  },
  // Big tiles and small, in two bands that mirror each other: a big gain, two
  // losses stacked and a tall gain, then the other way round. Two to a row on
  // a phone, the big gains across both.
  grid: {
    display: 'grid',
    gap: spacing.s3,
    gridAutoRows: {
      '@media (min-width: 768px)': 'minmax(128px, auto)',
      default: 'auto',
    },
    gridTemplateAreas: {
      '@media (min-width: 768px)':
        '"project project couch book" "project project bed book" "mom strangers outside outside" "mom sundays outside outside"',
      default: '"project project" "bed couch" "book mom" "sundays strangers" "outside outside"',
    },
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'repeat(4, minmax(0, 1fr))',
      default: 'repeat(2, minmax(0, 1fr))',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // The light around the moon and the sun, behind them.
  halo: {
    fill: tint.gold,
    fillOpacity: 0.24,
    opacity: 0.5,
  },
  // A loss's icon and the line across it.
  icon: {
    display: 'block',
    flexShrink: 0,
    height: ICON,
    overflow: 'visible',
    width: ICON,
  },
  // The page that turns: unseen while the book lies open.
  leaf: {
    opacity: 0,
  },
  lift: {
    animationName: lift,
  },
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  look: {
    animationName: look,
  },
  // The time every moving part of a gain's drawing keeps: its tile's own, over
  // and over, held while the grid is.
  loop: {
    animationDelay: clock.delay,
    animationDuration: clock.every,
    animationFillMode: 'backwards',
    animationIterationCount: 'infinite',
    animationPlayState: clock.state,
    animationTimingFunction: easing.smoothOut,
  },
  // What the feeds took: quieter than a gain, its edge dashed where something
  // was, its words struck through.
  loss: {
    borderStyle: 'dashed',
    color: colors.muted,
    fontSize: font.sizeSm,
    gap: spacing.s3,
    justifyContent: 'space-between',
    lineHeight: 1.5,
    padding: {
      '@media (min-width: 768px)': spacing.s4,
      default: spacing.s3,
    },
  },
  // A loss's icon, in its tile's quiet ink.
  mark: {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.5,
  },
  // The small filled parts of an icon: the light of a screen, a face on it.
  markFill: {
    fill: 'currentColor',
  },
  markLit: {
    fillOpacity: 0.35,
  },
  markThin: {
    strokeWidth: 1.1,
  },
  // The time every moving part of a loss keeps: one play, started with its
  // tile's rise, that ends as the loss stands.
  once: {
    animationDelay: clock.delay,
    animationDuration: `${drawing.loss}s`,
    animationFillMode: 'backwards',
    animationTimingFunction: easing.smoothOut,
  },
  // A shape filled with the page, so what is behind it does not show through.
  paper: {
    fill: colors.bg,
  },
  pop: {
    animationName: pop,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  pulse: {
    animationName: pulse,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  renew: {
    animationName: renew,
  },
  // The phone turns about its middle as it rings.
  ring: {
    animationName: ring,
    animationTimingFunction: easing.inOut,
    transformOrigin: '80px 50px',
  },
  // While the grid is on screen and the tab in front, the gains' drawings run.
  running: {
    [clock.state]: 'running',
  },
  // The laptop's display, lit.
  screen: {
    fill: `color-mix(in srgb, ${accent.base} 5%, ${colors.bg})`,
  },
  // A part that plays a share of the turn before the rest, or after it.
  shift: (share: number) => ({
    animationDelay: `calc(${clock.delay} + ${clock.every} * ${share})`,
  }),
  sink: {
    animationName: sink,
    transformBox: 'fill-box',
    transformOrigin: 'center bottom',
  },
  // A cloud, its line and the wash inside it.
  sky: {
    stroke: tint.sky,
  },
  skyWash: {
    fill: `color-mix(in srgb, ${tint.sky} 16%, ${colors.bg})`,
  },
  // The line across a loss's icon, a gap of the page around it so it reads
  // across the icon's own lines.
  slash: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  slashGap: {
    stroke: colors.bg,
    strokeWidth: 3.5,
  },
  sound: {
    animationName: sound,
  },
  spin: {
    animationName: spin,
    animationTimingFunction: 'linear',
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  // Read by a screen reader, never seen.
  spoken: {
    borderWidth: 0,
    clip: 'rect(0, 0, 0, 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
  },
  // How long a tile's drawing waits before it first plays, in milliseconds.
  starts: (ms: number) => ({
    [clock.delay]: `${ms}ms`,
  }),
  // The walker's arms swing from the shoulder, the legs from the hip.
  stepBack: {
    animationName: stepBack,
    animationTimingFunction: easing.inOut,
  },
  stepForward: {
    animationName: stepForward,
    animationTimingFunction: easing.inOut,
  },
  stepFromHip: {
    transformOrigin: '89px 64px',
  },
  stepFromShoulder: {
    transformOrigin: '91px 49.5px',
  },
  strike: {
    animationName: strike,
  },
  // The loss itself, struck through in orange.
  struck: {
    backgroundImage: `linear-gradient(${accent.base}, ${accent.base})`,
    backgroundPosition: '0 58%',
    backgroundRepeat: 'no-repeat',
    backgroundSize: `100% ${STRIKE}`,
  },
  talk: {
    animationName: talk,
    animationTimingFunction: easing.inOut,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  // The tick in the round mark, in the page's colour.
  tick: {
    fill: 'none',
    stroke: colors.bg,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.25,
  },
  // A tile in the grid. A pointer on it brings its edge up a step and lifts it
  // a little.
  tile: {
    borderColor: {
      ':hover': {
        '@media (hover: hover)': `color-mix(in srgb, ${colors.fg} 15%, ${colors.border})`,
        default: null,
      },
      default: colors.border,
    },
    borderRadius: radius.base,
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
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
  tileHidden: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
  tileRise: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: rise,
    animationTimingFunction: easing.smoothOut,
  },
  // The turning page hinges on the spine, at its foot.
  turnOver: {
    animationName: turnOver,
    animationTimingFunction: 'linear',
    transformBox: 'fill-box',
    transformOrigin: 'left bottom',
  },
  twinkle: {
    animationName: twinkle,
    animationTimingFunction: easing.inOut,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  type: {
    animationName: type,
    transformBox: 'fill-box',
    transformOrigin: 'left center',
  },
  walk: {
    animationName: walk,
    animationTimingFunction: 'linear',
  },
});

/**
 * Where a tile is in its rise: `hidden` while it waits under the fold, then
 * `wait`, how long its rise waits once it is on screen. Neither for a tile
 * that stands still.
 */
type Rise = { hidden: boolean; wait: number | null };
/** Whether a drawing plays. It stands finished while it does not. */
type Playing = { play: boolean };

/** The tile's own rise: out of sight while it waits, then up into place. */
function riseStyle({ hidden, wait }: Rise) {
  return hidden ? styles.tileHidden : wait === null ? null : [styles.tileRise, styles.after(wait)];
}

/**
 * Plays a gain's drawing again from the top of its turn. Every part is put
 * back to where the first turn started, `first` milliseconds in, so each
 * keeps its own place in the turn. The tile's own rise is left alone, and so
 * are the parts marked `data-steady`, the lights and the clouds, which only
 * go round and would jump if they were put back.
 */
function replay(tile: HTMLElement, first: number) {
  const kept = new Set(tile.getAnimations());
  for (const steady of tile.querySelectorAll('[data-steady]')) {
    for (const motion of steady.getAnimations()) {
      kept.add(motion);
    }
  }
  for (const part of tile.getAnimations({ subtree: true })) {
    if (!kept.has(part)) {
      part.currentTime = first;
    }
  }
}

/** Lines of code on the laptop's display, each `[x, y, length]`. */
const CODE = [
  [38, 28, 46],
  [46, 35, 30],
  [46, 42, 52],
  [54, 49, 24],
  [38, 56, 18],
];
/** How long after the line above it a line of code is typed, as a share of the turn. */
const TYPED_AFTER = 0.03;
const BAR = { height: 4, width: 72, x: 38, y: 66 };
/** The round mark at the bar's end, and the tick in it. */
const DONE = { r: 5, x: 122, y: 68 };
const TICK = 'M119.7 68.2L121.4 69.9L124.4 66.3';

/**
 * A laptop open on the desk, drawn like the Mac in the steps: the code on its
 * display is typed line after line, the bar under it fills to its end in
 * orange, and a tick comes up beside it.
 */
function ProjectArt({ play }: Playing) {
  return (
    <>
      <rect
        height={72}
        rx={5}
        vectorEffect={HAIRLINE}
        width={112}
        x={24}
        y={12}
        {...props(styles.line)}
      />
      <rect
        height={64}
        rx={1}
        vectorEffect={HAIRLINE}
        width={104}
        x={28}
        y={16}
        {...props(styles.line, styles.faint, styles.screen)}
      />
      <path
        d="M12 84H148V86.5Q148 89 145.5 89H14.5Q12 89 12 86.5Z M72 84Q72 86 74 86H86Q88 86 88 84"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      {CODE.map(([x, y, length], index) => (
        <path
          d={`M${x} ${y}h${length}`}
          key={`${x} ${y}`}
          vectorEffect={HAIRLINE}
          {...props(
            styles.line,
            styles.faint,
            play && [
              styles.loop,
              styles.type,
              styles.shift((index + 1 - CODE.length) * TYPED_AFTER),
            ],
          )}
        />
      ))}
      <rect
        height={BAR.height}
        rx={BAR.height / 2}
        vectorEffect={HAIRLINE}
        width={BAR.width}
        x={BAR.x}
        y={BAR.y}
        {...props(styles.line, styles.faint)}
      />
      <rect
        height={BAR.height}
        rx={BAR.height / 2}
        width={BAR.width}
        x={BAR.x}
        y={BAR.y}
        {...props(styles.bar, play && [styles.loop, styles.fill])}
      />
      <g {...props(play && [styles.loop, styles.pop])}>
        <circle cx={DONE.x} cy={DONE.y} r={DONE.r} {...props(styles.bar)} />
        <path d={TICK} vectorEffect={HAIRLINE} {...props(styles.tick)} />
      </g>
    </>
  );
}

/** The book's right page. Its left page is the same, the other way round. */
const PAGE = 'M80 36C90 29 108 27 126 31V80C108 76 90 78 80 84Z';
/** The lines of text on each page of the book, by where each ends. */
const LEFT_LINES = [72, 68, 72, 64, 70];
const RIGHT_LINES = [118, 114, 118, 110, 104];
const LINE_TOP = 42;
const LINE_PITCH = 7;
/** The moon's middle, and the stars beside it, each with how far into the turn it twinkles. */
const MOON = { x: 138, y: 14 };
const STARS = [
  { d: 'M122 9V15M119 12H125', late: 0 },
  { d: 'M110 4.5V8.5M108 6.5H112', late: 0.125 },
];
/** The ribbon that keeps the place, over the top of the right page. */
const BOOKMARK = 'M109.5 27.6V38.5L112.25 36L115 38.5V27.9Z';
/** When each page's lines go and come back, as shares of the turn: the right as the page lifts, the left as it lands. */
const RENEWED = { left: 0.4, right: 0.12 };

/**
 * An open book on its cover under a gold moon. A page turns from the right
 * to the left and the lines on both pages come in new, while the moon's
 * light swells and its stars twinkle.
 */
function BookArt({ play }: Playing) {
  return (
    <>
      <circle
        cx={MOON.x}
        cy={MOON.y}
        data-steady
        r={11}
        {...props(styles.halo, play && [styles.loop, styles.glow])}
      />
      <path
        d="M142 7.07A8 8 0 1 0 144.93 18A6.5 6.5 0 0 1 142 7.07Z"
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.gold, styles.goldWash)}
      />
      {STARS.map((star) => (
        <path
          d={star.d}
          data-steady
          key={star.d}
          vectorEffect={HAIRLINE}
          {...props(
            styles.line,
            styles.gold,
            play && [styles.loop, styles.twinkle, styles.shift(star.late)],
          )}
        />
      ))}
      <path
        d="M34 34L30 35V85C52 81 70 82 80 88C90 82 108 81 130 85V35L126 34"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      <path
        d={`M80 36C70 29 52 27 34 31V80C52 76 70 78 80 84Z ${PAGE}`}
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.paper)}
      />
      <path d={BOOKMARK} {...props(styles.bar)} />
      <g {...props(play && [styles.loop, styles.renew, styles.shift(RENEWED.left)])}>
        {LEFT_LINES.map((end, index) => (
          <path
            d={`M42 ${LINE_TOP + index * LINE_PITCH}H${end}`}
            key={index}
            vectorEffect={HAIRLINE}
            {...props(styles.line, styles.faint)}
          />
        ))}
      </g>
      <g {...props(play && [styles.loop, styles.renew, styles.shift(RENEWED.right)])}>
        {RIGHT_LINES.map((end, index) => (
          <path
            d={`M88 ${LINE_TOP + index * LINE_PITCH}H${end}`}
            key={index}
            vectorEffect={HAIRLINE}
            {...props(styles.line, styles.faint)}
          />
        ))}
      </g>
      <path
        d={PAGE}
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.paper, styles.leaf, play && [styles.loop, styles.turnOver])}
      />
    </>
  );
}

/** The bars of the voice on the call, each by where it stands and half its height. */
const VOICE = [
  { half: 1.5, x: 74.5 },
  { half: 3, x: 77.25 },
  { half: 2, x: 80 },
  { half: 3.5, x: 82.75 },
  { half: 1.5, x: 85.5 },
];
const VOICE_Y = 56;
/** How long after the bar before it a bar of the voice moves, as a share of the turn. */
const VOICE_AFTER = 0.015;
/** How long before the far arcs the near ones sound, as a share of the turn. */
const NEAR_BEFORE = 0.02;

/**
 * A phone on a call: it rings twice, shaking, the sound going out of it with
 * each ring, then the call is through, a green dot on the face it calls and
 * a voice moving under the name.
 */
function CallArt({ play }: Playing) {
  return (
    <>
      <g {...props(play && [styles.loop, styles.ring])}>
        <rect
          height={90}
          rx={8}
          vectorEffect={HAIRLINE}
          width={44}
          x={58}
          y={5}
          {...props(styles.line)}
        />
        <rect
          height={85}
          rx={5.5}
          vectorEffect={HAIRLINE}
          width={39}
          x={60.5}
          y={7.5}
          {...props(styles.line, styles.faint)}
        />
        <rect
          height={4}
          rx={2}
          vectorEffect={HAIRLINE}
          width={14}
          x={73}
          y={11}
          {...props(styles.line, styles.faint)}
        />
        <circle
          cx={80}
          cy={32}
          r={9}
          vectorEffect={HAIRLINE}
          {...props(styles.line, styles.greenWash)}
        />
        <circle cx={80} cy={29.5} r={2.8} vectorEffect={HAIRLINE} {...props(styles.line)} />
        <path
          d="M75 38C75.8 34.9 77.6 33.8 80 33.8C82.4 33.8 84.2 34.9 85 38"
          vectorEffect={HAIRLINE}
          {...props(styles.line)}
        />
        <circle
          cx={86.4}
          cy={38.4}
          r={2.6}
          vectorEffect={HAIRLINE}
          {...props(styles.greenDot, play && [styles.loop, styles.pop])}
        />
        <path d="M72 47H88" vectorEffect={HAIRLINE} {...props(styles.line)} />
        {VOICE.map(({ half, x }, index) => (
          <path
            d={`M${x} ${VOICE_Y - half}V${VOICE_Y + half}`}
            key={x}
            vectorEffect={HAIRLINE}
            {...props(
              styles.line,
              styles.green,
              play && [
                styles.loop,
                styles.talk,
                styles.shift((index + 1 - VOICE.length) * VOICE_AFTER),
              ],
            )}
          />
        ))}
        {[70, 80, 90].map((cx) => (
          <circle
            cx={cx}
            cy={68}
            key={cx}
            r={3.2}
            vectorEffect={HAIRLINE}
            {...props(styles.line, styles.faint)}
          />
        ))}
        <circle cx={80} cy={82} r={4.5} vectorEffect={HAIRLINE} {...props(styles.line)} />
      </g>
      <g {...props(play && [styles.loop, styles.sound, styles.shift(-NEAR_BEFORE)])}>
        <path
          d="M108.95 25.05A7 7 0 0 1 108.95 34.95 M51.05 25.05A7 7 0 0 0 51.05 34.95"
          vectorEffect={HAIRLINE}
          {...props(styles.line)}
        />
      </g>
      <g {...props(play && [styles.loop, styles.sound])}>
        <path
          d="M113.19 20.81A13 13 0 0 1 113.19 39.19 M46.81 20.81A13 13 0 0 0 46.81 39.19"
          vectorEffect={HAIRLINE}
          {...props(styles.line, styles.faint)}
        />
      </g>
    </>
  );
}

const SUN = { r: 7, x: 126, y: 26 };
/** The sun's rays, around it. */
const RAYS =
  'M136 26H139 M133.07 33.07L135.19 35.19 M126 36V39 M118.93 33.07L116.81 35.19 M116 26H113 M118.93 18.93L116.81 16.81 M126 16V13 M133.07 18.93L135.19 16.81';
/** The clouds, each with how far into the turn it drifts. */
const CLOUDS = [
  { d: 'M62 27H76.5A3.75 3.75 0 0 0 77 19.53A6 6 0 0 0 65.6 18.2A4.5 4.5 0 0 0 62 27Z', late: 0 },
  {
    d: 'M16 21H26A2.6 2.6 0 0 0 26.3 15.8A4.2 4.2 0 0 0 18.4 14.9A3.2 3.2 0 0 0 16 21Z',
    late: -0.5,
  },
];

/**
 * Someone out for a walk past two trees, hills behind and the sun over them:
 * they walk in from the left, a step at a time, while the clouds drift and
 * the sun's rays go round.
 */
function OutsideArt({ play }: Playing) {
  return (
    <>
      <path
        d="M70 86C88 70 108 66 128 72C138 75 146 80 154 82"
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.faint)}
      />
      <circle
        cx={SUN.x}
        cy={SUN.y}
        data-steady
        r={SUN.r + 5}
        {...props(styles.halo, play && [styles.loop, styles.glow])}
      />
      <circle
        cx={SUN.x}
        cy={SUN.y}
        r={SUN.r}
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.gold, styles.goldWash)}
      />
      <path
        d={RAYS}
        data-steady
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.gold, play && [styles.loop, styles.spin])}
      />
      {CLOUDS.map((cloud) => (
        <path
          d={cloud.d}
          data-steady
          key={cloud.d}
          vectorEffect={HAIRLINE}
          {...props(
            styles.line,
            styles.sky,
            styles.skyWash,
            play && [styles.loop, styles.drift, styles.shift(cloud.late)],
          )}
        />
      ))}
      <path d="M34 63V86" vectorEffect={HAIRLINE} {...props(styles.line)} />
      <circle
        cx={34}
        cy={50}
        r={13}
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.greenWash)}
      />
      <path d="M56 72V86" vectorEffect={HAIRLINE} {...props(styles.line)} />
      <circle
        cx={56}
        cy={64}
        r={8}
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.greenWash)}
      />
      <g {...props(play && [styles.loop, styles.walk])}>
        <circle cx={92} cy={41} r={4.5} vectorEffect={HAIRLINE} {...props(styles.line)} />
        <path d="M91.5 46L89 64" vectorEffect={HAIRLINE} {...props(styles.line)} />
        <path
          d="M91 49.5L85.5 58.5"
          vectorEffect={HAIRLINE}
          {...props(
            styles.line,
            play && [styles.loop, styles.stepForward, styles.stepFromShoulder],
          )}
        />
        <path
          d="M91 49.5L97 57"
          vectorEffect={HAIRLINE}
          {...props(styles.line, play && [styles.loop, styles.stepBack, styles.stepFromShoulder])}
        />
        <path
          d="M89 64L83.5 86"
          vectorEffect={HAIRLINE}
          {...props(styles.line, play && [styles.loop, styles.stepForward, styles.stepFromHip])}
        />
        <path
          d="M89 64L94.5 74L97 86"
          vectorEffect={HAIRLINE}
          {...props(styles.line, play && [styles.loop, styles.stepBack, styles.stepFromHip])}
        />
      </g>
      <path d="M6 86H154" vectorEffect={HAIRLINE} {...props(styles.line)} />
    </>
  );
}

/** A couch, its cushion sinking under whoever sat down on it. */
function CouchIcon({ play }: Playing) {
  return (
    <>
      <path d="M5.5 10V8A2.5 2.5 0 0 1 8 5.5H16A2.5 2.5 0 0 1 18.5 8V10" {...props(styles.mark)} />
      <path
        d="M8 15V13.25A1.5 1.5 0 0 1 9.5 11.75H14.5A1.5 1.5 0 0 1 16 13.25V15"
        {...props(styles.mark, play && [styles.once, styles.sink])}
      />
      <path
        d="M3.25 12.25A1.75 1.75 0 0 1 6.75 12.25V15H17.25V12.25A1.75 1.75 0 0 1 20.75 12.25V17A1.5 1.5 0 0 1 19.25 18.5H4.75A1.5 1.5 0 0 1 3.25 17Z M6 18.5V20 M18 18.5V20"
        {...props(styles.mark)}
      />
    </>
  );
}

/** A bed, and over its pillow a phone, its screen flickering with a video. */
function BedIcon({ play }: Playing) {
  return (
    <>
      <path
        d="M3.25 7.5V19.5 M3.25 16.5H20.75V19.5 M3.25 12.5H17.25A3.5 3.5 0 0 1 20.75 16V16.5 M5.25 12.5V11.5A1.25 1.25 0 0 1 6.5 10.25H8.75A1.25 1.25 0 0 1 10 11.5V12.5"
        {...props(styles.mark)}
      />
      <rect
        height={6.5}
        rx={1.1}
        transform="rotate(14 16.1 6.5)"
        width={4.25}
        x={14}
        y={3.25}
        {...props(
          styles.mark,
          styles.markFill,
          styles.markLit,
          play && [styles.once, styles.flicker],
        )}
      />
    </>
  );
}

/** A video, its play button asking to be pressed. */
function VideoIcon({ play }: Playing) {
  return (
    <>
      <rect height={13.5} rx={3.75} width={18.5} x={2.75} y={5.25} {...props(styles.mark)} />
      <path
        d="M10 8.75V15.25L15.25 12Z"
        {...props(styles.mark, play && [styles.once, styles.pulse])}
      />
    </>
  );
}

/** Someone and their phone, a stranger on its screen: they look down at it as it comes up. */
function StrangersIcon({ play }: Playing) {
  return (
    <>
      <circle
        cx={15.75}
        cy={7.75}
        r={3}
        {...props(styles.mark, play && [styles.once, styles.look])}
      />
      <path d="M10.5 19.25A5.25 5.25 0 0 1 21 19.25" {...props(styles.mark)} />
      <g {...props(play && [styles.once, styles.lift])}>
        <rect height={9.75} rx={1.4} width={5.5} x={2.75} y={9.5} {...props(styles.mark)} />
        <circle cx={5.5} cy={13} r={1} {...props(styles.markFill)} />
        <path d="M3.9 17A1.6 1.6 0 0 1 7.1 17" {...props(styles.mark, styles.markThin)} />
      </g>
    </>
  );
}

/**
 * A tile: its place in the grid, its words, and either its drawing, with how
 * long a turn of it takes, in seconds, or its icon.
 */
type Tile = { area: string; text: () => string } & (
  | { Art: ComponentType<Playing>; big?: boolean; every: number; view: string }
  | { Icon: ComponentType<Playing> }
);

/**
 * The tiles in reading order, each loss next to the gain it makes room for.
 * No two gains take the same time over a turn, so they soon fall out of step
 * and look as if each played when it liked.
 */
const TILES: ReadonlyArray<Tile> = [
  {
    area: 'project',
    Art: ProjectArt,
    big: true,
    every: 3.4,
    text: m.home_uses_project,
    view: VIEWS.project,
  },
  { area: 'couch', Icon: CouchIcon, text: m.home_uses_project_loss },
  { area: 'bed', Icon: BedIcon, text: m.home_uses_book_loss },
  { area: 'book', Art: BookArt, every: 3.7, text: m.home_uses_book, view: VIEWS.book },
  { area: 'mom', Art: CallArt, every: 4, text: m.home_uses_mom, view: VIEWS.call },
  { area: 'strangers', Icon: StrangersIcon, text: m.home_uses_mom_loss },
  { area: 'sundays', Icon: VideoIcon, text: m.home_uses_outside_loss },
  {
    area: 'outside',
    Art: OutsideArt,
    big: true,
    every: 3.1,
    text: m.home_uses_outside,
    view: VIEWS.outside,
  },
];

/**
 * Something the phone is for again, its drawing over its words. The drawing
 * plays over and over once `first`, how long its first turn waits, is known,
 * and a mouse coming onto the tile plays it again at once.
 */
function Gain({
  area,
  Art,
  big = false,
  every,
  first,
  rise,
  text,
  view,
}: {
  area: string;
  Art: ComponentType<Playing>;
  big?: boolean | undefined;
  every: number;
  first: number | null;
  rise: Rise;
  text: string;
  view: string;
}) {
  return (
    <li
      onPointerEnter={(event) => {
        if (first !== null && event.pointerType === 'mouse') {
          replay(event.currentTarget, first);
        }
      }}
      {...props(
        styles.tile,
        styles.gain,
        styles.area(area),
        riseStyle(rise),
        styles.every(every),
        first !== null && styles.starts(first),
      )}
    >
      <span {...props(styles.art)}>
        <svg aria-hidden="true" viewBox={view} {...props(styles.drawing, big && styles.drawingBig)}>
          <Art play={first !== null} />
        </svg>
      </span>
      <span {...props(styles.gainText)}>{text}</span>
    </li>
  );
}

/**
 * Something the feeds took: its icon crossed out, over its words struck
 * through. It plays once, as its tile rises, and stays struck. The lines are
 * drawn, not said, so a screen reader hears that the thing is gone in the
 * words around it.
 */
function Loss({
  area,
  Icon,
  rise,
  text,
}: {
  area: string;
  Icon: ComponentType<Playing>;
  rise: Rise;
  text: string;
}) {
  const [before, after] = m.home_uses_loss_spoken({ loss: LOSS_SLOT }).split(LOSS_SLOT);
  const play = rise.wait !== null;
  return (
    <li
      {...props(
        styles.tile,
        styles.loss,
        styles.area(area),
        riseStyle(rise),
        rise.wait !== null && styles.starts(rise.wait),
      )}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${ICON} ${ICON}`} {...props(styles.icon)}>
        <Icon play={play} />
        <path
          d={SLASH}
          pathLength={1}
          {...props(
            styles.slash,
            styles.slashGap,
            styles.crossed,
            play && [styles.once, styles.cross],
          )}
        />
        <path
          d={SLASH}
          pathLength={1}
          {...props(styles.slash, styles.crossed, play && [styles.once, styles.cross])}
        />
      </svg>
      <span>
        {before ? <span {...props(styles.spoken)}>{before}</span> : null}
        <span {...props(styles.struck, play && [styles.once, styles.strike])}>{text}</span>
        {after ? <span {...props(styles.spoken)}>{after}</span> : null}
      </span>
    </li>
  );
}

/**
 * What the feeds take and what the phone is for once they are off it, mixed
 * in one grid: each gain a tile with a small drawing, each loss a quieter
 * tile beside it, its icon crossed out and its words struck through in
 * orange.
 *
 * The server draws every tile finished, so none waits on the script. Only a
 * tile still under the window once the page has come alive hides, and rises
 * once its top comes up the window, `stagger` after the one before it when
 * they come up together, as a row does. As a loss rises its icon moves and it
 * is struck through, once, and it stays struck. As a gain rises its drawing
 * plays from the start, and from then on it plays again every three to four
 * seconds, each gain on its own time; a gain already on screen starts playing
 * where it stands. The gains are held while the grid is off screen or the tab
 * is put away, and with less motion every tile stands still, finished.
 */
export function UsesGrid() {
  const grid = useRef<HTMLUListElement>(null);
  const reduced = useLessMotion();
  const seen = useInView(grid);
  const hidden = useTabHidden();
  // Which tiles were under the window as the page came alive, by place.
  const [below, setBelow] = useState<ReadonlyArray<boolean>>([]);
  // How long each tile's rise waits, by place, once it has come up the window.
  const [waits, setWaits] = useState<ReadonlyMap<number, number>>(new Map());

  // Measured once, as the page comes alive and before it paints again: only a
  // tile wholly under the window is hidden, where nobody sees it go.
  useLayoutEffect(() => {
    const tiles = grid.current?.children;
    if (tiles !== undefined) {
      setBelow(Array.from(tiles, (tile) => tile.getBoundingClientRect().top > window.innerHeight));
    }
  }, []);

  const moving = !reduced && below.length > 0;
  const rising = moving && below.includes(true);

  // One watch over every hidden tile, so tiles that come up together are told
  // in the grid's order. Each starts no sooner than `stagger` after the last.
  useEffect(() => {
    const list = grid.current;
    if (!rising || list === null) {
      return;
    }
    const tiles = [...list.children];
    let last = Number.NEGATIVE_INFINITY;
    return inView(
      tiles.filter((_, index) => below[index] === true),
      (tile) => {
        const now = performance.now();
        last = Math.max(now, last + TIMES.stagger);
        const place = tiles.indexOf(tile);
        const wait = last - now;
        setWaits((was) => new Map(was).set(place, wait));
      },
      { margin: SEEN },
    );
  }, [below, rising]);

  return (
    <ul ref={grid} {...props(styles.grid, seen && !hidden && styles.running)}>
      {TILES.map((tile, place) => {
        const under = moving && below[place] === true;
        const wait = waits.get(place);
        const rise = {
          hidden: under && wait === undefined,
          wait: under && wait !== undefined ? wait : null,
        };
        if ('Icon' in tile) {
          return (
            <Loss
              area={tile.area}
              Icon={tile.Icon}
              key={tile.area}
              rise={rise}
              text={tile.text()}
            />
          );
        }
        // How long the drawing's first turn waits. A gain that rises starts
        // its turn early by the share that undoes the drawing, so the drawing
        // is at its start as the tile comes up. A gain already on screen
        // starts `apart` after the tile before it. Nothing plays before the
        // page has come alive, under the fold, or with less motion.
        const first = !moving
          ? null
          : !under
            ? place * TIMES.apart
            : wait === undefined
              ? null
              : wait - tile.every * 1000 * UNDONE;
        return (
          <Gain
            area={tile.area}
            Art={tile.Art}
            big={tile.big}
            every={tile.every}
            first={first}
            key={tile.area}
            rise={rise}
            text={tile.text()}
            view={tile.view}
          />
        );
      })}
    </ul>
  );
}
