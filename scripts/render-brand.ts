import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Renders the brand assets from the real Suisse Intl.
 *
 * The mark is type, not a drawing, so the only faithful way to draw it is to
 * set it in the licensed font. The PNGs are screenshots of a headless Chromium
 * page; the SVG is the same two letters as outlines, traced out of the font
 * with fontkit. The woff2 files are gitignored (`pnpm fonts`) and the font
 * never leaves this process: no asset it writes carries anything but shapes.
 *
 *   node scripts/render-brand.ts
 */
import { openSync as openFont } from 'fontkit';
import type { Font, Path as GlyphPath } from 'fontkit';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'apps/web/public');
/** The extension's own icons, the same mark at the four sizes Chrome asks for. */
const extensionIcons = path.join(root, 'apps/extension/src/icons');
/** The outlines both apps draw the mark from. */
const brandModule = path.join(root, 'packages/ui/src/brand.ts');
const font = path.join(root, 'packages/ui/fonts/SuisseIntl-Medium.woff2');

/** The brand, in prose. Only the mark itself is lowercase. */
const SITE_NAME = 'Attention Awareness';
const TAGLINE = 'Your attention is more valuable than gold.';
const MARK = 'aa';
const BLACK = '#000000';
const WHITE = '#ffffff';
const GRAY = '#8a8a8a';
/**
 * How much of an icon square the two letters take. Wider than the page mark's
 * 0.44: an icon is read at 16px in a tab, where a quiet mark is no mark.
 */
const TEXT_RATIO = 0.56;

/** The SVG mark is drawn at this size, then scaled by whatever renders it. */
const SVG_SIZE = 512;
/** The app radius, at the scale the mark is drawn: 4px on a 32px square. */
const SVG_RADIUS = SVG_SIZE * 0.125;
/** How tight the two letters are set, as on the page and in the PNGs. */
const TRACKING = -0.02;
/** Two decimals is finer than a 512px grid can show. */
const SVG_PRECISION = /-?\d+\.\d+/gu;

/** The corner of the ink the mark is centred by. */
type Box = { maxX: number; maxY: number; minX: number; minY: number };

const icons = [
  { dir: out, file: 'favicon.png', size: 32 },
  { dir: out, file: 'apple-touch-icon.png', size: 180 },
  { dir: out, file: 'icon-512.png', size: 512 },
  { dir: extensionIcons, file: 'icon-16.png', size: 16 },
  { dir: extensionIcons, file: 'icon-32.png', size: 32 },
  { dir: extensionIcons, file: 'icon-48.png', size: 48 },
  { dir: extensionIcons, file: 'icon-128.png', size: 128 },
];

const face = `@font-face {
  font-family: 'Suisse Intl';
  font-style: normal;
  font-weight: 500;
  src: url('data:font/woff2;base64,${readFileSync(font).toString('base64')}') format('woff2');
}`;

const reset = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: ${BLACK}; color: ${WHITE}; font-family: 'Suisse Intl'; font-weight: 500; -webkit-font-smoothing: antialiased; }`;

const iconPage = (size: number) => `<style>${face}${reset}
.mark {
  align-items: center;
  display: flex;
  font-size: ${Math.round(size * TEXT_RATIO)}px;
  height: ${size}px;
  justify-content: center;
  letter-spacing: -0.02em;
  line-height: 1;
  width: ${size}px;
}</style><div class="mark">${MARK}</div>`;

const ogPage = `<style>${face}${reset}
body { align-items: center; display: flex; gap: 72px; height: 630px; padding: 0 100px; width: 1200px; }
.mark { font-size: 200px; letter-spacing: -0.02em; line-height: 1; }
.lines { display: flex; flex-direction: column; gap: 20px; }
.name { font-size: 68px; letter-spacing: -0.03em; line-height: 1.05; }
.tagline { color: ${GRAY}; font-size: 34px; font-weight: 400; letter-spacing: -0.01em; line-height: 1.3; }
</style><div class="mark">${MARK}</div><div class="lines"><div class="name">${SITE_NAME}</div><div class="tagline">${TAGLINE}</div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

mkdirSync(extensionIcons, { recursive: true });

for (const icon of icons) {
  await page.setViewportSize({ height: icon.size, width: icon.size });
  await page.setContent(iconPage(icon.size));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(icon.dir, icon.file) });
  const where = path.relative(root, path.join(icon.dir, icon.file));
  process.stdout.write(`render-brand: ${where} (${icon.size}x${icon.size})\n`);
}

await page.setViewportSize({ height: 630, width: 1200 });
await page.setContent(ogPage);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(out, 'og.png') });
process.stdout.write('render-brand: og.png (1200x630)\n');

await browser.close();

/**
 * The same mark as outlines. Type in an SVG would mean shipping the font, and
 * the font is licensed, so the letters travel as the shapes they draw.
 */
function markPaths(): Array<string> {
  const face = openFont(font);
  if (!('layout' in face)) {
    throw new Error('Expected a single font, not a collection');
  }
  const run = (face as Font).layout(MARK);
  const size = SVG_SIZE * TEXT_RATIO;
  const scale = size / face.unitsPerEm;
  const tracking = size * TRACKING;

  // The pen walks the string once; the paths it leaves are placed, and only
  // then centred, because the ink is what has to sit in the middle, not the
  // advances around it.
  const place = (offsetX: number, offsetY: number) => {
    let pen = 0;
    return run.glyphs.map((glyph, index): GlyphPath => {
      const position = run.positions[index];
      const path = glyph.path.transform(
        scale,
        0,
        0,
        -scale,
        offsetX + pen + (position?.xOffset ?? 0) * scale,
        offsetY - (position?.yOffset ?? 0) * scale,
      );
      pen += (position?.xAdvance ?? 0) * scale + tracking;
      return path;
    });
  };

  const box = place(0, 0).reduce<Box>(
    (bounds, path) => ({
      maxX: Math.max(bounds.maxX, path.bbox.maxX),
      maxY: Math.max(bounds.maxY, path.bbox.maxY),
      minX: Math.min(bounds.minX, path.bbox.minX),
      minY: Math.min(bounds.minY, path.bbox.minY),
    }),
    { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity },
  );

  return place(
    SVG_SIZE / 2 - (box.minX + box.maxX) / 2,
    SVG_SIZE / 2 - (box.minY + box.maxY) / 2,
  ).map((path) =>
    path
      .toSVG()
      .replaceAll(SVG_PRECISION, (value: string) => String(Math.round(Number(value) * 100) / 100)),
  );
}

const paths = markPaths();

// The same outlines the favicon is cut from, so the mark on the page, the mark
// in the browser tab and the mark in the extension can never drift apart. It
// lands in packages/ui because both apps draw from it.
writeFileSync(
  brandModule,
  [
    '// Generated by scripts/render-brand.ts from the licensed Suisse Intl.',
    '// Do not edit by hand: run `node scripts/render-brand.ts` instead.',
    '',
    '/** The square the paths are drawn in, in its own units. */',
    `export const MARK_VIEWBOX = ${SVG_SIZE};`,
    '',
    '/** The corner that square is cut with, in the same units. */',
    `export const MARK_RADIUS = ${SVG_RADIUS};`,
    '',
    '/** One outlined letter each, already placed and centred. */',
    'export const MARK_PATHS: ReadonlyArray<string> = [',
    ...paths.map((d) => `  '${d}',`),
    '];',
    '',
  ].join('\n'),
);
process.stdout.write(`render-brand: ${path.relative(root, brandModule)}\n`);

// Inverted in a dark browser: a black tab bar swallows a black tile, so the
// mark turns into white paper there and keeps its edges.
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">`,
  '<style>.bg{fill:#000}.fg{fill:#fff}',
  '@media (prefers-color-scheme: dark){.bg{fill:#fff}.fg{fill:#000}}</style>',
  `<rect class="bg" width="${SVG_SIZE}" height="${SVG_SIZE}" rx="${SVG_RADIUS}"/>`,
  ...paths.map((d) => `<path class="fg" d="${d}"/>`),
  '</svg>',
].join('');

writeFileSync(path.join(out, 'favicon.svg'), `${svg}\n`);
process.stdout.write(`render-brand: favicon.svg (${svg.length} bytes)\n`);
