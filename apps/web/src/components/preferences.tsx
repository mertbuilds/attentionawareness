import { colors, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
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
  segment: {
    backgroundColor: 'transparent',
    borderRadius: radius.base,
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
    paddingBlock: 5,
    paddingInline: spacing.s2,
  },
  // The segments fill what is left inside the padding of the 28px box, which
  // keeps the picked one at a 1px inset from its border.
  segmented: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
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
