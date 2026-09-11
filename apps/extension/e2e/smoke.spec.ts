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
 * YouTube's own markup for one Shorts shelf on the home feed, the search
 * page's own shelf, a single Short among ordinary results, and the Shorts
 * entry in the guide, which is what `rules/youtube.css` keys on. Undefined
 * custom elements are `display: inline`, so "not none" is a real answer.
 */
const FIXTURE = `<!doctype html><html><head><title>YouTube</title></head><body>
<ytd-rich-section-renderer id="shelf"><ytd-rich-shelf-renderer is-shorts><ytm-shorts-lockup-view-model>short</ytm-shorts-lockup-view-model></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
<grid-shelf-view-model id="search-shelf"><ytm-shorts-lockup-view-model>short</ytm-shorts-lockup-view-model></grid-shelf-view-model>
<ytd-video-renderer id="result"><a href="/shorts/abc">short</a></ytd-video-renderer>
<ytd-guide-entry-renderer id="guide"><a title="Shorts">Shorts</a></ytd-guide-entry-renderer>
</body></html>`;

/** What a custom rule is pointed at: a page with nothing of YouTube's in it. */
const CUSTOM_FIXTURE = `<!doctype html><html><head><title>YouTube</title></head><body>
<div id="aa-fixture">fixture</div>
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
    await expect.poll(() => display(page, '#search-shelf')).toBe('none');
    await expect.poll(() => display(page, '#result')).toBe('none');
    await expect.poll(() => display(page, '#guide')).toBe('none');

    // The master switch, flipped in the popup that ships with the build.
    const popup = await openPopup(context);
    await popup.getByRole('switch', { name: strings.master }).click();

    await expect.poll(() => display(page, '#shelf')).not.toBe('none');
    await expect.poll(() => display(page, '#search-shelf')).not.toBe('none');
    await expect.poll(() => display(page, '#result')).not.toBe('none');
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

test('a rule written on the options page reaches the page it names', async () => {
  await withExtension(async (context) => {
    const options = await openExtensionPage(context, 'options.html');

    // Two hosts the manifest already grants, on purpose: a domain of its own
    // raises Chromium's host permission prompt, which is a native dialog
    // outside the page and one Playwright cannot answer. That path is checked
    // by hand after a build; the README says so.
    await addRule(options, 'youtube.com', '#aa-fixture { display: none !important }');
    await addRule(options, 'x.com', '#aa-fixture { outline: 2px solid red }');
    await expect(options.getByText(strings.saved)).toBeVisible();

    await options.setViewportSize({ height: 640, width: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await options.emulateMedia({ colorScheme });
      await options.screenshot({
        fullPage: true,
        path: screenshot(test.info().outputPath(), colorScheme, 'options'),
      });
    }

    const page = await context.newPage();
    await page.route('https://www.youtube.com/**', (route) =>
      route.fulfill({ body: CUSTOM_FIXTURE, contentType: 'text/html' }),
    );
    await page.goto('https://www.youtube.com/');

    await expect.poll(() => display(page, '#aa-fixture')).toBe('none');
  });
});

/** One rule, added and filled in the way a reader would. */
async function addRule(options: Page, domain: string, css: string): Promise<void> {
  await options.getByRole('button', { name: strings.add }).click();
  const domainField = options.getByRole('textbox', { name: strings.domainLabel }).last();
  await domainField.fill(domain);
  await domainField.blur();
  await options.getByRole('textbox', { name: strings.cssLabel }).last().fill(css);
}

/**
 * Where the page screenshots land. `AA_SCREENSHOT_DIR` is for looking at them;
 * without it they go where Playwright keeps a run's output.
 */
function screenshot(outputDir: string, colorScheme: 'dark' | 'light', page = 'popup'): string {
  const suffix = colorScheme === 'light' ? '' : '-dark';
  return path.join(process.env['AA_SCREENSHOT_DIR'] ?? outputDir, `ext-${page}${suffix}.png`);
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
  return openExtensionPage(context, 'popup.html');
}

async function openExtensionPage(context: BrowserContext, file: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${unpackedExtensionId(dist)}/${file}`);
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
