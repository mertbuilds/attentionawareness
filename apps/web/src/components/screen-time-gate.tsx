import { Label } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, props } from '@stylexjs/stylex';
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
export const HOURS_MIN = 1;
export const HOURS_MAX = 12;
/**
 * Where the slider stands before the reader has moved it: the whole hours of
 * the average day the line above it cites, which is the figure the reader is
 * asked to recognize or correct rather than remember.
 */
export const HOURS_DEFAULT = 6;

const styles = create({
  chip: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': accent.base,
      default: 'transparent',
    },
    borderColor: {
      ':hover': accent.base,
      default: colors.border,
    },
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    color: {
      ':hover': colors.bg,
      default: colors.fg,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: MONOSPACE,
    fontSize: font.sizeLg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    height: 48,
    justifyContent: 'center',
    minWidth: 48,
    paddingBlock: 0,
    paddingInline: spacing.s3,
    transitionDuration: '120ms',
    transitionProperty: 'background-color, border-color, color',
  },
  // The pill the average day lands on, and the word under it that says so.
  chipAverage: {
    borderColor: accent.base,
  },
  chipNote: {
    color: accent.base,
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.08em',
    lineHeight: 1,
    marginBlockStart: spacing.s1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  chips: {
    alignItems: 'start',
    display: 'grid',
    gap: spacing.s2,
    gridTemplateColumns: 'repeat(6, auto)',
    justifyContent: 'center',
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
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
  gateReading: {
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
});

/** A whole hour the page can price, whatever the answer or a link asked for. */
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
          <NumberFlow value={value} {...props(styles.gateCount)} />
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

/** The average day, to the nearest whole hour: 6 hours 40 minutes rounds up. */
const AVERAGE_HOURS = 7;
/** Every hour the page can be answered with, one to twelve. */
const HOURS = Array.from({ length: HOURS_MAX - HOURS_MIN + 1 }, (_, index) => HOURS_MIN + index);

/**
 * The first screen's answer: twelve pills, two rows of six, and nothing
 * chosen for the reader. A tap is the answer, and the stepper takes over from
 * there for corrections.
 */
export function HourChips({ onPick, sound }: { onPick: (hours: number) => void; sound: boolean }) {
  return (
    <ul aria-label={m.home_gate_slider_label()} {...props(styles.chips)}>
      {HOURS.map((hours) => (
        <li key={hours}>
          <button
            aria-label={hours === 1 ? m.home_gate_reading_one() : m.home_gate_reading({ hours })}
            onClick={() => {
              if (sound) {
                primeTickSound();
                playTick();
              }
              onPick(hours);
            }}
            onPointerUp={unlockTickSound}
            type="button"
            {...props(styles.chip, hours === AVERAGE_HOURS && styles.chipAverage)}
          >
            {hours}
          </button>
          {hours === AVERAGE_HOURS ? (
            <span aria-hidden="true" {...props(styles.chipNote)}>
              {m.home_gate_average_mark()}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
