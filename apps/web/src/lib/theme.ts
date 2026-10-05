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
export const THEME_GROUND = { dark: '#000000', light: '#fbfaf8' } as const;

/** The one `theme-color` meta a chosen theme owns. React never renders it. */
const GROUND_META = 'aa-theme-color';

/**
 * Tells the browser the ground of the theme in use. The head has two
 * `theme-color` metas, one per system theme, which React renders and nothing
 * here touches. A theme chosen here gets a meta of its own with no `media`,
 * put first in the head so the browser takes it; back on the system's, that
 * meta goes and the two speak again.
 */
function nameGround(attribute: ThemeAttribute): void {
  const own = document.getElementById(GROUND_META);
  if (attribute === undefined || attribute === null) {
    own?.remove();
    return;
  }
  const meta = own ?? document.createElement('meta');
  meta.id = GROUND_META;
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', THEME_GROUND[attribute]);
  if (own === null) {
    document.head.prepend(meta);
  }
}

/** Where the choice is kept in the browser. `system` is kept as no entry at all. */
export const THEME_KEY = 'aa-theme';

/**
 * Puts a kept choice on the page before it paints, so a reader who chose a
 * theme never sees the other one first. It runs in the head and does by hand
 * what `applyTheme` does, the meta of its own included.
 */
export const THEME_SCRIPT =
  `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){` +
  "var d=document.documentElement;d.setAttribute('data-theme',t);d.setAttribute('data-theme-choice',t);" +
  `var g=t==='dark'?'${THEME_GROUND.dark}':'${THEME_GROUND.light}';` +
  `var m=document.createElement('meta');m.id='${GROUND_META}';m.name='theme-color';m.content=g;document.head.prepend(m)` +
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
