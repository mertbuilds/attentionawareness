import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { BlogPage } from '../components/blog-page.tsx';
import { posts } from '../lib/blog.ts';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/blog/')({
  component: Blog,
  head: () => ({
    meta: [
      { title: `${m.blog_head_title()} · ${SITE_NAME}` },
      { content: m.blog_description(), name: 'description' },
      { content: m.blog_head_title(), property: 'og:title' },
      { content: m.blog_description(), property: 'og:description' },
    ],
  }),
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';

const styles = create({
  description: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  lead: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  minutes: {
    margin: 0,
  },
  // A post in the list: its title, what it is about, how long it takes.
  post: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    maxWidth: 640,
  },
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightRegular,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
});

function Blog() {
  return (
    <BlogPage below={<p {...props(styles.lead)}>{m.blog_lead()}</p>} heading={m.blog_title()}>
      <ul {...props(styles.list)}>
        {posts.map((post) => (
          <li key={post.slug} {...props(styles.post)}>
            <h2 {...props(styles.title)}>
              <a href={`/blog/${post.slug}`}>{post.heading}</a>
            </h2>
            <p {...props(styles.description)}>{post.description}</p>
            <p {...props(layout.muted, styles.minutes)}>
              {m.blog_minutes({ minutes: post.minutes })}
            </p>
          </li>
        ))}
      </ul>
    </BlogPage>
  );
}
