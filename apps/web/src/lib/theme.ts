/** The three states of the theme control, in the order it renders them. */
export const themeChoices = ['system', 'light', 'dark'] as const;

export type ThemeChoice = (typeof themeChoices)[number];

/** What lands in `data-theme` on `<html>`. `null` means: no attribute at all. */
type ThemeAttribute = 'dark' | 'light' | null;

/**
 * The `data-theme` value a choice resolves to. `null` leaves the attribute off,
 * so the `prefers-color-scheme` rules in `theme.css` decide. A browser that
 * reports no preference either way is unknown, and unknown resolves to dark.
 */
function themeAttribute(choice: string | null, systemKnown: boolean): ThemeAttribute {
  if (choice === 'dark' || choice === 'light') {
    return choice;
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

/** The page's ground in each theme, as `--background` in `theme.css` has it. */
export const THEME_GROUND = { dark: '#000000', light: '#ffffff' } as const;

/**
 * Tells the browser the ground of the theme in use, through the two
 * `theme-color` metas in the head, one per system theme. A theme chosen here
 * goes into both; back on the system's, each gets its own again.
 */
function nameGround(attribute: ThemeAttribute): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_GROUND[attribute ?? own];
  }
}

const listeners = new Set<() => void>();

/** The choice this tab is on. Nothing is stored, so a reload starts over. */
let current: ThemeChoice = 'system';

/**
 * The chosen theme is an external store: it outlives the control, which the
 * footer of every page mounts anew. Components subscribe instead of holding
 * their own copy, so the first client render still matches the server's.
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

/** The choice this tab is on, which starts at `system` on every load. */
export function readTheme(): ThemeChoice {
  return current;
}

/** Puts the choice on `<html>` and keeps it for the rest of the session. */
export function applyTheme(choice: ThemeChoice): void {
  current = choice;
  const attribute = themeAttribute(choice, systemKnown());
  if (attribute === null) {
    delete document.documentElement.dataset['theme'];
  } else {
    document.documentElement.dataset['theme'] = attribute;
  }
  nameGround(attribute);
  for (const listener of listeners) {
    listener();
  }
}
