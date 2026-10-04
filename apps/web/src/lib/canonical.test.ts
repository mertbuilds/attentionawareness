import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalRedirect } from './canonical.ts';

const target = (address: string): string | null =>
  canonicalRedirect(new URL(address))?.headers.get('location') ?? null;

test('the apex over https is the site and is not moved', () => {
  assert.equal(canonicalRedirect(new URL('https://attentionawareness.com/guide')), null);
});

test('www and the old names move to the apex, path and query kept', () => {
  assert.equal(
    target('https://www.attentionawareness.com/blog?x=1'),
    'https://attentionawareness.com/blog?x=1',
  );
  assert.equal(
    target('https://keepyourattention.com/guide'),
    'https://attentionawareness.com/guide',
  );
  assert.equal(target('http://www.dikkatfarkindaligi.com/'), 'https://attentionawareness.com/');
});

test('the apex over plain http moves to https with a 301', () => {
  const moved = canonicalRedirect(new URL('http://attentionawareness.com/blog?x=1'));
  assert.equal(moved?.status, 301);
  assert.equal(moved?.headers.get('location'), 'https://attentionawareness.com/blog?x=1');
});

test('a local server over http is left alone', () => {
  assert.equal(canonicalRedirect(new URL('http://localhost:4173/')), null);
});
