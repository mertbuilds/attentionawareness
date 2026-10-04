import assert from 'node:assert/strict';
import { test } from 'node:test';
import { macFileResponse } from './mac-files.ts';
import type { MacFilesBucket } from './mac-files.ts';

const SIZE = 10;

/** A bucket that holds every key asked for, ten bytes each. */
const bucket: MacFilesBucket = {
  get: (_key, options) =>
    Promise.resolve({
      body: new Blob([new Uint8Array(options.range?.length ?? SIZE)]).stream(),
      httpEtag: '"etag"',
      size: SIZE,
      writeHttpMetadata: (headers) => {
        headers.set('content-type', 'application/x-apple-diskimage');
      },
    }),
  head: () =>
    Promise.resolve({
      httpEtag: '"etag"',
      size: SIZE,
      writeHttpMetadata: (headers) => {
        headers.set('content-type', 'application/x-apple-diskimage');
      },
    }),
};

async function ask(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, 'https://attentionawareness.com');
  const response = await macFileResponse(new Request(url, init), url, bucket);
  assert.ok(response !== null);
  return response;
}

const DMG = '/mac/attention-awareness-0.4.0-4.dmg';
const SAVED = 'attachment; filename="attention-awareness-0.4.0.dmg"';

test('a dmg is saved under its version, without the build number', async () => {
  const response = await ask(DMG);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-disposition'), SAVED);
  assert.equal(response.headers.get('content-type'), 'application/x-apple-diskimage');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.equal(response.headers.get('content-length'), '10');
});

test('a dmg named before the build number joined keeps its name', async () => {
  const response = await ask('/mac/attention-awareness-0.2.0.dmg');
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="attention-awareness-0.2.0.dmg"',
  );
});

test('HEAD and a range carry the same name and still answer as before', async () => {
  const head = await ask(DMG, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-disposition'), SAVED);
  assert.equal(head.headers.get('content-length'), '10');
  assert.equal(head.headers.get('accept-ranges'), 'bytes');

  const range = await ask(DMG, { headers: { range: 'bytes=0-3' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-disposition'), SAVED);
  assert.equal(range.headers.get('content-range'), 'bytes 0-3/10');
  assert.equal(range.headers.get('content-length'), '4');
});

test('the feed, latest.json and any other name are not attachments', async () => {
  for (const path of ['/mac/appcast.xml', '/mac/latest.json', '/mac/other-0.4.0-4.dmg']) {
    const response = await ask(path);
    assert.equal(response.headers.get('content-disposition'), null);
  }
});
