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
 * Where the button's unseen hit area ends: 7px past the ring on every side,
 * so a 10px ring still takes a 24px press.
 */
const HIT_INSET = -7;

const styles = create({
  button: {
    '::after': {
      content: '""',
      inset: HIT_INSET,
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
    height: 10,
    justifyContent: 'center',
    padding: 0,
    position: 'relative',
    verticalAlign: 'middle',
    width: 10,
  },
  // A book-face italic i, the way a printed note marks one.
  glyph: {
    '::before': {
      content: GLYPH,
    },
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 7,
    fontStyle: 'italic',
    fontWeight: font.weightRegular,
    lineHeight: 1,
    textTransform: 'none',
  },
});

/** A small "i" beside a line, and the explanation behind it. */
export function InfoTip({
  children,
  label,
  onOpenChange,
}: {
  children: ReactNode;
  label: string;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  return (
    <Tip
      onOpenChange={onOpenChange}
      paper
      title={label}
      trigger={
        <button aria-label={label} type="button" {...props(styles.button)}>
          <span aria-hidden="true" {...props(styles.glyph)} />
        </button>
      }
    >
      {children}
    </Tip>
  );
}
