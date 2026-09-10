/** Where the chosen theme is remembered, per browser. */
export const THEME_KEY = 'kya:theme';

/** The three states of the theme control, in the order it renders them. */
export const themeChoices = ['system', 'light', 'dark'] as const;

export type ThemeChoice = (typeof themeChoices)[number];

/** What lands in `data-theme` on `<html>`. `null` means: no attribute at all. */
export type ThemeAttribute = 'dark' | 'light' | null;

export function isThemeChoice(value: string | null): value is ThemeChoice {
  return value !== null && (themeChoices as ReadonlyArray<string>).includes(value);
}

/**
 * The `data-theme` value a stored choice resolves to. `null` leaves the
 * attribute off, so the `prefers-color-scheme` rules in `theme.css` decide.
 * A browser that reports no preference either way is unknown, and unknown
 * resolves to dark.
 */
export function themeAttribute(stored: string | null, systemKnown = true): ThemeAttribute {
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return systemKnown ? null : 'dark';
}

/** Whether the browser states a color scheme preference at all. */
function systemKnown(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return (
    window.matchMedia('(prefers-color-scheme: dark)').matches ||
    window.matchMedia('(prefers-color-scheme: light)').matches
  );
}

const listeners = new Set<() => void>();

/**
 * The stored theme is an external store: it lives in localStorage, which the
 * server cannot read. Components subscribe instead of holding their own copy,
 * so the first client render can still match the server's (see `serverTheme`).
 */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What the server renders, and what the client hydrates against. */
export function serverTheme(): ThemeChoice {
  return 'system';
}

/** The stored choice, or `system` when nothing is stored or storage is blocked. */
export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isThemeChoice(stored) ? stored : 'system';
  } catch {
    // Private mode and blocked-storage browsers: fall back to the default.
    return 'system';
  }
}

/** Puts the choice on `<html>` and remembers it for the next visit. */
export function applyTheme(choice: ThemeChoice): void {
  const attribute = themeAttribute(choice, systemKnown());
  if (attribute === null) {
    delete document.documentElement.dataset['theme'];
  } else {
    document.documentElement.dataset['theme'] = attribute;
  }
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // The theme still applies for this page; it just will not be remembered.
  }
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Runs in the document head before first paint, so a forced theme never
 * flashes the other one. Same rules as `themeAttribute` + `readTheme`, hand
 * written because the head script cannot import a module — keep them in step.
 */
export const themeScript = `try {
  var root = document.documentElement;
  var stored = localStorage.getItem('${THEME_KEY}');
  var known = typeof window.matchMedia === 'function' && (window.matchMedia('(prefers-color-scheme: dark)').matches || window.matchMedia('(prefers-color-scheme: light)').matches);
  var attribute = stored === 'dark' || stored === 'light' ? stored : known ? null : 'dark';
  if (attribute === null) { delete root.dataset.theme; } else { root.dataset.theme = attribute; }
} catch (error) {}`;
