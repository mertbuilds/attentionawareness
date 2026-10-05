import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shape } from './open-numbers.server.ts';
import type { Row } from './open-numbers.server.ts';
import { durationParts } from './open-numbers.ts';

const NOW = Date.parse('2026-10-05T12:00:00Z');

test('no time at all is zero seconds', () => {
  assert.deepEqual(durationParts(0), [{ count: 0, unit: 'second' }]);
});

test('under a minute is seconds only', () => {
  assert.deepEqual(durationParts(48), [{ count: 48, unit: 'second' }]);
});

test('a whole minute leaves out the zero seconds', () => {
  assert.deepEqual(durationParts(60), [{ count: 1, unit: 'minute' }]);
});

test('minutes and seconds, largest first', () => {
  assert.deepEqual(durationParts(102), [
    { count: 1, unit: 'minute' },
    { count: 42, unit: 'second' },
  ]);
});

test('an hour and more, with a zero unit left out', () => {
  assert.deepEqual(durationParts(3600), [{ count: 1, unit: 'hour' }]);
  assert.deepEqual(durationParts(7265), [
    { count: 2, unit: 'hour' },
    { count: 1, unit: 'minute' },
    { count: 5, unit: 'second' },
  ]);
  assert.deepEqual(durationParts(3605.6), [
    { count: 1, unit: 'hour' },
    { count: 6, unit: 'second' },
  ]);
});

test('the visit rows give the bounce rate and the average visit', () => {
  const rows: Array<Row> = [
    { hits: 41, kind: 'visits', label: 'bounced', visitors: 132 },
    { hits: 38_579, kind: 'visits', label: 'seconds', visitors: 132 },
  ];
  const numbers = shape(rows, NOW);
  assert.equal(numbers.bounceRate, 31);
  assert.equal(numbers.sessionSeconds, 292);
});

test('missing visit rows count as zero', () => {
  const numbers = shape([{ hits: 269, kind: 'total', label: '', visitors: 110 }], NOW);
  assert.equal(numbers.bounceRate, 0);
  assert.equal(numbers.sessionSeconds, 0);
  assert.equal(numbers.views, 269);
});

test('no visits at all is zero, not a division by zero', () => {
  const rows: Array<Row> = [
    { hits: 0, kind: 'visits', label: 'bounced', visitors: 0 },
    { hits: 0, kind: 'visits', label: 'seconds', visitors: 0 },
  ];
  const numbers = shape(rows, NOW);
  assert.equal(numbers.bounceRate, 0);
  assert.equal(numbers.sessionSeconds, 0);
});
