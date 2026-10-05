import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellAt, enterTrail, glowStrength, gridOrigin } from './grid-cell.ts';

const CELL = 40;
/** A hero 1000 wide and 620 tall, 100 from the window's left and 50 from its top. */
const BOX = { height: 620, left: 100, top: 50, width: 1000 };
const FROM_CORNER = { cell: CELL, originX: 0, originY: 0 };

test('a ruling from the left edge starts at the edge', () => {
  assert.equal(gridOrigin('0%', 1000, CELL), 0);
  assert.equal(gridOrigin('12px', 1000, CELL), 12);
});

test('a centred ruling starts half the room one square leaves', () => {
  assert.equal(gridOrigin('50%', 1000, CELL), 480);
  assert.equal(gridOrigin('50%', 1013, CELL), 486.5);
  assert.equal(gridOrigin('100%', 1000, CELL), 960);
});

test('a position that is neither a percentage nor a length has no origin', () => {
  assert.equal(gridOrigin('calc(100% - 10px)', 1000, CELL), undefined);
  assert.equal(gridOrigin('', 1000, CELL), undefined);
});

test('a point is in the square it stands on', () => {
  assert.deepEqual(cellAt({ x: 100, y: 50 }, BOX, FROM_CORNER), {
    col: 0,
    height: CELL,
    left: 0,
    row: 0,
    top: 0,
    width: CELL,
  });
  assert.deepEqual(cellAt({ x: 100 + 95, y: 50 + 130 }, BOX, FROM_CORNER), {
    col: 2,
    height: CELL,
    left: 80,
    row: 3,
    top: 120,
    width: CELL,
  });
});

test('a point on a line is in the square the line starts', () => {
  assert.equal(cellAt({ x: 100 + 79.9, y: 50 }, BOX, FROM_CORNER)?.col, 1);
  assert.equal(cellAt({ x: 100 + 80, y: 50 }, BOX, FROM_CORNER)?.col, 2);
});

test('squares are counted from the origin, and the edge cuts the one before it', () => {
  // A centred ruling in a box 1013 wide: its squares start 6.5 from the edge.
  const box = { ...BOX, width: 1013 };
  const centred = { cell: CELL, originX: gridOrigin('50%', 1013, CELL) ?? 0, originY: 0 };
  assert.deepEqual(cellAt({ x: 100 + 3, y: 50 + 10 }, box, centred), {
    col: -13,
    height: CELL,
    left: 0,
    row: 0,
    top: 0,
    width: 6.5,
  });
  assert.deepEqual(cellAt({ x: 100 + 7, y: 50 + 10 }, box, centred), {
    col: -12,
    height: CELL,
    left: 6.5,
    row: 0,
    top: 0,
    width: CELL,
  });
});

test('the right and bottom edges cut the last square', () => {
  // 1000 is 25 squares exactly; 620 is 15 squares and half of one more.
  const last = cellAt({ x: 100 + 999, y: 50 + 619 }, BOX, FROM_CORNER);
  assert.deepEqual(last, { col: 24, height: 20, left: 960, row: 15, top: 600, width: CELL });
  const narrow = cellAt({ x: 100 + 989, y: 50 }, { ...BOX, width: 990 }, FROM_CORNER);
  assert.deepEqual(narrow, { col: 24, height: CELL, left: 960, row: 0, top: 0, width: 30 });
});

test('a point outside the hero is in no square', () => {
  assert.equal(cellAt({ x: 99.9, y: 60 }, BOX, FROM_CORNER), undefined);
  assert.equal(cellAt({ x: 200, y: 49.9 }, BOX, FROM_CORNER), undefined);
  assert.equal(cellAt({ x: 1100, y: 60 }, BOX, FROM_CORNER), undefined);
  assert.equal(cellAt({ x: 200, y: 670 }, BOX, FROM_CORNER), undefined);
});

test('the trail grows oldest first until the cap', () => {
  const one = enterTrail([], 'a', 3);
  const two = enterTrail(one.trail, 'b', 3);
  const three = enterTrail(two.trail, 'c', 3);
  assert.deepEqual(three, { dropped: undefined, trail: ['a', 'b', 'c'] });
});

test('past the cap the oldest square is dropped', () => {
  assert.deepEqual(enterTrail(['a', 'b', 'c'], 'd', 3), { dropped: 'a', trail: ['b', 'c', 'd'] });
});

test('a square the pointer comes back to moves to the end and drops nothing', () => {
  assert.deepEqual(enterTrail(['a', 'b', 'c'], 'a', 3), {
    dropped: undefined,
    trail: ['b', 'c', 'a'],
  });
});

test('a long sweep never holds more than the cap', () => {
  let trail: Array<string> = [];
  for (let step = 0; step < 500; step += 1) {
    trail = enterTrail(trail, `${step}:0`, 300).trail;
  }
  assert.equal(trail.length, 300);
  assert.equal(trail[0], '200:0');
  assert.equal(trail.at(-1), '499:0');
});

const IN = 80;
const OUT = 3000;

test('a square lights to full over the fade in and stays there', () => {
  const glow = { at: 1000, from: 0, lit: true };
  assert.equal(glowStrength(glow, 1000, IN, OUT), 0);
  assert.equal(glowStrength(glow, 1040, IN, OUT), 0.5);
  assert.equal(glowStrength(glow, 1080, IN, OUT), 1);
  assert.equal(glowStrength(glow, 9000, IN, OUT), 1);
});

test('a square that was left holds its colour, then lets go', () => {
  const glow = { at: 1000, from: 1, lit: false };
  assert.equal(glowStrength(glow, 1000, IN, OUT), 1);
  assert.ok(glowStrength(glow, 2000, IN, OUT) > 0.95);
  assert.ok(glowStrength(glow, 3000, IN, OUT) > 0.7);
  assert.ok(glowStrength(glow, 3700, IN, OUT) < 0.3);
  assert.equal(glowStrength(glow, 4000, IN, OUT), 0);
  assert.equal(glowStrength(glow, 9000, IN, OUT), 0);
});

test('a square left before it was full goes out from where it was', () => {
  assert.equal(glowStrength({ at: 1000, from: 0.5, lit: false }, 1000, IN, OUT), 0.5);
  assert.equal(glowStrength({ at: 1000, from: 0.5, lit: false }, 4000, IN, OUT), 0);
});

test('a square the pointer comes back to rises from where it was, never from nothing', () => {
  // Left at 1000, two seconds gone: what it has then is where it lights from.
  const fading = { at: 1000, from: 1, lit: false };
  const from = glowStrength(fading, 3000, IN, OUT);
  const back = { at: 3000, from, lit: true };
  assert.equal(glowStrength(back, 3000, IN, OUT), from);
  assert.ok(glowStrength(back, 3010, IN, OUT) > from);
  assert.equal(glowStrength(back, 3080, IN, OUT), 1);
  // Left again, its fade starts over from full.
  assert.equal(glowStrength({ at: 5000, from: 1, lit: false }, 5000, IN, OUT), 1);
});

test('a time before the change counts as the change', () => {
  assert.equal(glowStrength({ at: 1000, from: 1, lit: false }, 990, IN, OUT), 1);
});
