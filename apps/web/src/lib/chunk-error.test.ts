import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isChunkLoadError } from './chunk-error.ts';

test('a script from a replaced build is a chunk error, in each browser', () => {
  assert.equal(isChunkLoadError(new TypeError('Importing a module script failed.')), true);
  assert.equal(
    isChunkLoadError(
      new TypeError('Failed to fetch dynamically imported module: https://a.b/assets/x.js'),
    ),
    true,
  );
  assert.equal(
    isChunkLoadError(new TypeError('error loading dynamically imported module: x.js')),
    true,
  );
  assert.equal(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css')), true);
});

test('a chunk error by name counts too', () => {
  const error = new Error('Loading chunk 3 failed.');
  error.name = 'ChunkLoadError';
  assert.equal(isChunkLoadError(error), true);
});

test('any other error is not', () => {
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false);
  assert.equal(isChunkLoadError('Importing a module script failed'), false);
  assert.equal(isChunkLoadError(undefined), false);
});
