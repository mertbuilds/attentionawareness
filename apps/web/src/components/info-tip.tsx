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
 * The ring across, small next to a step's words. The button's unseen hit area
 * reaches past the ring on every side to a 24px press.
 */
const RING = 12;
const HIT = 24;

const styles = create({
  button: {
    '::after': {
      content: '""',
      inset: (RING - HIT) / 2,
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
    height: RING,
    justifyContent: 'center',
    padding: 0,
    position: 'relative',
    verticalAlign: 'middle',
    width: RING,
  },
  // A book-face italic i, the way a printed note marks one.
  glyph: {
    '::before': {
      content: GLYPH,
    },
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 8,
    fontStyle: 'italic',
    fontWeight: font.weightRegular,
    lineHeight: 1,
    textTransform: 'none',
  },
});

/** A small "i" beside a line, and the explanation behind it. */
export function InfoTip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tip
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
