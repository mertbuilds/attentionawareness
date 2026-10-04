/**
 * Opens the built site in Safari on an iOS Simulator and fails when the top
 * of a page has a black box in its corner. Only Safari on iOS draws that box
 * (see `rootLetter` in `apps/web/src/components/bill-paper.tsx`): desktop
 * Chrome, desktop Safari and Playwright's WebKit all draw the page right, so
 * no browser test in CI can see it. This is a manual check, for a Mac with
 * Xcode and an iOS Simulator runtime.
 *
 *   pnpm --filter @attentionawareness/web build
 *   (cd apps/web && pnpm exec vite preview --port 4173) &
 *   node scripts/safari-check.ts http://localhost:4173
 *
 * It boots the first iPhone the Simulator has, in the light appearance, and
 * shuts it down again if it was the one to boot it.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const PAGES = [
  '/',
  '/guide',
  '/open',
  '/blog',
  '/blog/turn-iphone-into-dumbphone',
  '/extension/privacy',
  '/build',
  '/nothing-here',
];
/** How long Safari gets to load and draw a page, in milliseconds. */
const SETTLE = 9000;
/** The corner that must stay the page's ground: this many pixels in, and the top two fifths. */
const CORNER_WIDTH = 6;
const CORNER_HEIGHT = 0.4;
/** A channel at or under this is black. The light ground is 255. */
const BLACK = 24;

const base = process.argv[2];
if (base === undefined) {
  process.stderr.write('usage: node scripts/safari-check.ts <base url of a running preview>\n');
  process.exit(2);
}

const simctl = (...args: Array<string>): string =>
  execFileSync('xcrun', ['simctl', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

type Device = { name: string; state: string; udid: string };

function isDevice(value: unknown): value is Device {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'state' in value &&
    typeof value.state === 'string' &&
    'udid' in value &&
    typeof value.udid === 'string'
  );
}

/** A booted iPhone if there is one, else the first one the Simulator has. */
function pickDevice(): Device {
  const listed: unknown = JSON.parse(simctl('list', 'devices', 'available', '--json'));
  const groups =
    typeof listed === 'object' && listed !== null && 'devices' in listed ? listed.devices : {};
  const phones = Object.values(groups ?? {})
    .flatMap((group: unknown) => (Array.isArray(group) ? group : []))
    .filter(isDevice)
    .filter((device) => device.name.startsWith('iPhone'));
  const device = phones.find((phone) => phone.state === 'Booted') ?? phones[0];
  if (device === undefined) {
    throw new Error('no iPhone in the iOS Simulator: install a runtime in Xcode');
  }
  return device;
}

type Picture = { channels: number; height: number; pixels: Buffer; width: number };

/** The pixels of an 8-bit RGB or RGBA PNG that is not interlaced, which is what the Simulator writes. */
function readPng(file: string): Picture {
  const data = readFileSync(file);
  let width = 0;
  let height = 0;
  let channels = 0;
  const packed: Array<Buffer> = [];
  for (let at = 8; at < data.length;) {
    const length = data.readUInt32BE(at);
    const type = data.toString('latin1', at + 4, at + 8);
    const body = data.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const colour = body[9];
      channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
      if (body[8] !== 8 || channels === 0 || body[12] !== 0) {
        throw new Error(`a PNG this script does not read: ${file}`);
      }
    } else if (type === 'IDAT') {
      packed.push(body);
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(packed));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x] ?? 0;
      const left = x >= channels ? (pixels[y * stride + x - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0;
      const corner = x >= channels && y > 0 ? (pixels[(y - 1) * stride + x - channels] ?? 0) : 0;
      let predicted = 0;
      if (filter === 1) {
        predicted = left;
      } else if (filter === 2) {
        predicted = up;
      } else if (filter === 3) {
        predicted = Math.floor((left + up) / 2);
      } else if (filter === 4) {
        const estimate = left + up - corner;
        const toLeft = Math.abs(estimate - left);
        const toUp = Math.abs(estimate - up);
        const toCorner = Math.abs(estimate - corner);
        predicted = toLeft <= toUp && toLeft <= toCorner ? left : toUp <= toCorner ? up : corner;
      }
      pixels[y * stride + x] = (value + predicted) % 256;
    }
  }
  return { channels, height, pixels, width };
}

/** How many pixels of the page's top corner are black. */
function blackInCorner({ channels, height, pixels, width }: Picture): number {
  let black = 0;
  for (let y = 0; y < height * CORNER_HEIGHT; y += 1) {
    for (let x = 0; x < CORNER_WIDTH; x += 1) {
      const at = (y * width + x) * channels;
      if (
        (pixels[at] ?? 255) <= BLACK &&
        (pixels[at + 1] ?? 255) <= BLACK &&
        (pixels[at + 2] ?? 255) <= BLACK
      ) {
        black += 1;
      }
    }
  }
  return black;
}

const wait = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const device = pickDevice();
const booted = device.state === 'Booted';
const shots = mkdtempSync(path.join(tmpdir(), 'safari-check-'));
let failed = 0;
try {
  if (!booted) {
    simctl('boot', device.udid);
  }
  simctl('bootstatus', device.udid);
  simctl('ui', device.udid, 'appearance', 'light');
  for (const page of PAGES) {
    simctl('openurl', device.udid, new URL(page, base).href);
    wait(SETTLE);
    const file = path.join(shots, 'page.png');
    simctl('io', device.udid, 'screenshot', file);
    const black = blackInCorner(readPng(file));
    if (black > 0) {
      failed += 1;
      process.stderr.write(`safari-check: ${page} has ${black} black pixels in its top corner\n`);
    } else {
      process.stdout.write(`safari-check: ${page} ok\n`);
    }
  }
} finally {
  rmSync(shots, { force: true, recursive: true });
  if (!booted) {
    simctl('shutdown', device.udid);
  }
}
process.exit(failed === 0 ? 0 : 1);
