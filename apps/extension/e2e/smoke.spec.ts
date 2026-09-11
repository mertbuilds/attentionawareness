import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';

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
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'attentionawareness-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    // Extensions do not load in the headless shell; this is the full browser.
    channel: 'chromium',
  });

  try {
    const page = await context.newPage();
    // youtube.com is never reached: the host pattern is what has to match, and
    // it matches whatever answers for it.
    await page.route('https://www.youtube.com/**', (route) =>
      route.fulfill({ body: FIXTURE, contentType: 'text/html' }),
    );
    await page.goto('https://www.youtube.com/');

    await expect.poll(() => display(page, '#shelf')).toBe('none');
    await expect.poll(() => display(page, '#guide')).toBe('none');

    // The master switch, flipped where the extension can reach its own storage.
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${unpackedExtensionId(dist)}/popup.html`);
    await popup.evaluate(() => chrome.storage.sync.set({ enabled: false }));

    await expect.poll(() => display(page, '#shelf')).not.toBe('none');
    await expect.poll(() => display(page, '#guide')).not.toBe('none');
  } finally {
    await context.close();
    await rm(userDataDir, { force: true, recursive: true });
  }
});

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
