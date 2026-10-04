import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { OG_SIZE, ogImage, ogImagePath } from './og.ts';
import { SITE_URL } from './structured-data.ts';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);

const slugs = readdirSync(new URL('../../content/blog/', import.meta.url))
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.slice(0, -'.md'.length));
const sitemapPaths = [...source('../../public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
  ([, loc = '']) => {
    const path = loc.slice(SITE_URL.length);
    return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  },
);

/** A PNG's width and height, from its header. */
function pngSize(file: URL): { height: number; width: number } {
  const bytes = readFileSync(file);
  return { height: bytes.readUInt32BE(20), width: bytes.readUInt32BE(16) };
}

test('every page in the sitemap has a card of its own, at the share size', () => {
  assert.ok(sitemapPaths.length > 0);
  for (const path of sitemapPaths) {
    const card = ogImagePath(path, slugs);
    assert.ok(existsSync(publicFile(card)), `${path}: ${card} is missing`);
    assert.deepEqual(pngSize(publicFile(card)), OG_SIZE, `${path}: ${card} is not 1200x630`);
    if (path !== '/') {
      assert.notEqual(card, ogImagePath('/', slugs), `${path} shows the home card`);
    }
  }
});

test('every post has its card, and its JSON-LD names it', () => {
  for (const slug of slugs) {
    const card = ogImagePath(`/blog/${slug}`, slugs);
    assert.equal(card, `/og/blog/${slug}.png`);
    assert.ok(existsSync(publicFile(card)), `${slug}: ${card} is missing`);
    assert.ok(
      source(`../../content/blog/${slug}.md`).includes(`"image": "${SITE_URL}${card}"`),
      `${slug}: the post's JSON-LD image is not its card`,
    );
  }
});

test('a path with no card of its own shows the home card', () => {
  assert.equal(ogImage('/no-such-page', slugs), `${SITE_URL}/og/home.png`);
  assert.equal(ogImage('/blog/no-such-post', slugs), `${SITE_URL}/og/home.png`);
});

test('the head points every share card at the page card', () => {
  const root = source('../routes/__root.tsx');
  assert.match(root, /const image = ogImage\(/u);
  assert.match(root, /\{ content: image, property: 'og:image' \}/u);
  assert.match(root, /\{ content: image, name: 'twitter:image' \}/u);
});
