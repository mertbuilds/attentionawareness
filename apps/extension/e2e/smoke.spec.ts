import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SITE_ORDER, siteStrings, strings } from '../src/lib/strings.ts';

/** The popup's own width, which is the window the browser gives it. */
const POPUP_WIDTH = 320;

/** The unpacked build. `pnpm build` has to have run. */
const dist = realpathSync(path.resolve(import.meta.dirname, '../dist'));

/**
 * YouTube's own markup for one Shorts shelf on the home feed and the Shorts
 * entry in the guide, which is what `rules/youtube.css` keys on. Undefined
 * custom elements are `display: inline`, so "not none" is a real answer.
 */
const FIXTURE = `<!doctype html><html><head><title>YouTube</title></head><body>
<ytd-rich-section-renderer id="shelf"><ytd-rich-shelf-renderer is-shorts><ytm-shorts-lockup-view-model>short</ytm-shorts-lockup-view-model></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
<ytd-guide-entry-renderer id="guide"><a title="Shorts">Shorts</a></ytd-guide-entry-renderer>
</body></html>`;

test('hides the Shorts shelf, and stops when the extension is turned off', async () => {
  await withExtension(async (context) => {
    const page = await context.newPage();
    // youtube.com is never reached: the host pattern is what has to match, and
    // it matches whatever answers for it.
    await page.route('https://www.youtube.com/**', (route) =>
      route.fulfill({ body: FIXTURE, contentType: 'text/html' }),
    );
    await page.goto('https://www.youtube.com/');

    await expect.poll(() => display(page, '#shelf')).toBe('none');
    await expect.poll(() => display(page, '#guide')).toBe('none');

    // The master switch, flipped in the popup that ships with the build.
    const popup = await openPopup(context);
    await popup.getByRole('switch', { name: strings.master }).click();

    await expect.poll(() => display(page, '#shelf')).not.toBe('none');
    await expect.poll(() => display(page, '#guide')).not.toBe('none');
  });
});

test('the popup draws a switch per site, in the licensed type', async () => {
  await withExtension(async (context) => {
    const popup = await openPopup(context);

    await expect(popup.getByRole('switch')).toHaveCount(SITE_ORDER.length + 1);
    for (const site of SITE_ORDER) {
      await expect(popup.getByRole('switch', { name: siteStrings[site].name })).toBeVisible();
    }

    // The footer's second link. `chrome.tabs.create` is there with `storage`
    // as the only permission, which is why the manifest asks for nothing more.
    expect(await popup.evaluate(() => typeof chrome.tabs.create)).toBe('function');

    // Suisse Intl is licensed and gitignored: what this asserts is that the
    // build bundled the woff2 files it has and the popup asked for them. A
    // checkout without `pnpm fonts` falls through to Inter, and says so here.
    expect(
      await popup.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].some(
          (face) => face.family === 'Suisse Intl' && face.status === 'loaded',
        );
      }),
    ).toBe(true);
    expect(await popup.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
      'Suisse Intl',
    );

    // Both schemes, because the popup follows the system and nothing else.
    // The window is the page's own width, the way the browser sizes a popup.
    await popup.setViewportSize({ height: 320, width: POPUP_WIDTH });
    for (const colorScheme of ['light', 'dark'] as const) {
      await popup.emulateMedia({ colorScheme });
      await popup.screenshot({
        fullPage: true,
        path: screenshot(test.info().outputPath(), colorScheme),
      });
    }
  });
});

/**
 * Where the two popup screenshots land. `AA_SCREENSHOT_DIR` is for looking at
 * them; without it they go where Playwright keeps a run's output.
 */
function screenshot(outputDir: string, colorScheme: 'dark' | 'light'): string {
  const name = colorScheme === 'light' ? 'ext-popup.png' : 'ext-popup-dark.png';
  return path.join(process.env['AA_SCREENSHOT_DIR'] ?? outputDir, name);
}

/**
 * One Chromium with the unpacked build loaded, thrown away afterwards. The
 * extension is the point, so there is no shared browser to reuse.
 */
async function withExtension(run: (context: BrowserContext) => Promise<void>): Promise<void> {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'attentionawareness-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    // Extensions do not load in the headless shell; this is the full browser.
    channel: 'chromium',
  });

  try {
    await run(context);
  } finally {
    await context.close();
    await rm(userDataDir, { force: true, recursive: true });
  }
}

async function openPopup(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${unpackedExtensionId(dist)}/popup.html`);
  return page;
}

function display(page: Page, selector: string): Promise<string> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    return element === null ? 'missing' : getComputedStyle(element).display;
  }, selector);
}

/**
 * Chrome derives an unpacked extension's id from the absolute path it loaded
 * it from: sha256 of that path, the first sixteen bytes, every hex digit
 * mapped onto a..p. With no background service worker there is nothing else to
 * ask for it.
 */
function unpackedExtensionId(directory: string): string {
  const digest = createHash('sha256').update(directory).digest('hex').slice(0, 32);
  return [...digest].map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16))).join('');
}
