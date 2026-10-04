import { existsSync } from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import type { Plugin } from 'vite';
import type { Post, PostMeta } from './src/lib/blog.ts';
import { splitEmphasis } from './src/lib/emphasis.ts';

/**
 * Compiles the blog posts in `content/blog/*.md` while Vite builds, so the
 * Worker never reads a file or parses Markdown: a post reaches it as a module
 * that already holds its HTML. Imported as it is, a post is everything the
 * post page draws; imported with `?meta`, only what a list of posts needs.
 *
 * A post is YAML frontmatter, the body, then two sections that are not part of
 * the body: `## Schema` (one fenced JSON-LD block, for the head) and
 * `## Sources` (a list, drawn small under the post). Why: docs/adr/0005.
 */

/** A post file, by its path, with the query a list asks for it with. */
const POST_FILE = /\/content\/blog\/[^/?]+\.md(\?meta)?$/u;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u;
/** The two sections after the body, each split off at its heading. */
const SECTIONS = /^## (Schema|Sources)$/mu;
const JSON_BLOCK = /```json\n([\s\S]*?)\n```/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

// GFM is marked's default, which is what draws the tables.
const markdown = new Marked();

/**
 * A table goes in a box of its own, the only thing that scrolls sideways on a
 * phone, and a link to another site opens beside the post. Both are done on the
 * HTML marked writes for our own files, where a table and a link each have one
 * spelling.
 */
function render(source: string): string {
  return markdown
    .parse(source, { async: false })
    .replaceAll('<table>', '<div data-table><table>')
    .replaceAll('</table>', '</table></div>')
    .replaceAll('<a href="http', '<a rel="noreferrer" target="_blank" href="http');
}

/** A YAML string as the formatter leaves it: bare, or in either kind of quotes. */
function unquote(value: string): string {
  if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll(String.raw`\"`, '"');
  }
  if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

/** Whether a day written YYYY-MM-DD is one the calendar has. */
function isDay(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`);
  // A month the calendar lacks does not parse, and a day it lacks runs on
  // into the next month, so the day has to read back as it was written.
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `key: value` lines. Nothing nested. */
function readFrontmatter(block: string, file: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) {
      throw new Error(`${file}: frontmatter line without a key: "${line}"`);
    }
    fields.set(line.slice(0, colon).trim(), unquote(line.slice(colon + 1).trim()));
  }
  return fields;
}

/** A post's frontmatter and the rest of the file. The share cards' script reads it too. */
export function splitPost(
  source: string,
  file: string,
): { body: string; fields: Map<string, string> } {
  const parts = FRONTMATTER.exec(source);
  if (parts === null) {
    throw new Error(`${file}: a post starts with frontmatter between two --- lines`);
  }
  return { body: parts[2] ?? '', fields: readFrontmatter(parts[1] ?? '', file) };
}

function compile(source: string, file: string): Post {
  const { body: content, fields } = splitPost(source, file);
  const field = (key: string): string => {
    const value = fields.get(key);
    if (value === undefined || value === '') {
      throw new Error(`${file}: frontmatter needs "${key}"`);
    }
    return value;
  };

  const slug = field('slug');
  if (slug !== path.basename(file, '.md')) {
    throw new Error(`${file}: the slug "${slug}" is not the file's name`);
  }
  const date = field('date');
  if (!DATE.test(date)) {
    throw new Error(`${file}: the date "${date}" is not YYYY-MM-DD`);
  }
  if (!isDay(date)) {
    throw new Error(`${file}: the date "${date}" is not a day of the calendar`);
  }
  const minutes = Number(field('reading_minutes'));
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new Error(`${file}: reading_minutes is not a whole number of minutes`);
  }
  // Kept in the file for whoever edits the post; the page has no use for it.
  field('primary_keyword');
  const title = field('title');

  const [body = '', ...rest] = content.split(SECTIONS);
  const sections = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    sections.set(rest[index] ?? '', rest[index + 1] ?? '');
  }
  const json = JSON_BLOCK.exec(sections.get('Schema') ?? '')?.[1];
  if (json === undefined) {
    throw new Error(`${file}: "## Schema" needs one fenced json block`);
  }
  let schema: unknown;
  try {
    schema = JSON.parse(json);
  } catch (error) {
    throw new Error(`${file}: the JSON-LD under "## Schema" does not parse`, { cause: error });
  }
  if (!isRecord(schema)) {
    throw new Error(`${file}: the JSON-LD under "## Schema" is not one object`);
  }
  // A post may only link on to a post that is there: its file, beside this one.
  const next = (fields.get('read_next') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const sibling of next) {
    if (!existsSync(path.join(path.dirname(file), `${sibling}.md`))) {
      throw new Error(`${file}: read_next names "${sibling}", and there is no such post`);
    }
  }

  const heading = fields.get('heading') || title;
  return {
    // The share card's line may be shorter than the heading, its accent words
    // between `**` marks (`scripts/render-og.ts`); here, the words alone.
    card: splitEmphasis(fields.get('og_title') || heading)
      .map((run) => run.text)
      .join(''),
    date,
    description: field('description'),
    heading,
    html: render(body),
    minutes,
    next,
    schema,
    slug,
    sources: render(sections.get('Sources') ?? ''),
    title,
  };
}

export function blogPosts(): Plugin {
  return {
    // Before any other plugin takes the file for JavaScript.
    enforce: 'pre',
    name: 'attentionawareness:blog-posts',
    transform(source, id) {
      if (!POST_FILE.test(id)) {
        return null;
      }
      const [file = id, query] = id.split('?');
      const post = compile(source, file);
      const { html: _html, schema: _schema, sources: _sources, ...meta } = post;
      const module: Post | PostMeta = query === 'meta' ? meta : post;
      return { code: `export default ${JSON.stringify(module)};`, map: null };
    },
  };
}
