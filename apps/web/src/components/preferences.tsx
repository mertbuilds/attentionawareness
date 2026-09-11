import { colors, font, radius, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

type Locale = (typeof locales)[number];

/** Every language in its own name, so a lost visitor can still find theirs. */
const LANGUAGE_NAMES: Record<Locale, () => string> = {
  en: m.pref_language_en,
  tr: m.pref_language_tr,
};

const LANGUAGE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  tr: '🇹🇷',
};

const THEME_NAMES: Record<ThemeChoice, () => string> = {
  dark: m.pref_theme_dark,
  light: m.pref_theme_light,
  system: m.pref_theme_system,
};

const styles = create({
  cluster: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  control: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: 12,
    gap: spacing.s1,
    lineHeight: 1,
    paddingBlock: 6,
    paddingInline: spacing.s2,
    whiteSpace: 'nowrap',
  },
  flag: {
    fontSize: 14,
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
  segment: {
    backgroundColor: 'transparent',
    borderRadius: radius.base,
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    lineHeight: 1,
    paddingBlock: 5,
    paddingInline: spacing.s2,
  },
  segmented: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    gap: 2,
    padding: 1,
  },
  segmentOn: {
    backgroundColor: colors.fg,
    color: colors.bg,
  },
});

/**
 * Theme and language, the last row of the page footer. The theme is written to
 * `<html data-theme>`; the language goes through Paraglide, which sets its
 * cookie and reloads the document.
 */
export function Preferences() {
  // The stored choice is never read during the first render: the server has no
  // localStorage, and a render that disagreed with the SSR HTML would detach
  // the hydrated tree. The head script already painted the right theme, so the
  // control catching up one render later is invisible.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
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
    <div {...props(styles.cluster)}>
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
            {LANGUAGE_FLAGS[locale]}
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
                  {LANGUAGE_FLAGS[code]}
                </span>
                <span>{LANGUAGE_NAMES[code]()}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
