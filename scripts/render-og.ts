import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
/**
 * Renders the share cards, one a page, from the real Suisse Intl.
 *
 * Every card is one template: the site's graph paper on its black ground, the
 * mark and the address in the top corners, a small orange label over a large
 * title whose accent words are orange, and one of the site's own line
 * drawings on the right. The titles come from the messages and the posts'
 * frontmatter, so a card never drifts from its page.
 *
 * The PNGs are committed. The font is licensed and not in CI, so the cards
 * cannot be rendered at build time: run this after a title or a post changes.
 *
 *   pnpm og
 */
import { chromium } from 'playwright';
import { OG_PAGES, OG_SIZE, ogImagePath } from '../apps/web/src/lib/og.ts';
import { splitPost } from '../apps/web/vite.blog.ts';
import { MARK_PATHS, MARK_RADIUS, MARK_VIEWBOX } from '../packages/ui/src/brand.ts';

const root = path.resolve(import.meta.dirname, '..');
const web = path.join(root, 'apps/web');
const out = path.join(web, 'public');
const blogDir = path.join(web, 'content/blog');
const fonts = path.join(root, 'packages/ui/fonts');

const messages: unknown = JSON.parse(readFileSync(path.join(web, 'messages/en.json'), 'utf8'));

/** A message by its key, or the run stops: a card never shows a missing word. */
function message(key: string): string {
  if (typeof messages !== 'object' || messages === null) {
    throw new Error('render-og: messages/en.json is not an object');
  }
  const value: unknown = Object.entries(messages).find(([name]) => name === key)?.[1];
  if (typeof value !== 'string') {
    throw new Error(`render-og: no message "${key}"`);
  }
  return value;
}

/** The one orange, read from its token so the cards follow it. */
function accentBase(): string {
  const token = readFileSync(path.join(root, 'packages/ui/src/accent.stylex.ts'), 'utf8');
  const base = /base: '(#[0-9a-f]{6})'/u.exec(token)?.[1];
  if (base === undefined) {
    throw new Error('render-og: no accent base in accent.stylex.ts');
  }
  return base;
}
const ORANGE = accentBase();
/** The dark theme's ground, ink and lines (`packages/ui/src/theme.css`). */
const BG = '#000000';
const FG = '#ffffff';
const MUTED = '#8a8a8a';
const BORDER = '#3f3f3f';
/** The hero's graph paper: the 40px square and the faint white rule. */
const RULE = 'rgba(255, 255, 255, 0.08)';
const SQUARE = 40;
const WORDMARK = 'attention awareness';

/** How thick the drawings' lines are on the card, in pixels: thin, and still there in a thumbnail. */
const STROKE = 2.5;
const FAINT = 2;

// ---------------------------------------------------------------- the drawings

/** Every line of a drawing keeps its width however large the drawing is set. */
const HAIR = 'vector-effect="non-scaling-stroke"';
const line = (color = MUTED, width = STROKE) =>
  `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${HAIR}`;
const faint = `${line(MUTED, FAINT)} opacity="0.5"`;

function svg(viewBox: string, body: string): string {
  return `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

/** A feed's own icon from `public/media/apps`, inline, so the page loads nothing. */
function feedIcon(bundleId: string): string {
  const file = path.join(out, 'media/apps', `${bundleId}.webp`);
  return `data:image/webp;base64,${readFileSync(file).toString('base64')}`;
}

let clips = 0;
/** A picture cut to a rounded square, edged with the page's border so it holds its shape. */
function roundImage(href: string, x: number, y: number, size: number, radius: number): string {
  clips += 1;
  const id = `clip${clips}`;
  return (
    `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}"/></clipPath>` +
    `<image href="${href}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#${id})"/>` +
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" ${line(BORDER, FAINT)}/>`
  );
}

/** The outlined "aa" mark on its tile, in a square of `size` at `x`, `y`. */
function mark(x: number, y: number, size: number): string {
  const scale = size / MARK_VIEWBOX;
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}" rx="${MARK_RADIUS}" fill="${FG}"/>` +
    MARK_PATHS.map((d) => `<path d="${d}" fill="${BG}"/>`).join('') +
    '</g>'
  );
}

/** A bar standing for a line of words. */
function bar(x: number, y: number, width: number, height: number, fill = BORDER): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${fill}"/>`;
}

/** The tick in a ticked box, around the box's middle, for a box of `size`. */
function tickBox(x: number, y: number, size: number, ticked: boolean): string {
  const box = `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="${size * 0.24}"`;
  if (!ticked) {
    return `${box} ${line(MUTED, FAINT)}/>`;
  }
  const s = size / 5;
  return (
    `${box} fill="${ORANGE}" fill-opacity="0.12" ${line(ORANGE, FAINT)}/>` +
    `<path d="M${x - 1.3 * s} ${y + 0.1 * s} L${x - 0.3 * s} ${y + 1.1 * s} L${x + 1.4 * s} ${y - s}" ${line(ORANGE, STROKE)}/>`
  );
}

/*
 * The iPhone, in the units `components/steps/phone.tsx` draws it in: an 80
 * by 160 body on a 240 wide box, a 4 by 5 grid of 12 unit apps and the dock.
 */
const PHONE = { height: 160, radius: 14, width: 80, x: 80, y: 10 };
const BEZEL = 3;
const ICON = 12;
const PITCH = { x: 17, y: 19 };
const GRID_LEFT = PHONE.x + (PHONE.width - 3 * PITCH.x - ICON) / 2;
const GRID_TOP = 31;
const DOCK = { height: 18, inset: 3, radius: 6, y: 143 };

/** The middle of the home screen's app `slot`, a row at a time from the top. */
function slot(index: number): { x: number; y: number } {
  return {
    x: GRID_LEFT + (index % 4) * PITCH.x + ICON / 2,
    y: GRID_TOP + Math.floor(index / 4) * PITCH.y + ICON / 2,
  };
}

/** Lucide's lines for the apps that stay, as `steps/phone.tsx` draws them (ISC, Lucide Contributors). */
const GLYPHS = {
  bank: 'M-0.72 2.16 V-0.36 M-0.32 -3.53 A0.72 0.72 0 0 1 0.32 -3.53 L3.14 -2.14 A0.18 0.18 0 0 1 3.06 -1.8 H-3.06 A0.18 0.18 0 0 1 -3.14 -2.14 Z M0.72 2.16 V-0.36 M2.16 2.16 V-0.36 M-3.24 3.6 H3.24 M-2.16 2.16 V-0.36',
  camera:
    'M0.72 -2.88 A0.72 0.72 0 0 1 1.35 -2.5 L1.53 -2.18 A0.72 0.72 0 0 0 2.16 -1.8 H2.88 A0.72 0.72 0 0 1 3.6 -1.08 V2.16 A0.72 0.72 0 0 1 2.88 2.88 H-2.88 A0.72 0.72 0 0 1 -3.6 2.16 V-1.08 A0.72 0.72 0 0 1 -2.88 -1.8 H-2.16 A0.72 0.72 0 0 0 -1.53 -2.18 L-1.35 -2.5 A0.72 0.72 0 0 1 -0.72 -2.88 Z M1.08 0.36 A1.08 1.08 0 1 1 -1.08 0.36 A1.08 1.08 0 1 1 1.08 0.36 Z',
  maps: 'M0.76 -2.32 A0.72 0.72 0 0 0 1.4 -2.32 L2.72 -2.98 A0.36 0.36 0 0 1 3.24 -2.66 V1.94 A0.36 0.36 0 0 1 3.04 2.26 L1.4 3.08 A0.72 0.72 0 0 1 0.76 3.08 L-0.76 2.32 A0.72 0.72 0 0 0 -1.4 2.32 L-2.72 2.98 A0.36 0.36 0 0 1 -3.24 2.66 V-1.94 A0.36 0.36 0 0 1 -3.04 -2.26 L-1.4 -3.08 A0.72 0.72 0 0 1 -0.76 -3.08 Z M1.08 -2.24 V3.16 M-1.08 -3.16 V2.24',
  messages:
    'M-3.24 1.56 A0.72 0.72 0 0 1 -3.21 1.98 L-3.59 3.17 A0.36 0.36 0 0 0 -3.15 3.59 L-1.92 3.23 A0.72 0.72 0 0 1 -1.52 3.26 A3.6 3.6 0 1 0 -3.24 1.56',
  music:
    'M-1.08 2.16 V-2.52 L3.24 -3.24 V1.44 M-1.08 2.16 A1.08 1.08 0 1 1 -3.24 2.16 A1.08 1.08 0 1 1 -1.08 2.16 Z M3.24 1.44 A1.08 1.08 0 1 1 1.08 1.44 A1.08 1.08 0 1 1 3.24 1.44 Z',
  notes:
    'M-2.8 -2.8 A0.8 0.8 0 0 1 -2 -3.6 H2 A0.8 0.8 0 0 1 2.8 -2.8 V2.8 A0.8 0.8 0 0 1 2 3.6 H-2 A0.8 0.8 0 0 1 -2.8 2.8 Z M-1.2 -2 H1.2 M-1.2 -0.4 H1.2 M-1.2 1.2 H0.4',
  phone:
    'M0.66 1.64 A0.36 0.36 0 0 0 1.1 1.54 L1.22 1.37 A0.72 0.72 0 0 1 1.8 1.08 H2.88 A0.72 0.72 0 0 1 3.6 1.8 V2.88 A0.72 0.72 0 0 1 2.88 3.6 A6.48 6.48 0 0 1 -3.6 -2.88 A0.72 0.72 0 0 1 -2.88 -3.6 H-1.8 A0.72 0.72 0 0 1 -1.08 -2.88 V-1.8 A0.72 0.72 0 0 1 -1.37 -1.22 L-1.54 -1.1 A0.36 0.36 0 0 0 -1.64 -0.65 A5.04 5.04 0 0 0 0.66 1.64',
} as const;
type Glyph = keyof typeof GLYPHS;

/** The phone's home screen, a row at a time: the four feeds among the seven apps that stay. */
const HOME: ReadonlyArray<{ feed: string } | { glyph: Glyph }> = [
  { feed: 'com.zhiliaoapp.musically' },
  { glyph: 'camera' },
  { feed: 'com.burbn.instagram' },
  { glyph: 'music' },
  { glyph: 'notes' },
  { feed: 'com.google.ios.youtube' },
  { glyph: 'maps' },
  { glyph: 'messages' },
  { feed: 'com.atebits.Tweetie2' },
  { glyph: 'phone' },
  { glyph: 'bank' },
];
const KEPT = HOME.flatMap((app) => ('glyph' in app ? [app.glyph] : []));

/** A kept app at `x`, `y`, `size` units wide: its square and its line. */
function keptApp(glyph: Glyph, x: number, y: number, size = ICON): string {
  const scale = size / ICON;
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect x="${-ICON / 2}" y="${-ICON / 2}" width="${ICON}" height="${ICON}" rx="3" ${line()}/>` +
    `<path d="${GLYPHS[glyph]}" ${line(MUTED, FAINT)}/>` +
    '</g>'
  );
}

/** A feed's tile at `x`, `y`, dimmed and struck through in orange: what the profile takes off. */
function struckFeed(bundleId: string, x: number, y: number): string {
  const reach = ICON / 2 + 0.5;
  return (
    `<g opacity="0.45">${roundImage(feedIcon(bundleId), x - ICON / 2, y - ICON / 2, ICON, 3)}</g>` +
    `<path d="M${x - reach} ${y - reach} L${x + reach} ${y + reach}" ${line(ORANGE, 4)}/>`
  );
}

/** The phone's body, its glass and island, and the dock's tray as far as `dock`. */
function phoneFrame(dock = 1): string {
  const screen = {
    height: PHONE.height - 2 * BEZEL,
    width: PHONE.width - 2 * BEZEL,
    x: PHONE.x + BEZEL,
    y: PHONE.y + BEZEL,
  };
  const dockLeft = GRID_LEFT - DOCK.inset;
  return (
    `<rect x="${PHONE.x}" y="${PHONE.y}" width="${PHONE.width}" height="${PHONE.height}" rx="${PHONE.radius}" fill="${BG}" ${line()}/>` +
    `<rect x="${screen.x}" y="${screen.y}" width="${screen.width}" height="${screen.height}" rx="${PHONE.radius - BEZEL}" ${faint}/>` +
    `<rect x="${PHONE.x + PHONE.width / 2 - 10}" y="${screen.y + 3}" width="20" height="6" rx="3" ${faint}/>` +
    (dock > 0
      ? `<rect x="${dockLeft}" y="${DOCK.y}" width="${PHONE.x * 2 + PHONE.width - 2 * dockLeft}" height="${DOCK.height}" rx="${DOCK.radius}" opacity="${dock}" ${line(BORDER, FAINT)}/>`
      : '')
  );
}

/** The phone's viewBox, with `pad` units of room around the body. */
const phoneBox = (pad = 4) =>
  `${PHONE.x - pad} ${PHONE.y - pad} ${PHONE.width + 2 * pad} ${PHONE.height + 2 * pad}`;

/** The phone's home screen as the profile leaves it: the feeds struck out, the rest in place. */
function phoneStruck(): string {
  const apps = HOME.map((app, index) => {
    const at = slot(index);
    return 'feed' in app ? struckFeed(app.feed, at.x, at.y) : keptApp(app.glyph, at.x, at.y);
  });
  return svg(phoneBox(), phoneFrame() + apps.join(''));
}

/** The home screen once the feeds are gone: the apps that stay, closed up from the top. */
function phoneKept(): string {
  const apps = KEPT.map((glyph, index) => {
    const at = slot(index);
    return keptApp(glyph, at.x, at.y);
  });
  return svg(phoneBox(), phoneFrame() + apps.join(''));
}

/** The phone's Screen Time as the hero leaves it: the lower average, what it was, and the week's bars. */
function phoneScreenTime(): string {
  const panel = { height: 86, inset: 6, radius: 6, width: 64, x: PHONE.x + 8, y: 42 };
  const textX = panel.x + panel.inset;
  const bars = { base: panel.y + panel.height - 8, max: 34, width: 5 };
  const pitch = (panel.width - 2 * panel.inset - bars.width) / 6;
  const days = [
    [0.78, 0.26],
    [0.92, 0.31],
    [0.7, 0.22],
    [1, 0.34],
    [0.85, 0.28],
    [0.95, 0.36],
    [0.74, 0.25],
  ] as const;
  const week = days.map(([before, after], day) => {
    const x = textX + day * pitch;
    const was = bars.max * before;
    const now = bars.max * after;
    return (
      `<rect x="${x}" y="${bars.base - was}" width="${bars.width}" height="${was}" rx="1.5" fill="${ORANGE}" opacity="0.22"/>` +
      `<rect x="${x}" y="${bars.base - now}" width="${bars.width}" height="${now}" rx="1.5" fill="${MUTED}"/>`
    );
  });
  const text = (size: number, y: number, fill: string, words: string, weight = 400) =>
    `<text x="${textX}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(words)}</text>`;
  return svg(
    phoneBox(),
    phoneFrame(0) +
      `<text x="${panel.x + 1}" y="${panel.y - 6}" font-size="5.5" fill="${FG}" font-weight="500">${escape(message('hero_phone_panel'))}</text>` +
      `<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" rx="${panel.radius}" ${line(BORDER, FAINT)}/>` +
      text(4.2, panel.y + 11, MUTED, message('hero_phone_average')) +
      `<text x="${textX}" y="${panel.y + 25}" font-size="12" fill="${FG}" font-weight="500" letter-spacing="-0.24">${escape(message('hero_phone_after'))}</text>` +
      text(
        4.2,
        panel.y + 32.5,
        ORANGE,
        message('hero_phone_was').replace('{time}', message('hero_phone_before')),
      ) +
      week.join(''),
  );
}

/*
 * The Mac, in the units `components/steps/laptop.tsx` draws it in, and the
 * first step's drawing (`steps/plug.tsx`): the laptop, the cable with its
 * orange pulse, and the iPhone, lit, on a 240 by 180 box.
 */
const LID = { height: 74, radius: 5, width: 112, x: 26, y: 34 };
const DISPLAY = { height: 66, width: 104, x: 30, y: 38 };
const BASE =
  'M14 108 H150 V110.5 Q150 113 147.5 113 H16.5 Q14 113 14 110.5 Z M74 108 Q74 110 76 110 H88 Q90 110 90 108';

function laptop(screen: string): string {
  return (
    `<rect x="${LID.x}" y="${LID.y}" width="${LID.width}" height="${LID.height}" rx="${LID.radius}" fill="${BG}" ${line()}/>` +
    `<rect x="${DISPLAY.x}" y="${DISPLAY.y}" width="${DISPLAY.width}" height="${DISPLAY.height}" rx="1" ${faint}/>` +
    `<g transform="translate(${DISPLAY.x} ${DISPLAY.y})">${screen}</g>` +
    `<path d="${BASE}" fill="${BG}" ${line()}/>` +
    `<rect x="150" y="109" width="6" height="3" rx="1" ${line()}/>`
  );
}

/**
 * Apple Configurator's icon, which the manual way runs on the Mac. Taken from
 * the app itself (`/Applications/Apple Configurator.app`, `Configurator.icns`,
 * converted with `sips -Z 256`); it carries the macOS rounded square and its
 * margin.
 */
const CONFIGURATOR_ICON = `data:image/png;base64,${readFileSync(path.join(import.meta.dirname, 'og/apple-configurator.png')).toString('base64')}`;

/** Apple Configurator on the Mac's screen: its icon in the middle of the display. */
function macConfigurator(): string {
  const size = 50;
  return `<image href="${CONFIGURATOR_ICON}" x="${(DISPLAY.width - size) / 2}" y="${(DISPLAY.height - size) / 2}" width="${size}" height="${size}"/>`;
}

function plugDrawing(): string {
  const phone = { height: 80, radius: 8, width: 40, x: 186, y: 42 };
  const inset = 2.5;
  const port = phone.x + phone.width / 2;
  const cable = 'M156 110.5 C174 110.5 170 152 188 152 C202 152 206 144 206 129';
  const glass = `x="${phone.x + inset}" y="${phone.y + inset}" width="${phone.width - 2 * inset}" height="${phone.height - 2 * inset}" rx="${phone.radius - inset}"`;
  return svg(
    '8 26 228 136',
    laptop(macConfigurator()) +
      `<rect x="${phone.x}" y="${phone.y}" width="${phone.width}" height="${phone.height}" rx="${phone.radius}" ${line()}/>` +
      `<rect ${glass} fill="${ORANGE}" fill-opacity="0.12"/>` +
      `<rect ${glass} ${line(ORANGE, FAINT)}/>` +
      `<rect x="${port - 5}" y="${phone.y + inset + 3.5}" width="10" height="3" rx="1.5" ${faint}/>` +
      `<rect x="${port - 2.5}" y="${phone.y + phone.height + 1}" width="5" height="6" rx="1" ${line()}/>` +
      `<path d="${cable}" ${line(MUTED, 3)}/>` +
      // The pulse on its way to the phone: a fainter trail, then the bright head.
      `<path d="${cable}" pathLength="1" stroke-dasharray="0.22 2" stroke-dashoffset="-0.5" ${line(ORANGE, 4)} stroke-opacity="0.5"/>` +
      `<path d="${cable}" pathLength="1" stroke-dasharray="0.02 2" stroke-dashoffset="-0.7" ${line(ORANGE, 8)}/>`,
  );
}

/*
 * The profile builder: the list of apps a profile blocks, the feeds ticked in
 * orange and the apps that stay left as they are, over the one button.
 */
function profileList(): string {
  const rows: ReadonlyArray<{ feed: string; name: number } | { glyph: Glyph; name: number }> = [
    { feed: 'com.zhiliaoapp.musically', name: 120 },
    { feed: 'com.burbn.instagram', name: 150 },
    { glyph: 'messages', name: 110 },
    { feed: 'com.google.ios.youtube', name: 130 },
    { feed: 'com.atebits.Tweetie2', name: 70 },
    { glyph: 'maps', name: 90 },
  ];
  const card = { height: 420, width: 380, x: 10, y: 10 };
  const left = card.x + 28;
  const pitch = 54;
  const top = card.y + 118;
  const list = rows.map((row, index) => {
    const y = top + index * pitch;
    const ticked = 'feed' in row;
    const icon = ticked
      ? roundImage(feedIcon(row.feed), left, y - 18, 36, 9)
      : keptApp(row.glyph, left + 18, y, 36);
    return (
      icon +
      bar(left + 54, y - 4, row.name, 8, ticked ? MUTED : BORDER) +
      tickBox(card.x + card.width - 44, y, 26, ticked)
    );
  });
  return svg(
    '0 0 400 440',
    `<rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="16" fill="${BG}" ${line(BORDER, FAINT)}/>` +
      mark(left, card.y + 30, 28) +
      bar(left + 42, card.y + 40, 120, 8, MUTED) +
      `<path d="M${card.x} ${card.y + 80} H${card.x + card.width}" ${line(BORDER, FAINT)}/>` +
      list.join(''),
  );
}

/*
 * The open numbers: three totals over a chart of two lines, drawn as shapes
 * only, so no number on a card can go stale.
 */
function numbersChart(): string {
  const tiles = [0, 1, 2].map((index) => {
    const x = 10 + index * 132;
    return (
      `<rect x="${x}" y="10" width="116" height="110" rx="12" ${line(BORDER, FAINT)}/>` +
      bar(x + 18, 32, 54, 7, BORDER) +
      // The total, a block as wide as its digits, with no digits to go stale.
      `<rect x="${x + 18}" y="58" width="${[74, 52, 66][index] ?? 60}" height="34" rx="5" fill="${index === 0 ? ORANGE : FG}"/>`
    );
  });
  const chart = { bottom: 420, left: 10, right: 390, top: 150 };
  const grid = [0, 1, 2, 3].map((index) => {
    const y = chart.top + 20 + index * 80;
    return `<path d="M${chart.left} ${y} H${chart.right}" ${line(BORDER, FAINT)} stroke-dasharray="2 8"/>`;
  });
  /** A line through `points`, as shares of the chart's height from its foot. */
  const trace = (points: ReadonlyArray<number>) => {
    const step = (chart.right - chart.left - 40) / (points.length - 1);
    return points
      .map((share, index) => {
        const x = chart.left + 20 + index * step;
        const y = chart.bottom - 20 - share * (chart.bottom - chart.top - 60);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };
  const views = [0.42, 0.55, 0.48, 0.7, 0.62, 0.84, 0.76, 0.95];
  const visitors = [0.18, 0.26, 0.22, 0.36, 0.3, 0.46, 0.4, 0.54];
  return svg(
    '0 0 400 430',
    tiles.join('') +
      `<rect x="${chart.left}" y="${chart.top}" width="${chart.right - chart.left}" height="${chart.bottom - chart.top}" rx="12" ${line(BORDER, FAINT)}/>` +
      grid.join('') +
      `<path d="${trace(views)}" ${line(MUTED, 3)}/>` +
      `<path d="${trace(visitors)}" ${line(ORANGE, 3.5)}/>`,
  );
}

/* The blog: a short stack of posts, the one in front with its orange label. */
function postStack(): string {
  const card = (x: number, y: number, opacity: number, front: boolean) =>
    `<g opacity="${opacity}">` +
    `<rect x="${x}" y="${y}" width="300" height="250" rx="14" fill="${BG}" ${line(front ? MUTED : BORDER, FAINT)}/>` +
    (front
      ? `<rect x="${x + 28}" y="${y + 32}" width="12" height="12" rx="2" fill="${ORANGE}"/>` +
        bar(x + 50, y + 34, 70, 8, MUTED) +
        bar(x + 28, y + 76, 230, 14, FG) +
        bar(x + 28, y + 102, 180, 14, FG) +
        bar(x + 28, y + 146, 240, 7, BORDER) +
        bar(x + 28, y + 164, 220, 7, BORDER) +
        bar(x + 28, y + 182, 160, 7, BORDER) +
        bar(x + 28, y + 214, 60, 7, MUTED)
      : '') +
    '</g>';
  return svg(
    '0 0 400 400',
    card(90, 20, 0.5, false) + card(50, 80, 0.75, false) + card(10, 140, 1, true),
  );
}

/** A part of the site's page: a line of words, a round picture or a box, and whether it is a feed. */
type Part =
  | { feed?: boolean; h?: number; kind: 'bar'; w: number; x: number; y: number }
  | { feed?: boolean; kind: 'dot'; r: number; x: number; y: number }
  | { feed?: boolean; h: number; kind: 'box'; r: number; w: number; x: number; y: number };
/** One entry of the site's menu: its icon and its name. */
function entry(y: number, feed = false): Array<Part> {
  return [
    { feed, kind: 'dot', r: 3, x: 17, y },
    { feed, kind: 'bar', w: 26, x: 25, y: y - 1.5 },
  ];
}
/** A row of three videos, each with a line of title under it. */
function videos(y: number): Array<Part> {
  return [0, 1, 2].flatMap((place): Array<Part> => {
    const x = 68 + place * 82;
    return [
      { h: 40, kind: 'box', r: 4, w: 74, x, y },
      { kind: 'bar', w: 48, x, y: y + 45 },
    ];
  });
}

/*
 * The browser window from the home page's extension section
 * (`components/extension-browser.tsx`), on the video site, its feeds in orange:
 * what the extension hides.
 */
function browserWindow(): string {
  const width = 320;
  const height = 208;
  const top = 26;
  const parts: Array<Part> = [
    { h: 12, kind: 'box', r: 6, w: 120, x: 120, y: 34 },
    ...entry(42),
    ...entry(56, true),
    ...entry(70),
    ...entry(84),
    ...entry(98),
    ...videos(56),
    { feed: true, kind: 'bar', w: 30, x: 68, y: 112 },
    ...[0, 1, 2, 3, 4].map((place): Part => ({
      feed: true,
      h: 46,
      kind: 'box',
      r: 4,
      w: 27,
      x: 68 + place * 33,
      y: 120,
    })),
    ...videos(178),
  ];
  const drawn = parts.map((part) => {
    const box = part.feed
      ? `fill="${ORANGE}" fill-opacity="0.1" ${line(ORANGE, FAINT)}`
      : line(MUTED, FAINT);
    if (part.kind === 'dot') {
      return `<circle cx="${part.x}" cy="${part.y}" r="${part.r}" ${box}/>`;
    }
    if (part.kind === 'box') {
      return `<rect x="${part.x}" y="${part.y}" width="${part.w}" height="${part.h}" rx="${part.r}" ${box}/>`;
    }
    return bar(part.x, part.y, part.w, part.h ?? 3, part.feed ? ORANGE : BORDER);
  });
  clips += 1;
  const page = `clip${clips}`;
  return svg(
    '-4 -4 328 216',
    `<clipPath id="${page}"><rect x="1" y="${top}" width="${width - 2}" height="${height - top - 1}"/></clipPath>` +
      `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${BG}" ${line()}/>` +
      `<path d="M0.5 ${top} H${width - 0.5}" ${line()}/>` +
      [14, 24, 34].map((x) => `<circle cx="${x}" cy="${top / 2}" r="3" ${line()}/>`).join('') +
      `<rect x="92" y="6" width="136" height="14" rx="7" ${line()}/>` +
      roundImage(feedIcon('com.google.ios.youtube'), 96, 8, 10, 2.5) +
      bar(110, 11.5, 56, 3) +
      `<g clip-path="url(#${page})">${drawn.join('')}</g>`,
  );
}

/*
 * The other uses' glyphs from the home page (`components/other-use-icons.tsx`,
 * drawn on Lucide's 24 unit grid), at their finished state, large, on the
 * same soft orange plate.
 */
const USE_GLYPHS = {
  apps:
    `<rect x="3.5" y="3.5" width="7" height="7" rx="1.75" LINE/>` +
    `<rect x="3.5" y="13.5" width="7" height="7" rx="1.75" LINE/>` +
    `<rect x="13.5" y="13.5" width="7" height="7" rx="1.75" LINE/>` +
    `<rect x="13.5" y="3.5" width="7" height="7" rx="1.75" SLOT/>`,
  eye:
    `<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" LINE/>` +
    `<circle cx="12" cy="12" r="2.75" LINE/>` +
    `<path d="M4 4l16 16" LINE/>`,
  lock:
    `<rect x="4.5" y="11" width="15" height="10" rx="2" LINE/>` +
    `<path d="M8 11V7.5a4 4 0 0 1 8 0V11" LINE/>` +
    `<path d="M12 14.75v2.5" LINE/>`,
  work:
    `<rect x="3" y="7" width="18" height="13" rx="2" LINE/>` +
    `<path d="M9 7V5.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2V7" LINE/>` +
    `<path d="M3 13h18" LINE/>` +
    `<rect x="10" y="11.25" width="4" height="3.5" rx="0.75" fill="${ORANGE}"/>`,
} as const;

function otherUseGlyph(name: keyof typeof USE_GLYPHS): string {
  const glyph = USE_GLYPHS[name]
    .replaceAll('LINE', line(ORANGE, 7))
    .replaceAll('SLOT', `${line(ORANGE, 4)} stroke-dasharray="6 7"`);
  return svg(
    '0 0 36 36',
    `<rect width="36" height="36" rx="4" fill="${ORANGE}" fill-opacity="0.12"/>` +
      `<g transform="translate(6 6)">${glyph}</g>`,
  );
}

// ---------------------------------------------------------------- the cards

type Card = {
  art: string;
  /** How wide the drawing stands, in pixels, inside its half of the card. */
  artWidth: number;
  /** Where it goes, in `public/`. */
  file: string;
  /** The title, its accent words between `**` marks. */
  title: string;
};

function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** `title` with its first `words` marked as the accent, or the run stops: a card never loses its accent. */
function accent(title: string, words: string): string {
  if (!title.includes(words)) {
    throw new Error(`render-og: "${words}" is not in "${title}"`);
  }
  return title.replace(words, `**${words}**`);
}

const file = (pagePath: string) => ogImagePath(pagePath, []).slice(1);

const pages: Array<Card> = [
  {
    art: phoneStruck(),
    artWidth: 250,
    file: file('/'),
    title: message('home_hero_title')
      .replace('{distraction}', `**${message('home_hero_title_distraction')}**`)
      .replace('{permanently}', `**${message('home_hero_title_accent')}**`),
  },
  {
    art: plugDrawing(),
    artWidth: 300,
    file: file('/guide'),
    title: accent(message('guide_head_title'), 'manually'),
  },
  {
    art: profileList(),
    artWidth: 300,
    file: file('/build'),
    title: accent(message('gen_step2_title'), 'profile'),
  },
  {
    art: numbersChart(),
    artWidth: 300,
    file: file('/open'),
    title: accent(message('open_title'), 'Open'),
  },
  {
    art: postStack(),
    artWidth: 300,
    file: file('/blog'),
    title: accent(message('blog_og_title'), 'for good'),
  },
  {
    art: browserWindow(),
    artWidth: 300,
    file: file('/extension/privacy'),
    title: accent(message('ext_privacy_title'), 'privacy'),
  },
];

/** Each post's drawing, by slug. A new post needs one here, or the run stops. */
const POST_ART: Record<string, { art: string; width: number }> = {
  'block-adult-websites-iphone': { art: otherUseGlyph('eye'), width: 300 },
  'block-any-app-iphone': { art: otherUseGlyph('apps'), width: 300 },
  'iphone-parental-controls-kids-cannot-turn-off': { art: otherUseGlyph('lock'), width: 300 },
  'supervise-iphone-ios-27-without-erasing': { art: phoneKept(), width: 250 },
  'turn-iphone-into-dumbphone': { art: phoneKept(), width: 250 },
  'why-screen-time-does-not-work': { art: phoneScreenTime(), width: 250 },
  'work-iphones-without-mdm': { art: otherUseGlyph('work'), width: 300 },
};

const posts: Array<Card> = readdirSync(blogDir)
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => {
    const slug = path.basename(name, '.md');
    const { fields } = splitPost(readFileSync(path.join(blogDir, name), 'utf8'), name);
    const art = POST_ART[slug];
    if (art === undefined) {
      throw new Error(`render-og: no drawing for the post "${slug}" (POST_ART)`);
    }
    const title = fields.get('og_title') || fields.get('heading') || fields.get('title');
    if (!title) {
      throw new Error(`render-og: ${name} has no title`);
    }
    return {
      art: art.art,
      artWidth: art.width,
      file: ogImagePath(`/blog/${slug}`, [slug]).slice(1),
      title,
    };
  });

/** An accent this short stays on one line, so two words like "dumb phone" are never split. */
const KEEP_WORDS = 2;

/** The title's runs as HTML, the accent words in `<em>`. */
function titleHtml(title: string): string {
  return title
    .split('**')
    .map((run, index) => {
      if (index % 2 === 0) {
        return escape(run);
      }
      const keep = run.trim().split(/\s+/u).length <= KEEP_WORDS;
      return `<em${keep ? ' class="keep"' : ''}>${escape(run)}</em>`;
    })
    .join('');
}

const face = (weight: number, name: string) => `@font-face {
  font-family: 'Suisse Intl';
  font-style: normal;
  font-weight: ${weight};
  src: url('data:font/woff2;base64,${readFileSync(path.join(fonts, name)).toString('base64')}') format('woff2');
}`;

/** The safe area every part stands in, so a card cropped square still shows it all. */
const SAFE = { x: 100, y: 64 };
/** The mark's side at the top left, in pixels; the wordmark is set to match it. */
const BRAND = 54;
/** How wide the title's column is, in pixels; the drawing takes the rest. */
const TEXT_WIDTH = 660;
/**
 * The largest title, and the smallest a long one may shrink to, in steps of
 * `TITLE_STEP`: two steps at most, so the set reads as one size.
 */
const TITLE_MAX = 88;
const TITLE_STEP = 6;
const TITLE_MIN = TITLE_MAX - 2 * TITLE_STEP;
const TITLE_LINES = 3;

const style = `${face(400, 'SuisseIntl-Regular.woff2')}${face(500, 'SuisseIntl-Medium.woff2')}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: ${BG};
  color: ${FG};
  font-family: 'Suisse Intl';
  font-weight: 500;
  height: ${OG_SIZE.height}px;
  overflow: hidden;
  position: relative;
  -webkit-font-smoothing: antialiased;
  width: ${OG_SIZE.width}px;
}
.grid {
  background-image: linear-gradient(${RULE} 1px, transparent 1px), linear-gradient(90deg, ${RULE} 1px, transparent 1px);
  background-position: 0 ${(OG_SIZE.height % SQUARE) / 2}px;
  background-size: ${SQUARE}px ${SQUARE}px;
  inset: 0;
  -webkit-mask-image: radial-gradient(ellipse 75% 85% at 50% 50%, black 35%, transparent 100%);
  position: absolute;
}
.glow {
  background: radial-gradient(ellipse 45% 70% at 100% 0%, color-mix(in srgb, ${ORANGE} 16%, transparent), transparent 70%);
  inset: 0;
  position: absolute;
}
.brand { align-items: center; display: flex; font-size: ${BRAND * 0.67}px; gap: ${BRAND * 0.39}px; left: ${SAFE.x}px; letter-spacing: -0.01em; position: absolute; top: ${SAFE.y}px; }
.brand svg { display: block; height: ${BRAND}px; width: ${BRAND}px; }
.text { bottom: ${SAFE.y}px; display: flex; flex-direction: column; justify-content: center; left: ${SAFE.x}px; position: absolute; top: ${SAFE.y + BRAND + 16}px; width: ${TEXT_WIDTH}px; }
.title { font-size: ${TITLE_MAX}px; letter-spacing: -0.03em; line-height: 1.06; text-wrap: balance; }
em { color: ${ORANGE}; font-style: normal; }
.keep { white-space: nowrap; }
.art { align-items: center; bottom: ${SAFE.y}px; display: flex; justify-content: center; left: ${SAFE.x + TEXT_WIDTH + 40}px; position: absolute; right: ${SAFE.x}px; top: ${SAFE.y + BRAND + 16}px; }
.art svg { display: block; height: 100%; overflow: visible; }`;

function cardHtml(card: Card): string {
  return (
    `<style>${style}.art svg { width: ${card.artWidth}px; }</style>` +
    '<div class="grid"></div><div class="glow"></div>' +
    `<div class="brand"><svg viewBox="0 0 ${BRAND} ${BRAND}">${mark(0, 0, BRAND)}</svg>${WORDMARK}</div>` +
    `<div class="text"><div class="title">${titleHtml(card.title)}</div></div>` +
    `<div class="art">${card.art}</div>`
  );
}

for (const pagePath of Object.keys(OG_PAGES)) {
  if (!pages.some((card) => card.file === file(pagePath))) {
    throw new Error(`render-og: no card for the page ${pagePath}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: OG_SIZE });

for (const card of [...pages, ...posts]) {
  await page.setContent(cardHtml(card));
  await page.evaluate(() => document.fonts.ready);
  // As large as the title goes in three lines, and smaller only for a long one.
  const { lines, size } = await page.evaluate(
    ({ lines, max, min, step }) => {
      const title = document.querySelector<HTMLElement>('.title');
      if (title === null) {
        return { lines: Infinity, size: 0 };
      }
      for (let size = max; size >= min; size -= step) {
        title.style.fontSize = `${size}px`;
        const count = Math.round(title.getBoundingClientRect().height / (size * 1.06));
        if (count <= lines && title.scrollWidth <= title.clientWidth) {
          return { lines: count, size };
        }
      }
      return { lines: Infinity, size: 0 };
    },
    { lines: TITLE_LINES, max: TITLE_MAX, min: TITLE_MIN, step: TITLE_STEP },
  );
  if (lines > TITLE_LINES) {
    throw new Error(`render-og: "${card.title}" does not fit in ${TITLE_LINES} lines`);
  }
  const target = path.join(out, card.file);
  mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target });
  const kb = Math.round(statSync(target).size / 1024);
  process.stdout.write(`render-og: ${card.file} (${size}px, ${lines} lines, ${kb} KB)\n`);
}

await browser.close();

// The old address of the one card the whole site had, kept for the links to it.
copyFileSync(path.join(out, file('/')), path.join(out, 'og.png'));
process.stdout.write('render-og: og.png (a copy of the home card)\n');
