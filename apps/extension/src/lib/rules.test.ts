import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'css-tree';
import { expect, test } from 'vitest';
import { ruleCss } from './rules.ts';

const directory = path.resolve(import.meta.dirname, '../rules');
const files = readdirSync(directory).filter((name) => name.endsWith('.css'));

test('every site has a rule file, and every rule file has rules', () => {
  expect([...files].sort()).toEqual(['instagram.css', 'tiktok.css', 'x.css', 'youtube.css']);
  for (const [site, css] of Object.entries(ruleCss)) {
    expect(css, site).toContain('!important');
  }
});

// A rule file that does not parse is a rule file the browser drops from the
// first error onwards, silently, leaving the feed where it was.
test.each(files)('%s parses', (name) => {
  const errors: Array<string> = [];
  parse(readFileSync(path.join(directory, name), 'utf8'), {
    filename: name,
    onParseError: (error) => {
      errors.push(`${error.message} (line ${String(error.line)})`);
    },
    positions: true,
  });
  expect(errors).toEqual([]);
});
