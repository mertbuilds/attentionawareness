/** A box in the window, as `getBoundingClientRect` gives it. */
export type GridBox = { height: number; left: number; top: number; width: number };

/**
 * How a box is ruled: the side of one square, and how far the first whole
 * square starts from the box's left and top edges.
 */
export type GridRule = { cell: number; originX: number; originY: number };

/**
 * How far a repeated background of `cell` starts from the edge of a box of
 * `box`, from one axis of its computed `background-position`: a percentage is
 * of the room the square leaves, as CSS has it, and a length is itself.
 * Anything else has no answer.
 */
export function gridOrigin(position: string, box: number, cell: number): number | undefined {
  const match = /^(-?\d*\.?\d+)(%|px)$/.exec(position.trim());
  if (match === null) {
    return undefined;
  }
  const value = Number(match[1]);
  return match[2] === '%' ? (value / 100) * (box - cell) : value;
}

/**
 * The square under a point of the window, or nothing when the point is not
 * over the box. Squares are counted from the rule's origin, so those before
 * it have negative numbers.
 */
export function cellAt(
  point: { x: number; y: number },
  box: GridBox,
  rule: GridRule,
): { col: number; row: number } | undefined {
  const x = point.x - box.left;
  const y = point.y - box.top;
  if (x < 0 || y < 0 || x >= box.width || y >= box.height) {
    return undefined;
  }
  return {
    col: Math.floor((x - rule.originX) / rule.cell),
    row: Math.floor((y - rule.originY) / rule.cell),
  };
}

/**
 * The trail after the pointer comes into the square `key`: the squares still
 * on screen, oldest first, never more than `cap`. A square already in the
 * trail moves to its end; a new one past the cap drops the oldest, which is
 * handed back so what drew it can be used again.
 */
export function enterTrail(
  trail: ReadonlyArray<string>,
  key: string,
  cap: number,
): { dropped: string | undefined; trail: Array<string> } {
  const next = trail.filter((other) => other !== key);
  const dropped = next.length >= cap ? next.shift() : undefined;
  next.push(key);
  return { dropped, trail: next };
}

/**
 * The squares a straight stroke crosses from one square to another, in the
 * order it crosses them: every one after `from`, up to `to` itself, and none
 * when the two are the same. It is Bresenham's line: one square for each step
 * along the longer way, so each touches the one before it by a side or by a
 * corner and a slanted stroke is as thin as a level one.
 */
export function cellsBetween(
  from: { col: number; row: number },
  to: { col: number; row: number },
): Array<{ col: number; row: number }> {
  const across = Math.abs(to.col - from.col);
  const down = Math.abs(to.row - from.row);
  const stepCol = Math.sign(to.col - from.col);
  const stepRow = Math.sign(to.row - from.row);
  const cells: Array<{ col: number; row: number }> = [];
  let { col, row } = from;
  let error = across - down;
  while (col !== to.col || row !== to.row) {
    const doubled = 2 * error;
    if (doubled > -down) {
      error -= down;
      col += stepCol;
    }
    if (doubled < across) {
      error += across;
      row += stepRow;
    }
    cells.push({ col, row });
  }
  return cells;
}

/**
 * A square's light: when the pointer came into it, how strong it was then,
 * from 0 to 1, and when the pointer left it, if it has.
 */
export type Glow = { at: number; from: number; left: number | undefined };

/**
 * How strong a square's light is at `now`, from 0 to 1. From the moment the
 * pointer comes in it rises to full over `fadeIn`, from wherever it was, and
 * keeps rising after the pointer has gone, so a square crossed in one frame
 * is as bright as one rested on. From the moment the pointer leaves it goes
 * out over `fadeOut`, slowly at first and fast at the end.
 */
export function glowStrength(glow: Glow, now: number, fadeIn: number, fadeOut: number): number {
  const risen = Math.min(1, glow.from + Math.max(0, now - glow.at) / fadeIn);
  if (glow.left === undefined) {
    return risen;
  }
  const gone = Math.min(1, Math.max(0, now - glow.left) / fadeOut);
  return risen * (1 - gone ** 3);
}
