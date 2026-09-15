import { colors, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { playTick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { HOURS_DEFAULT, HOURS_MAX, HOURS_MIN } from './screen-time-gate.tsx';

/** The feed shows itself first: from this hour it scrolls to the default. */
export const DEMO_FROM = 2;
const DEMO_START_MS = 700;
/** How long the whole show takes, from the first hour to the default. */
const DEMO_MS = 2500;
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
const PHONE_TALL = 360;
const PHONE_TALL_SHORT = 260;
/** Until the screen is measured, a video is this tall. */
const SCREEN_FALLBACK = PHONE_TALL - 14;
/** The placeholder shapes of a video: a shade off the screen in both themes. */
const BLOCK = `color-mix(in srgb, ${colors.fg} 12%, transparent)`;
const BLOCK_STRONG = `color-mix(in srgb, ${colors.fg} 22%, transparent)`;
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
  // The phone's body: a titanium rim, a black bezel, and the screen cut into
  // it with the corner an iPhone 15 Pro has. Everything is sized from the
  // body's own width, so it is the same phone at every size.
  phone: {
    backgroundColor: '#000',
    borderColor: `color-mix(in srgb, ${colors.fg} 26%, ${colors.bg})`,
    borderRadius: '15.5cqw',
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
  // The box the phone is sized in: the shape of an iPhone 15 Pro, 71.6 by
  // 146.6, and the thing that takes every scroll and drag aimed at it.
  shell: {
    aspectRatio: `${PHONE_WIDTH} / ${PHONE_HEIGHT}`,
    borderRadius: '15.5cqw',
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
  // The screen inside the bezel, with the corner the display has.
  screen: {
    borderRadius: '13cqw',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  // One video: the whole screen, a caption at the foot, the actions down
  // the right edge.
  video: {
    boxSizing: 'border-box',
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'space-between',
    paddingBlockEnd: '5cqw',
    paddingBlockStart: '14cqw',
    paddingInline: '4cqw',
    width: '100%',
  },
  videoActions: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  videoAvatar: {
    backgroundColor: BLOCK_STRONG,
    borderColor: colors.fg,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1.5,
    height: 22,
    width: 22,
  },
  videoCaption: {
    alignSelf: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '70%',
  },
  videoHeart: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: '50% 50% 0 50%',
    height: 14,
    transform: 'rotate(45deg) scale(0.9)',
    width: 14,
  },
  videoIcon: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  videoLine: {
    backgroundColor: BLOCK,
    borderRadius: 3,
    height: 6,
  },
  videoLineShort: {
    width: '50%',
  },
  videoName: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 3,
    height: 7,
    width: 56,
  },
});

function Video({ height, index }: { height: number; index: number }) {
  return (
    <div
      style={{ backgroundImage: WASHES[index % WASHES.length], height }}
      {...props(styles.video)}
    >
      <div {...props(styles.videoCaption)}>
        <span {...props(styles.videoName)} />
        <span {...props(styles.videoLine)} />
        <span {...props(styles.videoLine, styles.videoLineShort)} />
      </div>
      <div {...props(styles.videoActions)}>
        <span {...props(styles.videoAvatar)} />
        <span {...props(styles.videoHeart)} />
        <span {...props(styles.videoIcon)} />
        <span {...props(styles.videoIcon)} />
      </div>
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
  onPick,
  sound,
}: {
  /** Every hour the feed lands on, as it lands: the page reads it live. */
  onChange: (hours: number) => void;
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
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(0);
  const lastAt = useRef(0);
  const velocity = useRef(0);
  const dragFrom = useRef(0);
  const latest = useRef({ hours, onChange, onPick, screenHeight, sound });
  latest.current = { hours, onChange, onPick, screenHeight, sound };

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
        playTick();
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
  }

  // The feed shows itself once: from two hours it steps to the default one
  // video at a time, a tick and a pause at each, until the reader takes hold.
  useEffect(() => {
    const from = DEMO_FROM - HOURS_MIN;
    const to = HOURS_DEFAULT - HOURS_MIN;
    const pause = DEMO_MS / (to - from);
    let at = from;
    const step = () => {
      at += 1;
      setSnapping(true);
      moveTo(at);
      if (at < to) {
        demoTimer.current = setTimeout(step, pause);
      } else {
        demoTimer.current = null;
      }
    };
    demoTimer.current = setTimeout(() => {
      if (latest.current.sound) {
        primeTickSound();
      }
      step();
    }, DEMO_START_MS);
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
        {...props(styles.shell, held && styles.shellHeld)}
      >
        <div aria-hidden="true" {...props(styles.phone)}>
          <span {...props(styles.island)} />
          <div ref={screen} {...props(styles.screen)}>
            <div
              style={{ transform: `translateY(${-position * screenHeight}px)` }}
              {...props(styles.feed, snapping && styles.feedSnapping)}
            >
              {Array.from({ length: VIDEO_COUNT }, (_, index) => (
                <Video height={screenHeight} index={index} key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
