/**
 * Tells IndexNow (Bing, Yandex, Seznam, Naver and the other engines that share
 * it; not Google) that the site's pages changed. Run it after a deploy that
 * changes content: `pnpm indexnow`. `pnpm indexnow --dry-run` prints the
 * request and sends nothing.
 *
 * The addresses are the ones in `apps/web/public/sitemap.xml`, which lists
 * every page and post. The key is the name of the one `<32 hex>.txt` file in
 * `apps/web/public/`, whose content is the key itself. The engines read that
 * file from the live site to check that the sender owns the host, so the
 * script first makes sure the deployed site serves it.
 *
 * Protocol: https://www.indexnow.org/documentation
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const HOST = 'attentionawareness.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_FILE = /^[0-9a-f]{32}\.txt$/u;
const LOC = /<loc>([^<]+)<\/loc>/gu;

const publicDir = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'public');
const dryRun = process.argv.includes('--dry-run');

const fail = (message: string): never => {
  process.stderr.write(`indexnow: ${message}\n`);
  process.exit(1);
};

const keyFiles = readdirSync(publicDir).filter((name) => KEY_FILE.test(name));
const keyFile = keyFiles[0];
if (keyFile === undefined || keyFiles.length > 1) {
  fail(`expected one <32 hex>.txt key file in apps/web/public, found ${keyFiles.length}`);
}
const key = path.basename(keyFile, '.txt');
if (readFileSync(path.join(publicDir, keyFile), 'utf8').trim() !== key) {
  fail(`${keyFile} must hold its own name, the key, and nothing else`);
}

const sitemap = readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(LOC)].map((match) => (match[1] ?? '').trim());
if (urlList.length === 0) {
  fail('no <loc> in apps/web/public/sitemap.xml');
}
const foreign = urlList.filter((url) => new URL(url).host !== HOST);
if (foreign.length > 0) {
  fail(`the sitemap lists addresses of another host: ${foreign.join(', ')}`);
}

const keyLocation = `https://${HOST}/${keyFile}`;
const body = { host: HOST, key, keyLocation, urlList };

if (dryRun) {
  process.stdout.write(
    `indexnow: dry run, nothing sent. POST ${ENDPOINT}\n${JSON.stringify(body, null, 2)}\n`,
  );
  process.exit(0);
}

// Without the key file on the live site the engines answer 403, so stop here
// with a reason instead.
const live = await fetch(keyLocation);
if (!live.ok || (await live.text()).trim() !== key) {
  fail(`${keyLocation} does not serve the key yet (HTTP ${live.status}). Deploy first.`);
}

const response = await fetch(ENDPOINT, {
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json; charset=utf-8' },
  method: 'POST',
});
process.stdout.write(`indexnow: ${urlList.length} addresses sent, HTTP ${response.status}\n`);
// 200: accepted. 202: accepted, the key is still being checked.
if (response.status !== 200 && response.status !== 202) {
  fail(`not accepted: ${(await response.text()) || response.statusText}`);
}
