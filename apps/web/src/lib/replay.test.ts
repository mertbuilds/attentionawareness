import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CapturedNetworkRequest } from 'posthog-js';
import { openPanelReplay, posthogReplay, replayMask } from './replay.ts';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const request = (name: string): CapturedNetworkRequest => ({
  duration: 0,
  entryType: 'resource',
  name,
  startTime: 0,
});

test('the marker is one data attribute', () => {
  assert.deepEqual(replayMask, { 'data-replay-mask': '' });
});

test('OpenPanel keeps inputs masked and leaves out marked subtrees and App Store icons', () => {
  assert.deepEqual(openPanelReplay, {
    blockSelector: '[data-replay-mask], img[src*="mzstatic.com"]',
    enabled: true,
    maskAllInputs: true,
    maskAllText: false,
    sampleRate: 0.1,
  });
  assert.ok(
    source('../routes/__root.tsx').includes('sessionReplay:${JSON.stringify(openPanelReplay)}'),
  );
});

test('PostHog masks inputs, marked text, App Store icons and requests', () => {
  assert.equal(posthogReplay.maskAllInputs, true);
  assert.equal(posthogReplay.maskTextSelector, '[data-replay-mask], [data-replay-mask] *');
  assert.equal(posthogReplay.blockSelector, 'img[src*="mzstatic.com"]');
  assert.ok(source('../routes/__root.tsx').includes('session_recording: posthogReplay,'));

  const drop = posthogReplay.maskCapturedNetworkRequestFn;
  assert.equal(drop(request('https://itunes.apple.com/search?term=x')), null);
  assert.equal(drop(request('https://is1-ssl.mzstatic.com/icon.png')), null);
  assert.deepEqual(
    drop(request('https://attentionawareness.com/api/sign')),
    request('https://attentionawareness.com/api/sign'),
  );
});

test('PostHog masks naming attributes when it cannot see the element', () => {
  const mask = posthogReplay.maskAttributeFn;
  for (const name of ['alt', 'aria-label', 'title']) {
    assert.equal(mask(name, 'Instagram', undefined), '*');
  }
});

test('PostHog masks naming attributes inside a marked subtree only', () => {
  const mask = posthogReplay.maskAttributeFn;
  const inside = { closest: (selector: string) => (selector === '[data-replay-mask]' ? {} : null) };
  const outside = { closest: () => null };
  for (const name of ['alt', 'aria-label', 'title']) {
    assert.equal(mask(name, 'Instagram', inside), '*');
  }
  assert.equal(mask('alt', 'Instagram', outside), 'Instagram');
  assert.equal(mask('class', 'x1abc', inside), 'x1abc');
});

test('/build marks its page and the tip that lists every blocked app and site', () => {
  const build = source('../routes/build.tsx');
  assert.ok(build.includes('<main {...replayMask} {...props(styles.page)}>'));
  assert.ok(build.includes('<span {...replayMask} {...props(styles.previewList)}>'));
});
