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

/** Where the choice is kept in the browser. `system` is kept as no entry at all. */
export const THEME_KEY = 'aa-theme';

/**
 * Puts a kept choice on the page before it paints, so a reader who chose a
 * theme never sees the other one first. It runs in the head, after the two
 * `theme-color` metas, and does by hand what `applyTheme` does.
 */
export const THEME_SCRIPT =
  `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){` +
  "var d=document.documentElement;d.setAttribute('data-theme',t);d.setAttribute('data-theme-choice',t);" +
  `var g=t==='dark'?'${THEME_GROUND.dark}':'${THEME_GROUND.light}';` +
  "document.querySelectorAll('meta[name=\"theme-color\"]').forEach(function(m){m.setAttribute('content',g)})" +
  '}}catch(e){}';

/** The kept choice. A browser that keeps nothing, or refuses to say, is on the system's. */
function storedTheme(): ThemeChoice {
  try {
    const kept = window.localStorage.getItem(THEME_KEY);
    return kept === 'dark' || kept === 'light' ? kept : 'system';
  } catch {
    return 'system';
  }
}

/** Keeps the choice for the next visit. A browser that refuses still gets it for this one. */
function storeTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') {
      window.localStorage.removeItem(THEME_KEY);
    } else {
      window.localStorage.setItem(THEME_KEY, choice);
    }
  } catch {
    // Storage is off: the choice lasts until the page is left.
  }
}

const listeners = new Set<() => void>();

/** The choice this tab is on: the kept one, read the first time it is asked for. */
let current: ThemeChoice | undefined;

/**
 * The chosen theme is an external store: it outlives the controls, which the
 * footer of every page and the phone menu mount anew. Components subscribe
 * instead of holding their own copy, so the first client render still matches
 * the server's.
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

/** The choice this tab is on, which starts at the kept one. */
export function readTheme(): ThemeChoice {
  current ??= storedTheme();
  return current;
}

/** Puts the choice on `<html>`, where the head's script put the kept one. */
function showTheme(choice: ThemeChoice): void {
  current = choice;
  const attribute = themeAttribute(choice, systemKnown());
  const root = document.documentElement;
  if (attribute === null) {
    delete root.dataset['theme'];
  } else {
    root.dataset['theme'] = attribute;
  }
  // The controls draw their picked segment from this (`app.css`).
  if (choice === 'system') {
    delete root.dataset['themeChoice'];
  } else {
    root.dataset['themeChoice'] = choice;
  }
  nameGround(attribute);
  for (const listener of listeners) {
    listener();
  }
}

/** Puts the choice on `<html>` and keeps it in the browser for every later visit. */
export function applyTheme(choice: ThemeChoice): void {
  storeTheme(choice);
  showTheme(choice);
}

// A choice made in another tab of the site is this tab's too. `key` is null
// when the whole storage was cleared.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY || event.key === null) {
      showTheme(storedTheme());
    }
  });
}
