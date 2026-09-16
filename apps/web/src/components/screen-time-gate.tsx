import { Label } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import { useEffect, useRef, useState } from 'react';
import { playClick, playTick } from '../lib/sounds.ts';
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
/**
 * The rail's own show: six, seven, six. It steps one hour up, stands there,
 * and steps back, so a rail nobody has touched still answers with the average
 * day it started on.
 */
const DEMO_UP = 7;
/** How long the rail stands still on the landed screen before it shows itself. */
const DEMO_START_MS = 500;
/**
 * How long it waits, still untouched, before it shows itself again, counted
 * from the start of a run. A run is a step up, the hold, and a step back, and
 * the hands outlast the rail: the number is back on six at 1434ms with the
 * pair still lit, so the run ends when they have finished fading, at
 * HANDS_CYCLES * HANDS_BOB_MS + HANDS_FADE: 1651ms, and the rail rests the
 * other 3349ms.
 */
const DEMO_REPEAT_MS = 5000;
/**
 * The pace of the whole run, against the timings it was first cut at. Every
 * duration below is one of those base numbers times this, so the parts keep
 * their proportions and the next tempo change is this one number.
 */
const DEMO_TEMPO = 2 / 3;
/** How long the knob takes to glide one hour along the rail. */
const DEMO_STEP_MS = Math.round(350 * DEMO_TEMPO);
/** How many whole bobs the six-seven hands are lit for. */
const HANDS_CYCLES = 3;
/** One bob of a hand, up and back down, at the pace the pair reads lively. */
const HANDS_BOB_MS = Math.round(700 * DEMO_TEMPO);
/** How early the number turns back: it steps down while the hands finish their last bob. */
const DEMO_EARLY_MS = Math.round(300 * DEMO_TEMPO);
/**
 * How long it stands on seven before it steps back. The hands come out with
 * the step up, not on landing, so the hold is the rest of their three bobs
 * once that step and the early turn are paid for. The hands are lit for
 * exactly HANDS_CYCLES * HANDS_BOB_MS whatever the rail does under them.
 */
const DEMO_HOLD_MS = HANDS_CYCLES * HANDS_BOB_MS - DEMO_STEP_MS - DEMO_EARLY_MS;
/** How long the six-seven hands take to fade. */
const HANDS_FADE = `${Math.round(375 * DEMO_TEMPO)}ms`;
/** The hands read off the readout's own size, so they scale with it. */
const HANDS_SIZE = `calc(${DISPLAY_SIZE} * 0.45)`;
/** The palm-up hand the gesture is made of, twice. */
const HAND = '\u{1FAF4}';
/**
 * Where the slider stands before the reader has moved it: the whole hours of
 * the average day the line above it cites, which is the figure the reader is
 * asked to recognize or correct rather than remember.
 */
export const HOURS_DEFAULT = 6;

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

/** One hand of the six-seven: up, and down, the other half a beat behind. */
const weigh = keyframes({
  '0%': { translate: '0 0' },
  '100%': { translate: '0 0' },
  '50%': { translate: '0 -6px' },
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
  hand: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: `${HANDS_BOB_MS}ms`,
    },
    animationIterationCount: 'infinite',
    animationName: weigh,
    animationTimingFunction: 'ease-in-out',
    display: 'inline-block',
    fontSize: HANDS_SIZE,
    lineHeight: 1,
  },
  handRight: {
    // Half the bob, so the pair is always one hand up and one hand coming down.
    animationDelay: `${HANDS_BOB_MS / 2}ms`,
  },
  // Under the number, out of the flow, so the readout never moves for them.
  // The number's box carries the roll mask's own padding under the digit, so
  // the pair hangs off the foot of that box and over the unit word, which is
  // where the gesture belongs and what it is allowed to cover.
  hands: {
    display: 'flex',
    gap: 2,
    insetBlockStart: 'calc(100% - 4px)',
    insetInlineStart: '50%',
    justifyContent: 'center',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translateX(-50%)',
    transitionDuration: HANDS_FADE,
    transitionProperty: 'opacity',
    whiteSpace: 'nowrap',
  },
  handsShown: {
    opacity: 1,
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
    // The hands hang off this box, so it is the one they are measured from.
    position: 'relative',
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
export function Count({ value }: { value: number }) {
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

/** The big orange figure and its unit, as every picker on the page reads it. */
export function HourReadout({
  hours,
  sixSeven,
  sixSevenRun,
}: {
  hours: number;
  /** The rail is stepping six, seven, six on its own: the hands come out. */
  sixSeven: boolean;
  /**
   * Counts the runs, so the hands start from rest at each one. Zero is a
   * screen the rail has not counted on yet, and no hands in the page at all.
   */
  sixSevenRun: number;
}) {
  const reading = hours === 1 ? m.home_gate_reading_one() : m.home_gate_reading({ hours });
  return (
    <div {...props(styles.stepper)}>
      <p aria-hidden="true" {...props(styles.gateReading, styles.sliderReading)}>
        <Count value={hours} />
        {/* Six, seven. Palms up, both weighing, the right one half a beat
        behind: the gesture the number pair comes with now. The first count
        puts them in the page, so a screen cannot open with them already out;
        they stay after it, at rest, because the fade needs them there. */}
        {sixSevenRun > 0 ? (
          <span
            // A new pair at every run: their bob starts from rest with the step
            // to seven, and keeps going while they fade.
            key={sixSevenRun}
            {...props(styles.hands, sixSeven && styles.handsShown)}
          >
            <span {...props(styles.hand)}>{HAND}</span>
            <span {...props(styles.hand, styles.handRight)}>{HAND}</span>
          </span>
        ) : null}
      </p>
      <span aria-hidden="true" {...props(styles.stepUnit, styles.sliderUnit)}>
        {reading.replace(String(hours), '').trim()}
      </span>
    </div>
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
 * The question's answer, set rather than typed: a rail from two to twelve,
 * whole hours only. Left alone it counts six, seven, six, gliding up an hour
 * and back to where it stood, so the reader can see it is a thing to be
 * dragged; the first touch stops that for good and the rail is theirs.
 */
export function HourSlider({
  arrived,
  onChange,
  onSixSeven,
  sound,
  value,
}: {
  /**
   * Whether the screen the rail stands on is standing: the show waits for it
   * to land and stops the moment it starts to leave.
   */
  arrived: boolean;
  /** Every whole hour the rail passes, the reader's own and the show's alike. */
  onChange: (hours: number) => void;
  /** Whether the rail is counting six, seven, six: the readout puts its hands out. */
  onSixSeven: (showing: boolean) => void;
  /** Whether a detent may click, which is the page's answer, not the rail's. */
  sound: boolean;
  value: number;
}) {
  const reading = value === 1 ? m.home_gate_reading_one() : m.home_gate_reading({ hours: value });
  // While it glides the input accepts fractions; once held it is whole hours
  // again.
  const [gliding, setGliding] = useState(false);
  const [glide, setGlide] = useState<number | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hands = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  // The rail's live reading, for the show's own guard: it only ever counts
  // from the hour it started on.
  const at = useRef(value);
  at.current = value;

  useEffect(() => {
    if (!arrived) {
      return;
    }
    let lastWhole = HOURS_DEFAULT;
    function rest() {
      setGliding(false);
      setGlide(null);
      frame.current = null;
    }
    // One hour along the rail, gliding, reporting every whole hour it lands
    // on as the reader's own hand would.
    function stepTo(from: number, target: number, done: () => void) {
      let startedAt: number | null = null;
      function tick(now: number) {
        if (held.current) {
          rest();
          return;
        }
        startedAt ??= now;
        const t = Math.min(1, (now - startedAt) / DEMO_STEP_MS);
        const eased = 1 - (1 - t) * (1 - t);
        const reached = from + (target - from) * eased;
        setGlide(reached);
        const whole = Math.round(reached);
        if (whole !== lastWhole) {
          lastWhole = whole;
          onChange(whole);
          if (sound) {
            playClick();
          }
        }
        if (t < 1) {
          frame.current = requestAnimationFrame(tick);
          return;
        }
        frame.current = null;
        done();
      }
      frame.current = requestAnimationFrame(tick);
    }
    // One count as soon as the landed rail has stood still long enough to be
    // read, then one every five seconds it goes on standing there: six, a
    // hand up to seven, a moment there, and back down to six.
    function count() {
      if (held.current || at.current !== HOURS_DEFAULT) {
        return;
      }
      // Open the device before the first click: a browser that has heard from
      // this reader before lets it sound, a brand-new tab keeps it silent
      // until their first press, and either way the clicks go through it.
      if (sound) {
        primeTickSound();
      }
      lastWhole = HOURS_DEFAULT;
      setGliding(true);
      onSixSeven(true);
      // The hands keep their own time: three whole bobs from the moment they
      // come out, so the number can turn back under them and they are still
      // weighing while they fade.
      hands.current = setTimeout(() => {
        hands.current = null;
        onSixSeven(false);
      }, HANDS_CYCLES * HANDS_BOB_MS);
      stepTo(HOURS_DEFAULT, DEMO_UP, () => {
        pause.current = setTimeout(() => {
          pause.current = null;
          if (held.current) {
            return;
          }
          stepTo(DEMO_UP, HOURS_DEFAULT, rest);
        }, DEMO_HOLD_MS);
      });
      timer.current = setTimeout(count, DEMO_REPEAT_MS);
    }
    timer.current = setTimeout(count, DEMO_START_MS);
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      if (pause.current !== null) {
        clearTimeout(pause.current);
      }
      if (hands.current !== null) {
        clearTimeout(hands.current);
        hands.current = null;
      }
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
      // The screen is leaving: the rail stops where it is and the pair goes
      // with it, so nothing of this run is left for the next screen to open
      // with.
      onSixSeven(false);
      rest();
    };
    // The count runs once, when the screen lands, with the sound setting it
    // arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot demo
  }, [arrived]);

  const shown = glide ?? value;
  const travelled = ((shown - HOURS_MIN) / (HOURS_MAX - HOURS_MIN)) * 100;

  function hold() {
    held.current = true;
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pause.current !== null) {
      clearTimeout(pause.current);
      pause.current = null;
    }
    if (hands.current !== null) {
      clearTimeout(hands.current);
      hands.current = null;
    }
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    setGliding(false);
    setGlide(null);
    onSixSeven(false);
  }

  function onRailChange(hours: number) {
    hold();
    if (hours !== value && sound) {
      primeTickSound();
      playClick();
    }
    onChange(hours);
  }

  return (
    <div {...props(styles.gateRail)}>
      <Label style={styles.sliderLabel}>
        <span {...props(styles.srOnly)}>{m.home_gate_slider_label()}</span>
        <input
          aria-valuetext={reading}
          max={HOURS_MAX}
          min={HOURS_MIN}
          onChange={(event) => onRailChange(Number(event.target.value))}
          onKeyDown={hold}
          onPointerDown={() => {
            hold();
            if (sound) {
              primeTickSound();
            }
          }}
          onPointerUp={unlockTickSound}
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
  );
}
