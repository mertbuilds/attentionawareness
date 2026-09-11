import { colors, palette, radius } from '@keepyourattention/ui/tokens.stylex';
import { create } from '@stylexjs/stylex';
import { accent } from './accent.stylex.ts';

/**
 * The tick of a checkbox, drawn white so it reads on the accent fill. A data
 * URI cannot take a theme variable, so the stroke is the literal white.
 */
const CHECK_GLYPH =
  "url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2012%2012%22%3E%3Cpath%20d=%22M2.5%206.3%204.9%208.7%209.5%203.5%22%20fill=%22none%22%20stroke=%22%23ffffff%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')";

/** The dot of a radio: 6px across, centred in the ring. */
const RADIO_DOT = `radial-gradient(circle at center, ${palette.white} 0 3px, transparent 3px)`;

/**
 * Checkboxes and radios, drawn by us. The native controls paint their unticked
 * parts gray, which the dark theme reads as switched off, so the box is a bare
 * ring in the foreground colour until it is ticked and the accent fills it.
 * Compose `base` with `checkbox` or `radio`.
 */
export const controls = create({
  base: {
    appearance: 'none',
    backgroundColor: {
      ':checked': accent.base,
      default: 'transparent',
    },
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    borderColor: {
      ':checked': accent.base,
      default: colors.fg,
    },
    borderStyle: 'solid',
    borderWidth: '1.5px',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'inline-block',
    flexShrink: 0,
    height: 18,
    margin: 0,
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    width: 18,
  },
  checkbox: {
    backgroundImage: {
      ':checked': CHECK_GLYPH,
      default: 'none',
    },
    backgroundSize: '12px',
    borderRadius: radius.base,
  },
  radio: {
    backgroundImage: {
      ':checked': RADIO_DOT,
      default: 'none',
    },
    borderRadius: 999,
  },
});
