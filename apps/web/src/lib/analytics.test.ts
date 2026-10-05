import assert from 'node:assert/strict';
import { test } from 'node:test';
import { posthog, queuedCalls, startAnalytics } from './analytics.ts';

test('off the live site PostHog is never loaded and calls do not wait', () => {
  // No window or document here: a load scheduled anyway would throw.
  for (const host of ['aa.local', 'aa-phone.local', 'localhost', 'x.workers.dev', '']) {
    startAnalytics(host, 'key', {});
  }
  for (let index = 0; index < 100; index += 1) {
    posthog.capture('mac_download_started', { placement: 'hero' });
    posthog.logger.info('profile blocklist updated');
  }
  assert.equal(queuedCalls(), 0);
});

test('on the live site PostHog waits for the load event and calls wait for it', () => {
  const waits: Array<string> = [];
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { readyState: 'loading' },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: (type: string) => waits.push(type),
      setTimeout: () => 0,
    },
  });
  try {
    startAnalytics('attentionawareness.com', 'key', {});
    posthog.capture('support_clicked', { placement: 'footer' });
    assert.deepEqual(waits, ['load']);
    assert.equal(queuedCalls(), 1);
  } finally {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'window');
  }
});
