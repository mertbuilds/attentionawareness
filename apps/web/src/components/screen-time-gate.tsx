import { Label } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, props } from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import { useEffect, useRef, useState } from 'react';
import { playTick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/**
 * The one display size on the page, and the total line is the only thing set
 * in it: it is the sentence the whole first screen adds up to. Every heading,
 * the hero's own included, is steps below it.
 */
export const DISPLAY_SIZE = 'clamp(32px, 3.8vw, 44px)';
/** What the page can price, in hours a day, and the only stop it has. */
export const HOURS_MIN = 2;
export const HOURS_MAX = 12;
const HOURS_STEP = 1;
/** The rail's opening sweep: up two to nine, down to six, back to seven, gliding. */
const DEMO_SWEEP = [9, 6, 7];
const DEMO_START_MS = 700;
/** How long the rail waits, untouched, before it shows itself again. */
const DEMO_REPEAT_MS = 10_000;
/** How long the knob takes to glide one hour along the rail. */
const DEMO_HOUR_MS = 260;
/**
 * Where the slider stands before the reader has moved it: the whole hours of
 * the average day the line above it cites, which is the figure the reader is
 * asked to recognize or correct rather than remember.
 */
export const HOURS_DEFAULT = 7;

/** The machined knob, and the rail the ticks are measured against. */
const KNOB_WIDTH = 28;
const KNOB_HEIGHT = 44;
const TRACK_HEIGHT = 4;
/**
 * The knob's face: a fine horizontal grain over the falloff of a turned edge,
 * and a darker falloff for the moment it is held down. Fixed greys, because a
 * machined part is the same part in either theme.
 */
const KNOB_BRUSH =
  'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 3px)';
const KNOB_FALLOFF = 'linear-gradient(180deg, #e8e8ea 0%, #c9c9cd 45%, #a9a9ae 55%, #d6d6da 100%)';
const KNOB_FALLOFF_PRESSED =
  'linear-gradient(180deg, #d8d8dc 0%, #b9b9bf 45%, #999aa0 55%, #c6c6cc 100%)';
/**
 * The edges of that face: a lit top, a shaded bottom, and the rim around both.
 * The rim is listed last so the two 1px lines stay on top of it.
 */
const KNOB_EDGES =
  'inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 rgba(0, 0, 0, 0.25), inset 0 0 0 1px #6b6b70';
/** The knob standing off the rail, and the same knob pressed into it. */
const KNOB_SHADOW = `${KNOB_EDGES}, 0 2px 6px rgba(0, 0, 0, 0.35)`;
const KNOB_SHADOW_PRESSED = `${KNOB_EDGES}, 0 1px 2px rgba(0, 0, 0, 0.35)`;
/** The indicator cut into the middle of the face: 2px across, 18px tall. */
const KNOB_NOTCH_SIZE = '2px 18px';
/**
 * One detent per whole hour of travel, each with the fraction of the rail it
 * sits at. The knob only ever stops on these, so the marks are the truth.
 */
const TICKS = Array.from({ length: (HOURS_MAX - HOURS_MIN) / HOURS_STEP + 1 }, (_, index) => {
  const value = HOURS_MIN + index * HOURS_STEP;
  return { at: (value - HOURS_MIN) / (HOURS_MAX - HOURS_MIN), value };
});

const styles = create({
  // The question's answer, set on a dial. It is the whole first screen until
  // it is given, so it sits directly under the question and nothing sits under
  // it: the rail with the figure it reads, and the way on.
  gate: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    width: '100%',
  },
  // The control and the figure it reads, side by side: the rail takes what is
  // left of the row, and the number stands at the end of it.
  gateCount: {
    color: accent.base,
  },
  // The helper sentence, folded into a ring the question can be asked from.
  gateRail: {
    maxWidth: 420,
    width: '100%',
  },
  // NumberFlow pads its digits by a quarter em for the roll mask; the plain
  // first-frame digit wears the same padding so nothing moves at hydration.
  gateCountStill: {
    display: 'inline-block',
    paddingBlock: '0.25em',
  },
  gateReading: {
    alignItems: 'center',
    display: 'flex',
    fontFamily: MONOSPACE,
    fontSize: DISPLAY_SIZE,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    justifyContent: 'center',
    letterSpacing: '-0.02em',
    lineHeight: 1,
    margin: 0,
    // Room for two digits, so one digit sits in the same box as twelve.
    width: '2.4ch',
  },
  // Said to a screen reader and drawn for nobody: the control already carries
  // its own numbers, so the label over it is only a name.
  slider: {
    // Brushed aluminium: the grain and the falloff under it, with the orange
    // indicator cut into the middle as a layer of its own. Firefox's knob and
    // Chrome's are the same part, so they read from the same constants.
    '::-moz-range-thumb': {
      backgroundImage: {
        ':active': `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF_PRESSED}`,
        default: `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF}`,
      },
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${KNOB_NOTCH_SIZE}, auto, auto`,
      borderRadius: 6,
      borderStyle: 'none',
      borderWidth: 0,
      boxShadow: {
        ':active': KNOB_SHADOW_PRESSED,
        default: KNOB_SHADOW,
      },
      height: KNOB_HEIGHT,
      width: KNOB_WIDTH,
    },
    '::-moz-range-track': {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: TRACK_HEIGHT,
    },
    '::-webkit-slider-runnable-track': {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: TRACK_HEIGHT,
    },
    // The same face, plus the offset that sits it on the track.
    '::-webkit-slider-thumb': {
      appearance: 'none',
      backgroundImage: {
        ':active': `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF_PRESSED}`,
        default: `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF}`,
      },
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${KNOB_NOTCH_SIZE}, auto, auto`,
      borderRadius: 6,
      boxShadow: {
        ':active': KNOB_SHADOW_PRESSED,
        default: KNOB_SHADOW,
      },
      height: KNOB_HEIGHT,
      // Centres the knob on the track: (4 - 44) / 2.
      marginTop: -20,
      scale: {
        ':active': 1.03,
        ':hover': 1.03,
        default: 1,
      },
      transitionDuration: {
        '@media (prefers-reduced-motion: reduce)': '0ms',
        default: '150ms',
      },
      transitionProperty: 'scale',
      transitionTimingFunction: 'ease-out',
      width: KNOB_WIDTH,
    },
    appearance: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'block',
    height: KNOB_HEIGHT,
    margin: 0,
    minWidth: 0,
    padding: 0,
    width: '100%',
  },
  sliderFill: (percent: number) => ({
    '::-moz-range-track': {
      backgroundImage: `linear-gradient(to right, ${accent.base} 0 ${percent}%, ${colors.border} ${percent}% 100%)`,
    },
    '::-webkit-slider-runnable-track': {
      backgroundImage: `linear-gradient(to right, ${accent.base} 0 ${percent}%, ${colors.border} ${percent}% 100%)`,
    },
  }),
  sliderLabel: {
    display: 'block',
    width: '100%',
  },
  // The rail's readout stands alone, so it fills the stepper's middle column.
  sliderReading: {
    gridColumn: 2,
    // No stepper beside it, so nothing to hold a second digit's room for.
    width: 'auto',
  },
  sliderUnit: {
    gridColumn: 2,
  },
  srOnly: {
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
  // The story is told, not pitched: one column of plain paragraphs, set wider
  // apart and looser than anything else on the page.
  stepButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: {
      ':disabled': colors.muted,
      ':hover': accent.base,
      default: colors.fg,
    },
    cursor: { ':disabled': 'default', default: 'pointer' },
    display: 'inline-flex',
    height: 44,
    justifyContent: 'center',
    opacity: { ':disabled': 0.4, default: 1 },
    padding: 0,
    width: 44,
  },
  stepGlyph: {
    height: 24,
    width: 24,
  },
  stepper: {
    alignItems: 'center',
    columnGap: spacing.s4,
    display: 'grid',
    gridTemplateColumns: 'auto auto auto',
    justifyContent: 'center',
    rowGap: spacing.s2,
  },
  stepUnit: {
    color: colors.fg,
    fontSize: font.sizeLg,
    fontWeight: 600,
    gridColumn: 2,
    lineHeight: 1,
    textAlign: 'center',
  },
  tick: {
    backgroundColor: colors.muted,
    height: 9,
    insetBlockStart: 0,
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: 1,
  },
  tickAt: (at: number) => ({
    insetInlineStart: `calc(${KNOB_WIDTH / 2}px + (100% - ${KNOB_WIDTH}px) * ${at})`,
  }),
  tickNumber: {
    color: colors.muted,
    fontFamily: MONOSPACE,
    fontSize: 11,
    insetBlockStart: 12,
    insetInlineStart: '50%',
    lineHeight: 1,
    position: 'absolute',
    transform: 'translateX(-50%)',
  },
  tickRail: {
    height: 40,
    position: 'relative',
    width: '100%',
  },
});

/** A whole hour the page can price, whatever the answer or a link asked for. */
/** Nothing to subscribe to: the store is only "has the client taken over". */
function subscribeNever() {
  return () => {};
}

/**
 * NumberFlow is a custom element, so the server sends it empty and the digits
 * only appear once the client has registered it. Until then the count is a
 * plain span with the same number, so the first frame is whole.
 */
function Count({ value }: { value: number }) {
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return hydrated ? (
    <NumberFlow value={value} {...props(styles.gateCount)} />
  ) : (
    <span {...props(styles.gateCount, styles.gateCountStill)}>{value}</span>
  );
}

export function clampHours(value: number): number {
  return Math.min(Math.max(value, HOURS_MIN), HOURS_MAX);
}

/**
 * The question's answer, set rather than typed: whole hours on a machined
 * dial, the figure it reads beside it, and the way on under both. A detent is
 * the only stop the dial has, so there is no answer it can take that the page
 * cannot price, and nothing to correct.
 */
export function ScreenTimeGate({
  onChange,
  sound,
  value,
}: {
  onChange: (value: number) => void;
  /** Whether a detent may click, which is the page's answer, not the gate's. */
  sound: boolean;
  value: number;
}) {
  // The dial starts at one, so the readout needs the singular of its own word.
  const reading = value === 1 ? m.home_gate_reading_one() : m.home_gate_reading({ hours: value });
  const unit = reading.replace(String(value), '').trim();

  function step(delta: number) {
    const next = Math.min(HOURS_MAX, Math.max(HOURS_MIN, value + delta));
    if (next === value) {
      return;
    }
    // One metallic detent per whole hour.
    if (sound) {
      primeTickSound();
      playTick();
    }
    onChange(next);
  }

  return (
    <div {...props(styles.gate)}>
      <div {...props(styles.stepper)}>
        <button
          aria-label={m.home_gate_minus()}
          disabled={value <= HOURS_MIN}
          onClick={() => step(-1)}
          onPointerUp={unlockTickSound}
          type="button"
          {...props(styles.stepButton)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.stepGlyph)}>
            <path
              d="M5 12h14"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </svg>
        </button>
        <p aria-hidden="true" {...props(styles.gateReading)}>
          <Count value={value} />
        </p>
        <button
          aria-label={m.home_gate_plus()}
          disabled={value >= HOURS_MAX}
          onClick={() => step(1)}
          onPointerUp={unlockTickSound}
          type="button"
          {...props(styles.stepButton)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.stepGlyph)}>
            <path
              d="M5 12h14M12 5v14"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </svg>
        </button>
        <span aria-hidden="true" {...props(styles.stepUnit)}>
          {unit}
        </span>
      </div>
      {/* The range is for the keyboard and assistive tech; the stepper is its face. */}
      <Label style={styles.srOnly}>
        <span>{m.home_gate_slider_label()}</span>
        <input
          aria-valuetext={reading}
          max={HOURS_MAX}
          min={HOURS_MIN}
          onChange={(event) => onChange(Number(event.target.value))}
          step={1}
          type="range"
          value={value}
        />
      </Label>
    </div>
  );
}

/**
 * The first screen's answer: a rail from one to twelve, and nothing chosen
 * for the reader until they drag it. The moment the drag ends, or Enter is
 * pressed, the rail hands its value over and the stepper takes its place.
 */
export function HourSlider({
  onPick,
  onTouch,
  sound,
}: {
  onPick: (hours: number) => void;
  /** The reader took hold of the rail: the show stops and the page may react. */
  onTouch?: (() => void) | undefined;
  sound: boolean;
}) {
  const [hours, setHours] = useState(HOURS_DEFAULT);
  const reading = hours === 1 ? m.home_gate_reading_one() : m.home_gate_reading({ hours });
  // The rail shows itself once: the knob glides up to nine, down to six
  // and back to seven, ticking at every whole hour, until the reader takes
  // hold of it. While it glides the input accepts fractions; once held it is
  // whole hours again.
  const [gliding, setGliding] = useState(false);
  const [glide, setGlide] = useState<number | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  useEffect(() => {
    let from = HOURS_DEFAULT;
    let index = 0;
    let lastWhole = HOURS_DEFAULT;
    function leg(startedAt: number) {
      const to = DEMO_SWEEP[index];
      if (held.current || to === undefined) {
        setGliding(false);
        setGlide(null);
        frame.current = null;
        return;
      }
      const target: number = to;
      const duration = Math.abs(target - from) * DEMO_HOUR_MS;
      function tick(now: number) {
        if (held.current) {
          setGliding(false);
          setGlide(null);
          frame.current = null;
          return;
        }
        const t = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - (1 - t) * (1 - t);
        const value = from + (target - from) * eased;
        setGlide(value);
        const whole = Math.round(value);
        if (whole !== lastWhole) {
          lastWhole = whole;
          setHours(whole);
          if (sound) {
            playTick();
          }
        }
        if (t < 1) {
          frame.current = requestAnimationFrame(tick);
          return;
        }
        from = target;
        index += 1;
        frame.current = requestAnimationFrame(leg);
      }
      frame.current = requestAnimationFrame(tick);
    }
    // One sweep after the first beat, then one every ten seconds the rail
    // goes untouched, each from where the last one ended.
    function sweep() {
      if (held.current) {
        return;
      }
      // Open the device before the first tick: a browser that has heard from
      // this reader before lets it sound, a brand-new tab keeps it silent
      // until their first press, and either way the ticks go through it.
      if (sound) {
        primeTickSound();
      }
      index = 0;
      lastWhole = Math.round(from);
      setGliding(true);
      frame.current = requestAnimationFrame(leg);
      timer.current = setTimeout(sweep, DEMO_REPEAT_MS);
    }
    timer.current = setTimeout(sweep, DEMO_START_MS);
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
    };
    // The sweep runs once, on mount, with the sound setting it opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot demo
  }, []);

  const shown = glide ?? hours;
  const travelled = ((shown - HOURS_MIN) / (HOURS_MAX - HOURS_MIN)) * 100;

  function hold() {
    if (!held.current) {
      onTouch?.();
    }
    held.current = true;
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    setGliding(false);
    setGlide(null);
  }

  function onHoursChange(value: number) {
    hold();
    if (value !== hours && sound) {
      primeTickSound();
      playTick();
    }
    setHours(value);
  }

  function pick(event: React.SyntheticEvent<HTMLInputElement>) {
    unlockTickSound();
    onPick(Number(event.currentTarget.value));
  }

  return (
    <div {...props(styles.gate)}>
      <div {...props(styles.stepper)}>
        <p aria-hidden="true" {...props(styles.gateReading, styles.sliderReading)}>
          <Count value={hours} />
        </p>
        <span aria-hidden="true" {...props(styles.stepUnit, styles.sliderUnit)}>
          {reading.replace(String(hours), '').trim()}
        </span>
      </div>
      <div {...props(styles.gateRail)}>
        <Label style={styles.sliderLabel}>
          <span {...props(styles.srOnly)}>{m.home_gate_slider_label()}</span>
          <input
            aria-valuetext={reading}
            max={HOURS_MAX}
            min={HOURS_MIN}
            onChange={(event) => onHoursChange(Number(event.target.value))}
            onKeyDown={hold}
            onKeyUp={(event) => {
              if (event.key === 'Enter') {
                pick(event);
              }
            }}
            onPointerDown={() => {
              hold();
              if (sound) {
                primeTickSound();
              }
            }}
            onPointerUp={pick}
            onTouchEnd={pick}
            step={gliding ? 'any' : 1}
            type="range"
            value={shown}
            {...props(styles.slider, styles.sliderFill(travelled))}
          />
        </Label>
        <div aria-hidden="true" {...props(styles.tickRail)}>
          {TICKS.map((tick) => (
            <span key={tick.value} {...props(styles.tick, styles.tickAt(tick.at))}>
              <span {...props(styles.tickNumber)}>{tick.value}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
