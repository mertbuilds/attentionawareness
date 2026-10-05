/** A box in the window, as `getBoundingClientRect` gives it. */
export type GridBox = { height: number; left: number; top: number; width: number };

/**
 * How a box is ruled: the side of one square, and how far the first whole
 * square starts from the box's left and top edges.
 */
export type GridRule = { cell: number; originX: number; originY: number };

/**
 * One square of the ruling: which one, and the part of it that is inside the
 * box, measured from the box's left and top edges.
 */
export type GridCell = {
  col: number;
  height: number;
  left: number;
  row: number;
  top: number;
  width: number;
};

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
 * it have negative numbers, and one the box's edge cuts is given cut.
 */
export function cellAt(
  point: { x: number; y: number },
  box: GridBox,
  rule: GridRule,
): GridCell | undefined {
  const x = point.x - box.left;
  const y = point.y - box.top;
  if (x < 0 || y < 0 || x >= box.width || y >= box.height) {
    return undefined;
  }
  const col = Math.floor((x - rule.originX) / rule.cell);
  const row = Math.floor((y - rule.originY) / rule.cell);
  const left = Math.max(0, rule.originX + col * rule.cell);
  const top = Math.max(0, rule.originY + row * rule.cell);
  return {
    col,
    height: Math.min(box.height, rule.originY + (row + 1) * rule.cell) - top,
    left,
    row,
    top,
    width: Math.min(box.width, rule.originX + (col + 1) * rule.cell) - left,
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
 * A square's light: whether the pointer is in it, when that last changed, and
 * how strong it was then, from 0 to 1.
 */
export type Glow = { at: number; from: number; lit: boolean };

/**
 * How strong a square's light is at `now`, from 0 to 1. Under the pointer it
 * rises to full over `fadeIn`, from wherever it was. Left, it goes out over
 * `fadeOut`, slowly at first and fast at the end, from wherever it was.
 */
export function glowStrength(glow: Glow, now: number, fadeIn: number, fadeOut: number): number {
  const since = Math.max(0, now - glow.at);
  if (glow.lit) {
    return Math.min(1, glow.from + since / fadeIn);
  }
  const gone = Math.min(1, since / fadeOut);
  return glow.from * (1 - gone ** 3);
}
