import { colors, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { playTick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { HOURS_DEFAULT, HOURS_MAX, HOURS_MIN } from './screen-time-gate.tsx';

/** One screen of feed is one hour: this much scrolling adds an hour. */
const PIXELS_PER_HOUR = 140;
/** How far the feed can travel, from the first hour to the last. */
const TRAVEL = (HOURS_MAX - HOURS_MIN) * PIXELS_PER_HOUR;
/** The feed shows itself first: from this hour it scrolls to the default. */
export const DEMO_FROM = 2;
const DEMO_START_MS = 700;
/** How long the whole show takes, from the first hour to the default. */
const DEMO_MS = 2500;
/** The rest after a wheel stops that counts as letting go. */
const SETTLE_MS = 300;
/** Posts in the feed: enough to scroll past the last hour with feed to spare. */
const POST_COUNT = 24;
const PHONE_WIDTH = 176;
const PHONE_HEIGHT = 320;
/** On a short screen the whole first screen must still fit above the fold. */
const PHONE_HEIGHT_SHORT = 240;
/** The placeholder blocks of a post: a shade off the screen in both themes. */
const BLOCK = `color-mix(in srgb, ${colors.fg} 10%, transparent)`;
const BLOCK_STRONG = `color-mix(in srgb, ${colors.fg} 16%, transparent)`;

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
    gap: spacing.s4,
    width: '100%',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    margin: 0,
    opacity: 1,
    transitionDuration: '250ms',
    transitionProperty: 'opacity',
  },
  hintGone: {
    opacity: 0,
  },
  // The phone: a dark slab with a screen cut into it. The screen clips the
  // feed and takes every scroll and drag aimed at it.
  phone: {
    backgroundColor: colors.bg,
    borderColor: `color-mix(in srgb, ${colors.fg} 22%, ${colors.bg})`,
    borderRadius: 30,
    borderStyle: 'solid',
    borderWidth: 7,
    boxShadow: {
      ':focus-visible': `0 0 0 3px ${colors.muted}`,
      default: '0 12px 40px rgba(0, 0, 0, 0.35)',
    },
    boxSizing: 'border-box',
    cursor: 'grab',
    height: {
      '@media (max-height: 720px)': PHONE_HEIGHT_SHORT,
      default: PHONE_HEIGHT,
    },
    outlineStyle: 'none',
    overflow: 'hidden',
    position: 'relative',
    touchAction: 'none',
    userSelect: 'none',
    width: PHONE_WIDTH,
  },
  phoneHeld: {
    cursor: 'grabbing',
  },
  // The island at the top of the screen, over the feed.
  island: {
    backgroundColor: `color-mix(in srgb, ${colors.fg} 22%, ${colors.bg})`,
    borderRadius: 999,
    height: 18,
    insetBlockStart: 8,
    insetInlineStart: '50%',
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: 60,
    zIndex: 2,
  },
  // One post the way a photo feed lays it out: who, the picture edge to
  // edge, the three actions, the likes, a line of caption.
  post: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    paddingBlockEnd: spacing.s3,
  },
  postActions: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
    paddingInline: spacing.s2,
  },
  postAvatar: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 999,
    flexShrink: 0,
    height: 22,
    width: 22,
  },
  postCaption: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    paddingInline: spacing.s2,
  },
  postHead: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
    paddingBlock: spacing.s1,
    paddingInline: spacing.s2,
  },
  postHeart: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: '50% 50% 0 50%',
    height: 12,
    transform: 'rotate(45deg) scale(0.9)',
    width: 12,
  },
  postIcon: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 4,
    height: 12,
    width: 12,
  },
  postIconRound: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  // Square, the width of the screen: a photo.
  postImage: {
    aspectRatio: '1',
    backgroundColor: BLOCK,
    width: '100%',
  },
  postImageAlt: {
    aspectRatio: '4 / 5',
  },
  postLine: {
    backgroundColor: BLOCK,
    borderRadius: 3,
    height: 6,
  },
  postLineMid: {
    width: '70%',
  },
  postLineShort: {
    width: '45%',
  },
  postName: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 3,
    height: 6,
    width: 64,
  },
  screen: {
    height: '100%',
    // The feed starts under the island, and the first post is cut by the
    // top of the screen the way a feed always is.
    paddingBlockStart: 36,
    position: 'relative',
    width: '100%',
  },
});

/** The feed's travel for a number of hours. */
function offsetFor(hours: number): number {
  return (hours - HOURS_MIN) * PIXELS_PER_HOUR;
}

/** The hour a feed offset lands on. */
function hoursFor(offset: number): number {
  return Math.min(HOURS_MAX, Math.max(HOURS_MIN, HOURS_MIN + Math.round(offset / PIXELS_PER_HOUR)));
}

function Post({ index }: { index: number }) {
  // Every third picture is taller, the way a feed mixes squares and portraits.
  const tall = index % 3 === 2;
  return (
    <div {...props(styles.post)}>
      <div {...props(styles.postHead)}>
        <span {...props(styles.postAvatar)} />
        <span {...props(styles.postName)} />
      </div>
      <span {...props(styles.postImage, tall && styles.postImageAlt)} />
      <div {...props(styles.postActions)}>
        <span {...props(styles.postHeart)} />
        <span {...props(styles.postIconRound)} />
        <span {...props(styles.postIcon)} />
      </div>
      <div {...props(styles.postCaption)}>
        <span {...props(styles.postLine, styles.postLineShort)} />
        <span {...props(styles.postLine, styles.postLineMid)} />
      </div>
    </div>
  );
}

/**
 * The question's answer, scrolled rather than set: a phone with a feed in it,
 * and every screen of feed scrolled is an hour. Down adds, up takes away. The
 * act that costs the hours is the act that counts them.
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
  const [offset, setOffset] = useState(offsetFor(DEMO_FROM));
  const [held, setHeld] = useState(false);
  const holding = useRef(false);
  const [touched, setTouched] = useState(false);
  const phone = useRef<HTMLDivElement>(null);
  const travelled = useRef(offsetFor(DEMO_FROM));
  const frame = useRef<number | null>(null);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(0);
  const latest = useRef({ hours, onChange, onPick, sound });
  latest.current = { hours, onChange, onPick, sound };

  function moveBy(delta: number) {
    const next = Math.min(TRAVEL, Math.max(0, travelled.current + delta));
    travelled.current = next;
    setOffset(next);
    const landed = hoursFor(next);
    if (landed !== latest.current.hours) {
      if (latest.current.sound) {
        primeTickSound();
        playTick();
      }
      setHours(landed);
      latest.current.onChange(landed);
    }
  }

  function letGo() {
    unlockTickSound();
    latest.current.onPick(hoursFor(travelled.current));
  }

  // The show stops the moment the reader takes hold.
  function stopShow() {
    if (demoTimer.current !== null) {
      clearTimeout(demoTimer.current);
      demoTimer.current = null;
    }
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }

  // The feed shows itself once: from two hours it scrolls to the default,
  // ticking at every hour, until the reader takes hold of it.
  useEffect(() => {
    const from = offsetFor(DEMO_FROM);
    const to = offsetFor(HOURS_DEFAULT);
    const length = DEMO_MS;
    demoTimer.current = setTimeout(() => {
      if (latest.current.sound) {
        primeTickSound();
      }
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / length);
        // Ease out: quick to leave, slow to land.
        const eased = 1 - (1 - t) ** 3;
        moveBy(from + (to - from) * eased - travelled.current);
        if (t < 1) {
          frame.current = requestAnimationFrame(step);
        } else {
          frame.current = null;
        }
      };
      frame.current = requestAnimationFrame(step);
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
      setTouched(true);
      moveBy(event.deltaY);
      if (settle.current !== null) {
        clearTimeout(settle.current);
      }
      settle.current = setTimeout(letGo, SETTLE_MS);
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
    holding.current = true;
    setHeld(true);
    setTouched(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!holding.current) {
      return;
    }
    // A finger dragging up pulls the feed up: the feed scrolls down.
    moveBy(lastY.current - event.clientY);
    lastY.current = event.clientY;
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
    letGo();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      stopShow();
      setTouched(true);
      moveBy(event.key === 'ArrowDown' ? PIXELS_PER_HOUR : -PIXELS_PER_HOUR);
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
        {...props(styles.phone, held && styles.phoneHeld)}
      >
        <span aria-hidden="true" {...props(styles.island)} />
        <div aria-hidden="true" {...props(styles.screen)}>
          <div style={{ transform: `translateY(${-offset}px)` }} {...props(styles.feed)}>
            {Array.from({ length: POST_COUNT }, (_, index) => (
              <Post index={index} key={index} />
            ))}
          </div>
        </div>
      </div>
      <p aria-hidden="true" {...props(styles.hint, touched && styles.hintGone)}>
        {m.home_gate_scroll_hint()}
      </p>
    </div>
  );
}
