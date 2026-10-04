import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { duration, easing } from '../lib/motion.stylex.ts';

/** How far each line of the button stands from the middle, in pixels. */
const LINE_OFFSET = 3.5;

const styles = create({
  // The two lines, and the cross they turn into. It is a phone's control: a
  // wide window has the links themselves and no button. The pseudo-element
  // takes the touch a finger's width around it.
  button: {
    '::before': {
      content: '',
      inset: '-8px',
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: {
      '@media (min-width: 768px)': 'none',
      default: 'flex',
    },
    flexShrink: 0,
    height: 28,
    justifyContent: 'center',
    justifySelf: 'end',
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    padding: 0,
    position: 'relative',
    width: 28,
  },
  buttonOpen: {
    color: colors.fg,
  },
  // One line of the button, a hairline in the ink of the links.
  line: {
    backgroundColor: 'currentColor',
    borderRadius: 1,
    height: 1.5,
    position: 'absolute',
    // Back to two lines quicker than they crossed.
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.quick,
    },
    transitionProperty: 'transform',
    transitionTimingFunction: easing.smoothOut,
    width: 16,
  },
  lineLower: {
    transform: `translateY(${LINE_OFFSET}px)`,
  },
  lineLowerOpen: {
    transform: 'rotate(-45deg)',
  },
  lineOpen: {
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
  },
  lineUpper: {
    transform: `translateY(-${LINE_OFFSET}px)`,
  },
  lineUpperOpen: {
    transform: 'rotate(45deg)',
  },
  // The button is an item the header's morph carries, by this name.
  morph: (name: string) => ({
    viewTransitionName: name,
  }),
});

/**
 * What the menu's button wears, open or shut: the same on the button that
 * stands in the header before the menu's code is in, and on the one the menu
 * brings, so nothing moves as the one takes the other's place. `morph` is the
 * name the header's morph carries it by.
 */
export function menuButton(open: boolean, morph: string) {
  return props(styles.button, open && styles.buttonOpen, styles.morph(morph));
}

/** The button's two lines, crossed while the menu is open. */
export function MenuLines({ open }: { open: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        {...props(
          styles.line,
          styles.lineUpper,
          open && styles.lineOpen,
          open && styles.lineUpperOpen,
        )}
      />
      <span
        aria-hidden="true"
        {...props(
          styles.line,
          styles.lineLower,
          open && styles.lineOpen,
          open && styles.lineLowerOpen,
        )}
      />
    </>
  );
}
