/**
 * Packs the built extension into the file a store upload takes:
 * `attentionawareness-extension-<manifest version>.zip`, next to `dist`.
 *
 * The archive is written from inside `dist`, because the manifest has to sit
 * at the root of the zip and not under a folder. `zip` is the system binary,
 * which macOS and every CI image already have, so this needs no dependency.
 *
 *   node scripts/zip.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const manifest = path.join(dist, 'manifest.json');

if (!existsSync(manifest)) {
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' });
}

const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string };
const archive = path.join(root, `attentionawareness-extension-${version}.zip`);

// zip adds to an archive that is already there, which would carry whatever the
// last build left behind into this one.
rmSync(archive, { force: true });
execFileSync('zip', ['-r', '-q', '-X', archive, '.'], { cwd: dist, stdio: 'inherit' });

process.stdout.write(`${path.relative(root, archive)}\n`);
