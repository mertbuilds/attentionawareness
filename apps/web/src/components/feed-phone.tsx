import { colors, font, palette, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { typingIn } from '../lib/typing-in.ts';
import { m } from '../paraglide/messages.js';
import { BOXED, CHROMES } from './feed-chrome.tsx';
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
];

/** What each clip posts, under the handle or over the picture, by its place in the feed. */
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
 * Where a boxed skin cuts each clip, by its place in the feed: 0 keeps its top,
 * 100 its foot, 50 its middle. Each keeps the whole face, hair to chin, inside
 * the squarest box a skin has, so it holds in every other box too.
 */
const FOCUS = [20, 10, 0, 18, 0, 20, 33, 18, 40, 45, 40];

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

/** How long the feed stands on a clip before it swipes on to the next. */
const HOLD_MS = 1500;
/** How long one swipe takes, and the curve it travels on. */
const SWIPE_MS = 260;
const SWIPE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/**
 * A drag need not carry the feed half way: this much of a screen, or a flick
 * this fast, in pixels a millisecond, moves it on a clip. Less springs back.
 */
const DRAG_FRACTION = 0.12;
const FLICK_SPEED = 0.35;
/** Clips in the feed: one per clip shot for it, 01 through 11. After 11 comes 01. */
const CLIP_COUNT = 11;
/**
 * How many clips past the one on screen are already in the page. They load
 * while the feed stands, so a swipe never lands on a blank frame; the rest ask
 * the network for nothing until the feed comes to them.
 */
const PRELOAD_REACH = 2;
/** An iPhone 15 Pro is 71.6 by 146.6 millimetres: the mock keeps that shape. */
const PHONE_WIDTH = 71.6;
const PHONE_HEIGHT = 146.6;
/**
 * How tall the mock stands beside the words on a wide screen, and on a wide
 * but short one. Under the words on a narrow one it takes the room it is
 * given: as tall as that is, unless that would make it wider than it is.
 */
const PHONE_TALL = 430;
const PHONE_TALL_SHORT = 300;
const PHONE_TALL_NARROW = `min(100cqh, 100cqw * ${PHONE_HEIGHT} / ${PHONE_WIDTH})`;
/** Until the screen is measured, a video is this tall. */
const SCREEN_FALLBACK = PHONE_TALL - 17;
/**
 * How much of the phone has to be in the window for the arrow keys to move
 * the feed, and for the line that says so to show.
 */
const SEEN = 0.5;
/**
 * Every part of the feed is drawn in the phone body's own width, so the whole
 * thing holds together at any size the mock is given. The screen is 92 of
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
  // The black glass between the band and the screen. At its outer edge it
  // takes a little of the band's light, so the two meet in a soft fall rather
  // than a line. Its corner is the band's less the band: 18 minus 1.3.
  bezel: {
    backgroundColor: palette.black,
    borderRadius: '16.7cqw',
    boxShadow: `inset 0 0 1.2cqw 0.1cqw color-mix(in srgb, ${palette.gray500} 85%, transparent)`,
    boxSizing: 'border-box',
    height: '100%',
    padding: '2.7cqw',
    width: '100%',
  },
  feed: {
    display: 'flex',
    flexDirection: 'column',
    willChange: 'transform',
  },
  // The status icons carry the shadow a feed gives them, so they read on a
  // bright frame as well as a dark one.
  icon: {
    display: 'block',
    fill: 'currentColor',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))',
  },
  // The island, at the top of the screen, over the feed: 126 by 37 points on
  // a 393 point screen, centred on the status bar's line, with the front
  // camera's lens a faint dot near its right end.
  island: {
    backgroundColor: palette.black,
    backgroundImage: `radial-gradient(circle at 84% 50%, #454b86 0, #1b1f3d 0.4cqw, #0c0e1c 0.8cqw, ${palette.black} 1.1cqw)`,
    borderRadius: 999,
    height: '8.6cqw',
    insetBlockStart: '3.2cqw',
    insetInlineStart: '50%',
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: '29.5cqw',
    zIndex: 2,
  },
  // One key, drawn the way a key is: a hairline box around the arrow on it.
  // It is a button as well, and a press on it moves the feed as the key does.
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
  // What the two arrows do, in the corner of the window, while the phone is in
  // view. It is a keyboard's line: a reader who swipes has no keys to be told
  // about, and never sees it.
  keys: {
    alignItems: 'center',
    color: colors.muted,
    display: {
      '@media (hover: none)': 'none',
      '@media (max-width: 767px)': 'none',
      '@media (pointer: coarse)': 'none',
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
  // The phone's body: a thin band of polished titanium around the bezel. The
  // band is lit along its inner edge and falls darker toward its outer one,
  // the way a rounded rim catches the light, with a soft sheen across it.
  // Everything is sized from the body's own width, so it is the same phone at
  // every size, and it is the same metal in a light theme and a dark one.
  phone: {
    backgroundColor: palette.gray300,
    backgroundImage: `linear-gradient(160deg, #ececee, ${palette.gray300} 28%, ${palette.gray500} 62%, ${palette.gray300})`,
    borderRadius: '18cqw',
    boxShadow: `inset 0 0 0 0.15cqw ${palette.gray700}, inset 0 0 0.9cqw 0.3cqw color-mix(in srgb, ${palette.gray700} 70%, transparent), 0 12px 40px rgba(0, 0, 0, 0.35)`,
    boxSizing: 'border-box',
    height: '100%',
    padding: '1.3cqw',
    position: 'relative',
    width: '100%',
  },
  // The screen inside the bezel. Its corner is concentric with the body's:
  // the outer radius less the band and the bezel, 18 minus 1.3 minus 2.7.
  // It is the one part of the phone that takes a hand, so a finger on it
  // drags the feed rather than the page.
  screen: {
    borderRadius: '14cqw',
    cursor: 'grab',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    touchAction: 'none',
    width: '100%',
  },
  screenHeld: {
    cursor: 'grabbing',
  },
  // The box the phone is sized in: the shape of an iPhone 15 Pro, 71.6 by
  // 146.6. Only its screen takes a hand: a page scrolled over the band and
  // the bezel scrolls on.
  shell: {
    aspectRatio: `${PHONE_WIDTH} / ${PHONE_HEIGHT}`,
    containerType: 'inline-size',
    flexShrink: 0,
    height: {
      '@media (max-width: 767px)': PHONE_TALL_NARROW,
      '@media (min-width: 768px) and (max-height: 720px)': PHONE_TALL_SHORT,
      default: PHONE_TALL,
    },
    position: 'relative',
    userSelect: 'none',
    // The width follows the height through the aspect ratio.
    width: 'auto',
  },
  // The keys on the band's sides: the action button and the two volume keys
  // on the left, the side button on the right. Each stands a hair proud of
  // the band with the rest of it tucked under, where the body is drawn over it.
  sideKey: {
    backgroundColor: palette.gray500,
    borderRadius: '0.6cqw',
    position: 'absolute',
    width: '2cqw',
  },
  // Where each key sits down the side, and how long it is, in the body's height.
  sideKeyAction: {
    height: '4.6%',
    insetBlockStart: '20.5%',
    insetInlineStart: '-0.7cqw',
  },
  sideKeyPower: {
    height: '11.8%',
    insetBlockStart: '31.1%',
    insetInlineEnd: '-0.7cqw',
  },
  sideKeyVolumeDown: {
    height: '7.5%',
    insetBlockStart: '38%',
    insetInlineStart: '-0.7cqw',
  },
  sideKeyVolumeUp: {
    height: '7.5%',
    insetBlockStart: '28.5%',
    insetInlineStart: '-0.7cqw',
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
 * The clip a place in the feed shows, round the eleven either way: above the
 * first clip is the last one, and the feed never ends at either end.
 */
function clipAt(at: number): number {
  return ((at % CLIP_COUNT) + CLIP_COUNT) % CLIP_COUNT;
}

/** The app a clip wears. */
function platformFor(clip: number): Platform {
  return PLATFORMS[clip % PLATFORMS.length] ?? 'tiktok';
}

/**
 * The clip a video plays, by its place in the feed: 01.mp4 is the first. Each
 * one is cut twice, `01.av1.mp4` and `01.mp4`, and shown behind `01.jpg`.
 */
function clipUrl(clip: number, kind: 'av1.mp4' | 'jpg' | 'mp4'): string {
  return `/media/feed/${String(clip + 1).padStart(2, '0')}.${kind}`;
}
/** What the small cut is, so a browser that can read AV1 takes it. */
const AV1_TYPE = 'video/mp4; codecs=av01.0.05M.08';

/**
 * The numbers beside the actions. They are made up, but every clip has its
 * own, because a feed where every video carries the same count is not one.
 */
function counts(clip: number) {
  return {
    comments: 1203 + clip * 187,
    likes: 12_400 + clip * 3170,
    saves: 843 + clip * 129,
    shares: 2110 + clip * 96,
  };
}

/** Whether the tab is the one in front: a hidden tab plays nothing. */
function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function tabVisible(): boolean {
  return document.visibilityState === 'visible';
}

function tabVisibleOnServer(): boolean {
  return false;
}

/**
 * One video of the feed. The clip plays only while this is the video on
 * screen and the feed is running, muted and looping, over a wash that stands
 * in until the file has loaded or when there is none. The chrome around it is
 * whichever app this clip wears: the clip, the wash and the burnt-in caption
 * are the same in every one of them.
 */
function Video({
  clip,
  height,
  playing,
  preload,
}: {
  clip: number;
  height: number;
  playing: boolean;
  preload: 'auto' | 'metadata';
}) {
  const handle = HANDLES[clip]?.() ?? HANDLES[0]?.() ?? '';
  const video = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(0);
  const poster = clipUrl(clip, 'jpg');
  // The avatar and the record wear the clip's own frame.
  const frame = { backgroundImage: `url("${poster}")` };
  const platform = platformFor(clip);
  const Chrome = CHROMES[platform];
  const focus = BOXED.has(platform) ? { objectPosition: `50% ${FOCUS[clip] ?? 50}%` } : undefined;
  useEffect(() => {
    const element = video.current;
    if (element === null) {
      return;
    }
    if (!playing) {
      element.pause();
      return;
    }
    void element.play().catch(() => {
      // A clip that is missing, or a browser that will not run it, is the
      // wash instead. Nothing waits on it.
    });
  }, [playing]);
  // Four times a second while the clip runs, which is all the bar needs.
  function onTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    const whole = element.duration;
    setPlayed(Number.isFinite(whole) && whole > 0 ? (element.currentTime / whole) * 100 : 0);
  }
  return (
    <div style={{ backgroundImage: WASHES[clip % WASHES.length], height }} {...props(styles.video)}>
      <Chrome
        caption={CAPTIONS[clip]?.() ?? ''}
        clip={
          <video
            loop
            muted
            onTimeUpdate={onTimeUpdate}
            playsInline
            poster={poster}
            preload={preload}
            ref={video}
            style={focus}
            {...props(styles.videoClip)}
          >
            <source src={clipUrl(clip, 'av1.mp4')} type={AV1_TYPE} />
            <source src={clipUrl(clip, 'mp4')} type="video/mp4" />
          </video>
        }
        counts={counts(clip)}
        current={playing}
        frame={frame}
        handle={handle}
        played={played}
        post={POSTS[clip]?.() ?? ''}
      />
    </div>
  );
}

/**
 * The feed the page opens on: a phone that scrolls itself, one clip every
 * beat and round again after the last, the way a feed never ends. It makes no
 * sound. A hand on its screen drags it a clip at a time, and while most of it
 * is in the window the arrow keys do too, and a line in the corner says so. It
 * runs only while it is on screen in a tab in front, and for a reader who
 * asked for less motion it is one still frame that a hand or a key cuts.
 */
export function FeedPhone() {
  // How many swipes the feed has made, less the ones back up it, so it goes
  // under zero above the first clip. The clip on screen is this, round the
  // eleven; the count itself keeps every slot's key, so a slot keeps its
  // video element for as long as it is in the track.
  const [step, setStep] = useState(0);
  const [screenHeight, setScreenHeight] = useState(SCREEN_FALLBACK);
  const [onScreen, setOnScreen] = useState(false);
  // At least half the phone is in the window: the arrow keys are the feed's.
  const [seen, setSeen] = useState(false);
  // A hand is on the screen: the feed follows it and holds its beat.
  const [held, setHeld] = useState(false);
  const reduced = useReducedMotion();
  const tabShown = useSyncExternalStore(subscribeVisibility, tabVisible, tabVisibleOnServer);
  const shell = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const swiped = useRef(step);
  // Where the hand took the screen, where it last was and when, and how fast
  // it was going then.
  const grab = useRef({ at: 0, from: 0, speed: 0, y: 0 });
  // How far the hand had pulled the track when it let go past a clip, so the
  // swipe it starts runs on from there rather than from a whole screen away.
  const released = useRef(0);
  const running = onScreen && tabShown && reduced !== true;
  // The clip before the one on screen always stands loaded above it, the last
  // one above the first, so a swipe up has somewhere to go as much as a swipe
  // down; the next ones wait under it, loading.
  const first = step - 1;
  const offset = (step - first) * screenHeight;
  // The hour and the icons belong to the phone, not to the app, but they have
  // to be read against whatever the app on screen is: dark words on a light one.
  const skin = platformFor(clipAt(step));
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

  // Off screen, the feed holds still; mostly on screen, it takes the keys.
  useEffect(() => {
    const element = shell.current;
    if (element === null) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry?.isIntersecting ?? false);
        setSeen((entry?.intersectionRatio ?? 0) >= SEEN);
      },
      { threshold: [0, SEEN] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // One swipe a beat after the last one, for as long as the feed runs and no
  // hand is on it. A step by hand, or a hand let go, starts the beat again, so
  // the feed never jumps right after it.
  useEffect(() => {
    if (!running || held) {
      return;
    }
    const timer = setTimeout(() => setStep((at) => at + 1), HOLD_MS);
    return () => clearTimeout(timer);
  }, [held, running, step]);

  // Down is the next clip and up the one before, from anywhere on the page
  // while the phone is in view, unless the key is being typed with or is
  // already someone else's. A key held down moves the feed once.
  useEffect(() => {
    if (!seen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      const by = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (
        by === 0 ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        typingIn(event.target)
      ) {
        return;
      }
      // The page must not scroll while the feed does.
      event.preventDefault();
      if (!event.repeat) {
        setStep((at) => at + by);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [seen]);

  // The track has already been cut to the new clip, before this frame is
  // painted: it is drawn from where the last clip stood, a screen lower on
  // the way down and a screen higher on the way up, and travels into place.
  // For a reader who asked for less motion the cut is all there is.
  useLayoutEffect(() => {
    const from = swiped.current;
    if (from === step) {
      return;
    }
    swiped.current = step;
    const pull = released.current;
    released.current = 0;
    if (reduced === true) {
      return;
    }
    track.current?.animate(
      [
        { transform: `translateY(${-(from - first) * screenHeight + pull}px)` },
        { transform: `translateY(${-offset}px)` },
      ],
      { duration: SWIPE_MS, easing: SWIPE_EASE },
    );
    // A swipe starts when the step moves and at no other time.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the step is the swipe
  }, [step]);

  // How far the hand has pulled the track from where the clip stands: never
  // past the clip above it or the one under it, which are all there is.
  function pulled(): number {
    const hand = grab.current;
    return Math.max(-screenHeight, Math.min(screenHeight, hand.y - hand.from));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    // A swipe still travelling lands at once, so the hand takes the clip
    // where it stands.
    for (const animation of track.current?.getAnimations() ?? []) {
      animation.finish();
    }
    grab.current = { at: event.timeStamp, from: event.clientY, speed: 0, y: event.clientY };
    setHeld(true);
  }

  // The clip follows the finger, a pixel for a pixel.
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!held) {
      return;
    }
    const hand = grab.current;
    hand.speed = (event.clientY - hand.y) / Math.max(1, event.timeStamp - hand.at);
    hand.at = event.timeStamp;
    hand.y = event.clientY;
    if (track.current !== null) {
      track.current.style.transform = `translateY(${-offset + pulled()}px)`;
    }
  }

  // Let go: past a small part of a screen, or on a flick, the feed goes on a
  // clip the way the hand went, up for the next and down for the one before.
  // Short of that the clip springs back.
  function onPointerUp() {
    if (!held) {
      return;
    }
    setHeld(false);
    const pull = pulled();
    const { speed } = grab.current;
    const element = track.current;
    if (element !== null) {
      element.style.transform = `translateY(${-offset}px)`;
    }
    const by =
      Math.abs(pull) >= screenHeight * DRAG_FRACTION
        ? -Math.sign(pull)
        : Math.abs(speed) >= FLICK_SPEED
          ? -Math.sign(speed)
          : 0;
    if (by !== 0) {
      released.current = pull;
      setStep((at) => at + by);
      return;
    }
    if (reduced !== true && pull !== 0) {
      element?.animate(
        [
          { transform: `translateY(${-offset + pull}px)` },
          { transform: `translateY(${-offset}px)` },
        ],
        { duration: SWIPE_MS, easing: SWIPE_EASE },
      );
    }
  }

  return (
    <>
      <div aria-label={m.home_feed_label()} ref={shell} role="img" {...props(styles.shell)}>
        <span {...props(styles.sideKey, styles.sideKeyAction)} />
        <span {...props(styles.sideKey, styles.sideKeyVolumeUp)} />
        <span {...props(styles.sideKey, styles.sideKeyVolumeDown)} />
        <span {...props(styles.sideKey, styles.sideKeyPower)} />
        <div aria-hidden="true" {...props(styles.phone)}>
          <div {...props(styles.bezel)}>
            <div
              onPointerCancel={onPointerUp}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              ref={screen}
              {...props(styles.screen, held && styles.screenHeld)}
            >
              <div
                ref={track}
                style={{ transform: `translateY(${-offset}px)` }}
                {...props(styles.feed)}
              >
                {Array.from({ length: step + PRELOAD_REACH - first + 1 }, (_, index) => {
                  const at = first + index;
                  return (
                    <Video
                      clip={clipAt(at)}
                      height={screenHeight}
                      key={at}
                      playing={running && at === step}
                      preload={at <= step + 1 ? 'auto' : 'metadata'}
                    />
                  );
                })}
              </div>
              <div {...props(styles.statusBar, light && styles.statusBarDark)}>
                <span>{m.home_feed_status_time()}</span>
                <span {...props(styles.statusIcons)}>
                  <IconSignal style={styles.statusSignal} />
                  <IconWifi style={styles.statusWifi} />
                  <IconBattery style={styles.statusBattery} />
                </span>
              </div>
              <span {...props(styles.island)} />
            </div>
          </div>
        </div>
      </div>
      <div {...props(styles.keys, seen && styles.keysShown)}>
        <button
          aria-label={m.home_feed_key_up_label()}
          onClick={() => setStep((at) => at - 1)}
          type="button"
          {...props(styles.keycap)}
        >
          {m.home_feed_key_up()}
        </button>
        <button
          aria-label={m.home_feed_key_down_label()}
          onClick={() => setStep((at) => at + 1)}
          type="button"
          {...props(styles.keycap)}
        >
          {m.home_feed_key_down()}
        </button>
        <span>{m.home_feed_keys_hint()}</span>
      </div>
    </>
  );
}
