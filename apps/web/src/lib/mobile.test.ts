import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMobileAgent, MOBILE_SCRIPT } from './mobile.ts';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

test('a phone is mobile', () => {
  assert.equal(isMobileAgent(IPHONE, 5), true);
  assert.equal(isMobileAgent(ANDROID, 5), true);
});

test('an iPad that asks as a Mac is mobile by its touch', () => {
  assert.equal(isMobileAgent(MAC, 5), true);
});

test('a Mac is not mobile, whatever its window', () => {
  assert.equal(isMobileAgent(MAC, 0), false);
});

/** Whether the head script marks the root of a browser with this agent and touch. */
function marks(userAgent: string, maxTouchPoints: number): boolean {
  let marked = false;
  const document = { documentElement: { setAttribute: () => (marked = true) } };
  new Function('navigator', 'document', MOBILE_SCRIPT)({ maxTouchPoints, userAgent }, document);
  return marked;
}

test('the script in the head runs the same test', () => {
  for (const [agent, touch] of [
    [IPHONE, 5],
    [ANDROID, 5],
    [MAC, 5],
    [MAC, 0],
  ] as const) {
    assert.equal(marks(agent, touch), isMobileAgent(agent, touch));
  }
});
