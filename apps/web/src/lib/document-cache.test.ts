import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingAssetResponse, withDocumentCache } from './document-cache.ts';

test('a page is checked with the server each time', () => {
  const page = withDocumentCache(
    new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
  );
  assert.equal(page.headers.get('cache-control'), 'no-cache');
});

test('a response with its own cache rule or of another type keeps it', () => {
  const kept = withDocumentCache(
    new Response('<html></html>', {
      headers: { 'cache-control': 'no-store', 'content-type': 'text/html' },
    }),
  );
  assert.equal(kept.headers.get('cache-control'), 'no-store');
  const json = withDocumentCache(
    new Response('{}', { headers: { 'content-type': 'application/json' } }),
  );
  assert.equal(json.headers.get('cache-control'), null);
});

test('a hashed file that is gone is a plain 404, anything else is not answered here', () => {
  assert.equal(missingAssetResponse(new URL('https://a.b/assets/index-abc.js'))?.status, 404);
  assert.equal(missingAssetResponse(new URL('https://a.b/blog')), null);
});
