import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BROWSER_MARKS, detectBrowser } from './browser.ts';
import type { BrowserSigns } from './browser.ts';

const CHROME_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const SAFARI_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const FIREFOX_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0';

/** A browser's signs: Chrome's agent and no brands, but for what is given. */
function signs(given: Partial<BrowserSigns>): BrowserSigns {
  return { arc: false, brands: [], brave: false, userAgent: CHROME_AGENT, ...given };
}

test('Chrome is told by its brand, or by its agent alone', () => {
  assert.equal(detectBrowser(signs({ brands: ['Chromium', 'Google Chrome'] })), 'chrome');
  assert.equal(detectBrowser(signs({})), 'chrome');
});

test('Edge has no mark, and counts as Chrome by its agent', () => {
  assert.equal(detectBrowser(signs({ brands: ['Chromium', 'Microsoft Edge'] })), 'chrome');
  assert.equal(detectBrowser(signs({ userAgent: `${CHROME_AGENT} Edg/140.0.0.0` })), 'chrome');
});

test('Brave is told by its own object, though its brands say Chromium', () => {
  assert.equal(detectBrowser(signs({ brands: ['Chromium', 'Brave'], brave: true })), 'brave');
});

test('Opera is told by its brand, or by its agent', () => {
  assert.equal(detectBrowser(signs({ brands: ['Chromium', 'Opera'] })), 'opera');
  assert.equal(detectBrowser(signs({ userAgent: `${CHROME_AGENT} OPR/124.0.0.0` })), 'opera');
});

test('Arc is told by its colours, though it calls itself Chrome', () => {
  assert.equal(detectBrowser(signs({ arc: true, brands: ['Chromium', 'Google Chrome'] })), 'arc');
});

test('Vivaldi is told only when it names itself', () => {
  assert.equal(detectBrowser(signs({ userAgent: `${CHROME_AGENT} Vivaldi/7.6` })), 'vivaldi');
});

test('Safari and Firefox are none of them', () => {
  assert.equal(detectBrowser(signs({ userAgent: SAFARI_AGENT })), null);
  assert.equal(detectBrowser(signs({ userAgent: FIREFOX_AGENT })), null);
});

test('every mark is one path', () => {
  for (const mark of Object.values(BROWSER_MARKS)) {
    assert.match(mark, /^M[\d\s.,a-zA-Z-]+$/);
  }
});
