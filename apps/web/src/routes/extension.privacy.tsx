import { Separator } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { GridTexture } from '../components/grid-texture.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { layout } from '../lib/layout.ts';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/extension/privacy')({
  component: ExtensionPrivacy,
  head: () => ({ meta: [{ title: `${m.ext_privacy_head_title()} · ${SITE_NAME}` }] }),
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'Attention Awareness';
const REPO_URL = 'https://github.com/mertbuilds/attentionawareness';
const ISSUES_URL = 'https://github.com/mertbuilds/attentionawareness/issues';
/**
 * Where a link stands inside a sentence, the way the footer does it: the
 * message carries the link as a placeholder and is split on it, so the words
 * around it keep their own order and spacing in every language.
 */
const LINK_SLOT = '\u0000';

const styles = create({
  body: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
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
});

function ExtensionPrivacy() {
  const [sourceBefore, sourceAfter] = m
    .ext_privacy_source_body({ repo: LINK_SLOT })
    .split(LINK_SLOT);
  const [contactBefore, contactAfter] = m
    .ext_privacy_contact_body({ issues: LINK_SLOT })
    .split(LINK_SLOT);

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <header {...props(styles.hero)}>
        <h1 {...props(styles.heroTitle)}>{m.ext_privacy_title()}</h1>
        <p {...props(styles.lead)}>{m.ext_privacy_lead()}</p>
      </header>

      <div {...props(styles.content)}>
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.ext_privacy_stores_title()}</h2>
          <p {...props(styles.body)}>{m.ext_privacy_stores_body()}</p>
          <p {...props(styles.body)}>{m.ext_privacy_stores_sync()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.ext_privacy_sends_title()}</h2>
          <p {...props(styles.body)}>{m.ext_privacy_sends_body()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.ext_privacy_sees_title()}</h2>
          <p {...props(styles.body)}>{m.ext_privacy_sees_body()}</p>
          <p {...props(styles.body)}>{m.ext_privacy_sees_custom()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.ext_privacy_source_title()}</h2>
          <p {...props(styles.body)}>
            {sourceBefore}
            <a href={REPO_URL} rel="noreferrer" target="_blank">
              {m.ext_privacy_source_link()}
            </a>
            {sourceAfter}
          </p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.ext_privacy_contact_title()}</h2>
          <p {...props(styles.body)}>
            {contactBefore}
            <a href={ISSUES_URL} rel="noreferrer" target="_blank">
              {m.ext_privacy_contact_link()}
            </a>
            {contactAfter}
          </p>
        </section>

        <p {...props(layout.muted)}>{m.ext_privacy_updated()}</p>

        <Separator />

        <SiteFooter />
      </div>
    </main>
  );
}
