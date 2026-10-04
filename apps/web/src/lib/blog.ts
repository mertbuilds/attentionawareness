/**
 * The blog's posts. They are Markdown files in `content/blog/`, compiled to
 * HTML by `vite.blog.ts` while Vite builds, so nothing here reads a file or
 * parses Markdown when a page is asked for.
 */

/** What a list of posts shows of one post. */
export type PostMeta = {
  /** The day it was published, as YYYY-MM-DD. */
  date: string;
  description: string;
  /** The title on the page. The same as `title` unless the post sets its own. */
  heading: string;
  /** How long it takes to read. */
  minutes: number;
  /** The posts its closing block links on to, by slug. */
  next: Array<string>;
  slug: string;
  /** The title a search result and a share card show. */
  title: string;
};

/** A whole post: its body and sources as HTML, and the JSON-LD for the head. */
export type Post = PostMeta & {
  html: string;
  schema: Record<string, unknown>;
  sources: string;
};

const metas = import.meta.glob<PostMeta>('../../content/blog/*.md', {
  eager: true,
  import: 'default',
  query: '?meta',
});

// One chunk a post, fetched when that post is opened.
const bodies = import.meta.glob<Post>('../../content/blog/*.md', { import: 'default' });

/** Every post, the newest first. Posts of one day keep the order of their slugs. */
export const posts: ReadonlyArray<PostMeta> = Object.values(metas).toSorted(
  (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
);

/**
 * A post and the posts it links on to, or nothing where no post has that
 * slug. The build has already refused a post that links on to one that is
 * not there (`vite.blog.ts`).
 */
export async function loadPost(
  slug: string,
): Promise<{ next: Array<PostMeta>; post: Post } | undefined> {
  const load = bodies[`../../content/blog/${slug}.md`];
  if (load === undefined) {
    return undefined;
  }
  const post = await load();
  return {
    next: post.next.flatMap((sibling) => posts.find((other) => other.slug === sibling) ?? []),
    post,
  };
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

/** A post's day in words, the same on the server and in every reader's time zone. */
export function postDay(date: string): string {
  return DAY.format(new Date(`${date}T00:00:00Z`));
}
