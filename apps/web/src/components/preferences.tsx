import { colors, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import {
  applyTheme,
  readTheme,
  serverTheme,
  subscribeTheme,
  themeChoices,
  type ThemeChoice,
} from '../lib/theme.ts';
import { m } from '../paraglide/messages.js';

const THEME_NAMES: Record<ThemeChoice, () => string> = {
  dark: m.pref_theme_dark,
  light: m.pref_theme_light,
  system: m.pref_theme_system,
};

const styles = create({
  // One choice: a pill inside the track's pill. It is as tall as the track
  // less its border and its padding, so its round ends sit the same two
  // pixels from the track's edge at the top, the foot and the end. On a phone
  // the pseudo-element takes the touch a finger's height around it.
  segment: {
    '::before': {
      content: '',
      insetBlock: {
        '@media (max-width: 639px)': -10,
        default: 0,
      },
      insetInline: 0,
      position: 'absolute',
    },
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderStyle: 'none',
    borderWidth: 0,
    boxSizing: 'border-box',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    height: 24,
    lineHeight: 1,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    paddingBlock: 5,
    paddingInline: spacing.s2,
    position: 'relative',
  },
  // The track: a pill, as the site's buttons are. The segments fill what is
  // left inside the padding of the 28px box, which keeps the picked one at a
  // 1px inset from its border.
  segmented: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    gap: 2,
    height: 28,
    padding: 1,
  },
  segmentOn: {
    backgroundColor: colors.fg,
    color: colors.bg,
  },
});

/**
 * The theme control, written to `<html data-theme>`. It sits at the foot of
 * every page, and is the only preference the site carries.
 */
export function ThemeSwitch() {
  // The choice lives outside the control, because the footer of every page
  // mounts it anew. It is not read during the first render: the server has no
  // choice to read, and a render that disagreed with the SSR HTML would detach
  // the hydrated tree.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);

  return (
    <div aria-label={m.pref_theme_label()} role="group" {...props(styles.segmented)}>
      {themeChoices.map((choice) => (
        <button
          aria-pressed={choice === theme}
          key={choice}
          onClick={() => applyTheme(choice)}
          type="button"
          {...props(styles.segment, choice === theme && styles.segmentOn)}
        >
          {THEME_NAMES[choice]()}
        </button>
      ))}
    </div>
  );
}
