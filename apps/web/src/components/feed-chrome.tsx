import { font } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { m } from '../paraglide/messages.js';

/**
 * The six skins the feed wears. Every slot hands one of them the same parts,
 * so the only thing a slot decides is which app it is today.
 */
export type Platform = 'facebook' | 'linkedin' | 'reels' | 'shorts' | 'tiktok' | 'x';

/** The numbers beside the actions, as the slot derives them. */
export type Counts = {
  comments: number;
  likes: number;
  saves: number;
  shares: number;
};

export type ChromeProps = {
  /** The honest caption, burnt into the middle of the clip. */
  caption: string;
  /** The clip itself, placed by the skin: the whole screen, or a media box. */
  clip: ReactNode;
  counts: Counts;
  /** This is the slot on screen. The ones behind it hold their animations. */
  current: boolean;
  /** The clip's own frame, worn by avatars and audio thumbnails. */
  frame: { backgroundImage: string } | undefined;
  handle: string;
  /** How far the clip has run, in percent. */
  played: number;
  /** How dark the wash over the clip is. */
  shade: number;
};

/**
 * Every measure here is a share of the phone body's own width, in cqw. The
 * screen is 89.6 of them across and an iPhone screen is 393 points wide, so a
 * point is 0.228 of them. The handful of measures the six skins agree on are
 * written out first, in the points they come from, and the rest is set off
 * them: that is what keeps one skin's bar the height of another's.
 */
/** 11pt: the air a bar keeps under the phone's own line. */
const AIR = 2.6;
/** 40pt: the face over a post. */
const AVATAR = 9.1;
/** 44pt: a top bar. */
const BAR = 10;
/** 10pt: the grey a feed leaves between one card and the next. */
const FEED_GAP = 2.4;
/** 12pt: an avatar to the words beside it. */
const GAP = 2.7;
/** 16pt: the margin a card keeps either side, and the step down a rail. */
const GUTTER = 3.6;
/** 52pt: a row of actions under a card, words and all. */
const ROW = 12;
/** 32pt: a row of counted icons, which carries no words and stands lower. */
const ROW_TIGHT = 7.4;
/** 47pt: a row of tabs under a bar. */
const TAB_ROW = 10.8;
/** Where the phone's own line ends. Every app starts its air below this. */
const STATUS_END = 12.2;
/** The first bar, the tabs under it, and the first card under those. */
const BAR_TOP = STATUS_END + AIR;
const TABS_TOP = BAR_TOP + BAR;
const CARD_TOP = TABS_TOP + TAB_ROW;
/** The tab bar and the home indicator under it, measured up from the foot. */
const NAV_HEIGHT = 17;
/** The caption block and the action rail both stand clear of the tab bar. */
const CAPTION_BOTTOM = NAV_HEIGHT + GUTTER;
const RAIL_BOTTOM = NAV_HEIGHT + GAP;
/** TikTok's two colours: the plus in the tab bar, and the badge on the avatar. */
const CYAN = '#25f4ee';
const RED = '#fe2c55';
/** One colour each from the other five: the rest of them are black or white. */
const YT_RED = '#ff0033';
const X_BLUE = '#1d9bf0';
const X_MUTED = '#71767b';
const X_LINE = '#2f3336';
const LI_BLUE = '#0a66c2';
const LI_FEED = '#f4f2ee';
const LI_FIELD = '#edf3f8';
const LI_MUTED = 'rgba(0, 0, 0, 0.6)';
const LI_LINE = 'rgba(0, 0, 0, 0.08)';
const FB_BLUE = '#0866ff';
const FB_FEED = '#f0f2f5';
const FB_CHIP = '#e4e6eb';
const FB_MUTED = '#65676b';
const FB_LINE = '#ced0d4';
const FB_BADGE = '#e41e3f';

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
 * The feed's solid icons, drawn here so the mock needs no icon set: each is
 * one or more paths on the same 24 by 24 grid, filled with the colour it
 * inherits.
 */
const ICONS = {
  bookmark: [
    'M6.2 2.5h11.6c.94 0 1.7.76 1.7 1.7v17.05c0 .6-.66.97-1.17.65L12 18.2l-6.33 3.7a.76.76 0 0 1-1.17-.65V4.2c0-.94.76-1.7 1.7-1.7z',
  ],
  comment: [
    'M12 3C6.48 3 2 6.6 2 11.05c0 2.5 1.42 4.74 3.65 6.2L4.5 20.9a.6.6 0 0 0 .85.7l4.3-2.28c.75.11 1.54.17 2.35.17 5.52 0 10-3.6 10-8.44S17.52 3 12 3z',
  ],
  dots: [
    'M5.2 10.1a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z',
    'M12 10.1a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z',
    'M18.8 10.1a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z',
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
  x: [
    'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z',
  ],
};

/**
 * The same grid, drawn as lines. Instagram, YouTube and X all draw outlines,
 * and an outline is what makes a skin read as theirs at a glance.
 */
const LINE_ICONS = {
  bell: [
    'M12 3.4a5.4 5.4 0 0 0-5.4 5.4c0 3.4-.7 4.9-1.8 6.2-.4.5-.1 1.3.6 1.3h13.2c.7 0 1-.8.6-1.3-1.1-1.3-1.8-2.8-1.8-6.2A5.4 5.4 0 0 0 12 3.4z',
    'M9.9 19.2a2.3 2.3 0 0 0 4.2 0',
  ],
  bookmark: ['M6.4 3.6h11.2c.5 0 .9.4.9.9v15.9l-6.5-4.4-6.5 4.4V4.5c0-.5.4-.9.9-.9z'],
  briefcase: [
    'M4.2 8.4h15.6c1 0 1.7.8 1.7 1.7v8.2c0 1-.8 1.7-1.7 1.7H4.2c-1 0-1.7-.8-1.7-1.7v-8.2c0-1 .8-1.7 1.7-1.7z',
    'M8.8 8.4V6.5c0-.9.7-1.6 1.6-1.6h3.2c.9 0 1.6.7 1.6 1.6v1.9',
    'M2.5 12.8h19',
  ],
  camera: [
    'M4.3 7.9h3l1.3-2h6.8l1.3 2h3c1.1 0 2 .9 2 2v8.2c0 1.1-.9 2-2 2H4.3c-1.1 0-2-.9-2-2V9.9c0-1.1.9-2 2-2z',
    'M12 10.4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  ],
  comment: [
    'M12 3.6c4.9 0 8.7 3.3 8.7 7.6s-3.8 7.6-8.7 7.6c-.9 0-1.7-.1-2.5-.3l-4.6 2.3 1.3-3.8c-1.8-1.4-2.9-3.4-2.9-5.8 0-4.3 3.8-7.6 8.7-7.6z',
  ],
  heart: [
    'M12 20.1C7.5 16.3 3.4 13 3.4 9.2A4.5 4.5 0 0 1 7.9 4.7c1.7 0 3.2.9 4.1 2.3 1-1.4 2.4-2.3 4.1-2.3a4.5 4.5 0 0 1 4.5 4.5c0 3.8-4.1 7.1-8.6 10.9z',
  ],
  home: ['M3.6 9.9 12 3.4l8.4 6.5v9.2c0 .8-.6 1.4-1.4 1.4H5c-.8 0-1.4-.6-1.4-1.4V9.9z'],
  mail: [
    'M3.7 5.4h16.6c1 0 1.7.8 1.7 1.7v9.8c0 1-.8 1.7-1.7 1.7H3.7c-1 0-1.7-.8-1.7-1.7V7.1c0-1 .8-1.7 1.7-1.7z',
    'm2.6 6.7 9.4 6.2 9.4-6.2',
  ],
  menu: ['M3.6 6.9h16.8', 'M3.6 12h16.8', 'M3.6 17.1h16.8'],
  message: [
    'M4.2 4.6h15.6c1 0 1.7.8 1.7 1.7v9.4c0 1-.8 1.7-1.7 1.7h-8.4l-4.5 3.3v-3.3H4.2c-1 0-1.7-.8-1.7-1.7V6.3c0-1 .8-1.7 1.7-1.7z',
  ],
  messenger: [
    'M12 3.1c-5 0-9 3.7-9 8.4 0 2.6 1.3 4.9 3.3 6.5v3.4l3.1-1.7c.8.2 1.7.3 2.6.3 5 0 9-3.7 9-8.4s-4-8.5-9-8.5z',
    'm7.4 13.9 3.4-3.6 2.1 2.2 3.7-3.8',
  ],
  network: [
    'M9.3 4.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6z',
    'M2.6 19.4c0-3.2 3-5.5 6.7-5.5s6.7 2.3 6.7 5.5',
    'M17.4 7.9a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z',
    'M18.1 15.5c1.9.4 3.3 2 3.3 3.9',
  ],
  plane: ['M21.4 2.6 2.6 9.4l7.5 2.9 2.9 7.5 8.4-17.2z', 'M10.1 12.3 21.4 2.6'],
  play: [
    'M5.2 4.6h13.6a2.8 2.8 0 0 1 2.8 2.8v9.2a2.8 2.8 0 0 1-2.8 2.8H5.2a2.8 2.8 0 0 1-2.8-2.8V7.4a2.8 2.8 0 0 1 2.8-2.8z',
    'm10.2 9.2 4.6 2.8-4.6 2.8V9.2z',
  ],
  plusCircle: ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6z', 'M12 8.2v7.6', 'M8.2 12h7.6'],
  plusSquare: [
    'M5 4.6h14c.8 0 1.4.6 1.4 1.4v12c0 .8-.6 1.4-1.4 1.4H5c-.8 0-1.4-.6-1.4-1.4V6c0-.8.6-1.4 1.4-1.4z',
    'M12 8.4v7.2',
    'M8.4 12h7.2',
  ],
  reels: [
    'M5.4 3.5h13.2a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5.4a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3z',
    'M2.6 8.6h18.8',
    'm7.6 3.6 2.8 5',
    'm14.2 3.6 2.8 5',
    'm10.4 11.9 4.6 2.6-4.6 2.6v-5.2z',
  ],
  remix: [
    'M4.2 12.6h6.4c.9 0 1.6.7 1.6 1.6v5.2c0 .9-.7 1.6-1.6 1.6H4.2c-.9 0-1.6-.7-1.6-1.6v-5.2c0-.9.7-1.6 1.6-1.6z',
    'M14.6 3.4h6v6',
    'M20.6 3.4 12.4 11.6',
  ],
  repost: [
    'M4.6 9.2V7.6c0-1.3 1-2.3 2.3-2.3h9.6',
    'm13.6 2.3 3 3-3 3',
    'M19.4 14.8v1.6c0 1.3-1 2.3-2.3 2.3H7.5',
    'm10.4 21.7-3-3 3-3',
  ],
  search: ['M11 3.8a7.1 7.1 0 1 1 0 14.2 7.1 7.1 0 0 1 0-14.2z', 'm16.2 16.2 4.6 4.6'],
  share: ['M13.6 4.3 21 10.9l-7.4 6.6v-3.7c-5.2 0-8.6 1.4-10.6 4.5.5-6.3 4.6-9.5 10.6-9.6V4.3z'],
  shop: [
    'M4.7 8.2h14.6l1 11.3c.1.9-.6 1.7-1.5 1.7H5.2c-.9 0-1.6-.8-1.5-1.7L4.7 8.2z',
    'M8.6 10.4V7.2a3.4 3.4 0 0 1 6.8 0v3.2',
  ],
  sparkle: [
    'M11.2 3.4 13 8.8l5.4 1.8-5.4 1.8-1.8 5.4-1.8-5.4L4 10.6l5.4-1.8 1.8-5.4z',
    'm18.4 14.2.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5z',
  ],
  subscriptions: [
    'M6.4 4.4h11.2',
    'M4.2 7.6h15.6',
    'M4.6 10.8h14.8c1.1 0 2 .9 2 2v5.6c0 1.1-.9 2-2 2H4.6c-1.1 0-2-.9-2-2v-5.6c0-1.1.9-2 2-2z',
    'm10.4 13.6 4.4 2.6-4.4 2.6v-5.2z',
  ],
  thumbDown: [
    'M16.6 13.6 12.8 20.6a2.4 2.4 0 0 1-2.4-2.4v-3.6H5.7a2.3 2.3 0 0 1-2.2-2.7l1.3-6.2a2.3 2.3 0 0 1 2.2-1.8h9.6v9.7z',
    'M16.6 13.6h2.8c.9 0 1.6-.7 1.6-1.6V5.5c0-.9-.7-1.6-1.6-1.6h-2.8',
  ],
  thumbUp: [
    'M7.4 10.4 11.2 3.4a2.4 2.4 0 0 1 2.4 2.4v3.6h4.7a2.3 2.3 0 0 1 2.2 2.7l-1.3 6.2a2.3 2.3 0 0 1-2.2 1.8H7.4v-9.7z',
    'M7.4 10.4H4.6c-.9 0-1.6.7-1.6 1.6v6.5c0 .9.7 1.6 1.6 1.6h2.8',
  ],
  upload: [
    'M12 3.4v12.2',
    'm7.6 7.8 4.4-4.4 4.4 4.4',
    'M4.6 13.6v5.2c0 1 .8 1.8 1.8 1.8h11.2c1 0 1.8-.8 1.8-1.8v-5.2',
  ],
  user: [
    'M12 4.2a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8z',
    'M4.2 20.4c0-3.4 3.5-5.8 7.8-5.8s7.8 2.4 7.8 5.8',
  ],
  views: ['M4.4 20.4v-5.2', 'M9.5 20.4V9.6', 'M14.6 20.4v-8', 'M19.7 20.4V4.8'],
};

const styles = create({
  // The audio thumbnail at the foot of a Reels or Shorts rail: a small square
  // of the clip's own frame, turning like the record TikTok draws.
  audio: {
    animationDuration: '8s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: discSpin,
    },
    animationTimingFunction: 'linear',
    backgroundColor: '#3a3a3a',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: '1.6cqw',
    borderStyle: 'solid',
    borderWidth: '0.5cqw',
    boxSizing: 'border-box',
    height: '9cqw',
    marginBlockStart: '1.2cqw',
    width: '9cqw',
  },
  // The handle, the caption and the sound, bottom left, clear of the tab bar.
  caption: {
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.4cqw',
    insetBlockEnd: `${CAPTION_BOTTOM}cqw`,
    insetInlineStart: `${GUTTER}cqw`,
    position: 'absolute',
    textAlign: 'start',
    width: '62%',
  },
  captionAvatar: {
    backgroundColor: '#3a3a3a',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '0.4cqw',
    boxSizing: 'border-box',
    flexShrink: 0,
    height: '7.6cqw',
    width: '7.6cqw',
  },
  captionHandle: {
    fontSize: '3.8cqw',
    fontWeight: font.weightBold,
    lineHeight: 1.2,
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
  },
  // The line under the handle: the same words the clip carries burnt in.
  captionLine: {
    fontSize: '3.2cqw',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
    whiteSpace: 'nowrap',
  },
  // The avatar, the handle and the follow button, all on one line.
  captionRow: {
    alignItems: 'center',
    display: 'flex',
    gap: '2cqw',
    minWidth: 0,
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
  // Facebook: one action under the card, an icon with its word beside it.
  fbAction: {
    alignItems: 'center',
    display: 'flex',
    gap: '1.4cqw',
  },
  fbActionIcon: {
    height: '4.8cqw',
    width: '4.8cqw',
  },
  fbActionLabel: {
    fontSize: '2.9cqw',
    fontWeight: font.weightMedium,
    lineHeight: 1.2,
  },
  fbActions: {
    alignItems: 'center',
    color: FB_MUTED,
    display: 'flex',
    height: `${ROW}cqw`,
    justifyContent: 'space-around',
    paddingInline: `${GAP}cqw`,
  },
  fbAvatar: {
    backgroundColor: FB_CHIP,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: 999,
    flexShrink: 0,
    height: `${AVATAR}cqw`,
    width: `${AVATAR}cqw`,
  },
  // The count on the bell, which is the only red in the bar.
  fbBadge: {
    alignItems: 'center',
    backgroundColor: FB_BADGE,
    borderRadius: 999,
    color: '#fff',
    display: 'flex',
    fontSize: '2.2cqw',
    fontWeight: font.weightBold,
    height: '3.6cqw',
    insetBlockStart: '1.4cqw',
    insetInlineStart: '55%',
    justifyContent: 'center',
    lineHeight: 1,
    position: 'absolute',
    width: '3.6cqw',
  },
  // The whole screen, the grey Facebook stands its cards on.
  fbBoard: {
    backgroundColor: FB_FEED,
    inset: 0,
    position: 'absolute',
  },
  fbCard: {
    backgroundColor: '#fff',
    color: '#050505',
    textAlign: 'start',
  },
  fbDots: {
    color: FB_MUTED,
    flexShrink: 0,
    height: '5cqw',
    width: '5cqw',
  },
  fbEmoji: {
    fontSize: '3.2cqw',
    letterSpacing: '-0.4cqw',
  },
  // The card and the one behind it, with the feed's own grey showing between.
  fbFeed: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${FEED_GAP}cqw`,
    insetBlockStart: `${CARD_TOP + FEED_GAP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  fbHead: {
    alignItems: 'center',
    display: 'flex',
    gap: `${GAP}cqw`,
    paddingBlock: '2.4cqw',
    paddingInline: `${GUTTER}cqw`,
  },
  fbLine: {
    backgroundColor: FB_LINE,
    display: 'block',
    height: '0.2cqw',
    marginInline: `${GUTTER}cqw`,
  },
  // The picture in the post: four by five, the tallest Facebook shows, and
  // capped on a screen this size so the card, the gap under it and the card
  // behind it all still stand. The clip fills the box and is cut to it.
  fbMedia: {
    aspectRatio: '4 / 5',
    maxHeight: '96cqw',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  fbMeta: {
    color: FB_MUTED,
    display: 'block',
    fontSize: '2.7cqw',
    lineHeight: 1.3,
  },
  fbName: {
    fontSize: '3.5cqw',
    fontWeight: font.weightBold,
    lineHeight: 1.2,
  },
  fbPerson: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: '0.4cqw',
    minWidth: 0,
  },
  fbReactions: {
    alignItems: 'center',
    color: FB_MUTED,
    display: 'flex',
    fontSize: '2.8cqw',
    gap: '1.2cqw',
    height: '7.6cqw',
    paddingInline: `${GUTTER}cqw`,
  },
  fbSocial: {
    marginInlineStart: 'auto',
  },
  fbTab: {
    alignItems: 'center',
    color: FB_MUTED,
    display: 'flex',
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  fbTabActive: {
    color: FB_BLUE,
  },
  fbTabIcon: {
    height: '5.6cqw',
    width: '5.6cqw',
  },
  // The tabs sit under the word, the way Facebook has them: the whole app
  // across one row, and a line under the one you are on.
  fbTabs: {
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderBlockEndColor: FB_LINE,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '0.2cqw',
    boxSizing: 'border-box',
    display: 'flex',
    height: `${TAB_ROW}cqw`,
    insetBlockStart: `${TABS_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  fbTabUnderline: {
    backgroundColor: FB_BLUE,
    height: '0.7cqw',
    insetBlockEnd: 0,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  fbText: {
    display: 'block',
    fontSize: '3.3cqw',
    lineHeight: 1.35,
    paddingBlockEnd: '2.4cqw',
    paddingInline: `${GUTTER}cqw`,
  },
  // The bar over the feed: the word in the app's own blue, and the round
  // buttons at the other end. It runs up behind the hour, which is where
  // Facebook puts its white.
  fbTop: {
    alignItems: 'center',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    display: 'flex',
    height: `${TABS_TOP}cqw`,
    insetBlockStart: 0,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    justifyContent: 'space-between',
    paddingBlockStart: `${BAR_TOP}cqw`,
    paddingInline: `${GUTTER}cqw`,
    position: 'absolute',
  },
  fbTopButton: {
    alignItems: 'center',
    backgroundColor: FB_CHIP,
    borderRadius: 999,
    color: '#050505',
    display: 'flex',
    height: '8.2cqw',
    justifyContent: 'center',
    width: '8.2cqw',
  },
  fbTopIcon: {
    height: '4.4cqw',
    width: '4.4cqw',
  },
  fbTopTools: {
    alignItems: 'center',
    display: 'flex',
    gap: '2cqw',
  },
  fbWordmark: {
    color: FB_BLUE,
    fontSize: '6.4cqw',
    fontWeight: font.weightBold,
    letterSpacing: '-0.2cqw',
    lineHeight: 1,
  },
  // An outline button: Instagram's follow, drawn in the line the app gives it.
  followPill: {
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '1cqw',
    borderStyle: 'solid',
    borderWidth: '0.4cqw',
    flexShrink: 0,
    fontSize: '3cqw',
    fontWeight: font.weightBold,
    lineHeight: 1,
    paddingBlock: '1.2cqw',
    paddingInline: '2.4cqw',
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
  // On a light app the pill is the dark one.
  homeIndicatorDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  // Every icon over the picture carries the shadow a feed gives it, so it
  // reads on a bright frame as well as a dark one.
  icon: {
    display: 'block',
    fill: 'currentColor',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))',
  },
  // The same icon drawn as a line. On a card, where nothing is over a
  // picture, the shadow comes off.
  iconLine: {
    display: 'block',
    fill: 'none',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))',
    stroke: 'currentColor',
  },
  iconPlain: {
    filter: 'none',
  },
  liAction: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8cqw',
  },
  liActionIcon: {
    height: '4.6cqw',
    width: '4.6cqw',
  },
  liActionLabel: {
    fontSize: '2.7cqw',
    fontWeight: font.weightMedium,
    lineHeight: 1.2,
  },
  liActions: {
    alignItems: 'center',
    color: LI_MUTED,
    display: 'flex',
    height: `${ROW}cqw`,
    justifyContent: 'space-around',
    paddingInline: `${GAP}cqw`,
  },
  liAvatar: {
    backgroundColor: '#c9c5bd',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: 999,
    flexShrink: 0,
    height: `${AVATAR}cqw`,
    width: `${AVATAR}cqw`,
  },
  // LinkedIn: the whole screen, the light grey its feed sits on.
  liBoard: {
    backgroundColor: LI_FEED,
    inset: 0,
    position: 'absolute',
  },
  // The post itself: white, edge to edge, the way the app stacks them. It
  // stands in the feed under the bar rather than on the screen, so the words
  // under the picture are part of the card and not a row of their own.
  liCard: {
    backgroundColor: '#fff',
    color: '#000',
    textAlign: 'start',
  },
  liDegree: {
    color: LI_MUTED,
    fontSize: '2.9cqw',
    fontWeight: font.weightMedium,
    lineHeight: 1.25,
  },
  liEmoji: {
    fontSize: '3.2cqw',
    letterSpacing: '-0.4cqw',
  },
  // The card, and the next one showing under it.
  liFeed: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${FEED_GAP}cqw`,
    insetBlockStart: `${TABS_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  liFollow: {
    color: LI_BLUE,
    flexShrink: 0,
    fontSize: '3.4cqw',
    fontWeight: font.weightBold,
  },
  liHead: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: `${GAP}cqw`,
    paddingBlock: `${GAP}cqw`,
    paddingInline: `${GUTTER}cqw`,
  },
  liHeadline: {
    color: LI_MUTED,
    display: 'block',
    fontSize: '2.9cqw',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  liLine: {
    backgroundColor: LI_LINE,
    display: 'block',
    height: '0.2cqw',
    marginInline: `${GUTTER}cqw`,
  },
  // The picture in the post: the only part of a light card the wash touches.
  liMedia: {
    aspectRatio: '1 / 1',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  liMeta: {
    color: LI_MUTED,
    display: 'block',
    fontSize: '2.7cqw',
    lineHeight: 1.3,
  },
  liName: {
    fontSize: '3.5cqw',
    fontWeight: font.weightBold,
    lineHeight: 1.25,
  },
  liNameRow: {
    alignItems: 'baseline',
    display: 'flex',
    gap: '1cqw',
  },
  // The nav a light app draws: white, with the word under every icon.
  liNav: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBlockStartColor: LI_LINE,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '0.2cqw',
    color: LI_MUTED,
    display: 'flex',
    flexDirection: 'column',
    height: `${NAV_HEIGHT}cqw`,
    insetBlockEnd: 0,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  liNavActive: {
    color: '#000',
  },
  liPerson: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: '0.4cqw',
    minWidth: 0,
  },
  liReactions: {
    alignItems: 'center',
    color: LI_MUTED,
    display: 'flex',
    fontSize: '2.7cqw',
    gap: '1cqw',
    height: '7.6cqw',
    paddingInline: `${GUTTER}cqw`,
  },
  // The search field the app puts the whole feed under.
  liSearch: {
    alignItems: 'center',
    backgroundColor: LI_FIELD,
    borderRadius: '1cqw',
    color: LI_MUTED,
    display: 'flex',
    flexGrow: 1,
    height: '8cqw',
    paddingInline: '2.4cqw',
  },
  liText: {
    display: 'block',
    fontSize: '3.3cqw',
    lineHeight: 1.35,
    paddingBlockEnd: '2.4cqw',
    paddingInline: `${GUTTER}cqw`,
  },
  liTop: {
    alignItems: 'center',
    backgroundColor: '#fff',
    color: '#000',
    display: 'flex',
    gap: `${GAP}cqw`,
    height: `${BAR}cqw`,
    insetBlockStart: `${BAR_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    paddingInline: `${GUTTER}cqw`,
    position: 'absolute',
  },
  liTopAvatar: {
    backgroundColor: '#c9c5bd',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: 999,
    flexShrink: 0,
    height: '7.6cqw',
    width: '7.6cqw',
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
  // Instagram's avatar tab: the reader's own face, not an icon.
  navAvatar: {
    backgroundColor: '#3a3a3a',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderColor: '#fff',
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '0.4cqw',
    boxSizing: 'border-box',
    height: '5.8cqw',
    width: '5.8cqw',
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
  // A bar with no words under the icons: Instagram's and X's.
  navRowBare: {
    height: '11.4cqw',
    justifyContent: 'space-around',
  },
  // The burnt-in caption: across the middle of the picture, out of the rail's
  // and the caption block's way.
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
  // Inside a media box there is less room either side of the words.
  overlayTight: {
    paddingInline: '5cqw',
  },
  // A dark wash over the clip, so the words are what the eye lands on.
  // The band hugs each line of text the way Instagram sets its captions:
  // an inline box, cloned across line breaks, with rounded ends.
  overlayText: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: '2cqw',
    boxDecorationBreak: 'clone',
    color: '#fff',
    display: 'inline',
    fontSize: '9cqw',
    fontWeight: font.weightBold,
    lineHeight: 1.5,
    paddingBlock: '0.6cqw',
    paddingInline: '2.4cqw',
    textWrap: 'balance',
    WebkitBoxDecorationBreak: 'clone',
  },
  // The next post, showing under the gap: enough of it to say the feed does
  // not stop here.
  peek: {
    alignItems: 'center',
    backgroundColor: '#fff',
    display: 'flex',
    gap: `${GAP}cqw`,
    paddingBlock: '2.4cqw',
    paddingInline: `${GUTTER}cqw`,
  },
  peekAvatar: {
    borderRadius: 999,
    flexShrink: 0,
    height: `${AVATAR}cqw`,
    width: `${AVATAR}cqw`,
  },
  // Each feed's own grey, on the face and on the lines beside it.
  peekFb: {
    backgroundColor: FB_CHIP,
  },
  peekLi: {
    backgroundColor: LI_FIELD,
  },
  peekLine: {
    borderRadius: 999,
    height: '2.6cqw',
    width: '32cqw',
  },
  peekLineShort: {
    width: '19cqw',
  },
  peekText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.6cqw',
  },
  // X's peek stands on the app's own black rather than on a card, and its
  // head sets a name and a handle on one line, so the face keeps to the top.
  peekX: {
    backgroundColor: X_LINE,
  },
  peekXBoard: {
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  peekXHandle: {
    width: '13cqw',
  },
  peekXHead: {
    alignItems: 'center',
    display: 'flex',
    gap: '1.2cqw',
  },
  peekXName: {
    backgroundColor: X_MUTED,
    height: '3cqw',
    width: '18cqw',
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
  // YouTube runs its own line in its own red.
  progressFillRed: {
    backgroundColor: YT_RED,
  },
  progressTrackDim: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  // The actions down the right edge, counted the way a feed counts them.
  rail: {
    alignItems: 'center',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: `${GUTTER}cqw`,
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
    fontSize: '2.6cqw',
    fontWeight: font.weightMedium,
    lineHeight: 1,
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
  },
  // Instagram and YouTube count more actions into the same height, so they
  // draw them smaller and stand them closer than TikTok does.
  railGap: {
    gap: '2.6cqw',
  },
  railIcon: {
    height: '7.4cqw',
    width: '7.4cqw',
  },
  railIconSmall: {
    height: '6.8cqw',
    width: '6.8cqw',
  },
  railItem: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9cqw',
  },
  // Instagram's own word, top left, and the camera at the other corner.
  reelsTitle: {
    fontSize: '5cqw',
    fontWeight: font.weightBold,
    lineHeight: 1,
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)',
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
    insetInlineEnd: `${GUTTER}cqw`,
    position: 'absolute',
    width: '5.2cqw',
  },
  // Darker with every video down the feed: the first is a little dimmed,
  // the last is nearly black.
  shade: {
    backgroundColor: '#000',
    inset: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
  // YouTube's red pill, where Instagram puts its outline.
  subscribePill: {
    backgroundColor: YT_RED,
    borderRadius: '1cqw',
    color: '#fff',
    flexShrink: 0,
    fontSize: '3cqw',
    fontWeight: font.weightBold,
    lineHeight: 1,
    paddingBlock: '1.3cqw',
    paddingInline: '2.6cqw',
  },
  tab: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '3.8cqw',
    fontWeight: font.weightBold,
    lineHeight: 1,
    paddingInline: `${GAP}cqw`,
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
    height: `${BAR}cqw`,
    insetBlockStart: `${BAR_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  tabsRow: {
    alignItems: 'center',
    display: 'flex',
  },
  // The header a short-video app puts over the picture: a word on the left,
  // the tools on the right.
  top: {
    alignItems: 'center',
    color: '#fff',
    display: 'flex',
    height: `${BAR}cqw`,
    insetBlockStart: `${BAR_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    justifyContent: 'space-between',
    paddingInline: `${GUTTER}cqw`,
    position: 'absolute',
  },
  topIcon: {
    height: '6cqw',
    width: '6cqw',
  },
  topTools: {
    alignItems: 'center',
    display: 'flex',
    gap: '4cqw',
  },
  // X: the post card, and the black the app sits on.
  xAction: {
    alignItems: 'center',
    display: 'flex',
    gap: '1.2cqw',
  },
  xActionIcon: {
    height: '4.4cqw',
    width: '4.4cqw',
  },
  xActions: {
    alignItems: 'center',
    color: X_MUTED,
    display: 'flex',
    fontSize: '2.8cqw',
    height: `${ROW_TIGHT}cqw`,
    justifyContent: 'space-between',
    marginBlockStart: '1.4cqw',
  },
  xAvatar: {
    backgroundColor: '#2f3336',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: 999,
    flexShrink: 0,
    height: `${AVATAR}cqw`,
    width: `${AVATAR}cqw`,
  },
  xBoard: {
    backgroundColor: '#000',
    inset: 0,
    position: 'absolute',
  },
  xBody: {
    flexGrow: 1,
    minWidth: 0,
  },
  xCard: {
    color: '#e7e9ea',
    display: 'flex',
    gap: `${GAP}cqw`,
    paddingBlockStart: `${GAP}cqw`,
    paddingInline: `${GUTTER}cqw`,
    textAlign: 'start',
  },
  // The post, and the next one showing under its line: X sets one under the
  // other with no grey between, so the timeline reads as one column.
  xFeed: {
    display: 'flex',
    flexDirection: 'column',
    insetBlockStart: `${CARD_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  xHandle: {
    color: X_MUTED,
    fontSize: '3.3cqw',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  xLine: {
    backgroundColor: X_LINE,
    display: 'block',
    height: '0.2cqw',
    marginBlockStart: `${GAP}cqw`,
  },
  xLogo: {
    height: '5.6cqw',
    width: '5.6cqw',
  },
  // The picture under the words: rounded, and taller than it is wide.
  xMedia: {
    aspectRatio: '3 / 4',
    borderColor: X_LINE,
    borderRadius: '4cqw',
    borderStyle: 'solid',
    borderWidth: '0.2cqw',
    marginBlockStart: `${GAP}cqw`,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  xName: {
    fontSize: '3.5cqw',
    fontWeight: font.weightBold,
    lineHeight: 1.3,
  },
  xNameRow: {
    alignItems: 'center',
    display: 'flex',
    gap: '1.2cqw',
    minWidth: 0,
  },
  xNav: {
    borderBlockStartColor: X_LINE,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '0.2cqw',
  },
  xTab: {
    alignItems: 'center',
    color: X_MUTED,
    display: 'flex',
    flexBasis: 0,
    flexDirection: 'column',
    flexGrow: 1,
    fontSize: '3.4cqw',
    fontWeight: font.weightBold,
    justifyContent: 'center',
    position: 'relative',
  },
  xTabActive: {
    color: '#e7e9ea',
  },
  xTabs: {
    alignItems: 'stretch',
    borderBlockEndColor: X_LINE,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '0.2cqw',
    display: 'flex',
    height: `${TAB_ROW}cqw`,
    insetBlockStart: `${TABS_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
  },
  xTabUnderline: {
    backgroundColor: X_BLUE,
    borderRadius: 999,
    height: '0.9cqw',
    insetBlockEnd: 0,
    position: 'absolute',
    width: '14cqw',
  },
  xText: {
    display: 'block',
    fontSize: '3.6cqw',
    lineHeight: 1.35,
    marginBlockStart: '1cqw',
  },
  // The bar over the timeline: the reader on one side, the mark in the middle.
  xTop: {
    alignItems: 'center',
    color: '#e7e9ea',
    display: 'flex',
    height: `${BAR}cqw`,
    insetBlockStart: `${BAR_TOP}cqw`,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  xTopAvatar: {
    backgroundColor: '#2f3336',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: 999,
    height: '7.3cqw',
    insetInlineStart: `${GUTTER}cqw`,
    position: 'absolute',
    width: '7.3cqw',
  },
});

/** One of the solid icons, at whatever size it is given. */
function Icon({ name, style }: { name: keyof typeof ICONS; style?: StyleXStyles }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.icon, style)}>
      {ICONS[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}

/** One of the line icons. The weight is the one these apps draw at. */
function LineIcon({ name, style }: { name: keyof typeof LINE_ICONS; style?: StyleXStyles }) {
  return (
    <svg
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props(styles.iconLine, style)}
    >
      {LINE_ICONS[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}

/**
 * YouTube's mark: a lozenge on its side with the play cut out of it. The cut
 * is drawn in the black of the bar it stands on, which is the only place the
 * mark appears.
 */
function IconShorts({ style }: { style?: StyleXStyles }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.icon, style)}>
      <rect height="17" rx="4.8" transform="rotate(20 12 12)" width="9.6" x="7.2" y="3.5" />
      <path d="M10.2 8.6 16 12l-5.8 3.4V8.6z" fill="#000" />
    </svg>
  );
}

/** The sound line: two copies of the same words, running as one. */
function Marquee({ text }: { text: string }) {
  return (
    <span {...props(styles.marquee)}>
      <span {...props(styles.marqueeTrack)}>
        <span {...props(styles.marqueeCopy)}>{text}</span>
        <span {...props(styles.marqueeCopy)}>{text}</span>
      </span>
    </span>
  );
}

/**
 * The honest caption, the way a creator burns it into the middle of the
 * video: big, centred, white on a black band.
 */
function Band({ caption, tight }: { caption: string; tight?: boolean | undefined }) {
  return (
    <div {...props(styles.overlay, tight === true && styles.overlayTight)}>
      <span {...props(styles.overlayText)}>{caption}</span>
    </div>
  );
}

/** The wash over the clip, deeper with every slot down the feed. */
function Shade({ value }: { value: number }) {
  return <span style={{ opacity: value }} {...props(styles.shade)} />;
}

/** A count the way a feed writes it: thousands grouped, ten thousand and up in K. */
function formatCount(value: number): string {
  if (value >= 10_000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return String(value).replaceAll(/\B(?=(\d{3})+$)/g, ',');
}

/** The name over a post, read out of the handle: @two.mics is Two Mics. */
function displayName(handle: string): string {
  return handle
    .replace(/^@/, '')
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Off screen, nothing turns and nothing runs. */
function spin(current: boolean) {
  return { animationPlayState: current ? 'running' : 'paused' } as const;
}

/**
 * TikTok, which is the app the feed was drawn as: the two feeds at the top,
 * the rail down the right, the handle and the sound at the foot, and the
 * plus in the middle of the bar.
 */
function TikTokChrome({
  caption,
  clip,
  counts,
  current,
  frame,
  handle,
  played,
  shade,
}: ChromeProps) {
  return (
    <>
      {clip}
      <span {...props(styles.scrimTop)} />
      <span {...props(styles.scrimBottom)} />
      <div {...props(styles.rail)}>
        <span style={frame} {...props(styles.railAvatar)}>
          <span {...props(styles.railBadge)}>
            <Icon name="plus" style={styles.railBadgeIcon} />
          </span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="heart" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(counts.likes)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="comment" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(counts.comments)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="bookmark" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(counts.saves)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <Icon name="share" style={styles.railIcon} />
          <span {...props(styles.railCount)}>{formatCount(counts.shares)}</span>
        </span>
        <span style={spin(current)} {...props(styles.disc)}>
          <span style={frame} {...props(styles.discCore)} />
        </span>
      </div>
      <Shade value={shade} />
      <Band caption={caption} />
      <div {...props(styles.caption)}>
        <span {...props(styles.captionHandle)}>{handle}</span>
        <span {...props(styles.music)}>
          <Icon name="music" style={styles.musicIcon} />
          <Marquee text={m.home_feed_sound({ name: handle })} />
        </span>
      </div>
      <span {...props(styles.progress)}>
        <span style={{ width: `${played}%` }} {...props(styles.progressFill)} />
      </span>
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
    </>
  );
}

/**
 * Instagram Reels: the word at the top left, a camera at the right, outlined
 * actions down the rail, and the reader's own face in the bar.
 */
function ReelsChrome({
  caption,
  clip,
  counts,
  current,
  frame,
  handle,
  played,
  shade,
}: ChromeProps) {
  return (
    <>
      {clip}
      <span {...props(styles.scrimTop)} />
      <span {...props(styles.scrimBottom)} />
      <div {...props(styles.rail, styles.railGap)}>
        <span {...props(styles.railItem)}>
          <LineIcon name="heart" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{formatCount(counts.likes)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <LineIcon name="comment" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{formatCount(counts.comments)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <LineIcon name="plane" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{formatCount(counts.shares)}</span>
        </span>
        <Icon name="dots" style={[styles.railIcon, styles.railIconSmall]} />
        <span style={{ ...frame, ...spin(current) }} {...props(styles.audio)} />
      </div>
      <Shade value={shade} />
      <Band caption={caption} />
      <div {...props(styles.caption)}>
        <span {...props(styles.captionRow)}>
          <span style={frame} {...props(styles.captionAvatar)} />
          <span {...props(styles.captionHandle)}>{handle}</span>
          <span {...props(styles.followPill)}>{m.home_feed_ui_follow()}</span>
        </span>
        <span {...props(styles.captionLine)}>{caption}</span>
        <span {...props(styles.music)}>
          <Icon name="music" style={styles.musicIcon} />
          <Marquee text={m.home_feed_ui_original_audio({ name: handle })} />
        </span>
      </div>
      <span {...props(styles.progress)}>
        <span style={{ width: `${played}%` }} {...props(styles.progressFill)} />
      </span>
      <div {...props(styles.top)}>
        <span {...props(styles.reelsTitle)}>{m.home_feed_ui_reels()}</span>
        <LineIcon name="camera" style={styles.topIcon} />
      </div>
      <div {...props(styles.nav)}>
        <div {...props(styles.navRow, styles.navRowBare)}>
          <LineIcon name="home" style={styles.navIcon} />
          <LineIcon name="search" style={styles.navIcon} />
          <LineIcon name="reels" style={styles.navIcon} />
          <LineIcon name="shop" style={styles.navIcon} />
          <span style={frame} {...props(styles.navAvatar)} />
        </div>
        <span {...props(styles.homeIndicator)} />
      </div>
    </>
  );
}

/**
 * YouTube Shorts: thumbs both ways, words under every action, a red pill
 * beside the handle, and the app's own red line at the foot.
 */
function ShortsChrome({
  caption,
  clip,
  counts,
  current,
  frame,
  handle,
  played,
  shade,
}: ChromeProps) {
  return (
    <>
      {clip}
      <span {...props(styles.scrimTop)} />
      <span {...props(styles.scrimBottom)} />
      <div {...props(styles.rail, styles.railGap)}>
        <span {...props(styles.railItem)}>
          <LineIcon name="thumbUp" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{formatCount(counts.likes)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <LineIcon name="thumbDown" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{m.home_feed_ui_dislike()}</span>
        </span>
        <span {...props(styles.railItem)}>
          <LineIcon name="comment" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{formatCount(counts.comments)}</span>
        </span>
        <span {...props(styles.railItem)}>
          <LineIcon name="share" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{m.home_feed_ui_share()}</span>
        </span>
        <span {...props(styles.railItem)}>
          <LineIcon name="remix" style={[styles.railIcon, styles.railIconSmall]} />
          <span {...props(styles.railCount)}>{m.home_feed_ui_remix()}</span>
        </span>
        <span style={{ ...frame, ...spin(current) }} {...props(styles.audio)} />
      </div>
      <Shade value={shade} />
      <Band caption={caption} />
      <div {...props(styles.caption)}>
        <span {...props(styles.captionRow)}>
          <span style={frame} {...props(styles.captionAvatar)} />
          <span {...props(styles.captionHandle)}>{handle}</span>
          <span {...props(styles.subscribePill)}>{m.home_feed_ui_subscribe()}</span>
        </span>
        <span {...props(styles.captionLine)}>{caption}</span>
        <span {...props(styles.music)}>
          <Icon name="music" style={styles.musicIcon} />
          <Marquee text={m.home_feed_sound({ name: handle })} />
        </span>
      </div>
      <span {...props(styles.progress, styles.progressTrackDim)}>
        <span
          style={{ width: `${played}%` }}
          {...props(styles.progressFill, styles.progressFillRed)}
        />
      </span>
      <div {...props(styles.top)}>
        <span {...props(styles.reelsTitle)}>{m.home_feed_ui_shorts()}</span>
        <span {...props(styles.topTools)}>
          <LineIcon name="search" style={styles.topIcon} />
          <LineIcon name="camera" style={styles.topIcon} />
          <Icon name="dots" style={styles.topIcon} />
        </span>
      </div>
      <div {...props(styles.nav)}>
        <div {...props(styles.navRow)}>
          <span {...props(styles.navItem, styles.navItemMuted)}>
            <LineIcon name="home" style={styles.navIcon} />
            <span {...props(styles.navLabel)}>{m.home_feed_nav_home()}</span>
          </span>
          <span {...props(styles.navItem)}>
            <IconShorts style={styles.navIcon} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_shorts()}</span>
          </span>
          <LineIcon name="plusCircle" style={styles.navIcon} />
          <span {...props(styles.navItem, styles.navItemMuted)}>
            <LineIcon name="subscriptions" style={styles.navIcon} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_yt_subscriptions()}</span>
          </span>
          <span {...props(styles.navItem, styles.navItemMuted)}>
            <LineIcon name="user" style={styles.navIcon} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_yt_you()}</span>
          </span>
        </div>
        <span {...props(styles.homeIndicator)} />
      </div>
    </>
  );
}

/**
 * X: not a feed of full-screen videos at all, but a timeline. The clip is a
 * picture inside a post, and the post is what the reader scrolls past.
 */
function XChrome({ caption, clip, counts, frame, handle, shade }: ChromeProps) {
  return (
    <>
      <span {...props(styles.xBoard)} />
      <div {...props(styles.xFeed)}>
        <div {...props(styles.xCard)}>
          <span style={frame} {...props(styles.xAvatar)} />
          <div {...props(styles.xBody)}>
            <span {...props(styles.xNameRow)}>
              <span {...props(styles.xName)}>{displayName(handle)}</span>
              <span {...props(styles.xHandle)}>{m.home_feed_ui_x_meta({ handle })}</span>
            </span>
            <span {...props(styles.xText)}>{m.home_feed_x_text()}</span>
            <div {...props(styles.xMedia)}>
              {clip}
              <Shade value={shade} />
              <Band caption={caption} tight />
            </div>
            <div {...props(styles.xActions)}>
              <span {...props(styles.xAction)}>
                <LineIcon name="comment" style={styles.xActionIcon} />
                {formatCount(counts.comments)}
              </span>
              <span {...props(styles.xAction)}>
                <LineIcon name="repost" style={styles.xActionIcon} />
                {formatCount(counts.shares)}
              </span>
              <span {...props(styles.xAction)}>
                <LineIcon name="heart" style={styles.xActionIcon} />
                {formatCount(counts.likes)}
              </span>
              <span {...props(styles.xAction)}>
                <LineIcon name="views" style={styles.xActionIcon} />
                {formatCount(counts.likes * 12)}
              </span>
              <span {...props(styles.xAction)}>
                <LineIcon name="bookmark" style={styles.xActionIcon} />
              </span>
              <span {...props(styles.xAction)}>
                <LineIcon name="upload" style={styles.xActionIcon} />
              </span>
            </div>
            <span {...props(styles.xLine)} />
          </div>
        </div>
        <div {...props(styles.peek, styles.peekXBoard)}>
          <span {...props(styles.peekAvatar, styles.peekX)} />
          <span {...props(styles.peekText)}>
            <span {...props(styles.peekXHead)}>
              <span {...props(styles.peekLine, styles.peekXName)} />
              <span {...props(styles.peekLine, styles.peekX, styles.peekXHandle)} />
            </span>
            <span {...props(styles.peekLine, styles.peekX)} />
            <span {...props(styles.peekLine, styles.peekLineShort, styles.peekX)} />
          </span>
        </div>
      </div>
      <div {...props(styles.xTop)}>
        <span style={frame} {...props(styles.xTopAvatar)} />
        <Icon name="x" style={styles.xLogo} />
      </div>
      <div {...props(styles.xTabs)}>
        <span {...props(styles.xTab, styles.xTabActive)}>
          {m.home_feed_tab_foryou()}
          <span {...props(styles.xTabUnderline)} />
        </span>
        <span {...props(styles.xTab)}>{m.home_feed_tab_following()}</span>
      </div>
      <div {...props(styles.nav, styles.xNav)}>
        <div {...props(styles.navRow, styles.navRowBare)}>
          <Icon name="home" style={styles.navIcon} />
          <LineIcon name="search" style={styles.navIcon} />
          <LineIcon name="sparkle" style={styles.navIcon} />
          <LineIcon name="bell" style={styles.navIcon} />
          <LineIcon name="mail" style={styles.navIcon} />
        </div>
        <span {...props(styles.homeIndicator)} />
      </div>
    </>
  );
}

/**
 * LinkedIn: the same clip, in a suit. A white card on light grey, a headline
 * nobody reads, and four words under the picture instead of a rail.
 */
function LinkedInChrome({ caption, clip, counts, frame, handle, shade }: ChromeProps) {
  return (
    <>
      <span {...props(styles.liBoard)} />
      <div {...props(styles.liTop)}>
        <span style={frame} {...props(styles.liTopAvatar)} />
        <span {...props(styles.liSearch)}>
          <LineIcon name="search" style={[styles.topIcon, styles.iconPlain]} />
        </span>
        <LineIcon name="message" style={[styles.topIcon, styles.iconPlain]} />
      </div>
      <div {...props(styles.liFeed)}>
        <div {...props(styles.liCard)}>
          <div {...props(styles.liHead)}>
            <span style={frame} {...props(styles.liAvatar)} />
            <span {...props(styles.liPerson)}>
              <span {...props(styles.liNameRow)}>
                <span {...props(styles.liName)}>{displayName(handle)}</span>
                <span {...props(styles.liDegree)}>{m.home_feed_ui_li_degree()}</span>
              </span>
              <span {...props(styles.liHeadline)}>{m.home_feed_linkedin_headline()}</span>
              <span {...props(styles.liMeta)}>{m.home_feed_ui_li_posted()}</span>
            </span>
            <span {...props(styles.liFollow)}>{m.home_feed_ui_follow()}</span>
          </div>
          <span {...props(styles.liText)}>{m.home_feed_linkedin_text()}</span>
          <div {...props(styles.liMedia)}>
            {clip}
            <Shade value={shade} />
            <Band caption={caption} tight />
          </div>
          <div {...props(styles.liReactions)}>
            <span {...props(styles.liEmoji)}>{m.home_feed_ui_li_reactions()}</span>
            <span>
              {m.home_feed_ui_li_social({
                comments: formatCount(counts.comments),
                likes: formatCount(counts.likes),
                reposts: formatCount(counts.saves),
              })}
            </span>
          </div>
          <span {...props(styles.liLine)} />
          <div {...props(styles.liActions)}>
            <span {...props(styles.liAction)}>
              <LineIcon name="thumbUp" style={[styles.liActionIcon, styles.iconPlain]} />
              <span {...props(styles.liActionLabel)}>{m.home_feed_ui_like()}</span>
            </span>
            <span {...props(styles.liAction)}>
              <LineIcon name="comment" style={[styles.liActionIcon, styles.iconPlain]} />
              <span {...props(styles.liActionLabel)}>{m.home_feed_ui_comment()}</span>
            </span>
            <span {...props(styles.liAction)}>
              <LineIcon name="repost" style={[styles.liActionIcon, styles.iconPlain]} />
              <span {...props(styles.liActionLabel)}>{m.home_feed_ui_repost()}</span>
            </span>
            <span {...props(styles.liAction)}>
              <LineIcon name="plane" style={[styles.liActionIcon, styles.iconPlain]} />
              <span {...props(styles.liActionLabel)}>{m.home_feed_ui_send()}</span>
            </span>
          </div>
        </div>
        <div {...props(styles.peek)}>
          <span {...props(styles.peekAvatar, styles.peekLi)} />
          <span {...props(styles.peekText)}>
            <span {...props(styles.peekLine, styles.peekLi)} />
            <span {...props(styles.peekLine, styles.peekLineShort, styles.peekLi)} />
          </span>
        </div>
      </div>
      <div {...props(styles.liNav)}>
        <div {...props(styles.navRow)}>
          <span {...props(styles.navItem, styles.liNavActive)}>
            <LineIcon name="home" style={[styles.navIcon, styles.iconPlain]} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_li_home()}</span>
          </span>
          <span {...props(styles.navItem)}>
            <LineIcon name="network" style={[styles.navIcon, styles.iconPlain]} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_li_network()}</span>
          </span>
          <span {...props(styles.navItem)}>
            <LineIcon name="plusSquare" style={[styles.navIcon, styles.iconPlain]} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_li_post()}</span>
          </span>
          <span {...props(styles.navItem)}>
            <LineIcon name="bell" style={[styles.navIcon, styles.iconPlain]} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_li_notifications()}</span>
          </span>
          <span {...props(styles.navItem)}>
            <LineIcon name="briefcase" style={[styles.navIcon, styles.iconPlain]} />
            <span {...props(styles.navLabel)}>{m.home_feed_ui_li_jobs()}</span>
          </span>
        </div>
        <span {...props(styles.homeIndicator, styles.homeIndicatorDark)} />
      </div>
    </>
  );
}

/**
 * Facebook: the app everybody still has. The word in blue, the whole app in a
 * row of tabs under it, one white card on grey, and the next card already
 * showing at the foot so the feed reads as a feed.
 */
function FacebookChrome({ caption, clip, counts, frame, handle, shade }: ChromeProps) {
  return (
    <>
      <span {...props(styles.fbBoard)} />
      <div {...props(styles.fbTop)}>
        <span {...props(styles.fbWordmark)}>{m.home_feed_ui_fb_wordmark()}</span>
        <span {...props(styles.fbTopTools)}>
          <span {...props(styles.fbTopButton)}>
            <Icon name="plus" style={[styles.fbTopIcon, styles.iconPlain]} />
          </span>
          <span {...props(styles.fbTopButton)}>
            <LineIcon name="search" style={[styles.fbTopIcon, styles.iconPlain]} />
          </span>
          <span {...props(styles.fbTopButton)}>
            <LineIcon name="messenger" style={[styles.fbTopIcon, styles.iconPlain]} />
          </span>
        </span>
      </div>
      <div {...props(styles.fbTabs)}>
        <span {...props(styles.fbTab, styles.fbTabActive)}>
          <LineIcon name="home" style={[styles.fbTabIcon, styles.iconPlain]} />
          <span {...props(styles.fbTabUnderline)} />
        </span>
        <span {...props(styles.fbTab)}>
          <LineIcon name="play" style={[styles.fbTabIcon, styles.iconPlain]} />
        </span>
        <span {...props(styles.fbTab)}>
          <LineIcon name="network" style={[styles.fbTabIcon, styles.iconPlain]} />
        </span>
        <span {...props(styles.fbTab)}>
          <LineIcon name="shop" style={[styles.fbTabIcon, styles.iconPlain]} />
        </span>
        <span {...props(styles.fbTab)}>
          <LineIcon name="bell" style={[styles.fbTabIcon, styles.iconPlain]} />
          <span {...props(styles.fbBadge)}>{m.home_feed_ui_fb_badge()}</span>
        </span>
        <span {...props(styles.fbTab)}>
          <LineIcon name="menu" style={[styles.fbTabIcon, styles.iconPlain]} />
        </span>
      </div>
      <div {...props(styles.fbFeed)}>
        <div {...props(styles.fbCard)}>
          <div {...props(styles.fbHead)}>
            <span style={frame} {...props(styles.fbAvatar)} />
            <span {...props(styles.fbPerson)}>
              <span {...props(styles.fbName)}>{displayName(handle)}</span>
              <span {...props(styles.fbMeta)}>{m.home_feed_ui_fb_posted()}</span>
            </span>
            <Icon name="dots" style={[styles.fbDots, styles.iconPlain]} />
          </div>
          <span {...props(styles.fbText)}>{caption}</span>
          <div {...props(styles.fbMedia)}>
            {clip}
            <Shade value={shade} />
            <Band caption={caption} tight />
          </div>
          <div {...props(styles.fbReactions)}>
            <span {...props(styles.fbEmoji)}>{m.home_feed_ui_fb_reactions()}</span>
            <span>{formatCount(counts.likes)}</span>
            <span {...props(styles.fbSocial)}>
              {m.home_feed_ui_fb_social({
                comments: formatCount(counts.comments),
                shares: formatCount(counts.shares),
              })}
            </span>
          </div>
          <span {...props(styles.fbLine)} />
          <div {...props(styles.fbActions)}>
            <span {...props(styles.fbAction)}>
              <LineIcon name="thumbUp" style={[styles.fbActionIcon, styles.iconPlain]} />
              <span {...props(styles.fbActionLabel)}>{m.home_feed_ui_like()}</span>
            </span>
            <span {...props(styles.fbAction)}>
              <LineIcon name="comment" style={[styles.fbActionIcon, styles.iconPlain]} />
              <span {...props(styles.fbActionLabel)}>{m.home_feed_ui_comment()}</span>
            </span>
            <span {...props(styles.fbAction)}>
              <LineIcon name="plane" style={[styles.fbActionIcon, styles.iconPlain]} />
              <span {...props(styles.fbActionLabel)}>{m.home_feed_ui_send()}</span>
            </span>
            <span {...props(styles.fbAction)}>
              <LineIcon name="share" style={[styles.fbActionIcon, styles.iconPlain]} />
              <span {...props(styles.fbActionLabel)}>{m.home_feed_ui_share()}</span>
            </span>
          </div>
        </div>
        <div {...props(styles.peek)}>
          <span {...props(styles.peekAvatar, styles.peekFb)} />
          <span {...props(styles.peekText)}>
            <span {...props(styles.peekLine, styles.peekFb)} />
            <span {...props(styles.peekLine, styles.peekLineShort, styles.peekFb)} />
          </span>
        </div>
      </div>
      <span {...props(styles.homeIndicator, styles.homeIndicatorDark)} />
    </>
  );
}

/** The skin a slot wears, by the name the slot carries. */
export const CHROMES: Record<Platform, (chrome: ChromeProps) => ReactNode> = {
  facebook: FacebookChrome,
  linkedin: LinkedInChrome,
  reels: ReelsChrome,
  shorts: ShortsChrome,
  tiktok: TikTokChrome,
  x: XChrome,
};
