import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useId } from 'react';
import { MacDownload } from '../components/mac-download.tsx';
import {
  Callout,
  PageColumn,
  PageFoot,
  PageHeader,
  PageRoot,
  Prose,
  page,
} from '../components/page.tsx';
import { PostCard } from '../components/post-card.tsx';
import { loadPost, postDay } from '../lib/blog.ts';
import { ink } from '../lib/reading.stylex.ts';
import { breadcrumbSchema } from '../lib/structured-data.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/blog/$slug')({
  component: BlogPost,
  // A slug no post has throws in the loader, and the root's not-found page
  // answers with its own head.
  head: ({ loaderData }) =>
    loaderData === undefined
      ? {}
      : {
          meta: [
            // The post's own title, without the brand: with it most titles run
            // past what a search result shows.
            { title: loaderData.post.title },
            { content: loaderData.post.description, name: 'description' },
            { content: loaderData.post.title, property: 'og:title' },
            { content: loaderData.post.description, property: 'og:description' },
            { content: 'article', property: 'og:type' },
            { content: loaderData.post.date, property: 'article:published_time' },
            { 'script:ld+json': loaderData.post.schema },
            // The way down to the post, which a search result shows in place of the address.
            {
              'script:ld+json': breadcrumbSchema([
                { name: SITE_NAME, path: '/' },
                { name: m.blog_title(), path: BLOG_PATH },
                { name: loaderData.post.heading, path: `${BLOG_PATH}/${loaderData.post.slug}` },
              ]),
            },
          ],
        },
  loader: load,
});

/**
 * The post the address names. Declared with its own types rather than inline,
 * so the head above can read what it returns.
 */
async function load({ params }: { params: { slug: string } }) {
  const found = await loadPost(params.slug);
  if (found === undefined) {
    throw notFound();
  }
  return found;
}

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
const BLOG_PATH = '/blog';
/** The author's own site. Every link to one of Mert's sites carries utm tags. */
const AUTHOR_URL =
  'https://mertbuilds.com/?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=blog-author';
/** The manual way, on a page of its own. */
const GUIDE_PATH = '/guide';

const styles = create({
  ctaBody: {
    color: ink.text,
    lineHeight: 1.55,
    margin: 0,
    maxWidth: '52ch',
    textWrap: 'pretty',
  },
  ctaNote: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    lineHeight: 1.5,
    margin: 0,
  },
  ctaTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // What the post asks for: the download, its price, and the manual way.
  ctaWords: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  next: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(2, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // The heading over the sources, as quiet as the list under it.
  sources: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  sourcesTitle: {
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    lineHeight: 1.5,
    margin: 0,
  },
});

function BlogPost() {
  // The router's hooks come out untyped in this repo, so the data takes its
  // type from the loader that returned it.
  const { next, post }: Awaited<ReturnType<typeof load>> = Route.useLoaderData();
  const nextTitle = useId();

  return (
    <PageRoot>
      <PageHeader
        eyebrow={<a href={BLOG_PATH}>{m.blog_title()}</a>}
        meta={[
          <time dateTime={post.date} key="day">
            {postDay(post.date)}
          </time>,
          m.blog_minutes({ minutes: post.minutes }),
          <a href={AUTHOR_URL} key="author" rel="noreferrer" target="_blank">
            {m.blog_author()}
          </a>,
        ]}
        title={post.heading}
      >
        <p {...props(page.flush)}>{post.description}</p>
      </PageHeader>

      <PageColumn>
        {/* The post's own words, compiled from its Markdown file in this repo
        by vite.blog.ts. Nothing a reader or another site wrote goes in here. */}
        <Prose as="article" html={post.html} />

        <Callout>
          <div {...props(styles.ctaWords)}>
            <h2 {...props(styles.ctaTitle)}>{m.blog_cta_title()}</h2>
            <p {...props(styles.ctaBody)}>{m.blog_cta_body()}</p>
            <MacDownload placement="blog" />
            <p {...props(styles.ctaNote)}>
              <span>{m.home_hero_price()}</span>
              <a href={GUIDE_PATH}>{m.blog_cta_manual()}</a>
            </p>
          </div>
        </Callout>

        {next.length > 0 && (
          <nav aria-labelledby={nextTitle} {...props(page.section)}>
            <h2 id={nextTitle} {...props(page.sectionTitle)}>
              {m.blog_next_title()}
            </h2>
            <ul {...props(styles.next)}>
              {next.map((sibling) => (
                <li key={sibling.slug}>
                  <PostCard heading="h3" post={sibling} />
                </li>
              ))}
            </ul>
          </nav>
        )}

        {post.sources !== '' && (
          <section {...props(styles.sources)}>
            <h2 {...props(styles.sourcesTitle)}>{m.blog_sources_title()}</h2>
            {/* The same file's list of sources, compiled the same way. */}
            <Prose html={post.sources} small />
          </section>
        )}

        <PageFoot />
      </PageColumn>
    </PageRoot>
  );
}
