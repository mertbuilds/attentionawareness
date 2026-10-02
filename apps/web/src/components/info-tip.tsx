import { colors, font } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { Tip } from './tip.tsx';

/**
 * The letter on the button: not a message, so it is not in the catalog. It is
 * drawn rather than written, so a heading the button sits in reads as its own
 * words and nothing else.
 */
const GLYPH = '"i"';
/**
 * The ring across: large next to one of the story's display lines, smaller
 * next to a caption or a step's words. Either way the button's unseen hit
 * area reaches past the ring on every side to a 24px press.
 */
const LARGE = 20;
const SMALL = 12;
const HIT = 24;

const styles = create({
  button: {
    '::after': {
      content: '""',
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    color: {
      ':focus-visible': colors.fg,
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    justifyContent: 'center',
    padding: 0,
    position: 'relative',
    verticalAlign: 'middle',
  },
  large: {
    '::after': {
      inset: (LARGE - HIT) / 2,
    },
    height: LARGE,
    width: LARGE,
  },
  small: {
    '::after': {
      inset: (SMALL - HIT) / 2,
    },
    height: SMALL,
    width: SMALL,
  },
  // A book-face italic i, the way a printed note marks one.
  glyph: {
    '::before': {
      content: GLYPH,
    },
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontStyle: 'italic',
    fontWeight: font.weightRegular,
    lineHeight: 1,
    textTransform: 'none',
  },
  // In the large ring the i sits a pixel high, where the eye puts its middle.
  glyphLarge: {
    fontSize: 12,
    marginBlockStart: -1,
  },
  glyphSmall: {
    fontSize: 8,
  },
});

/** A small "i" beside a line, `size` to the line's text, and the explanation behind it. */
export function InfoTip({
  children,
  label,
  onOpenChange,
  size = 'small',
}: {
  children: ReactNode;
  label: string;
  onOpenChange?: ((open: boolean) => void) | undefined;
  size?: 'large' | 'small' | undefined;
}) {
  return (
    <Tip
      onOpenChange={onOpenChange}
      paper
      title={label}
      trigger={
        <button aria-label={label} type="button" {...props(styles.button, styles[size])}>
          <span
            aria-hidden="true"
            {...props(styles.glyph, size === 'large' ? styles.glyphLarge : styles.glyphSmall)}
          />
        </button>
      }
    >
      {children}
    </Tip>
  );
}
