import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'motion/react';
import type { MotionValue } from 'motion/react';
import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import {
  AVERAGE_HOURS,
  formatYears,
  heroMetrics,
  HORIZON_WEEKS,
  HORIZON_YEARS,
  MOON_KM,
  MOON_WALK_HOURS,
  moonShare,
  screenWeeks,
  WAKING_HOURS,
  WALKING_KMH,
  WEEKEND_HOURS,
  weeklyHours,
} from '../lib/attention-math.ts';
import { blur, distance, drawing, duration, easing } from '../lib/motion.stylex.ts';
import { typingIn } from '../lib/typing-in.ts';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { BillFilters } from './bill-paper.tsx';
import { GridTexture } from './grid-texture.tsx';
import { InfoTip } from './info-tip.tsx';

/** The report the average day is taken from. */
const SOURCE_URL = 'https://datareportal.com/reports/digital-2024-global-overview-report';
/** The story's sentences, in the order the scroll plays them, and where each drawing's beat stands. */
const BEATS = 6;
const WEEKS_BEAT = 1;
const WEEKENDS_BEAT = 2;
const EARTH_BEAT = 3;
const MOON_BEAT = 4;
const TURN_BEAT = 5;
/** How much of the stage has to be on screen before a drawing plays. */
const SEEN = 0.6;
/** `easing.smoothOut`, the curve things move into place on, as motion takes a curve. */
const SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** How long a beat takes to fade out. Its drawings start over once it has. */
const FADE_OUT_MS = Number.parseFloat(duration.quick);
/** The sentences' line height. */
const LINE_HEIGHT = 1.15;
/**
 * A wheel or a trackpad moves the story a beat a gesture. A gesture is over
 * once the wheel has been still this long, or once it has ebbed to under a
 * quarter of its strongest turn and been flicked again, three times as hard
 * and by this many pixels at least.
 */
const WHEEL_QUIET_MS = 150;
const WHEEL_EBB = 4;
const WHEEL_SURGE = 3;
const WHEEL_SURGE_PX = 16;
/** How far a gesture pushes before it moves the story, so a graze of the trackpad does not. */
const WHEEL_PUSH = 6;
/** How long the story takes to move the page from one beat to the next. */
const STEP_SECONDS = 0.8;
/** A wheel that counts in lines, as Firefox's does, moves this far a line. */
const LINE_PX = 16;
/**
 * What marks a figure's place in a sentence. The message is written with a
 * placeholder for each figure and split on this, so the words around a figure
 * keep their own order in every language instead of being stitched from
 * pieces.
 */
const SLOT = '\u0000';
/**
 * The stretches of a sentence it turns on, [[like this]]. The message marks
 * them, so each language puts them where its own grammar wants them.
 */
const MARKED = /\[\[(.*?)\]\]/u;
/** The grid behind the stage, solid in the middle and gone before the edges. */
const GRID_MASK = 'radial-gradient(ellipse at 50% 50%, black 35%, transparent 80%)';
/** The last run of non-blank characters in a piece of a sentence: its last word. */
const LAST_WORD = /\S*$/u;
/** The globe and the walk around it, in the drawing's own 200-unit box. */
const BOX = 200;
const CENTER = BOX / 2;
const GLOBE_RADIUS = 52;
const MERIDIAN_SQUASH = 0.42;
const EQUATOR_SQUASH = 0.3;
/** The walk spirals out one lap a trip, from just off the globe to the edge. */
const ORBIT_INNER = 64;
const ORBIT_OUTER = 94;
const POINTS_PER_LAP = 72;
const WALKER_RADIUS = 3.5;
/**
 * The grid of weeks, a square for each and drawn to the pixel: a row a year on
 * a wide screen, and half a year on a narrow one, where it stands tall instead.
 */
const WEEK_GAP = 2;
const WIDE_WEEKS = { columns: 52, size: 7 };
const NARROW_WEEKS = { columns: 26, size: 6 };
/** A square of the grid's legend, a touch bigger than the grid's own so it reads at text size. */
const SWATCH_SIZE = 8;
/**
 * The weekends, one calendar tile each, flipping past the line where each one
 * is crossed out. They move the way the other drawings do: up to speed over
 * this share of the run, steady through the middle, and easing to a stop on
 * the last over this share.
 */
const WEEKENDS_SPEED_UP = 0.15;
const WEEKENDS_SLOW_DOWN = 0.4;
/** Each stroke of a cross is drawn this long, the second this long after the first. */
const CROSS_MS = 210;
const CROSS_LATE_MS = 125;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 76;
const TILE_PITCH = 72;
/** The tiles drawn either side of the line, enough to run past both faded edges. */
const TILE_REACH = 5;
/** How far in from the tile's corners the cross is drawn. */
const CROSS_INSET = 12;
/** The strip fades out at both ends, so the tiles come from and go nowhere in particular. */
const STRIP_MASK = 'linear-gradient(to right, transparent, black 25%, black 75%, transparent)';
const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const SATURDAY = 6;
/** 1 January 2000 was a Saturday: the tiles read the names of the two days off it. */
const A_SATURDAY = Date.UTC(2000, 0, 1);
/** The walk to the Moon, in the drawing's own 320 by 180 box: the Earth low on the left, the Moon high on the right. */
const SKY_WIDTH = 320;
const SKY_HEIGHT = 180;
const SKY_EARTH = { radius: 18, x: 38, y: 146 };
const SKY_MOON = { radius: 10, x: 288, y: 34 };
/** The way bows up off the Earth like a launch, toward this point, and is drawn as a run of points. */
const WAY_BEND = { x: 96, y: 28 };
const WAY_STEPS = 160;
/** The middle of the way: a line marks it, and only past it does the sentence say halfway. */
const HALFWAY = 0.5;
const HALF_TICK_REACH = 5;
/** The walker's strides on the way out, a whole number so the legs land apart where it stops. */
const STRIDES = 7;
const STRIDE = 2.4;
const WALKER_HEAD = 12;
const WALKER_HEAD_RADIUS = 2.2;
/** The media query a reader who asked for less motion matches. */
const LESS_MOTION = '(prefers-reduced-motion: reduce)';
/** The scroll cue: a short track at the foot of the first beat, and the drop that runs down it. */
const CUE_HEIGHT = 48;
const CUE_DROP = 12;
/** The word over the track, set solid so the cue's height is known to the pixel. */
const CUE_LABEL = 11;
const CUE_TRACKING = '0.2em';
/** Where the cue stands, just over the progress rail. */
const CUE_BOTTOM = `calc(${spacing.s8} + ${spacing.s4})`;

/** The drop falls from above the track to below it, and starts over. */
const cueFall = keyframes({
  from: { transform: `translateY(-${CUE_DROP}px)` },
  to: { transform: `translateY(${CUE_HEIGHT}px)` },
});

const styles = create({
  // One sentence of the story. They all stand in the same cell, so the stage
  // is as tall as the tallest and nothing moves when one takes over from the
  // next. A beat leaves in a quiet fade, all of it at once; it comes on with
  // its parts rising into place one after another. With less motion they
  // stand one under the other instead.
  beat: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    gridArea: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: '1 / 1',
    },
    opacity: {
      '@media (prefers-reduced-motion: reduce)': 1,
      default: 0,
    },
    pointerEvents: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: 'none',
    },
    textAlign: 'center',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.quick,
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.inOut,
    width: '100%',
  },
  // The beat on the stage, and in the pointer's way.
  beatOn: {
    opacity: 1,
    pointerEvents: 'auto',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.verySlow,
    },
  },
  beats: {
    alignItems: 'center',
    display: 'grid',
    justifyItems: 'center',
    rowGap: {
      '@media (prefers-reduced-motion: reduce)': spacing.s16,
      default: 0,
    },
    width: '100%',
  },
  // The way on, pinned with the stage just over the progress rail. It stands
  // while the first beat does and trades places with the rail as the second
  // comes on, so the two are never seen whole at once. With less motion the
  // beats already stand one under the other, and there is nothing to point at.
  cue: {
    alignItems: 'center',
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'flex',
    },
    flexDirection: 'column',
    gap: spacing.s2,
    insetBlockEnd: CUE_BOTTOM,
    insetInlineStart: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translateX(-50%)',
  },
  cueDrop: {
    animationDuration: '1.8s',
    animationIterationCount: 'infinite',
    animationName: cueFall,
    animationTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
    backgroundColor: accent.base,
    display: 'block',
    height: CUE_DROP,
    width: '100%',
  },
  // The word over the track, small and spaced out. The space after its last
  // letter is taken back, so the word stands centred over the track.
  cueLabel: {
    color: colors.muted,
    fontSize: CUE_LABEL,
    letterSpacing: CUE_TRACKING,
    lineHeight: 1,
    marginInlineEnd: `-${CUE_TRACKING}`,
    textTransform: 'uppercase',
  },
  cueTrack: {
    backgroundColor: colors.border,
    borderRadius: 999,
    display: 'block',
    height: CUE_HEIGHT,
    overflow: 'hidden',
    width: 2,
  },
  // The cross a weekend gets as it passes the line, in red, corner to corner
  // over the whole tile.
  cross: {
    fill: 'none',
    height: '100%',
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: 'absolute',
    stroke: colors.error,
    strokeLinecap: 'round',
    strokeWidth: 2,
    width: '100%',
  },
  // Each stroke of the cross is drawn along its length, the second just after
  // the first, the way a hand crosses something out.
  crossStroke: {
    opacity: 0,
    strokeDasharray: 1,
    strokeDashoffset: 1,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: `${CROSS_MS}ms`,
    },
    transitionProperty: 'stroke-dashoffset',
    transitionTimingFunction: easing.smoothOut,
  },
  crossStrokeLate: {
    transitionDelay: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: `${CROSS_LATE_MS}ms`,
    },
  },
  crossStrokeOn: {
    opacity: 1,
    strokeDashoffset: 0,
  },
  // A drawing and its legend, under each other.
  drawing: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    width: '100%',
  },
  // A figure in a sentence, in the story's orange and in even figures.
  figure: {
    color: accent.base,
    fontVariantNumeric: 'tabular-nums',
  },
  globe: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  globeFaint: {
    opacity: 0.5,
  },
  // Out of sight: the cue past the first beat, and the rail on the first and the last.
  gone: {
    opacity: 0,
    visibility: 'hidden',
  },
  // The page's graph paper, pinned with the stage and as wide as the window,
  // so the story is told on it from the first beat to the last.
  grid: {
    height: '100%',
    insetInlineEnd: 'auto',
    insetInlineStart: 'calc(50% - 50vw)',
    maskImage: GRID_MASK,
    WebkitMaskImage: GRID_MASK,
    width: '100vw',
  },
  // One key, drawn the way a key is: a hairline box around the arrow on it.
  // It is a button as well, and a press on it moves the story as the key does.
  keycap: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: {
      ':hover': colors.fg,
      default: 'inherit',
    },
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    height: 18,
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
    width: 18,
  },
  // What the two arrows do, in the corner of the window, for as long as the
  // story is on. It is a keyboard's line: a reader who swipes has no keys to
  // be told about, and never sees it. With less motion nothing is pinned and
  // the arrows scroll the page as they always do.
  keys: {
    alignItems: 'center',
    color: colors.muted,
    display: {
      '@media (hover: none)': 'none',
      '@media (max-width: 767px)': 'none',
      '@media (pointer: coarse)': 'none',
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'flex',
    },
    fontSize: 12,
    gap: spacing.s1,
    insetBlockEnd: spacing.s4,
    insetInlineEnd: spacing.s4,
    lineHeight: 1,
    position: 'fixed',
    transitionDuration: duration.slow,
    transitionProperty: 'opacity, visibility',
    transitionTimingFunction: easing.smoothOut,
    zIndex: 30,
  },
  // What a drawing's marks stand for, small and quiet under it. It fades in
  // as the drawing starts, and is gone again once its beat has faded out.
  legend: {
    alignItems: 'center',
    color: colors.muted,
    columnGap: spacing.s4,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: 12,
    justifyContent: 'center',
    lineHeight: 1.4,
    margin: 0,
    opacity: {
      '@media (prefers-reduced-motion: reduce)': 1,
      default: 0,
    },
    rowGap: spacing.s1,
    transitionDelay: duration.quick,
    transitionDuration: '0s',
    transitionProperty: 'opacity',
  },
  legendItem: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s2,
  },
  legendOn: {
    opacity: 1,
    transitionDelay: `${drawing.delay}s`,
    transitionDuration: duration.slow,
    transitionTimingFunction: easing.smoothOut,
  },
  // Large and light: the story is read one sentence a screen, so each one is
  // set as big as the first screen's claim and a weight under it.
  line: {
    color: colors.fg,
    fontSize: {
      '@media (min-width: 640px)': 'clamp(36px, 4.6vw, 56px)',
      default: 'clamp(28px, 7.5vw, 36px)',
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: LINE_HEIGHT,
    margin: 0,
    maxWidth: 720,
    textWrap: 'balance',
  },
  // The small i after a figure, a breath away from the word before it.
  mark: {
    display: 'inline-flex',
    marginInlineStart: '0.3em',
    verticalAlign: 'middle',
  },
  // The i and the word before it, never split across two lines.
  markWord: {
    whiteSpace: 'nowrap',
  },
  // A stretch the sentence turns on: the figures' orange, at the sentence's
  // own weight.
  marked: {
    color: accent.base,
  },
  orbit: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    width: {
      '@media (min-width: 640px)': 200,
      default: 160,
    },
  },
  orbitLine: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  // A part of a beat: its drawing, its sentence, a line of the turn. Off the
  // stage it waits a little low and out of focus, put there once its beat has
  // faded out, so the fade is never seen to move.
  part: {
    filter: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: `blur(${blur.medium})`,
    },
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: `translateY(${distance.medium})`,
    },
    transitionDelay: duration.quick,
    transitionDuration: '0s',
    transitionProperty: 'transform, filter',
  },
  // On the stage it rises into focus, a step after the part over it.
  partOn: {
    filter: 'none',
    transform: 'none',
    transitionDelay: '0s',
    transitionDuration: duration.verySlow,
    transitionTimingFunction: easing.inOut,
  },
  partSecond: {
    transitionDelay: duration.stagger,
  },
  // How far along the story is, a hairline at the foot of the stage. It fades
  // out on the last beat, where the turn stands on its own, and back in on
  // the way up.
  rail: {
    backgroundColor: colors.border,
    borderRadius: 999,
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    height: 2,
    insetBlockEnd: spacing.s8,
    insetInlineStart: '50%',
    overflow: 'hidden',
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: 96,
  },
  railFill: {
    backgroundColor: accent.base,
    display: 'block',
    height: '100%',
    transformOrigin: 'left',
    width: '100%',
  },
  // The Earth and the Moon, as wide as the column on a phone.
  sky: {
    display: 'block',
    height: 'auto',
    maxWidth: 400,
    overflow: 'visible',
    width: '100%',
  },
  // The screen the story is told on. It stands still while the section
  // scrolls under it, and clears the brand bar at the top.
  stage: {
    alignItems: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    height: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: firstThatWorks('100dvh', '100svh', '100vh'),
    },
    insetBlockStart: 0,
    justifyContent: 'center',
    paddingBlockEnd: {
      '@media (prefers-reduced-motion: reduce)': 0,
      default: spacing.s16,
    },
    paddingBlockStart: {
      '@media (prefers-reduced-motion: reduce)': spacing.s16,
      default: `calc(${spacing.s16} + ${wip.height})`,
    },
    position: {
      '@media (prefers-reduced-motion: reduce)': 'relative',
      default: 'sticky',
    },
  },
  // Where the page comes to rest: a mark a screen apart for each beat, and
  // one at the story's foot, where the page past it takes over. None of them
  // can be scrolled past, so a flick moves the story on by one beat however
  // hard it is. With less motion nothing is pinned and the page never snaps.
  snap: {
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    height: 1,
    insetInlineStart: 0,
    pointerEvents: 'none',
    position: 'absolute',
    scrollSnapAlign: 'start',
    scrollSnapStop: 'always',
    width: 1,
  },
  // The first beat rests at the very top of the page, with the strip over
  // the story in view.
  snapTop: {
    scrollMarginBlockStart: wip.height,
  },
  // The stage and the scroll it is pinned through: a screen for each beat,
  // the last of them the one the page carries the stage away in.
  story: {
    height: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: firstThatWorks(`${BEATS * 100}svh`, `${BEATS * 100}vh`),
    },
    position: 'relative',
    // Pinned, the stage clears the brand bar itself. Standing in the column,
    // a jump to the story stops short of it instead.
    scrollMarginBlockStart: {
      '@media (prefers-reduced-motion: reduce)': `calc(${spacing.s16} + ${wip.height})`,
      default: 0,
    },
  },
  // A square of the legend, drawn as the grid draws a week.
  swatch: {
    borderColor: colors.border,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'block',
    flexShrink: 0,
    height: SWATCH_SIZE,
    width: SWATCH_SIZE,
  },
  swatchSpent: {
    backgroundColor: accent.base,
    borderColor: accent.base,
  },
  // The cue and the rail trade places on the turn to the second beat and
  // back, one fading out over the same time the other fades in.
  swap: {
    transitionDuration: duration.slow,
    transitionProperty: 'opacity, visibility',
    transitionTimingFunction: easing.smoothOut,
  },
  // One weekend, a page off a desk calendar: the month over the two days. It
  // stands on the line at its own middle and is moved along from there.
  tile: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    insetBlockStart: 0,
    insetInlineStart: `calc(50% - ${TILE_WIDTH / 2}px)`,
    position: 'absolute',
    width: TILE_WIDTH,
  },
  tileDate: {
    color: colors.fg,
    fontSize: 18,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  },
  tileDay: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  tileDays: {
    alignItems: 'center',
    display: 'grid',
    flexGrow: 1,
    gridTemplateColumns: '1fr 1fr',
  },
  // The month, in a band of its own across the top, the way a calendar page has it.
  tileMonth: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 1,
    overflow: 'hidden',
    paddingBlock: spacing.s1,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  // A crossed-out weekend's dates step back under the cross.
  tileSpent: {
    opacity: 0.3,
  },
  tileWeekday: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: '0.06em',
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  // The first beat's sentence, alone on the first screen: larger than the
  // ones after it, and smaller on a short window. On a wide screen it reaches
  // past the column, twelve times its size across, so it breaks into three
  // lines rather than five.
  title: {
    alignSelf: 'stretch',
    fontSize: 'clamp(40px, min(10.5vw, 11vh), 88px)',
    letterSpacing: '-0.03em',
    lineHeight: 1.05,
    marginInline: `min(0px, 50% - min(6em, 50vw - ${spacing.s4}))`,
    maxWidth: 'none',
  },
  // The last beat, the sentence the story turns on: it is not the reader, it
  // is the apps. Larger than the sentences before it, and wider than the
  // column on a wide screen, so each of its two lines stays one line.
  turn: {
    alignSelf: 'stretch',
    fontSize: {
      '@media (min-width: 640px)': 'clamp(40px, 5vw, 64px)',
      default: 'clamp(32px, 9vw, 40px)',
    },
    marginInline: `min(0px, 50% - min(8.5em, 50vw - ${spacing.s4}))`,
    maxWidth: 'none',
  },
  // A line of the turn, a part that fades in as it rises, so the second line
  // can wait for the first. With less motion both stand from the start.
  turnLine: {
    display: 'block',
    opacity: {
      '@media (prefers-reduced-motion: reduce)': 1,
      default: 0,
    },
    transitionProperty: 'transform, filter, opacity',
  },
  turnLineOn: {
    opacity: 1,
  },
  // The second line comes on once the first has, so the two are read apart.
  turnLineSecond: {
    transitionDelay: duration.verySlow,
  },
  walker: {
    fill: accent.base,
  },
  // The stick figure walking to the Moon, in the walk's orange.
  walkerFigure: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.4,
  },
  // The way to the Moon, a dotted line: faint all the way, and orange as far
  // as the hours walk it.
  way: {
    fill: 'none',
    opacity: 0.45,
    stroke: colors.muted,
    strokeDasharray: '0 6',
    strokeLinecap: 'round',
    strokeWidth: 2,
  },
  wayHalf: {
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1,
  },
  wayWalked: {
    opacity: 1,
    stroke: accent.base,
  },
  // A week still to come: a faint square, outlined.
  week: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
  },
  // The weekends and their legend, under each other.
  weekends: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    width: '100%',
  },
  // The line the weekends are stamped at, showing above and below the strip
  // and in the gaps between the tiles, which hide it where they pass.
  weekendsLine: {
    backgroundColor: accent.base,
    insetBlock: 0,
    insetInlineStart: '50%',
    position: 'absolute',
    width: 1,
  },
  weekendsStrip: {
    height: TILE_HEIGHT,
    maskImage: STRIP_MASK,
    overflow: 'hidden',
    position: 'relative',
    WebkitMaskImage: STRIP_MASK,
  },
  weekendsTrack: {
    boxSizing: 'border-box',
    maxWidth: 520,
    paddingBlock: spacing.s2,
    position: 'relative',
    width: '100%',
  },
  // The grid drawn at its own size, never scaled, so every square stays sharp.
  weeks: {
    flexShrink: 0,
  },
  weeksNarrow: {
    display: {
      '@media (min-width: 640px)': 'none',
      default: 'block',
    },
  },
  // A week the screen takes: filled in orange.
  weekSpent: {
    fill: accent.base,
  },
  weeksWide: {
    display: {
      '@media (min-width: 640px)': 'block',
      default: 'none',
    },
  },
});

function subscribeLessMotion(onChange: () => void): () => void {
  const query = window.matchMedia(LESS_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function prefersLessMotion(): boolean {
  return window.matchMedia(LESS_MOTION).matches;
}

function lessMotionOnServer(): boolean {
  return false;
}

/**
 * Whether the reader asked for less motion. The server cannot know, so the
 * page is first drawn the way the server drew it and changes once it has come
 * alive, rather than drawing on top of markup the server never sent.
 */
export function useLessMotion(): boolean {
  return useSyncExternalStore(subscribeLessMotion, prefersLessMotion, lessMotionOnServer);
}

/** Whether an event comes from inside a dialog, which keeps its own wheel and keys. */
function inDialog(target: EventTarget | null): boolean {
  return ((target as Element | null)?.closest('[role="dialog"]') ?? null) !== null;
}

/** A figure's placeholder: its index, between two slot marks. */
export function slot(index: number): string {
  return `${SLOT}${index}${SLOT}`;
}

/**
 * Words with figures in them. Split on the slot mark, every other piece is a
 * figure's index and the pieces between are the words around it.
 */
function Words({ figures, text }: { figures: ReadonlyArray<ReactNode>; text: string }) {
  return text
    .split(SLOT)
    .map((piece, index) => (
      <Fragment key={index}>{index % 2 === 1 ? figures[Number(piece)] : piece}</Fragment>
    ));
}

/**
 * A sentence with figures in it, and the small i that says how it is counted.
 * Split on the marks, every other stretch is one the sentence turns on, set in
 * the figures' orange. The i ends the sentence and holds on to its last word:
 * a browser would otherwise start a line with it.
 */
export function Sentence({
  figures,
  mark,
  text,
}: {
  figures: ReadonlyArray<ReactNode>;
  mark: ReactNode;
  text: string;
}) {
  const stretches = text.split(MARKED);
  const last = stretches.length - 1;
  return stretches.map((stretch, index) => {
    const cut = index === last ? stretch.search(LAST_WORD) : stretch.length;
    const words = (
      <>
        <Words figures={figures} text={stretch.slice(0, cut)} />
        {index === last ? (
          <span {...props(styles.markWord)}>
            <Words figures={figures} text={stretch.slice(cut)} />
            {mark}
          </span>
        ) : null}
      </>
    );
    return index % 2 === 1 ? (
      <span key={index} {...props(styles.marked)}>
        {words}
      </span>
    ) : (
      <Fragment key={index}>{words}</Fragment>
    );
  });
}

/** A figure in a sentence, printed the way the page's language prints it. */
export function Figure({ decimals = 0, value }: { decimals?: number; value: number }) {
  const format = new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
  return <span {...props(styles.figure)}>{format.format(value)}</span>;
}

/** The small i after a figure, and how it is counted. */
export function Mark({
  children,
  label,
  onOpenChange,
}: {
  children: ReactNode;
  label: string;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <span {...props(styles.mark)}>
      <InfoTip label={label} onOpenChange={onOpenChange}>
        {children}
      </InfoTip>
    </span>
  );
}

/**
 * How far a drawing has played, from 0 to 1: over `seconds` each time its beat
 * comes on, once the sentence has risen into place, and back to the start
 * once the beat has faded out, so it plays again when the reader comes back
 * to it. It stands done until the page has come alive, and for good with less
 * motion.
 */
function usePlayed(
  run: boolean,
  seconds: number,
  ease: [number, number, number, number] | 'linear',
): MotionValue<number> {
  const reduced = useLessMotion();
  const played = useMotionValue(1);
  useEffect(() => {
    if (reduced) {
      played.set(1);
      return;
    }
    if (!run) {
      const timer = setTimeout(() => played.set(0), FADE_OUT_MS);
      return () => clearTimeout(timer);
    }
    played.set(0);
    const controls = animate(played, 1, { delay: drawing.delay, duration: seconds, ease });
    return () => controls.stop();
  }, [ease, played, reduced, run, seconds]);
  return played;
}

/** Where the walk is `t` of the way along: one lap a trip, spiralling out. */
function orbitPoint(laps: number, t: number): { x: number; y: number } {
  const angle = t * laps * 2 * Math.PI - Math.PI / 2;
  const radius = ORBIT_INNER + (ORBIT_OUTER - ORBIT_INNER) * t;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

/**
 * The walk as far as `t` of the way along, as one path starting at the top and
 * going clockwise. It ends on `orbitPoint(laps, t)`, where the walker stands,
 * so the line and the walker are always the same distance along.
 */
function orbitPath(laps: number, t: number): string {
  if (t <= 0) {
    return '';
  }
  const steps = Math.max(1, laps) * POINTS_PER_LAP;
  const behind = Math.min(steps, Math.floor(t * steps));
  return Array.from({ length: behind + 2 }, (_, step) => {
    const { x, y } = orbitPoint(laps, step > behind ? t : step / steps);
    return `${step === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

/**
 * A plain globe, and the walks around it drawn once the beat comes on: one lap
 * for every trip around the Earth, with the walker at the head of the line.
 * The line and the walker are both drawn from how far it has walked, so the
 * walker never runs ahead of the line or falls behind it. With less motion
 * the walk stands drawn whole.
 */
function Orbit({
  laps,
  style,
  walked,
}: {
  laps: number;
  style: StyleXStyles;
  walked: MotionValue<number>;
}) {
  const reduced = useLessMotion();
  const line = useTransform(walked, (t) => orbitPath(laps, t));
  const walkerX = useTransform(walked, (t) => orbitPoint(laps, t).x);
  const walkerY = useTransform(walked, (t) => orbitPoint(laps, t).y);
  const walkerOpacity = useTransform(walked, [0, 0.02], [0, 1]);
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${BOX} ${BOX}`} {...props(styles.orbit, style)}>
      <circle cx={CENTER} cy={CENTER} r={GLOBE_RADIUS} {...props(styles.globe)} />
      <ellipse
        cx={CENTER}
        cy={CENTER}
        rx={GLOBE_RADIUS * MERIDIAN_SQUASH}
        ry={GLOBE_RADIUS}
        {...props(styles.globe, styles.globeFaint)}
      />
      <ellipse
        cx={CENTER}
        cy={CENTER}
        rx={GLOBE_RADIUS}
        ry={GLOBE_RADIUS * EQUATOR_SQUASH}
        {...props(styles.globe, styles.globeFaint)}
      />
      <motion.path d={reduced ? orbitPath(laps, 1) : line} {...props(styles.orbitLine)} />
      {reduced ? null : (
        <motion.circle
          cx={walkerX}
          cy={walkerY}
          r={WALKER_RADIUS}
          {...props(styles.walker)}
          style={{ opacity: walkerOpacity }}
        />
      )}
    </svg>
  );
}

/**
 * The next twenty years drawn a week a square, and the screen's share of them
 * filled in orange, a row at a time. However many weeks it holds, it is three
 * rectangles painted with a square pattern.
 */
function WeekGrid({
  filled,
  layout,
  style,
}: {
  filled: number;
  layout: { columns: number; size: number };
  style: StyleXStyles;
}) {
  const id = useId();
  const { columns, size } = layout;
  const pitch = size + WEEK_GAP;
  const width = columns * pitch - WEEK_GAP;
  const height = Math.ceil(HORIZON_WEEKS / columns) * pitch - WEEK_GAP;
  const rows = Math.floor(filled / columns);
  const week = `${id}-week`;
  const spent = `${id}-spent`;
  return (
    <svg
      aria-hidden="true"
      height={height}
      shapeRendering="crispEdges"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      {...props(styles.weeks, style)}
    >
      <defs>
        <pattern height={pitch} id={week} patternUnits="userSpaceOnUse" width={pitch}>
          <rect height={size - 1} width={size - 1} x={0.5} y={0.5} {...props(styles.week)} />
        </pattern>
        <pattern height={pitch} id={spent} patternUnits="userSpaceOnUse" width={pitch}>
          <rect height={size} width={size} {...props(styles.weekSpent)} />
        </pattern>
      </defs>
      <rect fill={`url(#${week})`} height={height} width={width} />
      <rect fill={`url(#${spent})`} height={rows * pitch} width={width} />
      <rect
        fill={`url(#${spent})`}
        height={pitch}
        width={(filled % columns) * pitch}
        y={rows * pitch}
      />
    </svg>
  );
}

/**
 * The grid of weeks, filled as far as it has played, and what its squares
 * stand for under it. It is drawn wide and narrow, and the screen shows the
 * one that fits. With less motion it stands filled.
 */
function Weeks({
  drawn,
  on,
  spent,
  style,
}: {
  drawn: MotionValue<number>;
  on: boolean;
  spent: number;
  style: StyleXStyles;
}) {
  const reduced = useLessMotion();
  const [filled, setFilled] = useState(0);
  useMotionValueEvent(drawn, 'change', (latest) => setFilled(Math.round(latest * spent)));
  const shown = reduced ? spent : filled;
  return (
    <div {...props(styles.drawing, style)}>
      <WeekGrid filled={shown} layout={WIDE_WEEKS} style={styles.weeksWide} />
      <WeekGrid filled={shown} layout={NARROW_WEEKS} style={styles.weeksNarrow} />
      <p aria-hidden="true" {...props(styles.legend, on && styles.legendOn)}>
        <span {...props(styles.legendItem)}>
          <span {...props(styles.swatch)} />
          {m.home_cost_weeks_legend()}
        </span>
        <span {...props(styles.legendItem)}>
          <span {...props(styles.swatch, styles.swatchSpent)} />
          {m.home_cost_weeks_legend_screen()}
        </span>
      </p>
    </div>
  );
}

/**
 * How many weekends have passed the line `t` of the way through: gathering
 * speed at first, steady through the middle, and slowing to a stop on the
 * last, with no jolt where one stretch hands over to the next.
 */
function weekendsBy(t: number): number {
  const up = WEEKENDS_SPEED_UP;
  const down = WEEKENDS_SLOW_DOWN;
  const speed = 1 / (1 - up / 2 - (2 * down) / 3);
  const share =
    t < up
      ? (speed * t * t) / (2 * up)
      : t < 1 - down
        ? speed * (t - up / 2)
        : 1 - (speed * (1 - t) ** 3) / (3 * down * down);
  return (HORIZON_WEEKS - 0.5) * share;
}

/** A store that never changes: the calendar is read once, when the page comes alive. */
function unchanging(): () => void {
  return () => {};
}

/** The coming Saturday, as midnight UTC on its date, so every one after it is a whole week on. */
function comingSaturday(today: Date): number {
  const ahead = (SATURDAY - today.getDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
}

/**
 * Every weekend in the next twenty years, a calendar tile each, flipping past
 * a line once the beat comes on. Each one is crossed out as it passes. With
 * less motion they stand all crossed out.
 */
function Weekends({
  drawn,
  on,
  style,
}: {
  drawn: MotionValue<number>;
  on: boolean;
  style: StyleXStyles;
}) {
  const reduced = useLessMotion();
  const [passed, setPassed] = useState(0);
  // The tiles start this weekend, which only the reader's own clock knows, so
  // the server leaves the dates blank and the page fills them in.
  const first = useSyncExternalStore(
    unchanging,
    () => comingSaturday(new Date()),
    () => null,
  );
  useMotionValueEvent(drawn, 'change', (latest) => setPassed(weekendsBy(latest)));

  const at = reduced ? weekendsBy(1) : passed;
  const stamped = Math.round(at);
  const locale = getLocale();
  const month = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  });
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' });
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });
  const from = Math.max(0, stamped - TILE_REACH);
  const to = Math.min(HORIZON_WEEKS - 1, stamped + TILE_REACH);

  return (
    <div aria-hidden="true" {...props(styles.weekends, style)}>
      <div {...props(styles.weekendsTrack)}>
        <span {...props(styles.weekendsLine)} />
        <div {...props(styles.weekendsStrip)}>
          {Array.from({ length: to - from + 1 }, (_, step) => {
            const index = from + step;
            const saturday = first === null ? null : first + index * DAYS_PER_WEEK * DAY_MS;
            const spent = index < stamped;
            return (
              <div
                key={index}
                style={{ transform: `translateX(${(index + 0.5 - at) * TILE_PITCH}px)` }}
                {...props(styles.tile)}
              >
                <span {...props(styles.tileMonth, spent && styles.tileSpent)}>
                  {saturday === null ? null : month.format(saturday)}
                </span>
                <span {...props(styles.tileDays, spent && styles.tileSpent)}>
                  {[0, 1].map((day) => (
                    <span key={day} {...props(styles.tileDay)}>
                      <span {...props(styles.tileWeekday)}>
                        {weekday.format(A_SATURDAY + day * DAY_MS)}
                      </span>
                      <span {...props(styles.tileDate)}>
                        {saturday === null ? null : date.format(saturday + day * DAY_MS)}
                      </span>
                    </span>
                  ))}
                </span>
                <svg viewBox={`0 0 ${TILE_WIDTH} ${TILE_HEIGHT}`} {...props(styles.cross)}>
                  <path
                    d={`M${CROSS_INSET} ${CROSS_INSET}L${TILE_WIDTH - CROSS_INSET} ${TILE_HEIGHT - CROSS_INSET}`}
                    pathLength={1}
                    {...props(styles.crossStroke, spent && styles.crossStrokeOn)}
                  />
                  <path
                    d={`M${TILE_WIDTH - CROSS_INSET} ${CROSS_INSET}L${CROSS_INSET} ${TILE_HEIGHT - CROSS_INSET}`}
                    pathLength={1}
                    {...props(
                      styles.crossStroke,
                      styles.crossStrokeLate,
                      spent && styles.crossStrokeOn,
                    )}
                  />
                </svg>
              </div>
            );
          })}
        </div>
      </div>
      <p {...props(styles.legend, on && styles.legendOn)}>{m.home_cost_weekends_legend()}</p>
    </div>
  );
}

type Point = { x: number; y: number };

/** Where a body's surface faces a point: the way leaves the Earth and meets the Moon there. */
function surfaceToward(body: { radius: number; x: number; y: number }, point: Point): Point {
  const angle = Math.atan2(point.y - body.y, point.x - body.x);
  return { x: body.x + body.radius * Math.cos(angle), y: body.y + body.radius * Math.sin(angle) };
}

const WAY_START = surfaceToward(SKY_EARTH, WAY_BEND);
const WAY_END = surfaceToward(SKY_MOON, WAY_BEND);
/** The way from the Earth to the Moon as a run of points, bowed toward the bend. */
const WAY: ReadonlyArray<Point> = Array.from({ length: WAY_STEPS + 1 }, (_, step) => {
  const t = step / WAY_STEPS;
  const start = (1 - t) ** 2;
  const bend = 2 * (1 - t) * t;
  const end = t ** 2;
  return {
    x: start * WAY_START.x + bend * WAY_BEND.x + end * WAY_END.x,
    y: start * WAY_START.y + bend * WAY_BEND.y + end * WAY_END.y,
  };
});
/** How far along the way each of its points is. */
const WAY_LENGTHS: ReadonlyArray<number> = WAY.reduce<Array<number>>((lengths, point, index) => {
  const previous = WAY[index - 1];
  lengths.push(
    previous === undefined
      ? 0
      : (lengths[index - 1] ?? 0) + Math.hypot(point.x - previous.x, point.y - previous.y),
  );
  return lengths;
}, []);
const WAY_LENGTH = WAY_LENGTHS.at(-1) ?? 0;

/** A run of points as one path. */
function through(points: ReadonlyArray<Point>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

/** The point `share` of the way along, and how many of the way's points lie behind it. */
function wayAt(share: number): { behind: number; point: Point } {
  const along = Math.min(1, Math.max(0, share)) * WAY_LENGTH;
  const behind = Math.max(
    1,
    WAY_LENGTHS.findIndex((length) => length >= along),
  );
  const from = WAY[behind - 1] ?? WAY_START;
  const to = WAY[behind] ?? WAY_END;
  const fromLength = WAY_LENGTHS[behind - 1] ?? 0;
  const span = (WAY_LENGTHS[behind] ?? fromLength) - fromLength;
  const t = span > 0 ? (along - fromLength) / span : 0;
  return { behind, point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t } };
}

/** The way walked, from the Earth to the point `share` of the way along. */
function walkedTo(share: number): string {
  const { behind, point } = wayAt(share);
  return through([...WAY.slice(0, behind), point]);
}

const WAY_PATH = through(WAY);
/** The short line across the way at its middle, square to it. */
const HALF_TICK = (() => {
  const { point } = wayAt(HALFWAY);
  const before = wayAt(HALFWAY - 0.01).point;
  const after = wayAt(HALFWAY + 0.01).point;
  const length = Math.hypot(after.x - before.x, after.y - before.y);
  const across = {
    x: ((before.y - after.y) / length) * HALF_TICK_REACH,
    y: ((after.x - before.x) / length) * HALF_TICK_REACH,
  };
  return through([
    { x: point.x - across.x, y: point.y - across.y },
    { x: point.x + across.x, y: point.y + across.y },
  ]);
})();

/**
 * The walker standing with its feet on a point of the way: legs `stride`
 * either side, arms swinging the other way, in the drawing's units. Its head
 * is drawn on its own, `WALKER_HEAD` over the point.
 */
function walkerAt({ x, y }: Point, stride: number): string {
  const arm = stride * 0.8;
  return [
    `M${x - stride} ${y} L${x} ${y - 4} L${x + stride} ${y}`,
    `M${x} ${y - 4} L${x} ${y - 9.5}`,
    `M${x + arm} ${y - 5.5} L${x} ${y - 8.5} L${x - arm} ${y - 5.5}`,
  ].join(' ');
}

/** The legs' spread `walked` of the way out, landing wide apart where the walk stops. */
function strideAt(walked: number): number {
  return STRIDE * Math.cos((1 - walked) * STRIDES * 2 * Math.PI);
}

/**
 * The Earth, the Moon and the dotted way between them. The hours walk the way
 * once the beat comes on, as far as they reach, and the walker stops there
 * with the rest of the way faint ahead of it. With less motion the walk
 * stands done.
 */
function Moon({
  share,
  style,
  walked,
}: {
  share: number;
  style: StyleXStyles;
  walked: MotionValue<number>;
}) {
  const reduced = useLessMotion();
  const reach = Math.min(1, share);
  const way = useTransform(walked, (latest) => walkedTo(latest * reach));
  const figure = useTransform(walked, (latest) =>
    walkerAt(wayAt(latest * reach).point, strideAt(latest)),
  );
  const headX = useTransform(walked, (latest) => wayAt(latest * reach).point.x);
  const headY = useTransform(walked, (latest) => wayAt(latest * reach).point.y - WALKER_HEAD);
  const end = wayAt(reach).point;
  return (
    <div {...props(styles.drawing, style)}>
      <svg aria-hidden="true" viewBox={`0 0 ${SKY_WIDTH} ${SKY_HEIGHT}`} {...props(styles.sky)}>
        <circle cx={SKY_EARTH.x} cy={SKY_EARTH.y} r={SKY_EARTH.radius} {...props(styles.globe)} />
        <ellipse
          cx={SKY_EARTH.x}
          cy={SKY_EARTH.y}
          rx={SKY_EARTH.radius * MERIDIAN_SQUASH}
          ry={SKY_EARTH.radius}
          {...props(styles.globe, styles.globeFaint)}
        />
        <ellipse
          cx={SKY_EARTH.x}
          cy={SKY_EARTH.y}
          rx={SKY_EARTH.radius}
          ry={SKY_EARTH.radius * EQUATOR_SQUASH}
          {...props(styles.globe, styles.globeFaint)}
        />
        <circle cx={SKY_MOON.x} cy={SKY_MOON.y} r={SKY_MOON.radius} {...props(styles.globe)} />
        <circle
          cx={SKY_MOON.x - 3}
          cy={SKY_MOON.y - 2}
          r={2.5}
          {...props(styles.globe, styles.globeFaint)}
        />
        <circle
          cx={SKY_MOON.x + 3.5}
          cy={SKY_MOON.y + 3.5}
          r={1.5}
          {...props(styles.globe, styles.globeFaint)}
        />
        <path d={WAY_PATH} {...props(styles.way)} />
        <path d={HALF_TICK} {...props(styles.wayHalf)} />
        <motion.path d={reduced ? walkedTo(reach) : way} {...props(styles.way, styles.wayWalked)} />
        <motion.path d={reduced ? walkerAt(end, STRIDE) : figure} {...props(styles.walkerFigure)} />
        <motion.circle
          cx={reduced ? end.x : headX}
          cy={reduced ? end.y - WALKER_HEAD : headY}
          r={WALKER_HEAD_RADIUS}
          {...props(styles.walker)}
        />
      </svg>
    </div>
  );
}

/**
 * Act one: what the average day costs, told one sentence a screen. The stage
 * stands pinned while the section scrolls under it, the page comes to rest on
 * one beat at a time, and each beat's drawing plays as it comes on. It ends
 * on the turn: it is not the reader's willpower, it is the apps.
 */
export function CostStory({ id }: { id: string }) {
  const story = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Where the page comes to rest for each beat, and past the story's foot.
  const rests = useRef<Array<HTMLSpanElement | null>>([]);
  // A beat on or back, as a gesture moves the story, for the keys in the corner.
  const stepper = useRef<(by: number) => void>(() => {});
  const keys = useRef<HTMLDivElement>(null);
  const reduced = useLessMotion();
  const seen = useInView(stage, { amount: SEEN });
  const { scrollYProgress } = useScroll({ offset: ['start start', 'end end'], target: story });
  const [active, setActive] = useState(0);
  // The page has gone on past the last beat, and the story is over.
  const [told, setTold] = useState(false);
  const on = (index: number) => seen && active === index;
  const weeksDrawn = usePlayed(on(WEEKS_BEAT), drawing.weeks, SMOOTH_OUT);
  const weekendsDrawn = usePlayed(on(WEEKENDS_BEAT), drawing.weekends, 'linear');
  const walked = usePlayed(on(EARTH_BEAT), drawing.earth, SMOOTH_OUT);
  const moonWalked = usePlayed(on(MOON_BEAT), drawing.moon, SMOOTH_OUT);

  const metrics = heroMetrics(AVERAGE_HOURS);
  const amountOf = (key: string) => metrics.find((metric) => metric.key === key)?.amount ?? 0;
  const earth = amountOf('earth');
  // The waking years, as the page prints them.
  const years = Number(formatYears(AVERAGE_HOURS));
  const number = new Intl.NumberFormat(getLocale());
  const toMoon = moonShare(AVERAGE_HOURS);
  const toMoonPercent = Math.round(toMoon * 100);

  // The beat whose resting place the page is nearest, so a beat takes over
  // from the last halfway through the page's move from one to the next.
  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setActive(Math.round(latest * (BEATS - 1)));
  });

  // The page rests on one beat at a time while the story is on, and lets go
  // once the stage has gone up and away, so the rest of the page scrolls the
  // way it always does. Coming back up, it takes hold again as the last beat
  // comes to rest. Touch, space and the page keys snap from one rest to the
  // next on their own. The arrow keys, and a wheel or a trackpad a gesture at
  // a time, move the story a beat themselves: a browser snaps a wheel to
  // wherever the gesture happens to end, which after a light flick is the same
  // beat and after a hard one a beat too far. Nothing waits for a drawing: a
  // gesture always moves the story, whatever is playing.
  useEffect(() => {
    if (reduced) {
      return;
    }
    const root = document.documentElement;
    let holding = false;
    // The rest the story is moving the page to itself, if it is, the move,
    // and where the move last put the page. Snapping waits until it lands, so
    // the browser cannot pull the page back to the rest it is leaving.
    let aim: number | null = null;
    let drive: { stop: () => void } | undefined;
    let driven = 0;
    // The wheel gesture under way: how far it has pushed, when it last turned,
    // its strongest turn and the weakest since, and whether it has moved the
    // story already.
    let pushed = 0;
    let lastWheel = Number.NEGATIVE_INFINITY;
    let peak = 0;
    let ebb = 0;
    let spent = false;

    // How far the page is from each rest: under nought, the page has gone
    // past it; over, it has still to come.
    function offsets(): Array<number> {
      return rests.current.map((mark) =>
        mark === null
          ? Number.NaN
          : mark.getBoundingClientRect().top -
            Number.parseFloat(getComputedStyle(mark).scrollMarginBlockStart),
      );
    }

    function snap() {
      const type = holding && aim === null ? 'y mandatory' : '';
      if (root.style.scrollSnapType !== type) {
        root.style.scrollSnapType = type;
      }
    }

    function land() {
      aim = null;
      drive = undefined;
      snap();
    }

    // One beat on or back: from the rest the page is already on its way to,
    // so a gesture before the last one has landed still counts, or else from
    // where it stands.
    function step(by: number) {
      const away = offsets();
      const next =
        aim === null
          ? by > 0
            ? away.findIndex((offset) => offset > 1)
            : away.findLastIndex((offset) => offset < -1)
          : aim + by;
      const offset = away[next];
      if (offset === undefined || Number.isNaN(offset)) {
        return;
      }
      aim = next;
      snap();
      drive?.stop();
      driven = window.scrollY;
      drive = animate(driven, driven + offset, {
        duration: STEP_SECONDS,
        ease: SMOOTH_OUT,
        onComplete: land,
        onUpdate: (top) => {
          // The reader has taken the page back mid-move: it is theirs.
          if (Math.abs(window.scrollY - driven) > 2) {
            drive?.stop();
            land();
            return;
          }
          driven = top;
          window.scrollTo({ behavior: 'instant', top });
        },
      });
    }

    function update() {
      const away = offsets();
      const last = away[BEATS - 1];
      const foot = away[BEATS];
      if (last === undefined || foot === undefined) {
        return;
      }
      const bottom = window.scrollY >= root.scrollHeight - window.innerHeight - 1;
      if (holding && (foot <= 1 || bottom)) {
        holding = false;
      } else if (!holding && last >= -1) {
        holding = true;
        // A wheel still turning from below has brought the story back: the
        // rest of that gesture is spent on landing.
        if (performance.now() - lastWheel < WHEEL_QUIET_MS) {
          spent = true;
        }
      }
      setTold(last < -1);
      snap();
    }

    // Down is the next beat and up the one before, on every beat, the phone's
    // too, unless the key is being typed with or is already someone else's. A
    // key held down moves the story once. Past the last beat the keys are the
    // page's own again.
    function onKeyDown(event: KeyboardEvent) {
      const by = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (
        by === 0 ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        typingIn(event.target) ||
        inDialog(event.target) ||
        !((offsets()[BEATS - 1] ?? Number.NaN) >= -1)
      ) {
        return;
      }
      event.preventDefault();
      if (!event.repeat) {
        step(by);
      }
    }

    function onWheel(event: WheelEvent) {
      if (
        event.ctrlKey ||
        Math.abs(event.deltaY) < Math.abs(event.deltaX) ||
        inDialog(event.target)
      ) {
        return;
      }
      const now = performance.now();
      const turn = Math.abs(event.deltaY);
      // A new gesture: the wheel had stopped, or had all but died away and
      // has been flicked again.
      if (
        now - lastWheel > WHEEL_QUIET_MS ||
        (ebb < peak / WHEEL_EBB && turn > Math.max(ebb * WHEEL_SURGE, ebb + WHEEL_SURGE_PX))
      ) {
        pushed = 0;
        peak = 0;
        spent = false;
      }
      lastWheel = now;
      if (turn >= peak) {
        peak = turn;
        ebb = turn;
      } else {
        ebb = Math.min(ebb, turn);
      }
      if (spent) {
        event.preventDefault();
        return;
      }
      // Between the last beat and the foot, where the page has let go on the
      // way down and not yet taken hold on the way up, the wheel is still the
      // story's, and so is a turn up from the foot itself.
      const foot = offsets()[BEATS] ?? Number.NaN;
      if (!holding && !(foot > 1 || (foot >= -1 && event.deltaY < 0))) {
        return;
      }
      event.preventDefault();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? LINE_PX
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1;
      pushed += event.deltaY * unit;
      if (Math.abs(pushed) >= WHEEL_PUSH) {
        spent = true;
        step(Math.sign(pushed));
      }
    }

    update();
    stepper.current = step;
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      stepper.current = () => {};
      drive?.stop();
      root.style.scrollSnapType = '';
    };
  }, [reduced]);

  // A key in the corner that has focus when the story ends lets it go with
  // the line, so the arrows scroll the page from the first press on.
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    if (told && focused !== null && keys.current?.contains(focused) === true) {
      focused.blur();
    }
  }, [told]);

  // A beat reached from the keyboard is scrolled to, so what has focus is the
  // sentence on the stage rather than one faded out of sight.
  function reveal(index: number) {
    if (reduced || index === active) {
      return;
    }
    rests.current[index]?.scrollIntoView({ block: 'start' });
  }

  function beat(index: number, style?: StyleXStyles) {
    return {
      onFocus: () => reveal(index),
      ...props(styles.beat, style, index === active && styles.beatOn),
    };
  }

  /** The `order`th part of a beat from the top, which rises into place a step after the one over it. */
  function partOf(index: number, order: number, style?: StyleXStyles): StyleXStyles {
    const shown = index === active;
    return [styles.part, style, shown && styles.partOn, shown && order === 1 && styles.partSecond];
  }

  const tipLabel = m.home_receipt_tip_label();
  const turning = active === TURN_BEAT;

  return (
    <section id={id} ref={story} {...props(styles.story)}>
      <BillFilters />
      {Array.from({ length: BEATS + 1 }, (_, index) => (
        <span
          aria-hidden="true"
          key={index}
          ref={(mark) => {
            rests.current[index] = mark;
          }}
          style={{ insetBlockStart: `${(index / BEATS) * 100}%` }}
          {...props(styles.snap, index === 0 && styles.snapTop)}
        />
      ))}
      <div ref={stage} {...props(styles.stage)}>
        <GridTexture style={styles.grid} />
        <div {...props(styles.beats)}>
          <div {...beat(0)}>
            {/* The page's heading: the first thing it says. */}
            <h1 {...props(partOf(0, 0, [styles.line, styles.title]))}>
              <Sentence
                figures={[<Figure key="hours" value={AVERAGE_HOURS} />]}
                mark={
                  <Mark label={m.home_cost_source_label()}>
                    <a href={SOURCE_URL} rel="noreferrer" target="_blank">
                      {m.home_gate_source()}
                    </a>
                  </Mark>
                }
                text={m.home_cost_average({ hours: slot(0) })}
              />
            </h1>
          </div>

          <div {...beat(WEEKS_BEAT)}>
            <Weeks
              drawn={weeksDrawn}
              on={on(WEEKS_BEAT)}
              spent={screenWeeks(AVERAGE_HOURS)}
              style={partOf(WEEKS_BEAT, 0)}
            />
            <p {...props(partOf(WEEKS_BEAT, 1, styles.line))}>
              <Sentence
                figures={[
                  <Figure decimals={Number.isInteger(years) ? 0 : 1} key="years" value={years} />,
                ]}
                mark={
                  <Mark label={tipLabel}>
                    {m.home_receipt_total_tip({
                      hours: AVERAGE_HOURS,
                      percent: Math.round((AVERAGE_HOURS / WAKING_HOURS) * 100),
                      years: formatYears(AVERAGE_HOURS),
                    })}
                  </Mark>
                }
                text={m.home_cost_years({ horizon: HORIZON_YEARS, years: slot(0) })}
              />
            </p>
          </div>

          <div {...beat(WEEKENDS_BEAT)}>
            <Weekends
              drawn={weekendsDrawn}
              on={on(WEEKENDS_BEAT)}
              style={partOf(WEEKENDS_BEAT, 0)}
            />
            <p {...props(partOf(WEEKENDS_BEAT, 1, styles.line))}>
              <Sentence
                figures={[]}
                mark={
                  <Mark label={tipLabel}>
                    {m.home_receipt_weekends_tip({
                      daily: AVERAGE_HOURS,
                      waking: WAKING_HOURS,
                      weekend: WEEKEND_HOURS,
                      weekly: weeklyHours(AVERAGE_HOURS),
                    })}
                  </Mark>
                }
                text={m.home_cost_weekends()}
              />
            </p>
          </div>

          <div {...beat(EARTH_BEAT)}>
            <Orbit laps={earth} style={partOf(EARTH_BEAT, 0)} walked={walked} />
            <p {...props(partOf(EARTH_BEAT, 1, styles.line))}>
              <Sentence
                figures={[<Figure key="earth" value={earth} />]}
                mark={<Mark label={tipLabel}>{m.home_receipt_earth_tip()}</Mark>}
                text={m.home_cost_earth({ count: slot(0) })}
              />
            </p>
          </div>

          <div {...beat(MOON_BEAT)}>
            <Moon share={toMoon} style={partOf(MOON_BEAT, 0)} walked={moonWalked} />
            <p {...props(partOf(MOON_BEAT, 1, styles.line))}>
              <Sentence
                figures={[]}
                mark={
                  <Mark label={tipLabel}>
                    {m.home_receipt_moon_tip({
                      hours: number.format(MOON_WALK_HOURS),
                      km: number.format(MOON_KM),
                      percent: toMoonPercent,
                      speed: WALKING_KMH,
                    })}
                  </Mark>
                }
                text={
                  toMoon >= HALFWAY
                    ? m.home_cost_moon_half()
                    : m.home_cost_moon_part({ percent: toMoonPercent })
                }
              />
            </p>
          </div>

          <div {...beat(TURN_BEAT)}>
            <h2 {...props(styles.line, styles.turn)}>
              <span {...props(partOf(TURN_BEAT, 0, styles.turnLine), turning && styles.turnLineOn)}>
                {m.home_turn_willpower()}
              </span>{' '}
              <span
                {...props(
                  partOf(TURN_BEAT, 1, styles.turnLine),
                  turning && [styles.turnLineOn, styles.turnLineSecond],
                )}
              >
                <Sentence figures={[]} mark={null} text={m.home_turn_built()} />
              </span>
            </h2>
          </div>
        </div>
        <span aria-hidden="true" {...props(styles.cue, styles.swap, active > 0 && styles.gone)}>
          <span {...props(styles.cueLabel)}>{m.home_cost_scroll()}</span>
          <span {...props(styles.cueTrack)}>
            <span {...props(styles.cueDrop)} />
          </span>
        </span>
        {/* Fixed to the window, and gone once the story is over. */}
        <div ref={keys} {...props(styles.keys, told && styles.gone)}>
          <button
            aria-label={m.home_cost_key_up_label()}
            onClick={() => stepper.current(-1)}
            type="button"
            {...props(styles.keycap)}
          >
            {m.home_cost_key_up()}
          </button>
          <button
            aria-label={m.home_cost_key_down_label()}
            onClick={() => stepper.current(1)}
            type="button"
            {...props(styles.keycap)}
          >
            {m.home_cost_key_down()}
          </button>
          <span>{m.home_cost_keys_hint()}</span>
        </div>
        <span
          aria-hidden="true"
          {...props(styles.rail, styles.swap, (active === 0 || turning) && styles.gone)}
        >
          <motion.span {...props(styles.railFill)} style={{ scaleX: scrollYProgress }} />
        </span>
      </div>
    </section>
  );
}
