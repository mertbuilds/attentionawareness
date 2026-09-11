import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, palette } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/**
 * The knob's shadow. It is the one thing that keeps a white knob off a light
 * gray track, and there is no theme token for a shadow.
 */
const KNOB_SHADOW = '0 1px 2px rgba(0, 0, 0, 0.25)';

const styles = create({
  knob: {
    backgroundColor: palette.white,
    borderRadius: 999,
    boxShadow: KNOB_SHADOW,
    height: 16,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'transform',
    transitionTimingFunction: 'ease',
    width: 16,
  },
  // 36 wide, 2px of padding on each side, a 16px knob: 16px of travel.
  knobOn: {
    transform: 'translateX(16px)',
  },
  track: {
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 999,
    borderStyle: 'none',
    borderWidth: 0,
    boxSizing: 'border-box',
    cursor: {
      ':disabled': 'default',
      default: 'pointer',
    },
    display: 'flex',
    flexShrink: 0,
    height: 20,
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: 2,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'background-color',
    transitionTimingFunction: 'ease',
    width: 36,
  },
  trackOn: {
    backgroundColor: accent.base,
  },
});

/**
 * A switch, drawn rather than borrowed. A checkbox cannot be a switch to a
 * screen reader, and the native one paints its off state gray, which the dark
 * theme reads as a control that is already off. This is a button that says
 * what it is, named by the row it sits in.
 */
export function Switch({
  checked,
  disabled = false,
  labelledBy,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean | undefined;
  labelledBy: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
      {...props(styles.track, checked && styles.trackOn)}
    >
      <span {...props(styles.knob, checked && styles.knobOn)} />
    </button>
  );
}
