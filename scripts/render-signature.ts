import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Writes the story's signature as pen strokes, in the order a hand writes
 * them.
 *
 * The hand is EMS Allure, a single-line font: each glyph is the path a pen
 * takes, not an outline around ink, so a stroke drawn along its own length is
 * the letter being written. The font is read from Inkscape's Hershey Text
 * extension at a pinned commit and never enters the repo; the module this
 * writes carries only the shapes of the signature's own words.
 *
 * Each locale's `home_story_sign` is split at its first comma: the name
 * before it is written large, the place and date after it small, under the
 * name and flush with its right edge.
 *
 *   node scripts/render-signature.ts
 */

const root = path.resolve(import.meta.dirname, '..');
const messages = path.join(root, 'apps/web/messages');
const out = path.join(root, 'apps/web/src/components/signature-strokes.ts');
const FONT_URL =
  'https://gitlab.com/inkscape/extensions/-/raw/29205f3cc6c39283e190a36d72d01ef428f668e5/svg_fonts/EMSAllure.svg';

/** The font's ascent, in its 1000-unit em: the baseline sits this far down. */
const ASCENT = 800;
/** The place and date, written at this share of the name's size. */
const PLACE_SCALE = 0.56;
/** The air between the foot of the name and the head of the place line. */
const LINE_GAP = 150;
/** Room around the ink for the pen's width, so no stroke is cut at the edge. */
const PAD = 24;
/**
 * Where this hand passes from one letter to the next, from the next one's
 * origin: a letter ends here, measured from the letter after it.
 */
const HANDOVER = { x: -31.5, y: 183 };
/**
 * Two letters of one word are written as one stroke when the pen would end
 * one this close to where it starts the next: the join of a cursive hand.
 */
const JOIN = 240;
/** Closer than this, two points are one. */
const SAME_POINT = 8;
const LETTER = /\p{L}/u;
/**
 * A point where the line turns back sharper than this (the cosine of the
 * angle between the way in and the way out) stays a corner when the line is
 * smoothed, as in the hook of an r.
 */
const CORNER = -0.2;
/** Steps a curve is cut into to measure it. */
const MEASURE_STEPS = 16;

type Point = { x: number; y: number };
type Glyph = { advance: number; strokes: Array<Array<Point>> };
type Box = { maxX: number; maxY: number; minX: number; minY: number };

const ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

function decode(text: string): string {
  return text.replaceAll(/&(#x[\da-f]+|\w+);/giu, (entity, name: string) =>
    name.startsWith('#x')
      ? String.fromCodePoint(Number.parseInt(name.slice(2), 16))
      : (ENTITIES[name] ?? entity),
  );
}

/** Every glyph of the SVG font, as polylines in font units, y up. */
function readFont(svg: string): Map<string, Glyph> {
  const glyphs = new Map<string, Glyph>();
  for (const [, attributes = ''] of svg.matchAll(/<glyph\s([^>]*)\/>/gu)) {
    const attribute = (name: string) =>
      new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'u').exec(attributes)?.[1];
    const unicode = attribute('unicode');
    if (unicode === undefined) {
      continue;
    }
    const strokes = (attribute('d') ?? '')
      .split('M')
      .map((stroke) => stroke.trim())
      .filter(Boolean)
      .map((stroke) =>
        stroke.split('L').map((point) => {
          const [x = 0, y = 0] = point.trim().split(/\s+/u).map(Number);
          return { x, y };
        }),
      );
    glyphs.set(decode(unicode), { advance: Number(attribute('horiz-adv-x')), strokes });
  }
  return glyphs;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * One line of text as the pen writes it, y down. Inside a word, a letter's
 * first stroke runs on from the letter before when they meet; its other
 * strokes, a t's bar or the dots of a ü, wait until the word is written.
 * The font draws its a from the tail back into the bowl, which no hand does,
 * so a first stroke that starts where its letter hands over is turned round.
 */
function write(glyphs: Map<string, Glyph>, text: string): Array<Array<Point>> {
  const strokes: Array<Array<Point>> = [];
  let later: Array<Array<Point>> = [];
  let joinable = false;
  let x = 0;
  for (const character of text) {
    const glyph = glyphs.get(character);
    if (glyph === undefined) {
      throw new Error(`EMS Allure has no glyph for "${character}"`);
    }
    if (character === ' ') {
      strokes.push(...later);
      later = [];
    }
    const handover = { x: glyph.advance + HANDOVER.x, y: HANDOVER.y };
    glyph.strokes.forEach((points, index) => {
      const [first] = points;
      const ordered =
        index === 0 && first && distance(first, handover) < SAME_POINT
          ? [...points].reverse()
          : points;
      const placed = ordered.map((point) => ({ x: point.x + x, y: ASCENT - point.y }));
      if (index > 0) {
        later.push(placed);
        return;
      }
      const previous = strokes.at(-1);
      const end = previous?.at(-1);
      const start = placed[0];
      if (
        joinable &&
        LETTER.test(character) &&
        previous &&
        end &&
        start &&
        distance(end, start) < JOIN
      ) {
        previous.push(...(distance(end, start) < SAME_POINT ? placed.slice(1) : placed));
      } else {
        strokes.push(placed);
      }
    });
    joinable = LETTER.test(character);
    x += glyph.advance;
  }
  return [...strokes, ...later];
}

function box(strokes: ReadonlyArray<ReadonlyArray<Point>>): Box {
  const points = strokes.flat();
  return {
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
  };
}

function move(
  strokes: ReadonlyArray<ReadonlyArray<Point>>,
  dx: number,
  dy: number,
  scale = 1,
): Array<Array<Point>> {
  return strokes.map((points) =>
    points.map((point) => ({ x: point.x * scale + dx, y: point.y * scale + dy })),
  );
}

function corner(points: ReadonlyArray<Point>, index: number): boolean {
  const before = points[index - 1];
  const at = points[index];
  const after = points[index + 1];
  if (!before || !at || !after) {
    return true;
  }
  const inX = at.x - before.x;
  const inY = at.y - before.y;
  const outX = after.x - at.x;
  const outY = after.y - at.y;
  const lengths = Math.hypot(inX, inY) * Math.hypot(outX, outY);
  return lengths === 0 || (inX * outX + inY * outY) / lengths < CORNER;
}

function cubicAt(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

const round = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) });

/** Offsets from `from`, written as short as path data allows. */
function offsets(from: Point, ...points: ReadonlyArray<Point>): string {
  return points
    .flatMap((point) => [point.x - from.x, point.y - from.y])
    .join(' ')
    .replaceAll(' -', '-');
}

/**
 * A polyline as a smooth path through its points (a Catmull-Rom spline as
 * cubic curves), turning sharp only at its corners, and the length of that
 * path. Where the line runs smooth through a point, the curve after it
 * mirrors the one before, so it is written with the shorter `s`.
 */
function smooth(line: ReadonlyArray<Point>): { d: string; length: number } {
  const points = line.map(round);
  const [first] = points;
  if (!first) {
    throw new Error('A stroke has no points');
  }
  let d = `M${first.x} ${first.y}`;
  let length = 0;
  let into = first;
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index] ?? first;
    const to = points[index + 1] ?? first;
    const sharp = corner(points, index);
    const before = sharp ? from : (points[index - 1] ?? from);
    const after = corner(points, index + 1) ? to : (points[index + 2] ?? to);
    const out = sharp
      ? round({ x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 })
      : { x: 2 * from.x - into.x, y: 2 * from.y - into.y };
    into = round({ x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 });
    d += sharp ? `c${offsets(from, out, into, to)}` : `s${offsets(from, into, to)}`;
    let last = from;
    for (let step = 1; step <= MEASURE_STEPS; step++) {
      const next = cubicAt(from, out, into, to, step / MEASURE_STEPS);
      length += distance(last, next);
      last = next;
    }
  }
  return { d, length: Math.round(length) };
}

function signature(glyphs: Map<string, Glyph>, text: string) {
  const comma = text.indexOf(',');
  const name = write(glyphs, text.slice(0, comma).trim());
  const place = move(write(glyphs, text.slice(comma + 1).trim()), 0, 0, PLACE_SCALE);
  const nameBox = box(name);
  const placeBox = box(place);
  const width = Math.ceil(
    Math.max(nameBox.maxX - nameBox.minX, placeBox.maxX - placeBox.minX) + 2 * PAD,
  );
  const placeTop = PAD + nameBox.maxY - nameBox.minY + LINE_GAP;
  const height = Math.ceil(placeTop + placeBox.maxY - placeBox.minY + PAD);
  return {
    height,
    name: move(name, width - PAD - nameBox.maxX, PAD - nameBox.minY).map(smooth),
    place: move(place, width - PAD - placeBox.maxX, placeTop - placeBox.minY).map(smooth),
    width,
  };
}

const response = await fetch(FONT_URL);
if (!response.ok) {
  throw new Error(`Fetching EMS Allure failed: ${response.status}`);
}
const glyphs = readFont(await response.text());

const texts = new Set(
  readdirSync(messages)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const text: unknown = JSON.parse(
        readFileSync(path.join(messages, file), 'utf8'),
      ).home_story_sign;
      if (typeof text !== 'string' || !text.includes(',')) {
        throw new Error(`${file}: home_story_sign needs a name, a comma, then the place`);
      }
      return text;
    }),
);

const strokes = (list: ReadonlyArray<{ d: string; length: number }>) =>
  list.map((stroke) => `      { d: '${stroke.d}', length: ${stroke.length} },`).join('\n');

const entries = [...texts].sort().map((text) => {
  const written = signature(glyphs, text);
  return `  ${JSON.stringify(text)}: {
    height: ${written.height},
    name: [
${strokes(written.name)}
    ],
    place: [
${strokes(written.place)}
    ],
    width: ${written.width},
  },`;
});

writeFileSync(
  out,
  `// Generated by scripts/render-signature.ts. Do not edit by hand: run
// \`node scripts/render-signature.ts\` instead.
//
// The hand is EMS Allure by Sheldon B. Michaels (SVG font by Windell H.
// Oskay, Evil Mad Scientist), a single-line derivative of Allura by Rob
// Leuschke, TypeSETit. Both are under the SIL Open Font License 1.1
// (https://openfontlicense.org), which leaves documents made with a font
// free of it: these paths are the signature's words, not the font.

/** One pen stroke, and how long it is in the units it is drawn in. */
export type Stroke = { d: string; length: number };

/**
 * The signature, keyed by the message it writes: the name, then the place
 * and date under it, each stroke in the order the pen draws it, in a box
 * \`width\` by \`height\` units.
 */
export const SIGNATURES: Readonly<
  Record<
    string,
    {
      height: number;
      name: ReadonlyArray<Stroke>;
      place: ReadonlyArray<Stroke>;
      width: number;
    }
  >
> = {
${entries.join('\n')}
};
`,
);
execFileSync(path.join(root, 'node_modules/.bin/oxfmt'), [out]);
process.stdout.write(`render-signature: ${path.relative(root, out)}\n`);
