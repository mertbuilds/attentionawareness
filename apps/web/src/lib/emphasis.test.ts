import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitEmphasis } from './emphasis.ts';

test('the words between two marks are stressed, the rest is not', () => {
  assert.deepEqual(splitEmphasis('**Yes.** It is free.'), [
    { strong: true, text: 'Yes.' },
    { strong: false, text: ' It is free.' },
  ]);
  assert.deepEqual(splitEmphasis('One **two** three **four**'), [
    { strong: false, text: 'One ' },
    { strong: true, text: 'two' },
    { strong: false, text: ' three ' },
    { strong: true, text: 'four' },
  ]);
});

test('a message without marks is one plain run', () => {
  assert.deepEqual(splitEmphasis('Plain words'), [{ strong: false, text: 'Plain words' }]);
});

test('markup in a message stays text', () => {
  assert.deepEqual(splitEmphasis('<b>x</b>'), [{ strong: false, text: '<b>x</b>' }]);
});

test('a mark left open stresses nothing', () => {
  assert.deepEqual(splitEmphasis('A **b'), [
    { strong: false, text: 'A ' },
    { strong: false, text: 'b' },
  ]);
});
