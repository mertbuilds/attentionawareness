import { buildCss } from './lib/css.ts';
import { ruleCss } from './lib/rules.ts';
import { siteFor } from './lib/sites.ts';
import { defaultSettings, getSettings, onSettingsChange, type Settings } from './lib/storage.ts';

/** The one style element every rule is injected through. */
const STYLE_ID = 'aa-rules';
/** What takes the page where a whole surface is removed. */
const NOTE_ID = 'aa-note';
/** The path the rules read, kept in step with `location.pathname`. */
const PATH_ATTRIBUTE = 'data-aa-path';
/**
 * All four sites are single page apps: the path changes with no load, and no
 * event fires for a `pushState` the page makes itself. A content script cannot
 * hear one either, because it runs in an isolated world, where patching
 * `history` patches a copy the page never calls. `popstate` covers the back
 * button; this poll covers everything else, at a cost of one string comparison
 * twice a second.
 */
const PATH_POLL_MS = 500;

const TIKTOK_NOTE = 'TikTok is off.';
const SHORTS_NOTE = 'Shorts is off.';
const NOTE_BRAND = 'attention awareness';

const site = siteFor(location.hostname);
const style = document.createElement('style');
style.id = STYLE_ID;

/** Whether the rules are in the page right now. The note follows them. */
let injected = false;

/**
 * The rules go in on the defaults before the first paint, and are corrected
 * the moment storage answers. Reading first would be simpler and would let the
 * feed flash into view, which is the one thing this exists to prevent; a page
 * that flashes out of view instead costs nothing.
 */
apply(defaultSettings);

// A host reached through a custom rule is none of the four, so there is no
// path for a rule to key on and no surface to leave a note in place of. The
// script injects the reader's CSS and touches nothing else on the page.
if (site !== null) {
  syncPath();
  document.addEventListener('DOMContentLoaded', syncNote);
  window.addEventListener('popstate', syncPath);
  setInterval(syncPath, PATH_POLL_MS);
}

// oxlint-disable-next-line unicorn/prefer-top-level-await -- a content script is not a module, so this file is built as an IIFE, and an IIFE has no top level to await at
void start();

async function start(): Promise<void> {
  apply(await getSettings());
  onSettingsChange(apply);
}

function apply(settings: Settings): void {
  const css = buildCss({ hostname: location.hostname, rules: ruleCss, settings, site });
  injected = css !== '';
  if (injected) {
    style.textContent = css;
    if (style.parentNode === null) {
      // `documentElement` exists at document_start; `head` does not yet.
      document.documentElement.append(style);
    }
  } else {
    style.remove();
    style.textContent = '';
  }
  syncNote();
}

function syncPath(): void {
  document.documentElement.setAttribute(PATH_ATTRIBUTE, location.pathname);
  syncNote();
}

/** What the note says here, or nothing where no surface was taken out. */
function noteText(): string | null {
  if (!injected) {
    return null;
  }
  if (site === 'tiktok') {
    return TIKTOK_NOTE;
  }
  if (site === 'youtube' && location.pathname.startsWith('/shorts')) {
    return SHORTS_NOTE;
  }
  return null;
}

function syncNote(): void {
  const text = noteText();
  const existing = document.getElementById(NOTE_ID);
  if (text === null) {
    existing?.remove();
    return;
  }
  if (document.body === null) {
    // Too early: the next path poll, or DOMContentLoaded, comes back for it.
    return;
  }

  const note = existing ?? document.createElement('div');
  note.id = NOTE_ID;
  if (note.firstElementChild?.textContent !== text) {
    note.replaceChildren(line(text), line(NOTE_BRAND));
  }
  if (note.parentElement !== document.body) {
    document.body.append(note);
  }
}

function line(text: string): HTMLParagraphElement {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  return paragraph;
}
