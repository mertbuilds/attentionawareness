import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellAt, cellsBetween, enterTrail, glowStrength, gridOrigin } from './grid-cell.ts';

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
    row: 0,
  });
  assert.deepEqual(cellAt({ x: 100 + 95, y: 50 + 130 }, BOX, FROM_CORNER), {
    col: 2,
    row: 3,
  });
});

test('a point on a line is in the square the line starts', () => {
  assert.equal(cellAt({ x: 100 + 79.9, y: 50 }, BOX, FROM_CORNER)?.col, 1);
  assert.equal(cellAt({ x: 100 + 80, y: 50 }, BOX, FROM_CORNER)?.col, 2);
});

test('squares are counted from the origin, and the one before it is numbered below zero', () => {
  // A centred ruling in a box 1013 wide: its squares start 6.5 from the edge.
  const box = { ...BOX, width: 1013 };
  const centred = { cell: CELL, originX: gridOrigin('50%', 1013, CELL) ?? 0, originY: 0 };
  assert.deepEqual(cellAt({ x: 100 + 3, y: 50 + 10 }, box, centred), {
    col: -13,
    row: 0,
  });
  assert.deepEqual(cellAt({ x: 100 + 7, y: 50 + 10 }, box, centred), {
    col: -12,
    row: 0,
  });
});

test('a ruling that stands on the bottom edge counts its rows from there', () => {
  // 620 tall: the last whole square starts at 580, and the first row is half a square.
  const originY = gridOrigin('100%', BOX.height, CELL) ?? 0;
  assert.equal(originY, 580);
  const fromBottom = { cell: CELL, originX: 0, originY };
  assert.deepEqual(cellAt({ x: 100, y: 50 + 619 }, BOX, fromBottom), {
    col: 0,
    row: 0,
  });
  assert.deepEqual(cellAt({ x: 100, y: 50 + 579 }, BOX, fromBottom), {
    col: 0,
    row: -1,
  });
  assert.deepEqual(cellAt({ x: 100, y: 50 + 5 }, BOX, fromBottom), {
    col: 0,
    row: -15,
  });
});

test('a ruling centred both ways starts a part of a square from each edge', () => {
  const box = { height: 150, left: 0, top: 0, width: 150 };
  const origin = gridOrigin('50%', 150, CELL) ?? 0;
  assert.equal(origin, 55);
  const centred = { cell: CELL, originX: origin, originY: origin };
  assert.deepEqual(cellAt({ x: 60, y: 10 }, box, centred), {
    col: 0,
    row: -2,
  });
});

test('a box shorter than a square holds one row', () => {
  const box = { height: 24, left: 0, top: 0, width: 200 };
  assert.deepEqual(cellAt({ x: 50, y: 23 }, box, FROM_CORNER), {
    col: 1,
    row: 0,
  });
  assert.equal(cellAt({ x: 50, y: 24 }, box, FROM_CORNER), undefined);
});

test('a point by the right and bottom edges is in the last square', () => {
  // 1000 is 25 squares exactly; 620 is 15 squares and half of one more.
  const last = cellAt({ x: 100 + 999, y: 50 + 619 }, BOX, FROM_CORNER);
  assert.deepEqual(last, { col: 24, row: 15 });
  const narrow = cellAt({ x: 100 + 989, y: 50 }, { ...BOX, width: 990 }, FROM_CORNER);
  assert.deepEqual(narrow, { col: 24, row: 0 });
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
  const glow = { at: 1000, from: 0, left: undefined };
  assert.equal(glowStrength(glow, 1000, IN, OUT), 0);
  assert.equal(glowStrength(glow, 1040, IN, OUT), 0.5);
  assert.equal(glowStrength(glow, 1080, IN, OUT), 1);
  assert.equal(glowStrength(glow, 9000, IN, OUT), 1);
});

test('a square that was left holds its colour, then lets go', () => {
  const glow = { at: 0, from: 0, left: 1000 };
  assert.equal(glowStrength(glow, 1000, IN, OUT), 1);
  assert.ok(glowStrength(glow, 2000, IN, OUT) > 0.95);
  assert.ok(glowStrength(glow, 3000, IN, OUT) > 0.7);
  assert.ok(glowStrength(glow, 3700, IN, OUT) < 0.3);
  assert.equal(glowStrength(glow, 4000, IN, OUT), 0);
  assert.equal(glowStrength(glow, 9000, IN, OUT), 0);
});

test('a square crossed in a moment still lights to full before it goes out', () => {
  // In at 1000 and left 4ms later, as in the middle of a fast stroke.
  const glow = { at: 1000, from: 0, left: 1004 };
  assert.ok(glowStrength(glow, 1004, IN, OUT) < 0.1);
  assert.ok(glowStrength(glow, 1040, IN, OUT) > 0.49);
  assert.ok(glowStrength(glow, 1080, IN, OUT) > 0.99);
  assert.equal(glowStrength(glow, 4004, IN, OUT), 0);
});

test('a square the pointer comes back to rises from where it was, never from nothing', () => {
  // Left at 1000, two seconds gone: what it has then is where it lights from.
  const fading = { at: 0, from: 0, left: 1000 };
  const from = glowStrength(fading, 3000, IN, OUT);
  assert.ok(from > 0 && from < 1);
  const back = { at: 3000, from, left: undefined };
  assert.equal(glowStrength(back, 3000, IN, OUT), from);
  assert.ok(glowStrength(back, 3010, IN, OUT) > from);
  assert.equal(glowStrength(back, 3080, IN, OUT), 1);
  // Left again, its fade starts over from full.
  assert.equal(glowStrength({ ...back, left: 5000 }, 5000, IN, OUT), 1);
  assert.ok(glowStrength({ ...back, left: 5000 }, 7000, IN, OUT) > 0.7);
});

test('a time before the change counts as the change', () => {
  assert.equal(glowStrength({ at: 0, from: 1, left: 1000 }, 990, IN, OUT), 1);
  assert.equal(glowStrength({ at: 1000, from: 0.4, left: undefined }, 990, IN, OUT), 0.4);
});

const at = (col: number, row: number) => ({ col, row });

test('a stroke that stays in its square crosses none', () => {
  assert.deepEqual(cellsBetween(at(3, 4), at(3, 4)), []);
});

test('a stroke to the next square crosses that one', () => {
  assert.deepEqual(cellsBetween(at(3, 4), at(4, 4)), [at(4, 4)]);
  assert.deepEqual(cellsBetween(at(3, 4), at(2, 3)), [at(2, 3)]);
});

test('a level stroke crosses every square of its row, either way', () => {
  assert.deepEqual(cellsBetween(at(0, 2), at(4, 2)), [at(1, 2), at(2, 2), at(3, 2), at(4, 2)]);
  assert.deepEqual(cellsBetween(at(4, 2), at(0, 2)), [at(3, 2), at(2, 2), at(1, 2), at(0, 2)]);
});

test('an upright stroke crosses every square of its column, either way', () => {
  assert.deepEqual(cellsBetween(at(2, -1), at(2, 2)), [at(2, 0), at(2, 1), at(2, 2)]);
  assert.deepEqual(cellsBetween(at(2, 2), at(2, -1)), [at(2, 1), at(2, 0), at(2, -1)]);
});

test('a stroke from corner to corner is one square thick', () => {
  assert.deepEqual(cellsBetween(at(0, 0), at(3, 3)), [at(1, 1), at(2, 2), at(3, 3)]);
  assert.deepEqual(cellsBetween(at(0, 0), at(-3, 3)), [at(-1, 1), at(-2, 2), at(-3, 3)]);
  assert.deepEqual(cellsBetween(at(3, 3), at(0, 0)), [at(2, 2), at(1, 1), at(0, 0)]);
});

test('a shallow stroke has one square a column', () => {
  const path = cellsBetween(at(0, 0), at(6, 2));
  assert.deepEqual(
    path.map((cell) => cell.col),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(path.at(-1), at(6, 2));
  assert.equal(cellsBetween(at(6, 2), at(0, 0)).length, 6);
});

test('a steep stroke has one square a row', () => {
  const path = cellsBetween(at(0, 0), at(2, -7));
  assert.deepEqual(
    path.map((cell) => cell.row),
    [-1, -2, -3, -4, -5, -6, -7],
  );
  assert.deepEqual(path.at(-1), at(2, -7));
  assert.equal(cellsBetween(at(2, -7), at(0, 0)).length, 7);
});

test('each square of a stroke touches the one before it, and none comes twice', () => {
  const ends = [-9, -4, -1, 0, 1, 3, 8, 17];
  for (const col of ends) {
    for (const row of ends) {
      const from = at(2, -3);
      const path = cellsBetween(from, at(col, row));
      assert.equal(path.length, Math.max(Math.abs(col - 2), Math.abs(row + 3)));
      let before = from;
      for (const cell of path) {
        const across = Math.abs(cell.col - before.col);
        const down = Math.abs(cell.row - before.row);
        assert.ok(across <= 1 && down <= 1 && across + down > 0);
        before = cell;
      }
      assert.deepEqual(before, at(col, row));
      assert.equal(new Set(path.map((cell) => `${cell.col}:${cell.row}`)).size, path.length);
    }
  }
});
