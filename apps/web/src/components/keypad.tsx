import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, palette, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { m } from '../paraglide/messages.js';

/** The keypad's own type, the same figures the readout is set in. */
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** The two keys that are not a digit, named so the caller can tell them apart. */
export const DELETE_KEY = 'delete';
export const TOTAL_KEY = 'total';
/** How wide the pad ever gets: three keys and the two gaps between them. */
const PAD_WIDTH = 300;
/** The total key, pressed: the same orange, with the light gone out of it. */
const COMMIT_PRESSED = `color-mix(in srgb, ${accent.base} 78%, ${palette.black})`;

/** One key of the pad: what it presses, and the glyph cut into it. */
type Key = { glyph: string; key: string; label?: () => string };

/**
 * The pad a till has, in the order a till has it: the high row first, the two
 * commands either side of the zero. Only the commands carry a label; a digit
 * is its own name in every language.
 */
const KEYS: ReadonlyArray<Key> = [
  { glyph: '7', key: '7' },
  { glyph: '8', key: '8' },
  { glyph: '9', key: '9' },
  { glyph: '4', key: '4' },
  { glyph: '5', key: '5' },
  { glyph: '6', key: '6' },
  { glyph: '1', key: '1' },
  { glyph: '2', key: '2' },
  { glyph: '3', key: '3' },
  { glyph: '⌫', key: DELETE_KEY, label: m.home_keypad_delete },
  { glyph: '0', key: '0' },
  { glyph: '↵', key: TOTAL_KEY, label: m.home_keypad_total },
];

const styles = create({
  // The total key: the one orange thing on the pad, because it is the one key
  // that says the reader is done.
  commit: {
    backgroundColor: {
      ':active': COMMIT_PRESSED,
      default: accent.base,
    },
    borderColor: accent.base,
    // Both states, because the base key dims its figure when it is pressed and
    // black on orange has nowhere to dim to.
    color: {
      ':active': palette.black,
      default: palette.black,
    },
  },
  // A machined key: black in both themes, because the part is the same part
  // either way. Pressed, it goes down a pixel and the figure on it dims.
  key: {
    alignItems: 'center',
    backgroundColor: palette.black,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: {
      ':active': palette.gray500,
      default: palette.white,
    },
    cursor: 'pointer',
    display: 'flex',
    fontFamily: MONOSPACE,
    fontSize: 20,
    fontVariantNumeric: 'tabular-nums',
    height: {
      '@media (min-width: 640px)': 56,
      default: 52,
    },
    justifyContent: 'center',
    lineHeight: 1,
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: 0,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'background-color, color, translate',
    transitionTimingFunction: 'ease-out',
    translate: {
      ':active': '0 1px',
      default: '0 0',
    },
  },
  pad: {
    display: 'grid',
    gap: spacing.s2,
    gridTemplateColumns: 'repeat(3, 1fr)',
    maxWidth: PAD_WIDTH,
    width: '100%',
  },
});

/**
 * The keys the reader enters their day on. Every press is live: the receipt
 * recounts on each one, and the total key only says so out loud.
 *
 * `onArm` runs on the press itself rather than on the click, because a browser
 * only hands out an audio device inside a gesture and the pointer going down
 * is the earliest part of one.
 */
export function Keypad({ onArm, onKey }: { onArm: () => void; onKey: (key: string) => void }) {
  return (
    <div {...props(styles.pad)}>
      {KEYS.map((key) => (
        <button
          aria-label={key.label?.()}
          key={key.key}
          onClick={() => onKey(key.key)}
          onPointerDown={onArm}
          type="button"
          {...props(styles.key, key.key === TOTAL_KEY && styles.commit)}
        >
          {key.glyph}
        </button>
      ))}
    </div>
  );
}
