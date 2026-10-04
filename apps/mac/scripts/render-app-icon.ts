/**
 * Draws the Mac app icon and packs it into Sources/AppIcon.icns.
 *
 *   node apps/mac/scripts/render-app-icon.ts
 *
 * The letters are the brand mark's own outlines (packages/ui/src/brand.ts,
 * traced from Suisse Intl Medium by scripts/render-brand.ts), so the icon
 * needs no font file and can never drift from the mark on the site. The body
 * follows Apple's macOS icon grid: an 824px rounded square in a 1024px canvas,
 * a continuous corner of 185.4px and a light shadow under it.
 *
 * It writes scripts/app-icon.svg (the drawing, tracked so it can be read
 * without running anything) and Sources/AppIcon.icns. Each size is drawn from
 * the vectors at its own pixel size by a headless Chromium with a transparent
 * page, then joined by iconutil.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

import { MARK_PATHS, MARK_VIEWBOX } from '../../../packages/ui/src/brand.ts';

const mac = path.resolve(import.meta.dirname, '..');

const CANVAS = 1024;
const BODY = 824;
const MARGIN = (CANVAS - BODY) / 2;
const RADIUS = 185.4;
/** How much of the body's width the two letters take, edge of ink to edge of ink. */
const INK_RATIO = 0.66;
/** The letters sit a touch below the middle, where the eye reads them as centred. */
const INK_DROP = 6;
/** The body is the site's black, lifted a little at the top so it is not flat. */
const BODY_TOP = '#161616';
const BODY_BOTTOM = '#000000';
/** At these pixel sizes the rim and the sheen are noise, so they are left out. */
const PLAIN_UP_TO = 32;

/** The sizes macOS asks for, each at 1x and 2x. */
const SIZES = [16, 32, 128, 256, 512];

const round = (value: number) => String(Math.round(value * 100) / 100);

/**
 * A rounded square with a continuous corner: the curve eases in from 1.53
 * radii away instead of starting where a circle would. The constants are the
 * well known fit of the shape iOS and macOS cut their icons with.
 */
function body(): string {
  const a = 1.52866498 * RADIUS;
  const b = 1.08849296 * RADIUS;
  const c = 0.86840694 * RADIUS;
  const d = 0.63149379 * RADIUS;
  const e = 0.07491139 * RADIUS;
  const f = 0.37282383 * RADIUS;
  const g = 0.16905956 * RADIUS;
  const lo = MARGIN;
  const hi = MARGIN + BODY;
  // One corner, drawn from the edge it leaves to the edge it meets. `along`
  // runs with the first edge and `across` with the second; each corner hands
  // in how those two map onto x and y.
  const corner = (point: (along: number, across: number) => [number, number]) =>
    [
      [point(b, 0), point(c, 0), point(d, e)],
      [point(f, g), point(g, f), point(e, d)],
      [point(0, c), point(0, b), point(0, a)],
    ]
      .map((curve) => `C${curve.map(([x, y]) => `${round(x)} ${round(y)}`).join(' ')}`)
      .join('');
  return [
    `M${round(lo + a)} ${lo}`,
    `L${round(hi - a)} ${lo}`,
    corner((along, across) => [hi - along, lo + across]),
    `L${hi} ${round(hi - a)}`,
    corner((along, across) => [hi - across, hi - along]),
    `L${round(lo + a)} ${hi}`,
    corner((along, across) => [lo + along, hi - across]),
    `L${lo} ${round(lo + a)}`,
    corner((along, across) => [lo + across, lo + along]),
    'Z',
  ].join('');
}

/** The ink of the mark in its own square, measured by the browser that draws it. */
type Ink = { height: number; width: number; x: number; y: number };

function icon(ink: Ink, plain: boolean): string {
  const shape = body();
  const scale = (BODY * INK_RATIO) / ink.width;
  const x = CANVAS / 2 - (ink.x + ink.width / 2) * scale;
  const y = CANVAS / 2 + INK_DROP - (ink.y + ink.height / 2) * scale;
  const finish = plain
    ? []
    : [
        // A faint light from above, and a thin bright line where the top edge
        // would catch it. Both are cut to the body.
        `<g clip-path="url(#cut)">`,
        `<rect x="${MARGIN}" y="${MARGIN}" width="${BODY}" height="${BODY}" fill="url(#sheen)"/>`,
        `<path d="${shape}" fill="none" stroke="url(#rim)" stroke-width="8" filter="url(#soft)"/>`,
        '</g>',
      ];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">`,
    '<defs>',
    `<linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BODY_TOP}"/><stop offset="1" stop-color="${BODY_BOTTOM}"/></linearGradient>`,
    `<linearGradient id="rim" gradientUnits="userSpaceOnUse" x1="0" y1="${MARGIN}" x2="0" y2="${MARGIN + BODY}"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.12" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.06"/><stop offset="1" stop-color="#fff" stop-opacity="0.03"/></linearGradient>`,
    `<radialGradient id="sheen" gradientUnits="userSpaceOnUse" cx="${CANVAS / 2}" cy="${MARGIN}" r="${BODY * 0.75}"><stop offset="0" stop-color="#fff" stop-opacity="0.07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
    `<clipPath id="cut"><path d="${shape}"/></clipPath>`,
    // Filters work in sRGB: in the default linear space a near black fill is
    // crushed into bands.
    '<filter id="soft" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1"/></filter>',
    '<filter id="shadow" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="10"/></filter>',
    '</defs>',
    // The shadow is its own shape under the body, so the body itself is never
    // put through a filter.
    `<path d="${shape}" fill="#000" fill-opacity="0.3" transform="translate(0 10)" filter="url(#shadow)"/>`,
    `<path d="${shape}" fill="url(#fill)"/>`,
    ...finish,
    `<g fill="#fff" transform="translate(${round(x)} ${round(y)}) scale(${Math.round(scale * 10000) / 10000})">`,
    ...MARK_PATHS.map((d) => `<path d="${d}"/>`),
    '</g>',
    '</svg>',
  ].join('');
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

await page.setContent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}"><g id="mark">${MARK_PATHS.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`,
);
const ink = await page.evaluate((): Ink => {
  const box = (document.querySelector('#mark') as SVGGElement).getBBox();
  return { height: box.height, width: box.width, x: box.x, y: box.y };
});

const full = icon(ink, false);
const plain = icon(ink, true);
writeFileSync(path.join(mac, 'scripts/app-icon.svg'), `${full}\n`);
process.stdout.write(`render-app-icon: scripts/app-icon.svg (${full.length} bytes)\n`);

const work = mkdtempSync(path.join(tmpdir(), 'app-icon-'));
const iconset = path.join(work, 'AppIcon.iconset');
mkdirSync(iconset);

const draw = async (pixels: number, file: string) => {
  await page.setViewportSize({ height: pixels, width: pixels });
  await page.setContent(
    `<style>* { margin: 0; } body { background: transparent; } svg { display: block; height: ${pixels}px; width: ${pixels}px; }</style>${pixels <= PLAIN_UP_TO ? plain : full}`,
  );
  await page.screenshot({ omitBackground: true, path: file });
};

for (const size of SIZES) {
  await draw(size, path.join(iconset, `icon_${size}x${size}.png`));
  await draw(size * 2, path.join(iconset, `icon_${size}x${size}@2x.png`));
}

// A copy of every size for a look by eye, when asked for: APP_ICON_PREVIEW=<dir>.
const preview = process.env['APP_ICON_PREVIEW'];
if (preview) {
  mkdirSync(preview, { recursive: true });
  execFileSync('cp', ['-R', iconset, preview]);
}

await browser.close();

const icns = path.join(mac, 'Sources/AppIcon.icns');
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icns]);
rmSync(work, { recursive: true });
process.stdout.write(`render-app-icon: Sources/AppIcon.icns (${SIZES.length * 2} pictures)\n`);
