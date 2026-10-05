import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { macFileEvent, sendMacEvent } from './mac-analytics.ts';
import type { MacEvent } from './mac-analytics.ts';

const env = { OPENPANEL_CLIENT_ID: 'id', OPENPANEL_CLIENT_SECRET: 'secret' };
const event: MacEvent = { name: 'mac_download', properties: { source: 'browser' } };

afterEach(() => {
  mock.restoreAll();
});

test('off the live site no Mac event is sent', async () => {
  const sent = mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(null)));
  for (const origin of [
    'https://aa.local',
    'https://aa-phone.local',
    'http://localhost:3000',
    'https://attentionawareness-web.example.workers.dev',
  ]) {
    await sendMacEvent(event, new Request(`${origin}/mac/attention-awareness-0.4.4-8.dmg`), env);
  }
  assert.equal(sent.mock.callCount(), 0);
});

test('on the live site a Mac event goes to OpenPanel', async () => {
  const sent = mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(null)));
  await sendMacEvent(
    event,
    new Request('https://attentionawareness.com/mac/attention-awareness-0.4.4-8.dmg'),
    env,
  );
  assert.equal(sent.mock.callCount(), 1);
  assert.equal(
    String(sent.mock.calls[0]?.arguments[0]),
    'https://analytics.vinena.studio/api/track',
  );
});

test('without the client credentials nothing is sent, even on the live site', async () => {
  const sent = mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(null)));
  await sendMacEvent(event, new Request('https://attentionawareness.com/mac/appcast.xml'), {});
  assert.equal(sent.mock.callCount(), 0);
});

test('a download pressed on a local or preview page is not counted', () => {
  const url = new URL('https://attentionawareness.com/mac/attention-awareness-0.4.4-8.dmg');
  const press = (referer: string) =>
    macFileEvent(new Request(url, { headers: { referer } }), url, new Response(null));
  for (const referer of [
    'https://aa.local/',
    'https://aa-phone.local/',
    'https://aa.localhost/',
    'http://localhost:3000/',
    'http://127.0.0.1:4173/',
    'http://192.168.1.5:4173/',
    'http://[::1]:3000/',
    'https://attentionawareness-web.example.workers.dev/',
  ]) {
    assert.equal(press(referer), null, referer);
  }
  assert.equal(
    press('https://attentionawareness.com/')?.properties.referrer_host,
    'attentionawareness.com',
  );
  assert.equal(
    press('https://www.reddit.com/r/nosurf/')?.properties.referrer_host,
    'www.reddit.com',
  );
  assert.equal(macFileEvent(new Request(url), url, new Response(null))?.name, 'mac_download');
});
