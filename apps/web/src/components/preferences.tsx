import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import {
  applyTheme,
  readTheme,
  serverTheme,
  subscribeTheme,
  themeChoices,
  type ThemeChoice,
} from '../lib/theme.ts';
import { m } from '../paraglide/messages.js';
import { getLocale, locales, setLocale } from '../paraglide/runtime.js';
import { FlagGb, FlagTr } from './flags.tsx';

type Locale = (typeof locales)[number];

/** Every language in its own name, so a lost visitor can still find theirs. */
const LANGUAGE_NAMES: Record<Locale, () => string> = {
  en: m.pref_language_en,
  tr: m.pref_language_tr,
};

const LANGUAGE_FLAGS: Record<Locale, () => ReactNode> = {
  en: () => <FlagGb />,
  tr: () => <FlagTr />,
};

const THEME_NAMES: Record<ThemeChoice, () => string> = {
  dark: m.pref_theme_dark,
  light: m.pref_theme_light,
  system: m.pref_theme_system,
};

const styles = create({
  control: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: 12,
    gap: spacing.s1,
    // The same 28px box as the theme toggle beside it.
    height: 28,
    lineHeight: 1,
    paddingBlock: 0,
    paddingInline: spacing.s2,
    whiteSpace: 'nowrap',
  },
  flag: {
    alignItems: 'center',
    display: 'inline-flex',
    lineHeight: 1,
  },
  languageMenu: {
    display: 'flex',
    position: 'relative',
  },
  // Opens upwards: the cluster is the last row of the page footer.
  list: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    insetBlockEnd: 'calc(100% + 6px)',
    insetInlineEnd: 0,
    minWidth: 140,
    padding: spacing.s1,
    position: 'absolute',
  },
  option: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': colors.border,
      default: 'transparent',
    },
    borderRadius: radius.base,
    borderStyle: 'none',
    borderWidth: 0,
    color: colors.fg,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    paddingBlock: spacing.s1,
    paddingInline: spacing.s2,
    textAlign: 'start',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  optionSelected: {
    fontWeight: font.weightMedium,
  },
  // Theme first, language to its right. The two only break into separate
  // lines when the column they sit in is too narrow to hold both.
  preferencesRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
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
  // 28px is what the language button next to it comes out at on its own, so
  // the two boxes of the row are level. The segments fill what is left inside
  // the padding, which keeps the picked one at the same 1px inset as before.
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
 * The theme control, written to `<html data-theme>`. It sits at the foot of the
 * page, left of the language switch.
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

/**
 * The language control. It goes through Paraglide, which sets its cookie and
 * reloads the document.
 */
export function LanguageSwitch() {
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageMenu = useRef<HTMLDivElement>(null);
  const locale = getLocale();

  useEffect(() => {
    if (!languageOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (languageMenu.current?.contains(event.target as Node | null) !== true) {
        setLanguageOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLanguageOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [languageOpen]);

  function pickLocale(code: Locale) {
    setLanguageOpen(false);
    if (code !== locale) {
      void setLocale(code);
    }
  }

  return (
    <div ref={languageMenu} {...props(styles.languageMenu)}>
      <button
        aria-expanded={languageOpen}
        aria-haspopup="listbox"
        aria-label={m.pref_language_label()}
        onClick={() => setLanguageOpen(!languageOpen)}
        type="button"
        {...props(styles.control)}
      >
        {/* Hidden from the name, so the control reads as its language and
            not as an unpronounceable flag. */}
        <span aria-hidden="true" {...props(styles.flag)}>
          {LANGUAGE_FLAGS[locale]()}
        </span>
        <span>{LANGUAGE_NAMES[locale]()}</span>
      </button>
      {languageOpen ? (
        <div aria-label={m.pref_language_label()} role="listbox" {...props(styles.list)}>
          {locales.map((code) => (
            <button
              aria-selected={code === locale}
              key={code}
              onClick={() => pickLocale(code)}
              role="option"
              type="button"
              {...props(styles.option, code === locale && styles.optionSelected)}
            >
              <span aria-hidden="true" {...props(styles.flag)}>
                {LANGUAGE_FLAGS[code]()}
              </span>
              <span>{LANGUAGE_NAMES[code]()}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Both controls as the single row the site footer shows: one box of segments
 * for the theme, one button for the language, level with each other.
 */
export function PreferencesRow() {
  return (
    <div {...props(styles.preferencesRow)}>
      <ThemeSwitch />
      <LanguageSwitch />
    </div>
  );
}
