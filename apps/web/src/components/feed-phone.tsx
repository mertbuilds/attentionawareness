import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { playClick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { CHROMES } from './feed-chrome.tsx';
import type { Platform } from './feed-chrome.tsx';

/** One caption per clip, by its place in the feed. */
const HANDLES = [
  m.home_feed_handle_1,
  m.home_feed_handle_2,
  m.home_feed_handle_3,
  m.home_feed_handle_4,
  m.home_feed_handle_5,
  m.home_feed_handle_6,
  m.home_feed_handle_7,
  m.home_feed_handle_8,
  m.home_feed_handle_9,
  m.home_feed_handle_10,
  m.home_feed_handle_11,
  m.home_feed_handle_12,
];

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

/**
 * What each slot posts, under the handle or over the picture, by its place in
 * the feed. The black slot at the end posts nothing.
 */
const POSTS = [
  m.home_feed_post_1,
  m.home_feed_post_2,
  m.home_feed_post_3,
  m.home_feed_post_4,
  m.home_feed_post_5,
  m.home_feed_post_6,
  m.home_feed_post_7,
  m.home_feed_post_8,
  m.home_feed_post_9,
  m.home_feed_post_10,
  m.home_feed_post_11,
];

/**
 * The app each slot wears: the six of them in turn, over and over down the
 * feed. It is the same clips and the same words the whole way; only the
 * chrome around them changes hands.
 */
const PLATFORMS: ReadonlyArray<Platform> = [
  'tiktok',
  'reels',
  'shorts',
  'x',
  'linkedin',
  'facebook',
];

/** The beat the feed waits before it starts showing itself. */
const DEMO_START_MS = 700;
/**
 * The show is a cold shower: the first clip is held long enough to read, and
 * every clip after it is held less, down to a floor no eye can keep up with.
 * The pauses run 2000, 1560, 1217, 949, 740, 577, 450, 351, 300, 300, 300.
 */
const SHOW_FIRST_MS = 2000;
const SHOW_FALL = 0.78;
const SHOW_FLOOR_MS = 300;
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
/** The curve it travels on: the one the transition was written in. */
const SNAP_EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
/** Videos in the feed: one per clip shot for it, 01 through 11, and the black one. */
const VIDEO_COUNT = 12;
/**
 * How near the video on screen a clip has to be to be asked for at all. The
 * two on either side keep the next move ready; the rest ask the network for
 * nothing until the feed comes to them, so no phone holds twelve clips open.
 */
const PRELOAD_REACH = 2;
/**
 * The slot the feed ends on: a black screen with the same chrome over it.
 * There is no clip and no poster frame behind it, so it asks the network for
 * nothing, and there is nothing to 404 on.
 */
const BLANK_INDEX = VIDEO_COUNT - 1;
/** An iPhone 15 Pro is 71.6 by 146.6 millimetres: the mock keeps that shape. */
const PHONE_WIDTH = 71.6;
const PHONE_HEIGHT = 146.6;
/**
 * The body's corner on the box the body fills. Inside that box the corner is
 * 17cqw, but a box cannot query itself: 17cqw written on the box would measure
 * the window instead. It is the same corner in percentages here, 17 of the
 * width across and, on this shape, 8.3 of the height down, which comes to the
 * same number both ways. Only the focus ring is drawn from it.
 */
const SHELL_RADIUS = '17% / 8.3%';
/** How tall the mock stands on a wide screen, and on a short one. */
const PHONE_TALL = 430;
const PHONE_TALL_SHORT = 300;
/** Until the screen is measured, a video is this tall. */
const SCREEN_FALLBACK = PHONE_TALL - 14;
/**
 * Every part of the feed is drawn in the phone body's own width, so the whole
 * thing holds together at any size the mock is given. The screen is 89.6 of
 * those hundredths wide and an iPhone screen is 393 points wide, so a point is
 * roughly 0.23 of them: that is the ratio every number here, and every number
 * in the chrome beside it, comes from.
 */
/** Each video is its own dark wash, so the eye sees the cut between them. */
const WASHES = [
  'linear-gradient(160deg, #2a1f3d, #0f0a1a)',
  'linear-gradient(160deg, #1f3d2a, #0a1a0f)',
  'linear-gradient(160deg, #3d2a1f, #1a0f0a)',
  'linear-gradient(160deg, #1f2a3d, #0a0f1a)',
  'linear-gradient(160deg, #3d1f2a, #1a0a0f)',
];

const styles = create({
  feed: {
    display: 'flex',
    flexDirection: 'column',
    willChange: 'transform',
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
  // The status icons carry the shadow a feed gives them, so they read on a
  // bright frame as well as a dark one.
  icon: {
    display: 'block',
    fill: 'currentColor',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))',
  },
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
  // One key, drawn the way a key is: a hairline box around the arrow on it.
  keycap: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'inline-flex',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  // What the two arrows do, in the corner of the window. It is a keyboard's
  // line: a reader who swipes has no keys to be told about, and never sees it.
  keys: {
    alignItems: 'center',
    color: colors.muted,
    display: {
      '@media (hover: none)': 'none',
      '@media (max-width: 639px)': 'none',
      default: 'flex',
    },
    fontSize: 12,
    gap: spacing.s1,
    insetBlockEnd: spacing.s4,
    insetInlineEnd: spacing.s4,
    lineHeight: 1,
    opacity: 0,
    position: 'fixed',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '400ms',
    },
    transitionProperty: 'opacity, visibility',
    transitionTimingFunction: 'ease-in-out',
    visibility: 'hidden',
    zIndex: 30,
  },
  keysShown: {
    opacity: 1,
    visibility: 'visible',
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
  // The screen inside the bezel. Its corner is concentric with the body's:
  // the outer radius less the rim and the bezel, 17 minus 2.2 minus 3.
  screen: {
    borderRadius: '11.8cqw',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  // The box the phone is sized in: the shape of an iPhone 15 Pro, 71.6 by
  // 146.6, and the thing that takes every scroll and drag aimed at it.
  shell: {
    aspectRatio: `${PHONE_WIDTH} / ${PHONE_HEIGHT}`,
    borderRadius: SHELL_RADIUS,
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
    // The ring the keyboard gets, and only it: it takes the phone's own corner
    // and stands off it, so what is marked is the phone rather than a box.
    outlineColor: colors.fg,
    outlineOffset: 4,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
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
  // Over a light app the hour and the icons are the dark ones.
  statusBarDark: {
    color: '#000',
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
  // The end of the feed: black, whatever the wash would have been.
  videoBlank: {
    backgroundColor: '#000',
  },
  // One video: the whole screen, with its own chrome over it.
  video: {
    boxSizing: 'border-box',
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  // The clip fills whatever it is put in, under everything else: the screen
  // on a short-video app, the media box on a timeline.
  videoClip: {
    height: '100%',
    insetBlockStart: 0,
    insetInlineStart: 0,
    objectFit: 'cover',
    position: 'absolute',
    width: '100%',
  },
});

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

/**
 * How dark the wash over a video is: nothing at all down the first seven, and
 * from the eighth on a little at first and almost all at the foot of the feed.
 */
const SHADE_FROM_INDEX = 7;
const SHADE_FIRST = 0.3;
const SHADE_LAST = 0.96;
function shadeFor(index: number): number {
  const last = VIDEO_COUNT - 1;
  if (index < SHADE_FROM_INDEX) {
    return 0;
  }
  const at = (Math.min(index, last) - SHADE_FROM_INDEX) / (last - SHADE_FROM_INDEX);
  return SHADE_FIRST + (SHADE_LAST - SHADE_FIRST) * at;
}

/** No further up than the first video, and no further down than the last. */
function inFeed(place: number): number {
  return Math.min(VIDEO_COUNT - 1, Math.max(0, place));
}

/** A key pressed into a field, or into a word being edited, is not the feed's. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName;
  return (
    element?.isContentEditable === true || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  );
}

/** The slot a clip wears, and the black one at the end, which keeps TikTok's. */
function platformFor(index: number): Platform {
  return index === BLANK_INDEX ? 'tiktok' : (PLATFORMS[index % PLATFORMS.length] ?? 'tiktok');
}

/**
 * The clip a video plays, by its place in the feed: 01.mp4 is the first. Each
 * one is cut twice, `01.av1.mp4` and `01.mp4`, and shown behind `01.jpg`.
 */
function clipUrl(index: number, kind: 'av1.mp4' | 'jpg' | 'mp4'): string {
  return `/media/feed/${String(index + 1).padStart(2, '0')}.${kind}`;
}
/** What the small cut is, so a browser that can read AV1 takes it. */
const AV1_TYPE = 'video/mp4; codecs=av01.0.05M.08';

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

/**
 * One video of the feed. The clip plays only while this is the video on
 * screen, muted and looping, over a wash that stands in until the file has
 * loaded or when there is none. A slot the feed is nowhere near asks for no
 * clip at all. The chrome around it is whichever app this slot wears: the
 * clip, the wash and the burnt-in caption are the same in every one of them.
 */
function Video({
  current,
  height,
  index,
  near,
}: {
  current: boolean;
  height: number;
  index: number;
  near: boolean;
}) {
  const handle = HANDLES[index]?.() ?? HANDLES[0]?.() ?? '';
  const video = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(0);
  const poster = clipUrl(index, 'jpg');
  const blank = index === BLANK_INDEX;
  // The avatar and the record wear the clip's own frame. The black slot has
  // no frame to wear, so they keep the flat grey their styles give them.
  const frame = blank ? undefined : { backgroundImage: `url("${poster}")` };
  const Chrome = CHROMES[platformFor(index)];
  useEffect(() => {
    const element = video.current;
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
      style={blank ? { height } : { backgroundImage: WASHES[index % WASHES.length], height }}
      {...props(styles.video, blank && styles.videoBlank)}
    >
      <Chrome
        caption={CAPTIONS[index]?.() ?? ''}
        clip={
          blank ? null : (
            <video
              loop
              muted
              onTimeUpdate={onTimeUpdate}
              playsInline
              poster={poster}
              preload={current ? 'auto' : near ? 'metadata' : 'none'}
              ref={video}
              {...props(styles.videoClip)}
            >
              <source src={clipUrl(index, 'av1.mp4')} type={AV1_TYPE} />
              <source src={clipUrl(index, 'mp4')} type="video/mp4" />
            </video>
          )
        }
        counts={counts(index)}
        current={current}
        frame={frame}
        handle={handle}
        played={played}
        post={POSTS[index]?.() ?? ''}
        shade={shadeFor(index)}
      />
    </div>
  );
}

/**
 * The feed the page opens on: a phone that scrolls itself, faster with every
 * clip, from the first to the twelfth and no further. It answers nothing and
 * counts nothing. Once the show has run the reader can move it by hand, which
 * is all that does: it moves the feed.
 */
export function FeedPhone({
  onDone,
  sound,
}: {
  /** The show has reached the last clip. */
  onDone?: (() => void) | undefined;
  sound: boolean;
}) {
  // The video the feed stands on. It changes as the feed passes the half way
  // mark to the next one and at no other time, so a drag between two videos
  // renders nothing.
  const [position, setPosition] = useState(0);
  const [screenHeight, setScreenHeight] = useState(SCREEN_FALLBACK);
  const [held, setHeld] = useState(false);
  // Where the feed is, in pixels up from the first video. The track is moved
  // by this and by nothing else: a hand on it never goes through React.
  const y = useMotionValue(0);
  const reduced = useReducedMotion();
  const phone = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  // The same place, counted in videos; a fraction mid-drag.
  const travelled = useRef(0);
  // The whole clip the feed last landed on, so a landing sounds once.
  const landed = useRef(0);
  const holding = useRef(false);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The travel to a whole video, while there is one running.
  const snap = useRef<ReturnType<typeof animate> | null>(null);
  // The feed is not the reader's until the show has played.
  const showing = useRef(true);
  const [ready, setReady] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(0);
  const lastAt = useRef(0);
  const velocity = useRef(0);
  const dragFrom = useRef(0);
  const latest = useRef({ onDone, reduced, screenHeight, sound });
  latest.current = { onDone, reduced, screenHeight, sound };
  // The hour and the icons belong to the phone, not to the app, but they have
  // to be read against whatever the app on screen is: dark words on a light one.
  const skin = platformFor(position);
  const light = skin === 'facebook' || skin === 'linkedin';

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

  // The screen has been measured, or the window has changed shape: the feed
  // stands on the video it stood on, at the height that video now is.
  useEffect(() => {
    snap.current?.stop();
    y.set(-travelled.current * screenHeight);
  }, [screenHeight, y]);

  // The feed has come to a whole video: it says so once, and that video is
  // the one that plays. Every landing there is comes through here, and the
  // clip it last landed on is what keeps one landing to one click.
  function land(whole: number) {
    if (whole === landed.current) {
      return;
    }
    landed.current = whole;
    if (latest.current.sound) {
      primeTickSound();
      playClick();
    }
    setPosition(whole);
  }

  // The feed goes where it is put, at once: a hand on it, or a wheel under it.
  function moveTo(next: number) {
    snap.current?.stop();
    travelled.current = inFeed(next);
    y.set(-travelled.current * latest.current.screenHeight);
  }

  function moveBy(pixels: number) {
    moveTo(travelled.current + pixels / latest.current.screenHeight);
  }

  // The feed travels to a whole video, on the curve the transition had before
  // it. A reader who asked for less motion is put there instead. Where it
  // lands is not said here: the track says it, once, on its way.
  function snapTo(whole: number) {
    const target = inFeed(whole);
    travelled.current = target;
    snap.current?.stop();
    snap.current = animate(y, -target * latest.current.screenHeight, {
      duration: latest.current.reduced === true ? 0 : SNAP_MS / 1000,
      ease: SNAP_EASE,
    });
  }

  // Which video is on screen follows the track itself, so it is right through
  // a drag as well as through a snap: the one place a landing is read off.
  useMotionValueEvent(y, 'change', (pixels) => {
    const height = latest.current.screenHeight;
    if (height > 0) {
      land(inFeed(Math.round(-pixels / height)));
    }
  });

  // Let go: the feed snaps to a whole video. A drag past a small part of a
  // video, or a flick, carries on to the next.
  function letGo(flick = 0) {
    unlockTickSound();
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
    snapTo(target);
    dragFrom.current = target;
  }

  // The show stops the moment the reader takes hold.
  function stopShow() {
    if (demoTimer.current !== null) {
      clearTimeout(demoTimer.current);
      demoTimer.current = null;
    }
  }

  // The feed shows itself once: from the first clip it steps to the last, one
  // clip at a time, and each pause is shorter than the one before it until the
  // floor. It ends on the twelfth and stays there.
  useEffect(() => {
    const last = VIDEO_COUNT - 1;
    let at = 0;
    let pause = SHOW_FIRST_MS;
    const step = () => {
      at += 1;
      snapTo(at);
      if (at >= last) {
        demoTimer.current = null;
        showing.current = false;
        setReady(true);
        latest.current.onDone?.();
        return;
      }
      pause = Math.max(SHOW_FLOOR_MS, Math.round(pause * SHOW_FALL));
      demoTimer.current = setTimeout(step, pause);
    };
    // A beat to take the phone in, then the first clip's own long hold.
    demoTimer.current = setTimeout(step, DEMO_START_MS + SHOW_FIRST_MS);
    return () => {
      stopShow();
      snap.current?.stop();
    };
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

  // The arrows move the feed from anywhere on the screen, not only while the
  // phone holds focus: the phone is the whole of this screen, and the only
  // thing on it there is to move. The listener goes with the feed, so it is
  // gone the moment the screen is.
  useEffect(() => {
    function moved(event: KeyboardEvent): number {
      if (
        isTyping(event.target) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return 0;
      }
      return event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    }
    function onKeyDown(event: KeyboardEvent) {
      const step = moved(event);
      if (step === 0) {
        return;
      }
      // The page must not scroll while the feed does.
      event.preventDefault();
      if (showing.current) {
        return;
      }
      stopShow();
      snapTo(Math.round(travelled.current) + step);
    }
    function onKeyUp(event: KeyboardEvent) {
      if (moved(event) !== 0) {
        letGo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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

  return (
    <div {...props(styles.gate)}>
      <div
        aria-label={m.home_feed_label()}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={phone}
        tabIndex={0}
        {...props(styles.shell, !ready && styles.shellShowing, held && styles.shellHeld)}
      >
        <div aria-hidden="true" {...props(styles.phone)}>
          <span {...props(styles.island)} />
          <div ref={screen} {...props(styles.screen)}>
            <motion.div style={{ y }} {...props(styles.feed)}>
              {Array.from({ length: VIDEO_COUNT }, (_, index) => (
                <Video
                  current={index === position}
                  height={screenHeight}
                  index={index}
                  key={index}
                  near={Math.abs(index - position) <= PRELOAD_REACH}
                />
              ))}
            </motion.div>
            <div {...props(styles.statusBar, light && styles.statusBarDark)}>
              <span>{m.home_feed_status_time()}</span>
              <span {...props(styles.statusIcons)}>
                <IconSignal style={styles.statusSignal} />
                <IconWifi style={styles.statusWifi} />
                <IconBattery style={styles.statusBattery} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The keys that move the feed, in the corner of the window. It says itself
 * once the show has run and the feed is the reader's, and goes quiet with the
 * screen it belongs to.
 */
export function FeedKeysHint({ shown }: { shown: boolean }) {
  return (
    <div aria-hidden="true" {...props(styles.keys, shown && styles.keysShown)}>
      <span {...props(styles.keycap)}>{m.home_feed_key_up()}</span>
      <span {...props(styles.keycap)}>{m.home_feed_key_down()}</span>
      <span>{m.home_feed_keys_hint()}</span>
    </div>
  );
}
