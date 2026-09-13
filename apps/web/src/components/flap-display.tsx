import { colors, font, palette, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { playTick } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';

/** The readout's own type. A register counts in figures, not in prose. */
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** How the readout splits the number it is handed. */
const MINUTES_PER_HOUR = 60;
/** The tens-of-hours flap before there are any: a card with nothing on it. */
const BLANK = ' ';
/** The one character between the two pairs that never turns. */
const COLON = ':';
/** Half the fold each: the old card down, then the new one up behind it. */
const HALF_MS = '90ms';
/** The depth the fold is seen at. Flat would read as a wipe, not as a card. */
const PERSPECTIVE = '400px';
/** How long the register shudders at a key it cannot take. */
const SHAKE_MS = '200ms';

/** The old card, falling forward off its hinge. */
const foldDown = keyframes({
  from: { transform: 'rotateX(0deg)' },
  to: { transform: 'rotateX(-90deg)' },
});

/** The new one, swinging up into the place it left. */
const foldUp = keyframes({
  from: { transform: 'rotateX(90deg)' },
  to: { transform: 'rotateX(0deg)' },
});

/** A key the register will not take: it shakes its head and keeps its number. */
const refuse = keyframes({
  '0%': { transform: 'translateX(0)' },
  '100%': { transform: 'translateX(0)' },
  '25%': { transform: 'translateX(-4px)' },
  '50%': { transform: 'translateX(4px)' },
  '75%': { transform: 'translateX(-2px)' },
});

const styles = create({
  // The half that turns down, off the hinge, carrying the digit that was.
  cardTop: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: HALF_MS,
    },
    animationFillMode: 'forwards',
    animationName: foldDown,
    animationTimingFunction: 'ease-in',
    backfaceVisibility: 'hidden',
    transformOrigin: 'bottom',
  },
  // The half that swings up into its place, carrying the digit that is. It is
  // held folded away through the first half of the turn, so what shows under
  // it until then is the digit that was.
  cardUp: {
    animationDelay: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: HALF_MS,
    },
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: HALF_MS,
    },
    animationFillMode: 'both',
    animationName: foldUp,
    animationTimingFunction: 'ease-out',
    backfaceVisibility: 'hidden',
    transformOrigin: 'top',
  },
  // The name of the two pairs, small enough to be read once and left alone.
  caption: {
    color: colors.muted,
    fontFamily: MONOSPACE,
    fontSize: 11,
    letterSpacing: '0.08em',
    margin: 0,
  },
  colon: {
    color: colors.fg,
    fontFamily: MONOSPACE,
    fontSize: {
      '@media (min-width: 640px)': 26,
      default: 22,
    },
    fontWeight: font.weightMedium,
    lineHeight: 1,
  },
  // A whole digit, drawn once at the size of the whole card. Each half crops
  // it to its own half, so the two line up the way one printed card would.
  face: {
    alignItems: 'center',
    color: palette.white,
    display: 'flex',
    fontFamily: MONOSPACE,
    fontSize: {
      '@media (min-width: 640px)': 30,
      default: 26,
    },
    fontVariantNumeric: 'tabular-nums',
    height: {
      '@media (min-width: 640px)': 44,
      default: 40,
    },
    insetInlineStart: 0,
    justifyContent: 'center',
    lineHeight: 1,
    position: 'absolute',
    width: '100%',
  },
  faceBottom: {
    insetBlockEnd: 0,
  },
  faceTop: {
    insetBlockStart: 0,
  },
  // One card of the register: black in both themes, because the part is the
  // same part either way.
  flap: {
    backgroundColor: palette.black,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    height: {
      '@media (min-width: 640px)': 44,
      default: 40,
    },
    overflow: 'hidden',
    perspective: PERSPECTIVE,
    position: 'relative',
    width: {
      '@media (min-width: 640px)': 32,
      default: 28,
    },
  },
  flapRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s1,
  },
  // Half a card, cropped out of a whole one.
  half: {
    backgroundColor: palette.black,
    height: '50%',
    insetInlineEnd: 0,
    insetInlineStart: 0,
    overflow: 'hidden',
    position: 'absolute',
  },
  halfBottom: {
    insetBlockEnd: 0,
  },
  halfTop: {
    insetBlockStart: 0,
  },
  // The seam the two halves meet on, and the only part of the card that is
  // nailed down.
  hinge: {
    backgroundColor: colors.border,
    height: '1px',
    insetBlockStart: '50%',
    insetInlineEnd: 0,
    insetInlineStart: 0,
    position: 'absolute',
    zIndex: 2,
  },
  readout: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  shaking: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: SHAKE_MS,
    },
    animationName: refuse,
    animationTimingFunction: 'ease-in-out',
  },
});

/**
 * One card of the register. It holds four halves: the digit it reads now on
 * top, the digit it read before underneath, and the two that turn between
 * them. The turning halves are keyed on the character, so a new digit
 * remounts them and the fold runs again; a digit that did not change leaves
 * them where they came to rest, which is where they belong.
 *
 * The character before this one is adjusted during the render that brings the
 * new one in, which is how a card knows what it is turning away from.
 */
function Flap({ char, sound }: { char: string; sound: boolean }) {
  const [shown, setShown] = useState(char);
  const [before, setBefore] = useState(char);
  if (shown !== char) {
    setBefore(shown);
    setShown(char);
  }

  // The clack the card makes as it lands, one per card that turned.
  const rung = useRef(char);
  useEffect(() => {
    if (rung.current === char) {
      return;
    }
    rung.current = char;
    if (sound) {
      playTick();
    }
  }, [char, sound]);

  return (
    <span {...props(styles.flap)}>
      <span {...props(styles.half, styles.halfTop)}>
        <span {...props(styles.face, styles.faceTop)}>{char}</span>
      </span>
      <span {...props(styles.half, styles.halfBottom)}>
        <span {...props(styles.face, styles.faceBottom)}>{before}</span>
      </span>
      <span key={char} {...props(styles.half, styles.halfTop, styles.cardTop)}>
        <span {...props(styles.face, styles.faceTop)}>{before}</span>
      </span>
      <span key={`${char}-up`} {...props(styles.half, styles.halfBottom, styles.cardUp)}>
        <span {...props(styles.face, styles.faceBottom)}>{char}</span>
      </span>
      <span {...props(styles.hinge)} />
    </span>
  );
}

/**
 * The register's readout: four flaps, the colon between them, and the caption
 * that says which pair is which. The flaps are a picture of the number, so a
 * screen reader is handed the number in words instead, on a live region that
 * says it again every time the keys change it.
 */
export function FlapDisplay({
  minutes,
  shaking,
  sound,
}: {
  minutes: number;
  shaking: boolean;
  sound: boolean;
}) {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  // Under ten hours the leading flap is blank, the way a register leaves one.
  const hoursText = String(hours).padStart(2, BLANK);
  const restText = String(rest).padStart(2, '0');
  // What the register reads, as one string: the flaps are the picture of it.
  const reading = `${hoursText}${COLON}${restText}`;

  return (
    <div
      aria-label={m.home_flap_label({ hours, minutes: rest })}
      aria-live="polite"
      {...props(styles.readout)}
    >
      <div
        aria-hidden="true"
        data-time={reading}
        {...props(styles.flapRow, shaking && styles.shaking)}
      >
        <Flap char={hoursText.slice(0, 1)} sound={sound} />
        <Flap char={hoursText.slice(1)} sound={sound} />
        <span {...props(styles.colon)}>{COLON}</span>
        <Flap char={restText.slice(0, 1)} sound={sound} />
        <Flap char={restText.slice(1)} sound={sound} />
      </div>
      <p aria-hidden="true" {...props(styles.caption)}>
        {m.home_flap_caption()}
      </p>
    </div>
  );
}
