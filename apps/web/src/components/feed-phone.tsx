import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { playClick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { HOURS_DEFAULT, HOURS_MAX, HOURS_MIN } from './screen-time-gate.tsx';

/** One caption per clip, by its place in the feed. */
const CAPTIONS = [
  m.home_feed_caption_1,
  m.home_feed_caption_2,
  m.home_feed_caption_3,
  m.home_feed_caption_4,
  m.home_feed_caption_5,
  m.home_feed_caption_6,
  m.home_feed_caption_7,
  m.home_feed_caption_8,
  m.home_feed_caption_9,
  m.home_feed_caption_10,
  m.home_feed_caption_11,
  m.home_feed_caption_12,
];

/** The feed shows itself first: from this hour it scrolls to the default. */
export const DEMO_FROM = 2;
const DEMO_START_MS = 700;
/** How long each video of the show plays before the next. */
const SHOW_STEP_MS = 2000;
/** Left alone this long after the show, the feed nods: one video down, one back up. */
const IDLE_MS = 5000;
/** After this many nods with no touch, the page is told the reader is only watching. */
const IDLE_NODS = 2;
const NOD_MS = 700;
/** The rest after a wheel stops that counts as letting go. */
const SETTLE_MS = 220;
/**
 * A swipe need not carry the feed half way: this much of a video, or a flick
 * this fast, moves to the next one. A feed is easy to move, or it is not one.
 */
const SWIPE_FRACTION = 0.12;
const FLICK_SPEED = 0.35;
/** How long the feed takes to snap to the nearest video once let go. */
const SNAP_MS = 260;
/** Videos in the feed: one per hour, and a few past the last. */
const VIDEO_COUNT = HOURS_MAX - HOURS_MIN + 3;
/** An iPhone 15 Pro is 71.6 by 146.6 millimetres: the mock keeps that shape. */
const PHONE_WIDTH = 71.6;
const PHONE_HEIGHT = 146.6;
/** How tall the mock stands on a wide screen, and on a short one. */
const PHONE_TALL = 430;
const PHONE_TALL_SHORT = 300;
/** Until the screen is measured, a video is this tall. */
const SCREEN_FALLBACK = PHONE_TALL - 14;
/**
 * Every part of the feed is drawn in the phone body's own width, so the whole
 * thing holds together at any size the mock is given. The screen is 89.6 of
 * those hundredths wide and an iPhone screen is 393 points wide, so a point is
 * roughly 0.23 of them: that is the ratio every number below comes from.
 *
 * The tab bar and the home indicator under it, measured up from the foot.
 */
const NAV_HEIGHT = 17;
/** The caption block and the action rail both stand clear of the tab bar. */
const CAPTION_BOTTOM = NAV_HEIGHT + 3;
const RAIL_BOTTOM = NAV_HEIGHT + 2;
/** TikTok's two colours: the plus in the tab bar, and the badge on the avatar. */
const CYAN = '#25f4ee';
const RED = '#fe2c55';
/** Each video is its own dark wash, so the eye sees the cut between them. */
const WASHES = [
  'linear-gradient(160deg, #2a1f3d, #0f0a1a)',
  'linear-gradient(160deg, #1f3d2a, #0a1a0f)',
  'linear-gradient(160deg, #3d2a1f, #1a0f0a)',
  'linear-gradient(160deg, #1f2a3d, #0a0f1a)',
  'linear-gradient(160deg, #3d1f2a, #1a0a0f)',
];

/** The record under the rail turns while the clip plays. */
const discSpin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});
/** The sound line runs the way a feed runs it: two copies, one seamless loop. */
const marqueeRun = keyframes({
  from: { transform: 'translateX(0)' },
  to: { transform: 'translateX(-50%)' },
});

/**
 * The feed's icons, drawn here so the mock needs no icon set: each is one or
 * more paths on the same 24 by 24 grid, filled with the colour it inherits.
 */
const ICONS = {
  bookmark: [
    'M6.2 2.5h11.6c.94 0 1.7.76 1.7 1.7v17.05c0 .6-.66.97-1.17.65L12 18.2l-6.33 3.7a.76.76 0 0 1-1.17-.65V4.2c0-.94.76-1.7 1.7-1.7z',
  ],
  comment: [
    'M12 3C6.48 3 2 6.6 2 11.05c0 2.5 1.42 4.74 3.65 6.2L4.5 20.9a.6.6 0 0 0 .85.7l4.3-2.28c.75.11 1.54.17 2.35.17 5.52 0 10-3.6 10-8.44S17.52 3 12 3z',
  ],
  friends: [
    'M9 4.5a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z',
    'M9 13.2c-3.6 0-6.5 2.05-6.5 4.6v1.3c0 .5.4.9.9.9h11.2c.5 0 .9-.4.9-.9v-1.3c0-2.55-2.9-4.6-6.5-4.6z',
    'M17.3 6.5a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
    'M17.3 13.5c-.72 0-1.4.08-2.03.24 1.42 1.07 2.28 2.5 2.28 4.06V20h3.65c.5 0 .9-.4.9-.9v-1.1c0-2.48-2.15-4.5-4.8-4.5z',
  ],
  heart: [
    'M12 21.2c-.4 0-.8-.14-1.1-.42C6.3 16.7 2 12.9 2 8.6 2 5.4 4.4 3 7.5 3c1.8 0 3.5.86 4.5 2.2C13 3.86 14.7 3 16.5 3 19.6 3 22 5.4 22 8.6c0 4.3-4.3 8.1-8.9 12.18-.3.28-.7.42-1.1.42z',
  ],
  home: ['M12 3 1.5 12h3v8.5h6V15h3v5.5h6V12h3L12 3z'],
  inbox: [
    'M5 3.5h14c1.66 0 3 1.34 3 3v8c0 1.66-1.34 3-3 3h-7.3L7.5 20.6V17.5H5c-1.66 0-3-1.34-3-3v-8c0-1.66 1.34-3 3-3z',
  ],
  music: [
    'M9.2 17.6a2.6 2.6 0 1 1-1.6-2.4V6.9c0-.5.34-.93.82-1.04l7.3-1.83A1.05 1.05 0 0 1 17 5.05v9.8a2.6 2.6 0 1 1-1.6-2.4V8.5l-6.2 1.55v7.55z',
  ],
  plus: ['M10.7 3.6h2.6v7.1h7.1v2.6h-7.1v7.1h-2.6v-7.1H3.6v-2.6h7.1V3.6z'],
  profile: [
    'M12 3a4.6 4.6 0 1 0 0 9.2A4.6 4.6 0 0 0 12 3z',
    'M12 13.9c-4.4 0-8 2.5-8 5.6v.6c0 .5.4.9.9.9h14.2c.5 0 .9-.4.9-.9v-.6c0-3.1-3.6-5.6-8-5.6z',
  ],
  search: [
    'M10.6 2.5a8.1 8.1 0 1 0 4.83 14.6l4.5 4.5a1.05 1.05 0 0 0 1.48-1.48l-4.5-4.5A8.1 8.1 0 0 0 10.6 2.5zm0 2.1a6 6 0 1 1 0 12 6 6 0 0 1 0-12z',
  ],
  share: ['M13.5 5.4v4C7.4 9.8 3.1 13.7 2 20.6c2.9-4.4 6.7-6.5 11.5-6.6v4L22 12 13.5 5.4z'],
};

const styles = create({
  // The handle, the caption and the sound, bottom left, clear of the tab bar.
  caption: {
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.4cqw',
    insetBlockEnd: `${CAPTION_BOTTOM}cqw`,
    insetInlineStart: '4cqw',
    position: 'absolute',
    textAlign: 'start',
    width: '62%',
  },
  captionHandle: {
    fontSize: '3.8cqw',
    fontWeight: font.weightBold,
    lineHeight: 1.2,
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
  },
  // The burnt-in caption: across the upper middle of the video, out of the
  // rail's and the caption block's way.
  overlay: {
    alignItems: 'center',
    display: 'flex',
    inset: 0,
    justifyContent: 'center',
    paddingInline: '10cqw',
    pointerEvents: 'none',
    position: 'absolute',
    textAlign: 'center',
  },
  // A dark wash over the clip, so the words are what the eye lands on.
  overlayText: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    boxDecorationBreak: 'clone',
    color: '#fff',
    fontSize: '7cqw',
    fontWeight: font.weightBold,
    lineHeight: 1.35,
    paddingBlock: '0.4cqw',
    paddingInline: '2cqw',
    textWrap: 'balance',
    WebkitBoxDecorationBreak: 'clone',
  },
  shade: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    inset: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
  // The record at the foot of the rail: a dark disc with a lighter ring and
  // the clip's own frame at its centre.
  disc: {
    alignItems: 'center',
    animationDuration: '8s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: discSpin,
    },
    animationTimingFunction: 'linear',
    backgroundColor: '#161616',
    borderRadius: 999,
    boxShadow: 'inset 0 0 0 1.2cqw rgba(255, 255, 255, 0.16)',
    display: 'flex',
    height: '10.4cqw',
    justifyContent: 'center',
    marginBlockStart: '1.6cqw',
    width: '10.4cqw',
  },
  discCore: {
    backgroundColor: '#4a4a4a',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: 999,
    height: '4.6cqw',
    width: '4.6cqw',
  },
  feed: {
    display: 'flex',
    flexDirection: 'column',
    willChange: 'transform',
  },
  feedSnapping: {
    transitionDuration: `${SNAP_MS}ms`,
    transitionProperty: 'transform',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  gate: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: {
      '@media (max-width: 639px)': 1,
      default: 0,
    },
    gap: spacing.s4,
    minHeight: 0,
    width: '100%',
  },
  // The white pill an iPhone draws at the foot of the screen.
  homeIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 999,
    height: '0.9cqw',
    insetBlockEnd: '1.9cqw',
    insetInlineStart: '50%',
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: '30cqw',
  },
  // Every icon over the picture carries the shadow a feed gives it, so it
  // reads on a bright frame as well as a dark one.
  icon: {
    display: 'block',
    fill: 'currentColor',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))',
  },
  // The island at the top of the screen, over the feed.
  // The island, at the top of the screen, over the feed: 126 by 37 points on
  // a 393 point screen, 11 points down.
  island: {
    backgroundColor: '#000',
    borderRadius: 999,
    height: '9.4cqw',
    insetBlockStart: 'calc(3cqw + 2.8cqw)',
    insetInlineStart: '50%',
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: '32cqw',
    zIndex: 2,
  },
  marquee: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  marqueeCopy: {
    paddingInlineEnd: '3cqw',
    whiteSpace: 'nowrap',
  },
  marqueeTrack: {
    animationDuration: '11s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: marqueeRun,
    },
    animationTimingFunction: 'linear',
    display: 'flex',
    width: 'max-content',
  },
  music: {
    alignItems: 'center',
    display: 'flex',
    fontSize: '3.2cqw',
    gap: '1.2cqw',
    marginBlockStart: '0.6cqw',
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
  },
  musicIcon: {
    flexShrink: 0,
    height: '3.6cqw',
    width: '3.6cqw',
  },
  // The tab bar: part of the screen, not of a video, so the feed runs under it.
  nav: {
    alignItems: 'center',
    backgroundColor: '#000',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    height: `${NAV_HEIGHT}cqw`,
    insetBlockEnd: 0,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  navIcon: {
    height: '6.2cqw',
    width: '6.2cqw',
  },
  navItem: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9cqw',
    width: '16cqw',
  },
  navItemMuted: {
    opacity: 0.7,
  },
  navLabel: {
    fontSize: '2.4cqw',
    fontWeight: font.weightMedium,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  // The plus in the middle: a white slab with a cyan one and a red one
  // showing at its shoulders.
  navPlus: {
    alignItems: 'center',
    color: '#161823',
    display: 'flex',
    height: '6.6cqw',
    justifyContent: 'center',
    position: 'relative',
    width: '11cqw',
  },
  navPlusCyan: {
    backgroundColor: CYAN,
    borderRadius: '1.8cqw',
    height: '100%',
    insetBlockStart: 0,
    insetInlineStart: '-1.3cqw',
    position: 'absolute',
    width: '9cqw',
  },
  navPlusFace: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: '1.8cqw',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  navPlusIcon: {
    filter: 'none',
    height: '3.4cqw',
    width: '3.4cqw',
  },
  navPlusRed: {
    backgroundColor: RED,
    borderRadius: '1.8cqw',
    height: '100%',
    insetBlockStart: 0,
    insetInlineEnd: '-1.3cqw',
    position: 'absolute',
    width: '9cqw',
  },
  navRow: {
    alignItems: 'center',
    display: 'flex',
    height: '11.4cqw',
    justifyContent: 'space-around',
    paddingInline: '1.5cqw',
    width: '100%',
  },
  // The phone's body: a titanium rim, a black bezel, and the screen cut into
  // it with the corner an iPhone 15 Pro has. Everything is sized from the
  // body's own width, so it is the same phone at every size.
  phone: {
    backgroundColor: '#000',
    borderColor: `color-mix(in srgb, ${colors.fg} 26%, ${colors.bg})`,
    borderRadius: '17cqw',
    borderStyle: 'solid',
    borderWidth: '2.2cqw',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
    boxSizing: 'border-box',
    height: '100%',
    overflow: 'hidden',
    padding: '3cqw',
    position: 'relative',
    width: '100%',
  },
  // How far the clip has run, on the seam between the video and the tab bar.
  progress: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    height: '0.55cqw',
    insetBlockEnd: `${NAV_HEIGHT}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  progressFill: {
    backgroundColor: '#fff',
    display: 'block',
    height: '100%',
  },
  // The actions down the right edge, counted the way a feed counts them.
  rail: {
    alignItems: 'center',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '3.4cqw',
    insetBlockEnd: `${RAIL_BOTTOM}cqw`,
    insetInlineEnd: '2.4cqw',
    position: 'absolute',
    width: '14cqw',
  },
  railAvatar: {
    backgroundColor: '#3a3a3a',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderColor: '#fff',
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '0.55cqw',
    boxSizing: 'border-box',
    height: '10.4cqw',
    marginBlockEnd: '1.2cqw',
    position: 'relative',
    width: '10.4cqw',
  },
  railBadge: {
    alignItems: 'center',
    backgroundColor: RED,
    borderRadius: 999,
    color: '#fff',
    display: 'flex',
    height: '4.4cqw',
    insetBlockEnd: '-2.2cqw',
    insetInlineStart: '50%',
    justifyContent: 'center',
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: '4.4cqw',
  },
  railBadgeIcon: {
    height: '2.6cqw',
    width: '2.6cqw',
  },
  railCount: {
    fontSize: '2.7cqw',
    fontWeight: font.weightMedium,
    lineHeight: 1,
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
  },
  railIcon: {
    height: '7.6cqw',
    width: '7.6cqw',
  },
  railItem: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9cqw',
  },
  // The screen inside the bezel. Its corner is concentric with the body's:
  // the outer radius less the rim and the bezel, 17 minus 2.2 minus 3.
  screen: {
    borderRadius: '11.8cqw',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  // The two washes a feed lays over the picture so white text reads on it.
  scrimBottom: {
    backgroundImage: 'linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0))',
    height: '38cqw',
    insetBlockEnd: `${NAV_HEIGHT}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  scrimTop: {
    backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0))',
    height: '26cqw',
    insetBlockStart: 0,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  search: {
    height: '5.2cqw',
    insetInlineEnd: '4cqw',
    position: 'absolute',
    width: '5.2cqw',
  },
  // The box the phone is sized in: the shape of an iPhone 15 Pro, 71.6 by
  // 146.6, and the thing that takes every scroll and drag aimed at it.
  shell: {
    aspectRatio: `${PHONE_WIDTH} / ${PHONE_HEIGHT}`,
    borderRadius: '17cqw',
    boxShadow: {
      ':focus-visible': `0 0 0 3px ${colors.muted}`,
      default: 'none',
    },
    containerType: 'inline-size',
    cursor: 'grab',
    // On a phone it grows to the room it is given and keeps its shape; on a
    // wide screen it is a fixed size, shorter when the window is short.
    flexGrow: {
      '@media (max-width: 639px)': 1,
      default: 0,
    },
    height: {
      '@media (max-height: 720px)': PHONE_TALL_SHORT,
      '@media (max-width: 639px)': 'auto',
      default: PHONE_TALL,
    },
    minHeight: 0,
    outlineStyle: 'none',
    position: 'relative',
    touchAction: 'none',
    userSelect: 'none',
    // The width follows the height through the aspect ratio.
    width: 'auto',
  },
  shellHeld: {
    cursor: 'grabbing',
  },
  // Not the reader's yet: no hand offered.
  shellShowing: {
    cursor: 'default',
  },
  // The iPhone's own line, level with the island: the hour on the left, the
  // signal, the network and the battery on the right.
  statusBar: {
    alignItems: 'center',
    color: '#fff',
    display: 'flex',
    fontSize: '3.1cqw',
    fontWeight: font.weightBold,
    height: '9.4cqw',
    insetBlockStart: '2.8cqw',
    insetInlineEnd: 0,
    insetInlineStart: 0,
    justifyContent: 'space-between',
    paddingInline: '7cqw',
    position: 'absolute',
  },
  statusBattery: {
    height: '3cqw',
    width: '6.3cqw',
  },
  statusIcons: {
    alignItems: 'center',
    display: 'flex',
    gap: '1.3cqw',
  },
  statusSignal: {
    height: '2.9cqw',
    width: '4.3cqw',
  },
  statusWifi: {
    height: '3cqw',
    width: '4cqw',
  },
  tab: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '3.8cqw',
    fontWeight: font.weightBold,
    lineHeight: 1,
    paddingInline: '2.4cqw',
    position: 'relative',
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)',
  },
  tabMuted: {
    fontWeight: font.weightMedium,
    opacity: 0.7,
  },
  tabUnderline: {
    backgroundColor: '#fff',
    borderRadius: 999,
    height: '0.7cqw',
    insetBlockEnd: '-1.9cqw',
    position: 'absolute',
    width: '6.4cqw',
  },
  // The two feeds at the top of the screen, and the search at the corner.
  tabs: {
    alignItems: 'center',
    color: '#fff',
    display: 'flex',
    height: '9cqw',
    insetBlockStart: '13.2cqw',
    insetInlineEnd: 0,
    insetInlineStart: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  tabsRow: {
    alignItems: 'center',
    display: 'flex',
  },
  // One video: the whole screen, with its own chrome over it.
  video: {
    boxSizing: 'border-box',
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  // The clip fills the video edge to edge, under everything else.
  videoClip: {
    height: '100%',
    insetBlockStart: 0,
    insetInlineStart: 0,
    objectFit: 'cover',
    position: 'absolute',
    width: '100%',
  },
});

/** One of the hand-drawn icons, at whatever size it is given. */
function Icon({ name, style }: { name: keyof typeof ICONS; style?: StyleXStyles }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.icon, style)}>
      {ICONS[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}

/** Four bars, the way iOS draws the signal. */
function IconSignal({ style }: { style?: StyleXStyles }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 12" {...props(styles.icon, style)}>
      <rect height="4" rx="1" width="3.2" x="0" y="8" />
      <rect height="6.2" rx="1" width="3.2" x="4.9" y="5.8" />
      <rect height="8.5" rx="1" width="3.2" x="9.8" y="3.5" />
      <rect height="11" rx="1" width="3.2" x="14.7" y="1" />
    </svg>
  );
}

/** Three arcs and a dot: the network. */
function IconWifi({ style }: { style?: StyleXStyles }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 12" {...props(styles.icon, style)}>
      <path d="M8 3.1c2.05 0 3.93.73 5.4 1.95l1.55-1.9A10.7 10.7 0 0 0 8 .6C5.2.6 2.63 1.6.65 3.15L2.2 5.05A8.55 8.55 0 0 1 8 3.1z" />
      <path d="M8 7.05c1.1 0 2.1.38 2.9 1.02l1.55-1.9A8.6 8.6 0 0 0 8 4.55c-1.7 0-3.26.6-4.45 1.62l1.55 1.9A5.6 5.6 0 0 1 8 7.05z" />
      <path d="M8 8.5c-.9 0-1.72.32-2.36.85l2.36 2.9 2.36-2.9A3.65 3.65 0 0 0 8 8.5z" />
    </svg>
  );
}

/** A full battery, outline and cap the way iOS draws them. */
function IconBattery({ style }: { style?: StyleXStyles }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 27 13" {...props(styles.icon, style)}>
      <rect
        fill="none"
        height="12"
        rx="3.6"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1"
        width="23"
        x="0.5"
        y="0.5"
      />
      <rect height="8" rx="2.2" width="16" x="2.5" y="2.5" />
      <path d="M25 4.5v4c1-.42 1.6-1.15 1.6-2s-.6-1.58-1.6-2z" fillOpacity="0.45" />
    </svg>
  );
}

/** The clip a video plays, by its place in the feed: 01.mp4 is the first. */
function clipUrl(index: number, kind: 'jpg' | 'mp4'): string {
  return `/media/feed/${String(index + 1).padStart(2, '0')}.${kind}`;
}

/**
 * The numbers beside the actions. They are made up, but every video has its
 * own, because a feed where twelve videos carry the same count is not one.
 */
function counts(index: number) {
  return {
    comments: 1203 + index * 187,
    likes: 12_400 + index * 3170,
    saves: 843 + index * 129,
    shares: 2110 + index * 96,
  };
}

/** A count the way a feed writes it: thousands grouped, ten thousand and up in K. */
function formatCount(value: number): string {
  if (value >= 10_000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return String(value).replaceAll(/\B(?=(\d{3})+$)/g, ',');
}

/**
 * One video of the feed. The clip plays only while this is the video on
 * screen, muted and looping, over a wash that stands in until the file has
 * loaded or when there is none. Everything the feed draws over the picture
 * rides with it: the caption, the action rail, and how far the clip has run.
 */
function Video({ current, height, index }: { current: boolean; height: number; index: number }) {
  const clip = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(0);
  const poster = clipUrl(index, 'jpg');
  const stat = counts(index);
  useEffect(() => {
    const element = clip.current;
    if (element === null) {
      return;
    }
    if (!current) {
      element.pause();
      return;
    }
    void element.play().catch(() => {
      // A clip that is missing, or a browser that will not run it, is the
      // wash instead. Nothing waits on it.
    });
  }, [current]);
  // Four times a second while the clip runs, which is all the bar needs.
  function onTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    const whole = element.duration;
    setPlayed(Number.isFinite(whole) && whole > 0 ? (element.currentTime / whole) * 100 : 0);
  }
  return (
    <div
      style={{ backgroundImage: WASHES[index % WASHES.length], height }}
      {...props(styles.video)}
    >
      <video
        loop
        muted
        onTimeUpdate={onTimeUpdate}
        playsInline
        poster={poster}
        preload={current ? 'auto' : 'metadata'}
        ref={clip}
        src={clipUrl(index, 'mp4')}
        {...props(styles.videoClip)}
      />
      <span {...props(styles.scrimTop)} />
      <span {...props(styles.scrimBottom)} />
      <div {...props(styles.rail)}>
        <span style={{ backgroundImage: `url("${poster}")` }} {...props(styles.railAvatar)}>
          <span {...props(styles.railBadge)}>
            <Icon name="plus" style={styles.railBadgeIcon} />
          </span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="heart" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(stat.likes)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="comment" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(stat.comments)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="bookmark" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(stat.saves)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="share" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(stat.shares)}</span>
        </span>
        <span {...props(styles.disc)}>
          <span style={{ backgroundImage: `url("${poster}")` }} {...props(styles.discCore)} />
        </span>
      </div>
      <span {...props(styles.shade)} />
      {/* The honest caption, the way a creator burns it into the middle of
      the video: big, centred, white on a black band. */}
      <div {...props(styles.overlay)}>
        <span {...props(styles.overlayText)}>{CAPTIONS[index]?.() ?? ''}</span>
      </div>
      <div {...props(styles.caption)}>
        <span {...props(styles.captionHandle)}>{m.home_feed_handle()}</span>
        <span {...props(styles.music)}>
          <Icon name="music" style={styles.musicIcon} />
          <span {...props(styles.marquee)}>
            <span {...props(styles.marqueeTrack)}>
              <span {...props(styles.marqueeCopy)}>
                {m.home_feed_sound({ name: m.home_feed_handle() })}
              </span>
              <span {...props(styles.marqueeCopy)}>
                {m.home_feed_sound({ name: m.home_feed_handle() })}
              </span>
            </span>
          </span>
        </span>
      </div>
      <span {...props(styles.progress)}>
        <span style={{ width: `${played}%` }} {...props(styles.progressFill)} />
      </span>
    </div>
  );
}

/**
 * The question's answer, scrolled rather than set: a phone with a video feed
 * in it, and every video scrolled past is an hour. Down adds, up takes away,
 * and the feed snaps to a whole video when let go. The act that costs the
 * hours is the act that counts them.
 */
export function FeedPhone({
  onChange,
  onIdle,
  onNod,
  onPick,
  sound,
}: {
  /** Every hour the feed lands on, as it lands: the page reads it live. */
  onChange: (hours: number) => void;
  /** The feed has nodded twice with nobody touching it: the page may move on. */
  onIdle?: (() => void) | undefined;
  /** The feed is nodding on its own between six and seven, or has stopped. */
  onNod?: ((nodding: boolean) => void) | undefined;
  /** The hour the feed is let go at. */
  onPick: (hours: number) => void;
  sound: boolean;
}) {
  const [hours, setHours] = useState(DEMO_FROM);
  // Where the feed is, in videos from the first hour; a fraction mid-drag.
  const [position, setPosition] = useState(DEMO_FROM - HOURS_MIN);
  const [screenHeight, setScreenHeight] = useState(SCREEN_FALLBACK);
  const [snapping, setSnapping] = useState(false);
  const [held, setHeld] = useState(false);
  const phone = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const travelled = useRef(DEMO_FROM - HOURS_MIN);
  const holding = useRef(false);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The feed is not the reader's until the show has played.
  const showing = useRef(true);
  const [ready, setReady] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nods = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(0);
  const lastAt = useRef(0);
  const velocity = useRef(0);
  const dragFrom = useRef(0);
  const latest = useRef({ hours, onChange, onIdle, onNod, onPick, screenHeight, sound });
  latest.current = { hours, onChange, onIdle, onNod, onPick, screenHeight, sound };

  // A video is exactly one screen tall, whatever the screen turns out to be.
  useLayoutEffect(() => {
    const element = screen.current;
    if (element === null) {
      return;
    }
    const measure = () => setScreenHeight(element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function moveTo(next: number) {
    const clamped = Math.min(HOURS_MAX - HOURS_MIN, Math.max(0, next));
    travelled.current = clamped;
    setPosition(clamped);
    const landed = HOURS_MIN + Math.round(clamped);
    if (landed !== latest.current.hours) {
      if (latest.current.sound) {
        primeTickSound();
        playClick();
      }
      setHours(landed);
      latest.current.onChange(landed);
    }
  }

  function moveBy(pixels: number) {
    setSnapping(false);
    moveTo(travelled.current + pixels / latest.current.screenHeight);
  }

  // Let go: the feed snaps to a whole video, and the page hears the hour. A
  // drag past a small part of a video, or a flick, carries on to the next.
  function letGo(flick = 0) {
    unlockTickSound();
    setSnapping(true);
    const from = dragFrom.current;
    const moved = travelled.current - from;
    let target = Math.round(travelled.current);
    if (Math.abs(moved) >= SWIPE_FRACTION || Math.abs(flick) >= FLICK_SPEED) {
      const direction = moved !== 0 ? Math.sign(moved) : Math.sign(flick);
      target = direction > 0 ? Math.ceil(travelled.current) : Math.floor(travelled.current);
      if (target === from) {
        target = from + direction;
      }
    }
    moveTo(target);
    dragFrom.current = target;
    latest.current.onPick(HOURS_MIN + Math.round(target));
  }

  // The show stops the moment the reader takes hold.
  function stopShow() {
    if (demoTimer.current !== null) {
      clearTimeout(demoTimer.current);
      demoTimer.current = null;
    }
    if (idleTimer.current !== null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
      latest.current.onNod?.(false);
    }
  }

  // Left alone after the show, the feed nods once: a video down, a pause,
  // and back up. Then it waits again, until the reader takes hold.
  function waitThenNod() {
    // Six, seven, six: the page hears of it as the feed moves, so what it
    // shows for it moves in step.
    idleTimer.current = setTimeout(() => {
      const here = Math.round(travelled.current);
      const sixSeven = here + HOURS_MIN === 6;
      if (sixSeven) {
        latest.current.onNod?.(true);
      }
      setSnapping(true);
      moveTo(here + 1);
      idleTimer.current = setTimeout(() => {
        setSnapping(true);
        moveTo(here);
        idleTimer.current = setTimeout(() => {
          if (sixSeven) {
            latest.current.onNod?.(false);
          }
          nods.current += 1;
          if (nods.current === IDLE_NODS) {
            latest.current.onIdle?.();
          }
          waitThenNod();
        }, NOD_MS);
      }, NOD_MS);
    }, IDLE_MS);
  }

  // The feed shows itself once: from two hours it steps to the default one
  // video at a time, a tick and a pause at each, until the reader takes hold.
  useEffect(() => {
    const from = DEMO_FROM - HOURS_MIN;
    const to = HOURS_DEFAULT - HOURS_MIN;
    const pause = SHOW_STEP_MS;
    let at = from;
    const step = () => {
      at += 1;
      setSnapping(true);
      moveTo(at);
      if (at < to) {
        demoTimer.current = setTimeout(step, pause);
      } else {
        demoTimer.current = null;
        showing.current = false;
        setReady(true);
        waitThenNod();
      }
    };
    demoTimer.current = setTimeout(step, DEMO_START_MS);
    return stopShow;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot show
  }, []);

  // The wheel must not scroll the page while it scrolls the feed, and a
  // passive listener cannot say so: the handler goes on by hand.
  useEffect(() => {
    const element = phone.current;
    if (element === null) {
      return;
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (showing.current) {
        return;
      }
      stopShow();
      if (settle.current === null) {
        dragFrom.current = Math.round(travelled.current);
      }
      moveBy(event.deltaY);
      if (settle.current !== null) {
        clearTimeout(settle.current);
      }
      settle.current = setTimeout(() => {
        settle.current = null;
        letGo();
      }, SETTLE_MS);
    }
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
      if (settle.current !== null) {
        clearTimeout(settle.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs carry the latest values
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (showing.current) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    stopShow();
    lastY.current = event.clientY;
    lastAt.current = event.timeStamp;
    velocity.current = 0;
    dragFrom.current = Math.round(travelled.current);
    holding.current = true;
    setHeld(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!holding.current) {
      return;
    }
    // A finger dragging up pulls the feed up: the feed scrolls down.
    const dy = lastY.current - event.clientY;
    const dt = Math.max(1, event.timeStamp - lastAt.current);
    velocity.current = dy / dt;
    moveBy(dy);
    lastY.current = event.clientY;
    lastAt.current = event.timeStamp;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!holding.current) {
      return;
    }
    holding.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setHeld(false);
    letGo(velocity.current);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (showing.current) {
        return;
      }
      stopShow();
      setSnapping(true);
      moveTo(Math.round(travelled.current) + (event.key === 'ArrowDown' ? 1 : -1));
    }
  }

  function onKeyUp(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
      letGo();
    }
  }

  const reading = hours === 1 ? m.home_gate_reading_one() : m.home_gate_reading({ hours });

  return (
    <div {...props(styles.gate)}>
      <div
        aria-label={m.home_gate_slider_label()}
        aria-valuemax={HOURS_MAX}
        aria-valuemin={HOURS_MIN}
        aria-valuenow={hours}
        aria-valuetext={reading}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={phone}
        role="slider"
        tabIndex={0}
        {...props(styles.shell, !ready && styles.shellShowing, held && styles.shellHeld)}
      >
        <div aria-hidden="true" {...props(styles.phone)}>
          <span {...props(styles.island)} />
          <div ref={screen} {...props(styles.screen)}>
            <div
              style={{ transform: `translateY(${-position * screenHeight}px)` }}
              {...props(styles.feed, snapping && styles.feedSnapping)}
            >
              {Array.from({ length: VIDEO_COUNT }, (_, index) => (
                <Video
                  current={index === Math.round(position)}
                  height={screenHeight}
                  index={index}
                  key={index}
                />
              ))}
            </div>
            <div {...props(styles.statusBar)}>
              <span>{m.home_feed_status_time()}</span>
              <span {...props(styles.statusIcons)}>
                <IconSignal style={styles.statusSignal} />
                <IconWifi style={styles.statusWifi} />
                <IconBattery style={styles.statusBattery} />
              </span>
            </div>
            <div {...props(styles.tabs)}>
              <div {...props(styles.tabsRow)}>
                <span {...props(styles.tab, styles.tabMuted)}>{m.home_feed_tab_following()}</span>
                <span {...props(styles.tab)}>
                  {m.home_feed_tab_foryou()}
                  <span {...props(styles.tabUnderline)} />
                </span>
              </div>
              <Icon name="search" style={styles.search} />
            </div>
            <div {...props(styles.nav)}>
              <div {...props(styles.navRow)}>
                <span {...props(styles.navItem)}>
                  <Icon name="home" style={styles.navIcon} />
                  <span {...props(styles.navLabel)}>{m.home_feed_nav_home()}</span>
                </span>
                <span {...props(styles.navItem, styles.navItemMuted)}>
                  <Icon name="friends" style={styles.navIcon} />
                  <span {...props(styles.navLabel)}>{m.home_feed_nav_friends()}</span>
                </span>
                <span {...props(styles.navPlus)}>
                  <span {...props(styles.navPlusCyan)} />
                  <span {...props(styles.navPlusRed)} />
                  <span {...props(styles.navPlusFace)}>
                    <Icon name="plus" style={styles.navPlusIcon} />
                  </span>
                </span>
                <span {...props(styles.navItem, styles.navItemMuted)}>
                  <Icon name="inbox" style={styles.navIcon} />
                  <span {...props(styles.navLabel)}>{m.home_feed_nav_inbox()}</span>
                </span>
                <span {...props(styles.navItem, styles.navItemMuted)}>
                  <Icon name="profile" style={styles.navIcon} />
                  <span {...props(styles.navLabel)}>{m.home_feed_nav_profile()}</span>
                </span>
              </div>
              <span {...props(styles.homeIndicator)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
