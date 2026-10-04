# ADR-0005: Blog posts as Markdown, compiled at build

Date: 2026-10-04. Status: accepted.

## Why

The site needs long-form posts that answer what people search for: how to block an app, a website or a child's iPhone for good. A post is a thousand words of prose with headings, numbered steps, tables and links. As Paraglide messages that would be one key per paragraph in `messages/en.json`. And a Worker has no file system, so nothing can read Markdown when a page is asked for.

## Decision

- A post is one Markdown file, `apps/web/content/blog/<slug>.md`:
  - frontmatter: `title`, `description`, `slug` (the file's name), `date`, `primary_keyword`, `reading_minutes`, and two optional keys: `heading`, for a title on the page that differs from the `<title>`, and `read_next`, the slugs the closing block links on to;
  - the body;
  - `## Schema`, one fenced JSON-LD block, which goes into the head;
  - `## Sources`, a list, drawn small under the post.
  - Working notes (keyword data, unverified facts) stay out of the repo.
- `apps/web/vite.blog.ts` is a Vite plugin that compiles each file while Vite builds or serves. `marked` (GFM, so tables render) turns the body and the sources into HTML, the JSON-LD is parsed, and the file becomes a JavaScript module. Frontmatter with a key missing, a slug that is not the file's name, or JSON-LD that does not parse fails the build. `marked` is a devDependency: the Worker never parses Markdown.
- `src/lib/blog.ts` takes the files in with `import.meta.glob`: only the frontmatter for a list of posts, and the whole post as a chunk of its own, loaded by the route that shows it.
- `/blog` lists the posts, the newest first. `/blog/$slug` loads one in its route loader and sets `<title>`, the description, `og:*` and the JSON-LD from it. A slug no post has answers with the 404 page.
- The post page puts the compiled HTML in with `dangerouslySetInnerHTML`. Only HTML compiled from files in this repo goes there, never anything a reader or another site wrote. Its styles are plain CSS in `src/app.css` under `[data-prose]`, because the compiled elements carry no class for StyleX to hold on to.
- Posts are English only and long-form, so their text is exempt from the rule that every string goes through `m.*()`. The page around a post (labels, the closing block) still goes through Paraglide.

## Consequences

- A new post is a new file, plus its address in `public/sitemap.xml`, which is written by hand.
- The JSON-LD repeats the title, the description, the date and the FAQ answers. Whoever edits one edits the other.
- A post in a second language needs a new decision: the exemption above holds only while posts are English only.
- The loader's data travels in the page for hydration, so a post's HTML is in the document twice. Compression takes most of that back.
