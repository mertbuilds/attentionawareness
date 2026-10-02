import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Writes the story's signature as the outlines of its letters, set in Great
 * Vibes.
 *
 * The page loads no web font for two lines of handwriting. The font is read
 * from the google/fonts repository at a pinned commit and never enters the
 * repo; the module this writes carries only the shapes of the signature's own
 * words, as filled paths.
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

type Point = { x: number; y: number };
type Box = { maxX: number; maxY: number; minX: number; minY: number };

const COMMANDS = {
  bezierCurveTo: 'c',
  closePath: 'z',
  lineTo: 'l',
  moveTo: 'm',
  quadraticCurveTo: 'q',
} as const;

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

/**
 * The outlines as one path's data in whole units, each point written as its
 * offset from where the pen stands.
 */
function data(paths: ReadonlyArray<GlyphPath>): string {
  let d = '';
  let at: Point = { x: 0, y: 0 };
  let start = at;
  for (const { args, command } of paths.flatMap((glyph) => glyph.commands)) {
    if (command === 'closePath') {
      d += COMMANDS.closePath;
      at = start;
      continue;
    }
    const points: Array<Point> = [];
    for (let index = 0; index < args.length; index += 2) {
      points.push({ x: Math.round(args[index] ?? 0), y: Math.round(args[index + 1] ?? 0) });
    }
    d += `${COMMANDS[command]}${points
      .flatMap((point) => [point.x - at.x, point.y - at.y])
      .join(' ')
      .replaceAll(' -', '-')}`;
    at = points.at(-1) ?? at;
    if (command === 'moveTo') {
      start = at;
    }
  }
  return d;
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
  const line = (paths: ReadonlyArray<GlyphPath>, ink: Box, top: number) => {
    const dx = width - PAD - ink.maxX;
    return {
      d: data(paths.map((glyph) => glyph.translate(dx, top - ink.minY))),
      left: Math.floor(ink.minX + dx),
      right: Math.ceil(ink.maxX + dx),
    };
  };
  return {
    height,
    name: line(name, nameBox, PAD),
    place: line(place, placeBox, placeTop),
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

const line = (written: { d: string; left: number; right: number }) =>
  `{ d: '${written.d}', left: ${written.left}, right: ${written.right} }`;

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
// free of it: these outlines are the signature's words, not the font.

/** One line of the signature, filled, and where its ink starts and ends. */
export type Line = { d: string; left: number; right: number };

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
