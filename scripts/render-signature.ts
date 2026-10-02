import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Writes the story's signature as the outlines of its letters, set in Great
 * Vibes, and the pen strokes that write them.
 *
 * The page loads no web font for two lines of handwriting. The font is read
 * from the google/fonts repository at a pinned commit and never enters the
 * repo; the module this writes carries only the shapes of the signature's own
 * words, as filled paths.
 *
 * Great Vibes draws ink, not the way a pen went, so the pen is found in the
 * ink: each line is filled into a grid of pixels and thinned to its centre
 * line (Zhang-Suen), and the centre line is followed as a hand writes it,
 * straight on through a crossing, round a loop where the pen passes it, each
 * piece of ink from left to right. The page shows the letters through these
 * strokes as they are drawn, each as wide as the ink it has to uncover.
 *
 * Each locale's `home_story_sign` is split at its first comma: the name
 * before it is set large, the place and date after it at half the size,
 * under the name and flush with its right edge.
 *
 *   node scripts/render-signature.ts
 */
import { create as createFont } from 'fontkit';
import type { Font, Path as GlyphPath } from 'fontkit';

const root = path.resolve(import.meta.dirname, '..');
const messages = path.join(root, 'apps/web/messages');
const out = path.join(root, 'apps/web/src/components/signature-glyphs.ts');
const FONT_URL =
  'https://raw.githubusercontent.com/google/fonts/a6039f387a790a092e417b4e8dbdd5b57fe4d6d4/ofl/greatvibes/GreatVibes-Regular.ttf';

/** The name is set this many units to the em: the scale the page sizes it by. */
const EM = 1000;
/** The place and date, set at this share of the name's size. */
const PLACE_SCALE = 0.5;
/** The air between the foot of the name and the head of the place line. */
const LINE_GAP = 120;
/** Room around the ink, so the box cuts no edge of a letter. */
const PAD = 8;

/**
 * The pen is found on a grid this many pixels to the em, whatever the size
 * of the line: fine enough that a hairline is a few pixels wide.
 */
const GRID = 500;
/** Blank pixels around the ink, so no pixel of it touches the grid's edge. */
const BORDER = 4;
/**
 * Paper enclosed by ink in fewer pixels than this is a seam where two
 * letters' outlines overlap, not the eye of a letter, and is filled in.
 */
const SEAM = 64;
/**
 * A branch of the centre line that ends within this many times the ink's
 * depth at its junction, plus `SPUR_SLACK` pixels, only runs into a corner
 * of the ink. It is cut off.
 */
const SPUR = 1.6;
const SPUR_SLACK = 2;
/**
 * Two junctions closer than this many times the deeper one's depth are one
 * crossing, which thinning splits in two where the lines cross at a slant.
 */
const BRIDGE = 2;
/**
 * The way a line leaves a junction is read this many times the junction's
 * depth along it, and at least `REACH_MIN` pixels, past the blot where the
 * lines meet.
 */
const REACH = 3;
const REACH_MIN = 6;
/**
 * At a junction the pen runs on into the line that bends least from the one
 * it came along, unless that one bends sharper than this: the cosine of the
 * turn. Then the stroke ends there.
 */
const STRAIGHT = -0.2;
/** A stroke shorter than this many pixels, among others, is left to them. */
const STUB = 14;
/** The centre line is averaged over this many pixels to each side. */
const SOFTEN = 2;
/** How far, in pixels, the simplified line may stray from the centre line. */
const SIMPLIFY = 0.6;
/**
 * A point where the line turns back sharper than this (the cosine of the
 * angle between the way in and the way out) stays a corner when the line is
 * smoothed.
 */
const CORNER = -0.2;
/** Steps a curve is cut into to measure it. */
const MEASURE_STEPS = 16;
/**
 * The pen is this many units wider on each side than the farthest ink it
 * writes, so the edge of its mask clears the edge of the letter.
 */
const MARGIN = 12;
/** The side of a cell of the index the nearest stroke is found in, in units. */
const CELL = 24;

type Point = { x: number; y: number };
type Box = { maxX: number; maxY: number; minX: number; minY: number };

const COMMANDS = {
  bezierCurveTo: 'c',
  closePath: 'z',
  lineTo: 'l',
  moveTo: 'm',
  quadraticCurveTo: 'q',
} as const;

/** One command of an outline, its points absolute and in whole units. */
type Command = { command: keyof typeof COMMANDS; points: Array<Point> };

/**
 * A line of ink on the grid, and how deep each pixel of it lies: its
 * distance to the nearest blank pixel. Pixel `col` is centred at
 * `x0 + (col + 0.5) / scale` units.
 */
type Grid = {
  cols: number;
  depth: Float64Array;
  ink: Uint8Array;
  rows: number;
  scale: number;
  x0: number;
  y0: number;
};

/** Where an edge of the centre line meets a node: its first point or its last. */
type End = { edge: number; side: 0 | 1 };
/** A junction or a loose end of the centre line, in pixels. */
type Node = { at: Point; ends: Array<End>; radius: number };
/** The centre line between two nodes, through the pixel centres it crosses. */
type Edge = { a: number; b: number; points: Array<Point> };
type Graph = { edges: Map<number, Edge>; nodes: Map<number, Node> };
/** A pen stroke as the edges it runs along, each forwards or backwards. */
type Trail = Array<{ edge: number; reversed: boolean }>;

type Pen = { d: string; length: number; width: number };

/** One line of text as its letters' outlines, y down, the baseline at 0. */
function set(font: Font, text: string, size: number): Array<GlyphPath> {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let pen = 0;
  return run.glyphs.map((glyph, index) => {
    const position = run.positions[index];
    const placed = glyph.path.transform(
      scale,
      0,
      0,
      -scale,
      pen + (position?.xOffset ?? 0) * scale,
      -(position?.yOffset ?? 0) * scale,
    );
    pen += (position?.xAdvance ?? 0) * scale;
    return placed;
  });
}

function box(paths: ReadonlyArray<GlyphPath>): Box {
  return paths.reduce<Box>(
    (bounds, { bbox }) => ({
      maxX: Math.max(bounds.maxX, bbox.maxX),
      maxY: Math.max(bounds.maxY, bbox.maxY),
      minX: Math.min(bounds.minX, bbox.minX),
      minY: Math.min(bounds.minY, bbox.minY),
    }),
    { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity },
  );
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lengthOf(points: ReadonlyArray<Point>): number {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    length += from && to ? distance(from, to) : 0;
  }
  return length;
}

const round = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) });

/** Offsets from `from`, written as short as path data allows. */
function offsets(from: Point, ...points: ReadonlyArray<Point>): string {
  return points
    .flatMap((point) => [point.x - from.x, point.y - from.y])
    .join(' ')
    .replaceAll(' -', '-');
}

/** The outlines as commands, their points in whole units. */
function outline(paths: ReadonlyArray<GlyphPath>): Array<Command> {
  return paths
    .flatMap((glyph) => glyph.commands)
    .map(({ args, command }) => {
      const points: Array<Point> = [];
      for (let index = 0; index < args.length; index += 2) {
        points.push(round({ x: args[index] ?? 0, y: args[index + 1] ?? 0 }));
      }
      return { command, points };
    });
}

/** The outline as one path's data, each point an offset from the last. */
function data(commands: ReadonlyArray<Command>): string {
  let d = '';
  let at: Point = { x: 0, y: 0 };
  let start = at;
  for (const { command, points } of commands) {
    if (command === 'closePath') {
      d += COMMANDS.closePath;
      at = start;
      continue;
    }
    d += `${COMMANDS[command]}${offsets(at, ...points)}`;
    at = points.at(-1) ?? at;
    if (command === 'moveTo') {
      start = at;
    }
  }
  return d;
}

/** The point `t` of the way along a Bézier curve of any degree. */
function bezier(controls: ReadonlyArray<Point>, t: number): Point {
  let points = controls;
  while (points.length > 1) {
    const last = points;
    points = last.slice(1).map((point, index) => {
      const from = last[index] ?? point;
      return { x: from.x + (point.x - from.x) * t, y: from.y + (point.y - from.y) * t };
    });
  }
  return points[0] ?? { x: 0, y: 0 };
}

/** The outline as closed polygons, its curves cut into pieces about `step` long. */
function polygons(commands: ReadonlyArray<Command>, step: number): Array<Array<Point>> {
  const all: Array<Array<Point>> = [];
  let polygon: Array<Point> = [];
  let at: Point = { x: 0, y: 0 };
  for (const { command, points } of commands) {
    if (command === 'moveTo' || command === 'closePath') {
      if (polygon.length > 2) {
        all.push(polygon);
      }
      polygon = [...points];
      at = points.at(-1) ?? at;
      continue;
    }
    const controls = [at, ...points];
    const pieces = Math.max(1, Math.ceil(lengthOf(controls) / step));
    for (let piece = 1; piece <= pieces; piece++) {
      polygon.push(bezier(controls, piece / pieces));
    }
    at = points.at(-1) ?? at;
  }
  if (polygon.length > 2) {
    all.push(polygon);
  }
  return all;
}

/**
 * The polygons filled into a grid `scale` pixels to the unit, nonzero as the
 * browser fills the path, a pixel inked when its centre is inside.
 */
function rasterize(shape: ReadonlyArray<ReadonlyArray<Point>>, scale: number): Grid {
  const bounds = shape.flat().reduce<Box>(
    (ink, point) => ({
      maxX: Math.max(ink.maxX, point.x),
      maxY: Math.max(ink.maxY, point.y),
      minX: Math.min(ink.minX, point.x),
      minY: Math.min(ink.minY, point.y),
    }),
    { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity },
  );
  const x0 = bounds.minX - BORDER / scale;
  const y0 = bounds.minY - BORDER / scale;
  const cols = Math.ceil((bounds.maxX - bounds.minX) * scale) + 2 * BORDER;
  const rows = Math.ceil((bounds.maxY - bounds.minY) * scale) + 2 * BORDER;
  const ink = new Uint8Array(cols * rows);
  const sides = shape.flatMap((polygon) =>
    polygon.map((from, index) => ({ from, to: polygon[(index + 1) % polygon.length] ?? from })),
  );
  for (let row = 0; row < rows; row++) {
    const y = y0 + (row + 0.5) / scale;
    const crossings: Array<{ winding: number; x: number }> = [];
    for (const { from, to } of sides) {
      if (from.y <= y !== to.y <= y) {
        crossings.push({
          winding: to.y > from.y ? 1 : -1,
          x: from.x + ((y - from.y) * (to.x - from.x)) / (to.y - from.y),
        });
      }
    }
    crossings.sort((a, b) => a.x - b.x);
    let winding = 0;
    crossings.forEach((crossing, index) => {
      winding += crossing.winding;
      const next = crossings[index + 1];
      if (winding !== 0 && next) {
        const first = Math.max(0, Math.ceil((crossing.x - x0) * scale - 0.5));
        const last = Math.min(cols - 1, Math.ceil((next.x - x0) * scale - 0.5) - 1);
        ink.fill(1, row * cols + first, row * cols + last + 1);
      }
    });
  }
  fillSeams(ink, cols);
  return { cols, depth: depthOf(ink, cols, rows), ink, rows, scale, x0, y0 };
}

function fillSeams(ink: Uint8Array, cols: number) {
  const seen = new Uint8Array(ink.length);
  for (let start = 0; start < ink.length; start++) {
    if (ink[start] || seen[start]) {
      continue;
    }
    seen[start] = 1;
    const paper = [start];
    for (let at = 0; at < paper.length; at++) {
      const pixel = paper[at] ?? 0;
      for (const next of [pixel - cols, pixel + 1, pixel + cols, pixel - 1]) {
        if (next >= 0 && next < ink.length && !ink[next] && !seen[next]) {
          seen[next] = 1;
          paper.push(next);
        }
      }
    }
    if (paper.length < SEAM) {
      for (const pixel of paper) {
        ink[pixel] = 1;
      }
    }
  }
}

/** Stands in for a distance longer than any on the grid. */
const FAR = 1e20;

/**
 * The squared distance from each cell of a row to the nearest of the
 * parabolas `values` stands for: the lower envelope of Felzenszwalb and
 * Huttenlocher's exact distance transform.
 */
function envelope(values: Float64Array, count: number, out: Float64Array) {
  const hull = new Int32Array(count);
  const bounds = new Float64Array(count + 1);
  const meet = (q: number, h: number) =>
    ((values[q] ?? 0) + q * q - ((values[h] ?? 0) + h * h)) / (2 * q - 2 * h);
  let k = 0;
  bounds[0] = -FAR;
  bounds[1] = FAR;
  for (let q = 1; q < count; q++) {
    let s = meet(q, hull[k] ?? 0);
    while (s <= (bounds[k] ?? 0)) {
      k--;
      s = meet(q, hull[k] ?? 0);
    }
    k++;
    hull[k] = q;
    bounds[k] = s;
    bounds[k + 1] = FAR;
  }
  k = 0;
  for (let q = 0; q < count; q++) {
    while ((bounds[k + 1] ?? 0) < q) {
      k++;
    }
    const h = hull[k] ?? 0;
    out[q] = (q - h) ** 2 + (values[h] ?? 0);
  }
}

/** Each ink pixel's distance to the nearest blank one, down columns then rows. */
function depthOf(ink: Uint8Array, cols: number, rows: number): Float64Array {
  const depth = Float64Array.from(ink, (value) => (value ? FAR : 0));
  const line = new Float64Array(Math.max(cols, rows));
  const out = new Float64Array(Math.max(cols, rows));
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      line[row] = depth[row * cols + col] ?? 0;
    }
    envelope(line, rows, out);
    for (let row = 0; row < rows; row++) {
      depth[row * cols + col] = out[row] ?? 0;
    }
  }
  for (let row = 0; row < rows; row++) {
    line.set(depth.subarray(row * cols, (row + 1) * cols));
    envelope(line, cols, out);
    for (let col = 0; col < cols; col++) {
      depth[row * cols + col] = Math.sqrt(out[col] ?? 0);
    }
  }
  return depth;
}

/** The offsets of a pixel's eight neighbours, clockwise from the one above. */
const around = (cols: number) => [-cols, -cols + 1, 1, cols + 1, cols, cols - 1, -1, -cols - 1];

/**
 * The ink thinned to its centre line, one pixel wide (Zhang-Suen). Then every
 * pixel the line can lose without coming apart is taken out, the steps of a
 * stair where it runs at a slant, so each pixel of a line has two neighbours.
 */
function thin(grid: Grid): Uint8Array {
  const { cols, rows } = grid;
  const offsets8 = around(cols);
  const line = Uint8Array.from(grid.ink);
  const look = (index: number) => offsets8.map((offset) => line[index + offset] ?? 0);
  for (let changed = true; changed;) {
    changed = false;
    for (const second of [false, true]) {
      const gone: Array<number> = [];
      for (let row = 1; row < rows - 1; row++) {
        for (let col = 1; col < cols - 1; col++) {
          const index = row * cols + col;
          if (!line[index]) {
            continue;
          }
          const near = look(index);
          const count = near.reduce((sum, value) => sum + value, 0);
          const turns = near.filter((value, k) => !value && near[(k + 1) % 8]).length;
          const [n, , e, , s, , w] = near;
          if (
            count >= 2 &&
            count <= 6 &&
            turns === 1 &&
            (second ? !(n && e && w) && !(n && s && w) : !(n && e && s) && !(e && s && w))
          ) {
            gone.push(index);
          }
        }
      }
      for (const index of gone) {
        line[index] = 0;
      }
      changed ||= gone.length > 0;
    }
  }
  // A pixel is simple, and can go, when the blank around it is one piece
  // (Yokoi's connectivity number is 1) and it is no loose end.
  for (let changed = true; changed;) {
    changed = false;
    for (let index = 0; index < line.length; index++) {
      if (!line[index]) {
        continue;
      }
      const near = look(index);
      const blank = near.map((value) => 1 - value);
      const count = near.reduce((sum, value) => sum + value, 0);
      const yokoi = [0, 2, 4, 6].reduce(
        (sum, k) => sum + (blank[k] ?? 0) * (1 - (blank[k + 1] ?? 0) * (blank[(k + 2) % 8] ?? 0)),
        0,
      );
      if (count >= 2 && yokoi === 1) {
        line[index] = 0;
        changed = true;
      }
    }
  }
  return line;
}

/**
 * The centre line as nodes, its loose ends and its junctions (touching
 * pixels with three neighbours or more, as one), and the edges between them.
 * A loop with neither gets a node at its first pixel, its top.
 */
function graphOf(line: Uint8Array, grid: Grid): Graph {
  const { cols } = grid;
  const offsets8 = around(cols);
  const neighbours = (index: number) =>
    offsets8.map((offset) => index + offset).filter((next) => line[next] === 1);
  const centre = (index: number): Point => ({
    x: (index % cols) + 0.5,
    y: Math.floor(index / cols) + 0.5,
  });
  const owner = new Int32Array(line.length).fill(-1);
  const members = new Map<number, ReadonlyArray<number>>();
  const nodes = new Map<number, Node>();
  const edges = new Map<number, Edge>();
  const addNode = (pixels: ReadonlyArray<number>) => {
    const id = nodes.size;
    for (const pixel of pixels) {
      owner[pixel] = id;
    }
    const points = pixels.map(centre);
    nodes.set(id, {
      at: {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      },
      ends: [],
      radius: Math.max(...pixels.map((pixel) => grid.depth[pixel] ?? 0)),
    });
    members.set(id, pixels);
  };
  const addEdge = (chain: ReadonlyArray<number>) => {
    const id = edges.size;
    const a = owner[chain[0] ?? 0] ?? 0;
    const b = owner[chain.at(-1) ?? 0] ?? 0;
    edges.set(id, { a, b, points: chain.map(centre) });
    nodes.get(a)?.ends.push({ edge: id, side: 0 });
    nodes.get(b)?.ends.push({ edge: id, side: 1 });
  };
  for (let index = 0; index < line.length; index++) {
    if (line[index] !== 1 || owner[index] !== -1 || neighbours(index).length === 2) {
      continue;
    }
    const cluster = [index];
    if (neighbours(index).length >= 3) {
      const inCluster = new Set(cluster);
      for (let at = 0; at < cluster.length; at++) {
        for (const next of neighbours(cluster[at] ?? 0)) {
          if (!inCluster.has(next) && neighbours(next).length >= 3) {
            inCluster.add(next);
            cluster.push(next);
          }
        }
      }
    }
    addNode(cluster.sort((a, b) => a - b));
    // A dot thinned to one pixel is a stroke of no length.
    if (neighbours(index).length === 0) {
      addEdge([index, index]);
    }
  }
  const walked = new Uint8Array(line.length);
  const touching = new Set<number>();
  const trace = (from: number, first: number) => {
    const chain = [from, first];
    let previous = from;
    let current = first;
    while (owner[current] === -1) {
      walked[current] = 1;
      const next = neighbours(current).find((pixel) => pixel !== previous);
      if (next === undefined) {
        break;
      }
      chain.push(next);
      previous = current;
      current = next;
    }
    addEdge(chain);
  };
  for (const [id, pixels] of members) {
    for (const pixel of pixels) {
      for (const next of neighbours(pixel)) {
        const other = owner[next] ?? -1;
        if (other === -1 && !walked[next]) {
          trace(pixel, next);
        } else if (other !== -1 && other !== id) {
          const pair = Math.min(pixel, next) * line.length + Math.max(pixel, next);
          if (!touching.has(pair)) {
            touching.add(pair);
            addEdge([pixel, next]);
          }
        }
      }
    }
  }
  for (let index = 0; index < line.length; index++) {
    if (line[index] === 1 && owner[index] === -1 && !walked[index]) {
      addNode([index]);
      trace(index, neighbours(index)[0] ?? index);
    }
  }
  return { edges, nodes };
}

/** The edge's points from the end given, starting and ending at its nodes. */
function along(graph: Graph, end: End): Array<Point> {
  const edge = graph.edges.get(end.edge);
  if (!edge) {
    return [];
  }
  const points = [...edge.points];
  points[0] = graph.nodes.get(edge.a)?.at ?? points[0] ?? { x: 0, y: 0 };
  points[points.length - 1] = graph.nodes.get(edge.b)?.at ?? points.at(-1) ?? { x: 0, y: 0 };
  return end.side === 0 ? points : points.reverse();
}

/** A node where only two edges meet is no junction: the two become one. */
function dissolve(graph: Graph, id: number) {
  const node = graph.nodes.get(id);
  const [first, second] = node?.ends ?? [];
  const one = first && graph.edges.get(first.edge);
  const two = second && graph.edges.get(second.edge);
  if (!node || node.ends.length !== 2 || !first || !second || !one || !two || one === two) {
    return;
  }
  const into = first.side === 1 ? one.points : [...one.points].reverse();
  const onward = second.side === 0 ? two.points : [...two.points].reverse();
  const a = first.side === 1 ? one.a : one.b;
  const b = second.side === 0 ? two.b : two.a;
  const edge = Math.max(...graph.edges.keys()) + 1;
  graph.edges.set(edge, { a, b, points: [...into.slice(0, -1), node.at, ...onward.slice(1)] });
  const replace = (at: number, old: End, side: 0 | 1) => {
    const other = graph.nodes.get(at);
    if (other) {
      other.ends = other.ends.map((end) =>
        end.edge === old.edge && end.side !== old.side ? { edge, side } : end,
      );
    }
  };
  replace(a, first, 0);
  replace(b, second, 1);
  graph.edges.delete(first.edge);
  graph.edges.delete(second.edge);
  graph.nodes.delete(id);
}

/** Cuts the spurs thinning grows into the corners of thick ink, shortest first. */
function prune(graph: Graph) {
  for (;;) {
    let spur: { base: number; edge: number; length: number; tip: number } | undefined;
    for (const [id, edge] of graph.edges) {
      const a = graph.nodes.get(edge.a);
      const b = graph.nodes.get(edge.b);
      if (!a || !b || (a.ends.length === 1) === (b.ends.length === 1)) {
        continue;
      }
      const [tip, base] = a.ends.length === 1 ? [edge.a, edge.b] : [edge.b, edge.a];
      const junction = base === edge.a ? a : b;
      const length = lengthOf(edge.points);
      if (
        junction.ends.length >= 3 &&
        length <= junction.radius * SPUR + SPUR_SLACK &&
        (!spur || length < spur.length)
      ) {
        spur = { base, edge: id, length, tip };
      }
    }
    if (!spur) {
      return;
    }
    const { base, edge, tip } = spur;
    graph.edges.delete(edge);
    graph.nodes.delete(tip);
    const junction = graph.nodes.get(base);
    if (junction) {
      junction.ends = junction.ends.filter((end) => end.edge !== edge);
    }
    dissolve(graph, base);
  }
}

/** Joins the two halves of each crossing thinning has split, shortest first. */
function contract(graph: Graph) {
  for (;;) {
    let bridge: { edge: number; length: number } | undefined;
    for (const [id, edge] of graph.edges) {
      const a = graph.nodes.get(edge.a);
      const b = graph.nodes.get(edge.b);
      if (!a || !b || edge.a === edge.b || a.ends.length < 3 || b.ends.length < 3) {
        continue;
      }
      const length = lengthOf(edge.points);
      if (length <= BRIDGE * Math.max(a.radius, b.radius) && (!bridge || length < bridge.length)) {
        bridge = { edge: id, length };
      }
    }
    const edge = bridge && graph.edges.get(bridge.edge);
    const a = edge && graph.nodes.get(edge.a);
    const b = edge && graph.nodes.get(edge.b);
    if (!bridge || !edge || !a || !b) {
      return;
    }
    const moved = b.ends.filter((end) => end.edge !== bridge.edge);
    for (const end of moved) {
      const other = graph.edges.get(end.edge);
      if (other && end.side === 0) {
        other.a = edge.a;
      } else if (other) {
        other.b = edge.a;
      }
    }
    a.at = { x: (a.at.x + b.at.x) / 2, y: (a.at.y + b.at.y) / 2 };
    a.radius = Math.max(a.radius, b.radius);
    a.ends = [...a.ends.filter((end) => end.edge !== bridge.edge), ...moved];
    graph.edges.delete(bridge.edge);
    graph.nodes.delete(edge.b);
  }
}

/** The way the edge leaves its node, as a unit vector. */
function heading(graph: Graph, end: End, radius: number): Point {
  const points = along(graph, end);
  const [from] = points;
  if (!from) {
    return { x: 0, y: 0 };
  }
  const reach = Math.min(Math.max(radius * REACH, REACH_MIN), lengthOf(points) / 2);
  let target = points.at(-1) ?? from;
  let walked = 0;
  for (let index = 1; index < points.length; index++) {
    const point = points[index] ?? from;
    walked += distance(points[index - 1] ?? from, point);
    if (walked >= reach) {
      target = point;
      break;
    }
  }
  const length = distance(from, target) || 1;
  return { x: (target.x - from.x) / length, y: (target.y - from.y) / length };
}

const endKey = (end: End) => end.edge * 2 + end.side;

/**
 * At each node, which edge the pen runs on into from which: the straightest
 * pairs first, so a crossing is crossed and a loop goes round.
 */
function pair(graph: Graph): Map<number, End> {
  const partner = new Map<number, End>();
  for (const [, node] of graph.nodes) {
    const headings = node.ends.map((end) => heading(graph, end, node.radius));
    const pairs: Array<{ first: number; second: number; straight: number }> = [];
    headings.forEach((one, first) => {
      headings.forEach((two, second) => {
        if (first < second) {
          pairs.push({ first, second, straight: -(one.x * two.x + one.y * two.y) });
        }
      });
    });
    pairs.sort((p, q) => q.straight - p.straight || p.first - q.first || p.second - q.second);
    const taken = new Set<number>();
    for (const { first, second, straight } of pairs) {
      const one = node.ends[first];
      const two = node.ends[second];
      if (straight < STRAIGHT && node.ends.length > 2) {
        break;
      }
      if (one && two && !taken.has(first) && !taken.has(second)) {
        taken.add(first);
        taken.add(second);
        partner.set(endKey(one), two);
        partner.set(endKey(two), one);
      }
    }
  }
  return partner;
}

/** The nodes a trail passes, from its first to its last. */
function passes(graph: Graph, trail: Trail): Array<number> {
  return trail.flatMap(({ edge, reversed }, index) => {
    const { a = 0, b = 0 } = graph.edges.get(edge) ?? {};
    const [from, to] = reversed ? [b, a] : [a, b];
    return index === 0 ? [from, to] : [to];
  });
}

function pointsOf(graph: Graph, trail: Trail): Array<Point> {
  return trail.flatMap(({ edge, reversed }, index) => {
    const points = along(graph, { edge, side: reversed ? 1 : 0 });
    return index === 0 ? points : points.slice(1);
  });
}

const backwards = (trail: Trail): Trail =>
  [...trail].reverse().map((step) => ({ ...step, reversed: !step.reversed }));

/** Twice the area a closed line goes round, below 0 when it turns anticlockwise. */
function turning(points: ReadonlyArray<Point>): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length] ?? point;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
}

/**
 * The pen strokes, in the order a hand writes them. An open stroke starts at
 * its leftmost end. A closed one, the bowl of an a, goes round anticlockwise
 * and is written where the pen first passes the node it hangs from. Pieces of
 * ink are written from left to right, and the strokes of each by where they
 * start.
 */
function order(graph: Graph, partner: Map<number, End>): Array<Trail> {
  const used = new Set<number>();
  const walk = (start: End): Trail => {
    const trail: Trail = [];
    for (let end: End | undefined = start; end && !used.has(end.edge);) {
      used.add(end.edge);
      trail.push({ edge: end.edge, reversed: end.side === 1 });
      end = partner.get(endKey({ edge: end.edge, side: end.side === 1 ? 0 : 1 }));
    }
    return trail;
  };
  const strokes: Array<Trail> = [];
  for (const [edge] of graph.edges) {
    for (const side of [0, 1] as const) {
      if (!used.has(edge) && !partner.has(endKey({ edge, side }))) {
        const trail = walk({ edge, side });
        const points = pointsOf(graph, trail);
        const first = points[0] ?? { x: 0, y: 0 };
        const last = points.at(-1) ?? first;
        strokes.push(
          last.x < first.x || (last.x === first.x && last.y < first.y) ? backwards(trail) : trail,
        );
      }
    }
  }
  let loops: Array<Trail> = [];
  for (const [edge] of graph.edges) {
    if (!used.has(edge)) {
      const trail = walk({ edge, side: 0 });
      loops.push(turning(pointsOf(graph, trail)) > 0 ? backwards(trail) : trail);
    }
  }
  for (let placed = true; placed && loops.length > 0;) {
    placed = false;
    loops = loops.filter((loop) => {
      const nodes = passes(graph, loop);
      for (const stroke of strokes) {
        const at = passes(graph, stroke).findIndex((node) => nodes.includes(node));
        if (at !== -1) {
          const from = nodes.indexOf(passes(graph, stroke)[at] ?? -1);
          stroke.splice(at, 0, ...loop.slice(from), ...loop.slice(0, from));
          placed = true;
          return false;
        }
      }
      return true;
    });
  }
  strokes.push(...loops);
  const parent = new Map<number, number>();
  const find = (node: number): number => {
    const up = parent.get(node) ?? node;
    return up === node ? node : find(up);
  };
  for (const [, { a, b }] of graph.edges) {
    const one = find(a);
    const two = find(b);
    if (one !== two) {
      parent.set(Math.max(one, two), Math.min(one, two));
    }
  }
  const left = new Map<number, number>();
  for (const [, edge] of graph.edges) {
    const piece = find(edge.a);
    left.set(piece, Math.min(left.get(piece) ?? Infinity, ...edge.points.map(({ x }) => x)));
  }
  const keyed = strokes.map((trail) => {
    const points = pointsOf(graph, trail);
    const piece = find(passes(graph, trail)[0] ?? 0);
    return { length: lengthOf(points), piece, start: points[0] ?? { x: 0, y: 0 }, trail };
  });
  const counts = new Map<number, number>();
  for (const { piece } of keyed) {
    counts.set(piece, (counts.get(piece) ?? 0) + 1);
  }
  return keyed
    .filter(({ length, piece }) => length >= STUB || counts.get(piece) === 1)
    .sort(
      (p, q) =>
        (left.get(p.piece) ?? 0) - (left.get(q.piece) ?? 0) ||
        p.start.x - q.start.x ||
        p.start.y - q.start.y,
    )
    .map(({ trail }) => trail);
}

/** The line averaged over its neighbours, its ends where they are. */
function soften(points: ReadonlyArray<Point>): Array<Point> {
  return points.map((point, index) => {
    const reach = Math.min(SOFTEN, index, points.length - 1 - index);
    const near = points.slice(index - reach, index + reach + 1);
    return {
      x: near.reduce((sum, { x }) => sum + x, 0) / near.length,
      y: near.reduce((sum, { y }) => sum + y, 0) / near.length,
    };
  });
}

function offLine(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = dx * dx + dy * dy;
  const t =
    span === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / span));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

/** The fewest points that keep the line within `tolerance` (Ramer-Douglas-Peucker). */
function simplify(points: ReadonlyArray<Point>, tolerance: number): Array<Point> {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const spans: Array<[number, number]> = [[0, points.length - 1]];
  for (let span = spans.pop(); span; span = spans.pop()) {
    const [first, last] = span;
    const a = points[first] ?? { x: 0, y: 0 };
    const b = points[last] ?? a;
    let far = -1;
    let farthest = tolerance;
    for (let index = first + 1; index < last; index++) {
      const away = offLine(points[index] ?? a, a, b);
      if (away > farthest) {
        far = index;
        farthest = away;
      }
    }
    if (far !== -1) {
      keep[far] = 1;
      spans.push([first, far], [far, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
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

/**
 * A polyline as a smooth path through its points (a Catmull-Rom spline as
 * cubic curves), turning sharp only at its corners, the length of that path,
 * and points along it. Where the line runs smooth through a point, the curve
 * after it mirrors the one before, so it is written with the shorter `s`. A
 * dot is a stroke one unit long.
 */
function smooth(line: ReadonlyArray<Point>): {
  d: string;
  length: number;
  samples: Array<Point>;
} {
  const points = line
    .map(round)
    .filter((point, index, all) => index === 0 || distance(point, all[index - 1] ?? point) > 0);
  const [first] = points;
  if (!first) {
    throw new Error('A stroke has no points');
  }
  if (points.length === 1) {
    return { d: `M${first.x} ${first.y}h1`, length: 1, samples: [first] };
  }
  let d = `M${first.x} ${first.y}`;
  let length = 0;
  let into = first;
  const samples = [first];
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
      samples.push(next);
      last = next;
    }
  }
  return { d, length: Math.round(length), samples };
}

/** The key of the index cell `x` across and `y` down. */
const cellOf = (x: number, y: number) => y * 100_000 + x;

/**
 * How far from each stroke the farthest ink lies that is nearer to it than
 * to any other, in units: half the width its pen needs so that, once every
 * stroke is drawn, no ink is left covered.
 */
function reaches(grid: Grid, strokes: ReadonlyArray<ReadonlyArray<Point>>): Float64Array {
  const cells = new Map<number, Array<{ point: Point; stroke: number }>>();
  strokes.forEach((samples, stroke) => {
    for (const point of samples) {
      const key = cellOf(Math.floor(point.x / CELL), Math.floor(point.y / CELL));
      const cell = cells.get(key) ?? [];
      cell.push({ point, stroke });
      cells.set(key, cell);
    }
  });
  const reach = new Float64Array(strokes.length);
  const { cols, scale, x0, y0 } = grid;
  grid.ink.forEach((inked, index) => {
    if (!inked) {
      return;
    }
    const point = {
      x: x0 + ((index % cols) + 0.5) / scale,
      y: y0 + (Math.floor(index / cols) + 0.5) / scale,
    };
    const cx = Math.floor(point.x / CELL);
    const cy = Math.floor(point.y / CELL);
    let nearest = Infinity;
    let owner = 0;
    // Rings of cells around the pixel's own, until no farther ring can hold
    // a nearer point.
    for (let ring = 0; nearest > (ring - 1) * CELL; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
            continue;
          }
          for (const { point: sample, stroke } of cells.get(cellOf(cx + dx, cy + dy)) ?? []) {
            const away = distance(point, sample);
            if (away < nearest) {
              nearest = away;
              owner = stroke;
            }
          }
        }
      }
    }
    reach[owner] = Math.max(reach[owner] ?? 0, nearest);
  });
  return reach;
}

/** The pen strokes that write one line set at `size` units to the em. */
function pens(commands: ReadonlyArray<Command>, size: number): Array<Pen> {
  const scale = GRID / size;
  const grid = rasterize(polygons(commands, 1 / scale), scale);
  const graph = graphOf(thin(grid), grid);
  prune(graph);
  contract(graph);
  for (const id of graph.nodes.keys()) {
    dissolve(graph, id);
  }
  const strokes = order(graph, pair(graph)).map((trail) =>
    smooth(
      simplify(soften(pointsOf(graph, trail)), SIMPLIFY).map((point) => ({
        x: grid.x0 + point.x / scale,
        y: grid.y0 + point.y / scale,
      })),
    ),
  );
  if (strokes.length === 0) {
    throw new Error('A line of the signature has no ink');
  }
  const reach = reaches(
    grid,
    strokes.map(({ samples }) => samples),
  );
  return strokes.map(({ d, length }, index) => ({
    d,
    length,
    width: Math.ceil(2 * ((reach[index] ?? 0) + MARGIN)),
  }));
}

function signature(font: Font, text: string) {
  const comma = text.indexOf(',');
  const name = set(font, text.slice(0, comma).trim(), EM);
  const place = set(font, text.slice(comma + 1).trim(), EM * PLACE_SCALE);
  const nameBox = box(name);
  const placeBox = box(place);
  const width = Math.ceil(
    Math.max(nameBox.maxX - nameBox.minX, placeBox.maxX - placeBox.minX) + 2 * PAD,
  );
  const placeTop = PAD + nameBox.maxY - nameBox.minY + LINE_GAP;
  const height = Math.ceil(placeTop + placeBox.maxY - placeBox.minY + PAD);
  const line = (paths: ReadonlyArray<GlyphPath>, ink: Box, top: number, size: number) => {
    const commands = outline(
      paths.map((glyph) => glyph.translate(width - PAD - ink.maxX, top - ink.minY)),
    );
    return { d: data(commands), pens: pens(commands, size) };
  };
  return {
    height,
    name: line(name, nameBox, PAD, EM),
    place: line(place, placeBox, placeTop, EM * PLACE_SCALE),
    width,
  };
}

const response = await fetch(FONT_URL);
if (!response.ok) {
  throw new Error(`Fetching Great Vibes failed: ${response.status}`);
}
const face = createFont(Buffer.from(await response.arrayBuffer()));
if (!('layout' in face)) {
  throw new Error('Expected a single font, not a collection');
}
const font = face as Font;

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

const line = (written: { d: string; pens: ReadonlyArray<Pen> }) => `{
      d: '${written.d}',
      pens: [
${written.pens.map((pen) => `        { d: '${pen.d}', length: ${pen.length}, width: ${pen.width} },`).join('\n')}
      ],
    }`;

const entries = [...texts].sort().map((text) => {
  const written = signature(font, text);
  return `  ${JSON.stringify(text)}: {
    height: ${written.height},
    name: ${line(written.name)},
    place: ${line(written.place)},
    width: ${written.width},
  },`;
});

writeFileSync(
  out,
  `// Generated by scripts/render-signature.ts. Do not edit by hand: run
// \`node scripts/render-signature.ts\` instead.
//
// The hand is Great Vibes by Robert Leuschke, TypeSETit (copyright 2010 The
// Great Vibes Pro Project Authors), under the SIL Open Font License 1.1
// (https://openfontlicense.org), which leaves documents made with a font
// free of it: these outlines, and the strokes found in them, are the
// signature's words, not the font.

/**
 * One stroke of the pen along the middle of the ink, how long it is, and how
 * wide the pen has to be to uncover the ink it writes, all in units.
 */
export type Pen = { d: string; length: number; width: number };

/** One line of the signature, filled, and the strokes that write it, in order. */
export type Line = { d: string; pens: ReadonlyArray<Pen> };

/**
 * The signature, keyed by the message it writes: the name, then the place
 * and date under it, in a box \`width\` by \`height\` units.
 */
export const SIGNATURES: Readonly<
  Record<string, { height: number; name: Line; place: Line; width: number }>
> = {
${entries.join('\n')}
};
`,
);
execFileSync(path.join(root, 'node_modules/.bin/oxfmt'), [out]);
process.stdout.write(`render-signature: ${path.relative(root, out)}\n`);
