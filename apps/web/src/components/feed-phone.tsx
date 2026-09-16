import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
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
 * The app each slot wears: the five of them in turn, over and over down the
 * feed. It is the same clips and the same words the whole way; only the
 * chrome around them changes hands.
 */
const PLATFORMS: ReadonlyArray<Platform> = ['tiktok', 'reels', 'shorts', 'x', 'linkedin'];

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
/** Videos in the feed: one per clip shot for it, 01 through 11, and the black one. */
const VIDEO_COUNT = 12;
/**
 * The slot the feed ends on: a black screen with the same chrome over it.
 * There is no clip and no poster frame behind it, so it asks the network for
 * nothing, and there is nothing to 404 on.
 */
const BLANK_INDEX = VIDEO_COUNT - 1;
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

/** How dark the wash over a video is: from a little at the top of the feed to almost all at the foot. */
const SHADE_FIRST = 0.35;
const SHADE_LAST = 0.96;
function shadeFor(index: number): number {
  const last = VIDEO_COUNT - 1;
  const at = Math.min(index, last) / last;
  return SHADE_FIRST + (SHADE_LAST - SHADE_FIRST) * at;
}

/** The slot a clip wears, and the black one at the end, which keeps TikTok's. */
function platformFor(index: number): Platform {
  return index === BLANK_INDEX ? 'tiktok' : (PLATFORMS[index % PLATFORMS.length] ?? 'tiktok');
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

/**
 * One video of the feed. The clip plays only while this is the video on
 * screen, muted and looping, over a wash that stands in until the file has
 * loaded or when there is none. The chrome around it is whichever app this
 * slot wears: the clip, the wash and the burnt-in caption are the same in
 * every one of them.
 */
function Video({ current, height, index }: { current: boolean; height: number; index: number }) {
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
              preload={current ? 'auto' : 'metadata'}
              ref={video}
              src={clipUrl(index, 'mp4')}
              {...props(styles.videoClip)}
            />
          )
        }
        counts={counts(index)}
        current={current}
        frame={frame}
        handle={handle}
        played={played}
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
  // Where the feed is, in videos from the first; a fraction mid-drag.
  const [position, setPosition] = useState(0);
  const [screenHeight, setScreenHeight] = useState(SCREEN_FALLBACK);
  const [snapping, setSnapping] = useState(false);
  const [held, setHeld] = useState(false);
  const phone = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const travelled = useRef(0);
  // The whole clip the feed last landed on, so a landing sounds once.
  const landed = useRef(0);
  const holding = useRef(false);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The feed is not the reader's until the show has played.
  const showing = useRef(true);
  const [ready, setReady] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(0);
  const lastAt = useRef(0);
  const velocity = useRef(0);
  const dragFrom = useRef(0);
  const latest = useRef({ onDone, screenHeight, sound });
  latest.current = { onDone, screenHeight, sound };
  // The hour and the icons belong to the phone, not to the app, but they have
  // to be read against whatever the app on screen is: dark words on a light one.
  const light = platformFor(Math.round(position)) === 'linkedin';

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
    const clamped = Math.min(VIDEO_COUNT - 1, Math.max(0, next));
    travelled.current = clamped;
    setPosition(clamped);
    const whole = Math.round(clamped);
    if (whole !== landed.current) {
      if (latest.current.sound) {
        primeTickSound();
        playClick();
      }
      landed.current = whole;
    }
  }

  function moveBy(pixels: number) {
    setSnapping(false);
    moveTo(travelled.current + pixels / latest.current.screenHeight);
  }

  // Let go: the feed snaps to a whole video. A drag past a small part of a
  // video, or a flick, carries on to the next.
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
      setSnapping(true);
      moveTo(at);
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

  return (
    <div {...props(styles.gate)}>
      <div
        aria-label={m.home_feed_label()}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
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
