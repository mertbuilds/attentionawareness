import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { PageHeader, PageRoot, page } from '../components/page.tsx';
import { posts } from '../lib/blog.ts';
import { OG_PAGES, OG_SIZE, ogImagePath } from '../lib/og.ts';
import { m } from '../paraglide/messages.js';

/**
 * Every share card on one page, for a look before they ship: each at full
 * size, and as the small thumbnail a chat app shows. The page is there in dev
 * only. A production build answers it with the 404 and drops its code.
 */
export const Route = createFileRoute('/og-preview')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: import.meta.env.DEV ? OgPreview : () => null,
  head: () => ({
    meta: [{ title: m.og_preview_title() }, { content: 'noindex', name: 'robots' }],
  }),
  // When the page was drawn, put on every card's address, so a browser that
  // kept an older render of a card fetches the new one after `pnpm og`.
  loader: () => ({ drawn: Date.now() }),
});

/** How wide a thumbnail of a card is in a chat app. */
const THUMBNAIL = 300;
/** The cards' own size, written out: StyleX reads only values in this file. */
const CARD_WIDTH = 1200;
const CARD_RATIO = '1200 / 630';
const SLUGS = posts.map((post) => post.slug);

const styles = create({
  caption: {
    alignItems: 'flex-start',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s6,
    justifyContent: 'space-between',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    margin: 0,
  },
  cards: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s16,
    marginInline: 'auto',
    maxWidth: CARD_WIDTH + 32,
    paddingBlock: spacing.s16,
    paddingInline: spacing.s4,
    width: '100%',
  },
  full: {
    aspectRatio: CARD_RATIO,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'block',
    height: 'auto',
    width: '100%',
  },
  muted: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
  },
  path: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: font.sizeSm,
    margin: 0,
  },
  thumb: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'block',
    height: 'auto',
    width: THUMBNAIL,
  },
  thumbBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  words: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    maxWidth: 560,
  },
});

/** Each page's path and the words on its card, the home page first, then the posts. */
function cards(): Array<{ path: string; title: string }> {
  const titles: Record<keyof typeof OG_PAGES, string> = {
    '/': m.home_hero_title({
      distraction: m.home_hero_title_distraction(),
      permanently: m.home_hero_title_accent(),
    }),
    '/blog': m.blog_og_title(),
    '/build': m.gen_step2_title(),
    '/extension/privacy': m.ext_privacy_title(),
    '/guide': m.guide_head_title(),
    '/open': m.open_title(),
  };
  return [
    ...Object.entries(titles).map(([path, title]) => ({ path, title })),
    ...posts.map((post) => ({ path: `/blog/${post.slug}`, title: post.card })),
  ];
}

function OgPreview() {
  const { drawn } = Route.useLoaderData();
  return (
    <PageRoot>
      <PageHeader eyebrow={m.og_preview_eyebrow()} title={m.og_preview_title()} wide>
        <p {...props(page.flush)}>{m.og_preview_lead()}</p>
      </PageHeader>
      <div {...props(styles.cards)}>
        {cards().map(({ path, title }) => {
          const src = `${ogImagePath(path, SLUGS)}?v=${drawn}`;
          return (
            <figure key={path} {...props(styles.card)}>
              <img
                alt={title}
                height={OG_SIZE.height}
                src={src}
                width={OG_SIZE.width}
                {...props(styles.full)}
              />
              <figcaption {...props(styles.caption)}>
                <div {...props(styles.words)}>
                  <p {...props(styles.path)}>
                    <a href={path}>{path}</a>
                  </p>
                  <p {...props(styles.muted)}>{title}</p>
                  <p {...props(styles.muted)}>{ogImagePath(path, SLUGS)}</p>
                </div>
                <div {...props(styles.thumbBox)}>
                  <img
                    alt={title}
                    height={(OG_SIZE.height * THUMBNAIL) / OG_SIZE.width}
                    src={src}
                    width={THUMBNAIL}
                    {...props(styles.thumb)}
                  />
                  <p {...props(styles.muted)}>{m.og_preview_thumbnail()}</p>
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </PageRoot>
  );
}
