import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { proxyAnalytics } from './op-proxy.ts';

const AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';

afterEach(() => {
  mock.restoreAll();
});

const post = (origin: string): Request =>
  new Request(`${origin}/op/track`, {
    body: '{"type":"track"}',
    headers: { 'user-agent': AGENT },
    method: 'POST',
  });

test('off the live site the proxy forwards nothing and answers 200', async () => {
  const sent = mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(null)));
  for (const origin of [
    'https://aa.local',
    'https://aa-phone.local',
    'http://localhost:3000',
    'http://192.168.1.5:4173',
    'https://attentionawareness-web.example.workers.dev',
  ]) {
    const answer = await proxyAnalytics({ request: post(origin) });
    assert.equal(answer.status, 200);
    const script = await proxyAnalytics({ request: new Request(`${origin}/op/op1.js`) });
    assert.equal(script.status, 200);
    assert.equal(await script.text(), '');
  }
  assert.equal(sent.mock.callCount(), 0);
});

test('on the live site an event goes to OpenPanel', async () => {
  const sent = mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(null)));
  await proxyAnalytics({ request: post('https://attentionawareness.com') });
  assert.equal(sent.mock.callCount(), 1);
  assert.equal(
    String(sent.mock.calls[0]?.arguments[0]),
    'https://analytics.vinena.studio/api/track',
  );
});
