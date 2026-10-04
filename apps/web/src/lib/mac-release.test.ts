import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRelease } from './mac-release.ts';

const url = 'https://attentionawareness.com/mac/attention-awareness-0.4.0-4.dmg';

test('a file with no url is no release', () => {
  assert.equal(parseRelease(null), null);
  assert.equal(parseRelease('0.4.0'), null);
  assert.equal(parseRelease({ version: '0.4.0' }), null);
  assert.equal(parseRelease({ url: 4 }), null);
});

test('the saved name is the filename of latest.json', () => {
  assert.deepEqual(
    parseRelease({ filename: 'attention-awareness-0.4.1.dmg', url, version: '0.4.1' }),
    { filename: 'attention-awareness-0.4.1.dmg', url },
  );
});

test('without a filename the saved name is made from the version, never the build', () => {
  assert.deepEqual(parseRelease({ build: '4', url, version: '0.4.0' }), {
    filename: 'attention-awareness-0.4.0.dmg',
    url,
  });
});

test('a filename that is not a plain dmg name is not used', () => {
  for (const filename of ['../x.dmg', 'a b.dmg', 'app.exe', 'a/b.dmg', '', 4]) {
    assert.deepEqual(parseRelease({ filename, url, version: '0.4.0' }), {
      filename: 'attention-awareness-0.4.0.dmg',
      url,
    });
  }
});

test('with no usable version either the saved name carries none', () => {
  assert.deepEqual(parseRelease({ url, version: '0.4.0-4' }), {
    filename: 'attention-awareness.dmg',
    url,
  });
  assert.deepEqual(parseRelease({ url }), { filename: 'attention-awareness.dmg', url });
});
