import { colors, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { playTick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { HOURS_DEFAULT, HOURS_MAX, HOURS_MIN, HourReadout } from './screen-time-gate.tsx';

/** One screen of feed is one hour: this much scrolling adds an hour. */
const PIXELS_PER_HOUR = 140;
/** How far the feed can travel, from the first hour to the last. */
const TRAVEL = (HOURS_MAX - HOURS_MIN) * PIXELS_PER_HOUR;
/** The rest after a wheel stops that counts as letting go. */
const SETTLE_MS = 300;
/** Posts in the feed: enough to scroll past the last hour with feed to spare. */
const POST_COUNT = 24;
const POST_HEIGHT = 140;
const PHONE_WIDTH = 176;
const PHONE_HEIGHT = 320;
/** The placeholder blocks of a post: a shade off the screen in both themes. */
const BLOCK = `color-mix(in srgb, ${colors.fg} 10%, transparent)`;
const BLOCK_STRONG = `color-mix(in srgb, ${colors.fg} 16%, transparent)`;

/** The nudge the feed gives itself until it is touched: a scroll, hinted. */
const nudge = keyframes({
  '0%': { transform: 'translateY(0)' },
  '100%': { transform: 'translateY(0)' },
  '12%': { transform: 'translateY(-28px)' },
  '24%': { transform: 'translateY(0)' },
});

const styles = create({
  feed: {
    display: 'flex',
    flexDirection: 'column',
    willChange: 'transform',
  },
  feedNudge: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '6s',
    },
    animationIterationCount: 'infinite',
    animationName: nudge,
    animationTimingFunction: 'ease-in-out',
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
    height: PHONE_HEIGHT,
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
  post: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    height: POST_HEIGHT,
    paddingBlock: spacing.s3,
    paddingInline: spacing.s3,
  },
  postAvatar: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 999,
    flexShrink: 0,
    height: 20,
    width: 20,
  },
  postDot: {
    backgroundColor: BLOCK_STRONG,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  postHead: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  postImage: {
    backgroundColor: BLOCK,
    borderRadius: 8,
    flexGrow: 1,
  },
  postLine: {
    backgroundColor: BLOCK,
    borderRadius: 3,
    height: 6,
  },
  postLines: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: 5,
  },
  postLineShort: {
    width: '45%',
  },
  postRow: {
    display: 'flex',
    gap: spacing.s3,
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
  // Every third post carries a picture; the others are text.
  const withImage = index % 3 !== 1;
  return (
    <div {...props(styles.post)}>
      <div {...props(styles.postHead)}>
        <span {...props(styles.postAvatar)} />
        <div {...props(styles.postLines)}>
          <span {...props(styles.postLine, styles.postLineShort)} />
          <span {...props(styles.postLine)} />
        </div>
      </div>
      {withImage ? (
        <span {...props(styles.postImage)} />
      ) : (
        <div {...props(styles.postLines)}>
          <span {...props(styles.postLine)} />
          <span {...props(styles.postLine)} />
          <span {...props(styles.postLine, styles.postLineShort)} />
        </div>
      )}
      <div {...props(styles.postRow)}>
        <span {...props(styles.postDot)} />
        <span {...props(styles.postDot)} />
        <span {...props(styles.postDot)} />
      </div>
    </div>
  );
}

/**
 * The question's answer, scrolled rather than set: a phone with a feed in it,
 * and every screen of feed scrolled is an hour. Down adds, up takes away. The
 * act that costs the hours is the act that counts them.
 */
export function FeedPhone({ onPick, sound }: { onPick: (hours: number) => void; sound: boolean }) {
  const [hours, setHours] = useState(HOURS_DEFAULT);
  const [offset, setOffset] = useState(offsetFor(HOURS_DEFAULT));
  const [held, setHeld] = useState(false);
  const [touched, setTouched] = useState(false);
  const phone = useRef<HTMLDivElement>(null);
  const travelled = useRef(offsetFor(HOURS_DEFAULT));
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(0);
  const latest = useRef({ hours, onPick, sound });
  latest.current = { hours, onPick, sound };

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
    }
  }

  function letGo() {
    unlockTickSound();
    latest.current.onPick(hoursFor(travelled.current));
  }

  // The wheel must not scroll the page while it scrolls the feed, and a
  // passive listener cannot say so: the handler goes on by hand.
  useEffect(() => {
    const element = phone.current;
    if (element === null) {
      return;
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
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
    lastY.current = event.clientY;
    setHeld(true);
    setTouched(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!held) {
      return;
    }
    // A finger dragging up pulls the feed up: the feed scrolls down.
    moveBy(lastY.current - event.clientY);
    lastY.current = event.clientY;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!held) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    setHeld(false);
    letGo();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
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
      <HourReadout hours={hours} />
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
            <div {...props(!touched && styles.feedNudge)}>
              {Array.from({ length: POST_COUNT }, (_, index) => (
                <Post index={index} key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p aria-hidden="true" {...props(styles.hint, touched && styles.hintGone)}>
        {m.home_gate_scroll_hint()}
      </p>
    </div>
  );
}
