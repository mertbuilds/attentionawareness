/**
 * Renders the three Chrome Web Store screenshots into `store/`, at the
 * 1280x800 the dashboard takes.
 *
 * Chromium is launched with `dist` loaded unpacked, the same way the smoke
 * spec does it, because the popup and the options page only exist inside a
 * browser that has the extension in it. Two of the three shots are composed:
 * the page is screenshotted at its own width, and that PNG is then laid on a
 * black 1280x800 canvas by a second page, so a 320px popup is not stretched to
 * four times its size.
 *
 * The build is not chained. Build first, then:
 *
 *   pnpm --filter @attentionawareness/extension build
 *   node scripts/store-shots.ts
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import type { CustomRule } from '../src/lib/storage.ts';
import { strings } from '../src/lib/strings.ts';

/** What the store takes. Both dimensions are exact, not a maximum. */
const SHOT_WIDTH = 1280;
const SHOT_HEIGHT = 800;

/** The popup's own width, which is the window the browser gives it. */
const POPUP_WIDTH = 320;

/** How wide the options page is drawn before it is laid on the canvas. */
const OPTIONS_WIDTH = 720;
/** And how much of it fits above the caption. */
const OPTIONS_MAX_HEIGHT = 620;

/** How long youtube.com is given to settle before it is shot. */
const YOUTUBE_SETTLE_MS = 6000;

/**
 * Where the shot goes when the home feed comes back empty, which it does on a
 * fresh profile with no history behind it. Search is populated signed out, and
 * is one of the surfaces the Shorts shelf is taken off.
 */
const YOUTUBE_FALLBACK = 'https://www.youtube.com/results?search_query=lofi&hl=en';

/** An ordinary video tile, which is how a populated page is recognised. */
const VIDEO_TILE = 'ytd-rich-item-renderer, ytd-video-renderer';

/** The consent wall, in the two languages this is ever run in. */
const CONSENT_BUTTON = /^(accept all|reject all|tümünü kabul et|tümünü reddet)$/i;

/** The rules the options page shot is taken with, written straight to storage. */
const EXAMPLE_RULES: Array<CustomRule> = [
  {
    css: '#right-sidebar-container,\nshreddit-feed + aside {\n  display: none !important;\n}',
    domain: 'reddit.com',
    enabled: true,
    id: 'example-reddit',
  },
  {
    css: '#hnmain > tbody > tr:nth-child(3) {\n  display: none !important;\n}',
    domain: 'news.ycombinator.com',
    enabled: true,
    id: 'example-hn',
  },
];

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const store = path.join(root, 'store');

if (!existsSync(path.join(dist, 'manifest.json'))) {
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' });
}

const unpacked = realpathSync(dist);
await mkdir(store, { recursive: true });

await withExtension(async (context) => {
  await popupShot(context);
  await youtubeShot(context);
  await optionsShot(context);
});

/** Shot 1: the popup at its own width, centred, with what it does under it. */
async function popupShot(context: BrowserContext): Promise<void> {
  const popup = await context.newPage();
  await popup.setViewportSize({ height: 420, width: POPUP_WIDTH });
  await popup.goto(extensionUrl('popup.html'));
  await popup.getByRole('switch').first().waitFor();
  await popup.evaluate(async () => {
    await document.fonts.ready;
  });
  // The popup's height is its content's, not the window's: a window taller
  // than the popup would frame the dead space under it too.
  await popup.setViewportSize({ height: await contentHeight(popup), width: POPUP_WIDTH });
  const frame = await popup.screenshot();

  await compose(context, {
    caption: 'One switch. The feeds are gone.',
    frame,
    subtitle: 'X · YouTube · Instagram',
    to: 'shot-1-popup.png',
    width: POPUP_WIDTH,
  });
}

/**
 * Shot 2: youtube.com itself, logged out, with the extension on. It is the one
 * shot of the real thing, and the one that can fail: a consent wall is a page
 * of Google's, and a region that insists on it is a region this cannot shoot.
 */
async function youtubeShot(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  try {
    // `hl` and `gl` because the shot is for an English store listing, and
    // because a US locale is the one least likely to be walled.
    await page.goto('https://www.youtube.com/?hl=en&gl=US', { waitUntil: 'domcontentloaded' });
  } catch (error) {
    skip(`youtube.com did not load: ${String(error)}`);
    await page.close();
    return;
  }

  await dismissConsent(page);
  await page.waitForTimeout(YOUTUBE_SETTLE_MS);

  if (new URL(page.url()).hostname.startsWith('consent.')) {
    skip('youtube.com is behind a consent wall this run could not dismiss.');
    await page.close();
    return;
  }

  if ((await page.locator(VIDEO_TILE).count()) === 0) {
    process.stdout.write(
      'store-shots: the signed out home feed came back empty. Shooting search instead.\n',
    );
    await page.goto(YOUTUBE_FALLBACK, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(YOUTUBE_SETTLE_MS);
  }

  await page.screenshot({ path: path.join(store, 'shot-2-youtube.png') });
  written('shot-2-youtube.png');
  await page.close();
}

/** Shot 3: the options page holding two rules, centred on the canvas. */
async function optionsShot(context: BrowserContext): Promise<void> {
  const options = await context.newPage();
  await options.setViewportSize({ height: OPTIONS_MAX_HEIGHT, width: OPTIONS_WIDTH });
  await options.goto(extensionUrl('options.html'));
  // The options page reads storage once, on mount, so the rules are written
  // first and the page is reloaded onto them.
  await options.evaluate(
    (custom: Array<CustomRule>) => chrome.storage.sync.set({ custom }),
    EXAMPLE_RULES,
  );
  await options.reload();
  await options.getByRole('textbox', { name: strings.cssLabel }).last().waitFor();
  await options.evaluate(async () => {
    await document.fonts.ready;
  });

  // Whatever the two rules come out to, up to what the canvas has room for.
  const height = Math.min(await contentHeight(options), OPTIONS_MAX_HEIGHT);
  await options.setViewportSize({ height, width: OPTIONS_WIDTH });
  const frame = await options.screenshot();

  await compose(context, {
    caption: 'Your own CSS, on any site you name.',
    frame,
    subtitle: 'One domain, one switch, one block of CSS',
    to: 'shot-3-options.png',
    width: OPTIONS_WIDTH,
  });
}

/**
 * Lays a page's own screenshot on the black canvas the store wants, with a
 * line of what it is under it. The PNG rides in as a data URL: the canvas is
 * a page of its own, and a file it could load would be one more file to clean
 * up afterwards.
 */
async function compose(
  context: BrowserContext,
  {
    caption,
    frame,
    subtitle,
    to,
    width,
  }: { caption: string; frame: Buffer; subtitle: string; to: string; width: number },
): Promise<void> {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { background: #000000; margin: 0; }
  body {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 28px;
    height: ${SHOT_HEIGHT}px;
    justify-content: center;
    width: ${SHOT_WIDTH}px;
  }
  img {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    display: block;
    width: ${width}px;
  }
  p { margin: 0; text-align: center; }
  .caption {
    color: #ffffff;
    font: 500 26px/1.2 system-ui, sans-serif;
    letter-spacing: -0.01em;
  }
  .subtitle { color: #8a8a8a; font: 400 16px/1.4 system-ui, sans-serif; margin-top: -18px; }
</style></head><body>
  <img alt="" src="data:image/png;base64,${frame.toString('base64')}">
  <p class="caption">${caption}</p>
  <p class="subtitle">${subtitle}</p>
</body></html>`;

  const canvas = await context.newPage();
  await canvas.setViewportSize({ height: SHOT_HEIGHT, width: SHOT_WIDTH });
  await canvas.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await canvas.waitForFunction(() => document.images[0]?.complete === true);
  await canvas.evaluate(async () => {
    await document.fonts.ready;
  });
  await canvas.screenshot({ path: path.join(store, to) });
  await canvas.close();
  written(to);
}

/**
 * Clicks the consent dialog away if there is one, wherever it is: Google
 * serves it as a page of its own on consent.youtube.com, and as an iframe on
 * youtube.com itself. Nothing to click is the answer this wants.
 */
async function dismissConsent(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    const button = frame.getByRole('button', { name: CONSENT_BUTTON }).first();
    try {
      await button.click({ timeout: 2000 });
      await page.waitForLoadState('domcontentloaded');
      return;
    } catch {
      // This frame has no consent button, which is what most of them are.
    }
  }
}

/**
 * One Chromium with the unpacked build loaded, thrown away afterwards, dark
 * because the canvas the shots sit on is black.
 */
async function withExtension(run: (context: BrowserContext) => Promise<void>): Promise<void> {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'attentionawareness-store-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: [`--disable-extensions-except=${unpacked}`, `--load-extension=${unpacked}`],
    // Extensions do not load in the headless shell; this is the full browser.
    channel: 'chromium',
    colorScheme: 'dark',
    viewport: { height: SHOT_HEIGHT, width: SHOT_WIDTH },
  });

  try {
    await run(context);
  } finally {
    await context.close();
    await rm(userDataDir, { force: true, recursive: true });
  }
}

/**
 * How tall the page's own content is. `documentElement.scrollHeight` would
 * answer with the window whenever the content is shorter than it, and the
 * popup always is.
 */
async function contentHeight(page: Page): Promise<number> {
  return Math.ceil(await page.evaluate(() => document.body.getBoundingClientRect().height));
}

function extensionUrl(file: string): string {
  return `chrome-extension://${unpackedExtensionId(unpacked)}/${file}`;
}

/**
 * Chrome derives an unpacked extension's id from the absolute path it loaded
 * it from: sha256 of that path, the first sixteen bytes, every hex digit
 * mapped onto a..p.
 */
function unpackedExtensionId(directory: string): string {
  const digest = createHash('sha256').update(directory).digest('hex').slice(0, 32);
  return [...digest].map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16))).join('');
}

function written(file: string): void {
  process.stdout.write(`store-shots: ${file} (${SHOT_WIDTH}x${SHOT_HEIGHT})\n`);
}

function skip(reason: string): void {
  process.stdout.write(`store-shots: skipped shot-2-youtube.png. ${reason}\n`);
}
