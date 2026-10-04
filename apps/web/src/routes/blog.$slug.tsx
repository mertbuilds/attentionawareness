import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useId } from 'react';
import { BlogPage } from '../components/blog-page.tsx';
import { MacDownload } from '../components/mac-download.tsx';
import { loadPost, postDay } from '../lib/blog.ts';
import { layout } from '../lib/layout.ts';
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
            { title: `${loaderData.post.title} · ${SITE_NAME}` },
            { content: loaderData.post.description, name: 'description' },
            { content: loaderData.post.title, property: 'og:title' },
            { content: loaderData.post.description, property: 'og:description' },
            { content: 'article', property: 'og:type' },
            { 'script:ld+json': loaderData.post.schema },
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
/** The manual way, on a page of its own. */
const GUIDE_PATH = '/guide';

const styles = create({
  // What the post asks for, in a box of its own under the last paragraph: the
  // download, its price, and the manual way.
  cta: {
    alignItems: 'flex-start',
    borderColor: colors.fg,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    padding: spacing.s6,
  },
  ctaBody: {
    color: colors.muted,
    lineHeight: 1.5,
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
  line: {
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    lineHeight: 1.5,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  sectionTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightRegular,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // The heading over the sources, as quiet as the list under it.
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
    <BlogPage
      above={
        <p {...props(layout.muted, styles.line)}>
          <a href={BLOG_PATH}>{m.blog_title()}</a>
        </p>
      }
      below={
        <p {...props(layout.muted, styles.line)}>
          <time dateTime={post.date}>{postDay(post.date)}</time>
          {' · '}
          {m.blog_minutes({ minutes: post.minutes })}
        </p>
      }
      heading={post.heading}
    >
      {/* The post's own words, compiled from its Markdown file in this repo
      by vite.blog.ts. Nothing a reader or another site wrote goes in here. */}
      <article dangerouslySetInnerHTML={{ __html: post.html }} data-prose="" />

      <aside {...props(styles.cta)}>
        <h2 {...props(styles.sectionTitle)}>{m.blog_cta_title()}</h2>
        <p {...props(styles.ctaBody)}>{m.blog_cta_body()}</p>
        <MacDownload placement="blog" />
        <p {...props(styles.ctaNote)}>
          <span>{m.home_hero_price()}</span>
          <a href={GUIDE_PATH}>{m.blog_cta_manual()}</a>
        </p>
      </aside>

      {next.length > 0 && (
        <nav aria-labelledby={nextTitle} {...props(styles.section)}>
          <h2 id={nextTitle} {...props(styles.sectionTitle)}>
            {m.blog_next_title()}
          </h2>
          <ul {...props(styles.list)}>
            {next.map((sibling) => (
              <li key={sibling.slug}>
                <a href={`${BLOG_PATH}/${sibling.slug}`}>{sibling.heading}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {post.sources !== '' && (
        <section {...props(styles.section)}>
          <h2 {...props(styles.sourcesTitle)}>{m.blog_sources_title()}</h2>
          {/* The same file's list of sources, compiled the same way. */}
          <div dangerouslySetInnerHTML={{ __html: post.sources }} data-prose="small" />
        </section>
      )}
    </BlogPage>
  );
}
