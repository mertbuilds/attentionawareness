import { Separator } from '@attentionawareness/ui';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { GridTexture } from '../components/grid-texture.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/guides/use-social-media-from-your-computer')({
  component: ExtensionGuide,
  head: () => ({
    meta: [
      { title: `${m.guide_ext_head_title()} · ${SITE_NAME}` },
      { content: m.guide_ext_description(), name: 'description' },
      { content: m.guide_ext_title(), property: 'og:title' },
      { content: m.guide_ext_description(), property: 'og:description' },
      { content: PAGE_URL, property: 'og:url' },
      { content: 'article', property: 'og:type' },
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'Article',
          author: { '@type': 'Person', name: AUTHOR_NAME },
          dateModified: UPDATED_ON,
          datePublished: PUBLISHED_ON,
          headline: m.guide_ext_title(),
          publisher: { '@type': 'Organization', name: SITE_NAME },
        },
      },
    ],
  }),
});

/** The arrow before a back link: a glyph, not a message. */
const BACK_ARROW = '\u2190';
const HOME_URL = '/';
/** Everything written out, this guide included. */
const GUIDES_URL = '/guides';
/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
const PAGE_URL = 'https://attentionawareness.com/guides/use-social-media-from-your-computer';
/** Who wrote it. The byline and the article metadata name the same person. */
const AUTHOR_NAME = 'Mert Duzgun';
/** When the guide went up, and when it was last gone over, for a crawler. */
const PUBLISHED_ON = '2026-09-18';
const UPDATED_ON = '2026-09-18';
/** The same day as `UPDATED_ON`, spelled the way the byline reads it aloud. */
const UPDATED_LABEL = '18 September 2026';
/** Every link off this site carries utm tags, so the visit is traced to this page. */
const STORE_URL =
  'https://chromewebstore.google.com/detail/attention-awareness/lgcijcijcndmggjiioibfcmppndfakee?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=guide';
const PRIVACY_URL = '/extension/privacy';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/**
 * The two halves of the custom rule the options page takes. They are code
 * rather than copy, so they stay here instead of in a message, and a CSS block
 * cannot go in one anyway: braces are what a message names a variable with.
 */
const EXAMPLE_DOMAIN = 'news.example.com';
const EXAMPLE_CSS = '.trending-sidebar {\n  display: none;\n}';
/**
 * Where a link stands inside a sentence, the way the footer does it: the
 * message carries the link as a placeholder and is split on it, so the words
 * around it keep their own order and spacing in every language.
 */
const LINK_SLOT = '\u0000';

const styles = create({
  // The guide itself. The page centres it, so the column and the gaps that
  // separate one section from the next live on the article rather than on main.
  article: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    width: '100%',
  },
  // The way back, over the title: one quiet line, an arrow and a word.
  back: {
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    display: 'inline-flex',
    fontSize: font.sizeSm,
    gap: spacing.s1,
    textDecorationLine: 'none',
  },
  body: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  bulletItem: {
    marginBlockEnd: spacing.s2,
    textWrap: 'pretty',
  },
  bullets: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    paddingInlineStart: spacing.s4,
  },
  // Who wrote it and when, a step quieter than the sentence under it.
  byline: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  // What the column under it holds: the quieter of the two headings a site has.
  columnTitle: {
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    letterSpacing: '0.04em',
    margin: 0,
    textTransform: 'uppercase',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    maxWidth: 760,
    width: '100%',
  },
  // Same column as `content`, so the hero and every section share a left edge.
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 760,
    width: '100%',
  },
  heroTitle: {
    fontSize: 'clamp(36px, 6.4vw, 54px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.035em',
    lineHeight: 1.04,
    margin: 0,
    textWrap: 'balance',
  },
  lead: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  // The way back and the way to the guides, side by side on one quiet row.
  nav: {
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    // The stacking context that keeps the grid layer above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: `calc(100vh - ${wip.height})`,
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
  },
  pre: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
    margin: 0,
    overflowX: 'auto',
    padding: spacing.s3,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  sectionTitle: {
    fontSize: 'clamp(22px, 3.2vw, 28px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // One site: its name over the two columns that say what happens to it.
  site: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  subTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightBold,
    letterSpacing: '-0.01em',
    margin: 0,
  },
  twoCol: {
    display: 'grid',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    gridTemplateColumns: {
      '@media (min-width: 640px)': '1fr 1fr',
      default: '1fr',
    },
  },
});

function ExtensionGuide() {
  const [billBefore, billAfter] = m.guide_ext_why_3({ bill: LINK_SLOT }).split(LINK_SLOT);
  const [storeBefore, storeAfter] = m.guide_ext_install_body({ store: LINK_SLOT }).split(LINK_SLOT);
  const [privacyBefore, privacyAfter] = m
    .guide_ext_install_privacy({ privacy: LINK_SLOT })
    .split(LINK_SLOT);
  // What the options page is given: the domain, then the rule, labelled the
  // way its two fields are.
  const example = [
    m.guide_ext_switches_example_domain(),
    EXAMPLE_DOMAIN,
    '',
    m.guide_ext_switches_example_css(),
    EXAMPLE_CSS,
  ].join('\n');

  // One block per site, in the order the popup lists them. Every line is taken
  // from the header of that site's rule file, so the page and the CSS say the
  // same thing.
  const sites = [
    {
      gone: [m.guide_ext_x_gone_1(), m.guide_ext_x_gone_2(), m.guide_ext_x_gone_3()],
      name: m.guide_ext_x_name(),
      stays: [
        m.guide_ext_x_stays_1(),
        m.guide_ext_x_stays_2(),
        m.guide_ext_x_stays_3(),
        m.guide_ext_x_stays_4(),
        m.guide_ext_x_stays_5(),
      ],
    },
    {
      gone: [
        m.guide_ext_yt_gone_1(),
        m.guide_ext_yt_gone_2(),
        m.guide_ext_yt_gone_3(),
        m.guide_ext_yt_gone_4(),
      ],
      name: m.guide_ext_yt_name(),
      stays: [
        m.guide_ext_yt_stays_1(),
        m.guide_ext_yt_stays_2(),
        m.guide_ext_yt_stays_3(),
        m.guide_ext_yt_stays_4(),
      ],
    },
    {
      gone: [
        m.guide_ext_ig_gone_1(),
        m.guide_ext_ig_gone_2(),
        m.guide_ext_ig_gone_3(),
        m.guide_ext_ig_gone_4(),
      ],
      name: m.guide_ext_ig_name(),
      stays: [
        m.guide_ext_ig_stays_1(),
        m.guide_ext_ig_stays_2(),
        m.guide_ext_ig_stays_3(),
        m.guide_ext_ig_stays_4(),
        m.guide_ext_ig_stays_5(),
      ],
    },
    {
      gone: [m.guide_ext_tt_gone_1()],
      name: m.guide_ext_tt_name(),
      stays: [m.guide_ext_tt_stays_1()],
    },
  ];

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <article {...props(styles.article)}>
        <header {...props(styles.hero)}>
          <div {...props(styles.nav)}>
            <a data-plain="" href={HOME_URL} {...props(styles.back)}>
              <span aria-hidden="true">{BACK_ARROW}</span>
              {m.nav_back_home()}
            </a>
            <a data-plain="" href={GUIDES_URL} {...props(styles.back)}>
              {m.guides_nav_link()}
            </a>
          </div>
          <h1 {...props(styles.heroTitle)}>{m.guide_ext_title()}</h1>
          <p {...props(styles.byline)}>
            {m.guide_ext_byline({ author: AUTHOR_NAME, date: UPDATED_LABEL })}
          </p>
          <p {...props(styles.lead)}>{m.guide_ext_intro()}</p>
        </header>

        <div {...props(styles.content)}>
          <section {...props(styles.section)}>
            <h2 {...props(styles.sectionTitle)}>{m.guide_ext_why_title()}</h2>
            <p {...props(styles.body)}>{m.guide_ext_why_1()}</p>
            <p {...props(styles.body)}>{m.guide_ext_why_2()}</p>
            <p {...props(styles.body)}>
              {billBefore}
              <a href={HOME_URL}>{m.guide_ext_why_bill_link()}</a>
              {billAfter}
            </p>
          </section>

          <section {...props(styles.section)}>
            <h2 {...props(styles.sectionTitle)}>{m.guide_ext_install_title()}</h2>
            <p {...props(styles.body)}>
              {storeBefore}
              <a href={STORE_URL} rel="noreferrer" target="_blank">
                {m.guide_ext_install_store_link()}
              </a>
              {storeAfter}
            </p>
            <p {...props(styles.body)}>{m.guide_ext_install_browsers()}</p>
            <p {...props(styles.body)}>
              {privacyBefore}
              <a href={PRIVACY_URL}>{m.guide_ext_install_privacy_link()}</a>
              {privacyAfter}
            </p>
          </section>

          <section {...props(styles.section)}>
            <h2 {...props(styles.sectionTitle)}>{m.guide_ext_sites_title()}</h2>
            <p {...props(styles.body)}>{m.guide_ext_sites_body()}</p>
            {sites.map((site) => (
              <div key={site.name} {...props(styles.site)}>
                <h3 {...props(styles.subTitle)}>{site.name}</h3>
                <div {...props(styles.twoCol)}>
                  <div {...props(styles.column)}>
                    <h4 {...props(styles.columnTitle)}>{m.guide_ext_sites_gone()}</h4>
                    <ul {...props(styles.bullets)}>
                      {site.gone.map((line) => (
                        <li key={line} {...props(styles.bulletItem)}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div {...props(styles.column)}>
                    <h4 {...props(styles.columnTitle)}>{m.guide_ext_sites_stays()}</h4>
                    <ul {...props(styles.bullets)}>
                      {site.stays.map((line) => (
                        <li key={line} {...props(styles.bulletItem)}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section {...props(styles.section)}>
            <h2 {...props(styles.sectionTitle)}>{m.guide_ext_switches_title()}</h2>
            <ul {...props(styles.bullets)}>
              <li {...props(styles.bulletItem)}>{m.guide_ext_switches_site()}</li>
              <li {...props(styles.bulletItem)}>{m.guide_ext_switches_master()}</li>
              <li {...props(styles.bulletItem)}>{m.guide_ext_switches_custom()}</li>
              <li {...props(styles.bulletItem)}>{m.guide_ext_switches_domain()}</li>
              <li {...props(styles.bulletItem)}>{m.guide_ext_switches_permission()}</li>
            </ul>
            <h3 {...props(styles.subTitle)}>{m.guide_ext_switches_example_title()}</h3>
            <p {...props(styles.body)}>{m.guide_ext_switches_example_body()}</p>
            <pre {...props(styles.pre)}>{example}</pre>
          </section>
        </div>
      </article>

      <div {...props(styles.content)}>
        <Separator />

        <SiteFooter />
      </div>
    </main>
  );
}
