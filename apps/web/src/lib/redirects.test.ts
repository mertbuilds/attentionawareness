import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trailingSlashRedirect } from './redirects.ts';

test('a closing slash moves to the path without it, for good, query kept', () => {
  const moved = trailingSlashRedirect(new URL('https://attentionawareness.com/blog/post/?x=1'));
  assert.equal(moved?.status, 308);
  assert.equal(moved?.headers.get('location'), 'https://attentionawareness.com/blog/post?x=1');
});

test('the home page and a path without a closing slash are left alone', () => {
  assert.equal(trailingSlashRedirect(new URL('https://attentionawareness.com/')), null);
  assert.equal(trailingSlashRedirect(new URL('https://attentionawareness.com/guide')), null);
});

test('a path of slashes stays on the site', () => {
  assert.equal(
    trailingSlashRedirect(new URL('https://attentionawareness.com//other.example/'))?.headers.get(
      'location',
    ),
    'https://attentionawareness.com//other.example',
  );
  assert.equal(
    trailingSlashRedirect(new URL('https://attentionawareness.com///'))?.headers.get('location'),
    'https://attentionawareness.com/',
  );
});
