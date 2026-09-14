import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { Tip } from './tip.tsx';

/** The letter on the button: not a message, so it is not in the catalog. */
const GLYPH = 'i';

const styles = create({
  button: {
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
    height: 16,
    justifyContent: 'center',
    padding: 0,
    // Centred on the cap height of the line it follows, which sits a touch
    // above the box's own middle in a shouted receipt.
    transform: 'translateY(-1px)',
    verticalAlign: 'middle',
    width: 16,
  },
  // A book-face italic i, the way a printed note marks one.
  glyph: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: 700,
    lineHeight: 1,
    marginBlockStart: -1,
    textTransform: 'none',
  },
});

/** A small "i" beside a line, and the explanation behind it. */
export function InfoTip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tip
      title={label}
      trigger={
        <button aria-label={label} type="button" {...props(styles.button)}>
          <span aria-hidden="true" {...props(styles.glyph)}>
            {GLYPH}
          </span>
        </button>
      }
    >
      {children}
    </Tip>
  );
}
