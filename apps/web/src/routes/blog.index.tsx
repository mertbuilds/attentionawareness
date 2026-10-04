import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { PageColumn, PageFoot, PageHeader, PageRoot, page } from '../components/page.tsx';
import { PostCard } from '../components/post-card.tsx';
import { posts } from '../lib/blog.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/blog/')({
  component: Blog,
  head: () => ({
    meta: [
      { title: `${m.blog_head_title()} · ${SITE_NAME}` },
      { content: m.blog_description(), name: 'description' },
      { content: m.blog_head_title(), property: 'og:title' },
      { content: m.blog_description(), property: 'og:description' },
      { content: m.blog_lead(), property: 'og:image:alt' },
    ],
  }),
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';

const styles = create({
  // One card a row on a phone, two side by side where they fit.
  list: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'repeat(2, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
});

function Blog() {
  return (
    <PageRoot>
      <PageHeader eyebrow={m.page_eyebrow_blog()} title={m.blog_title()} wide>
        <p {...props(page.flush)}>{m.blog_lead()}</p>
      </PageHeader>
      <PageColumn width="wide">
        <ul {...props(styles.list)}>
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
        <PageFoot />
      </PageColumn>
    </PageRoot>
  );
}
