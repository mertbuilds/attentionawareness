import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { usePostHog } from '@posthog/react';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { BlogPage } from '../components/blog-page.tsx';
import { OpenNumbers } from '../components/open-numbers.tsx';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/open')({
  component: Open,
  head: () => ({
    meta: [
      { title: `${m.open_head_title()} · ${SITE_NAME}` },
      { content: m.open_description(), name: 'description' },
      { content: m.open_head_title(), property: 'og:title' },
      { content: m.open_description(), property: 'og:description' },
    ],
  }),
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
/** Where a sponsor writes to, with the subject already filled in. */
const SPONSOR_MAILTO = `mailto:hi@attentionawareness.com?subject=${encodeURIComponent('Sponsoring attentionawareness.com')}`;
/** Where the link stands in the sentence, as the footer does it. */
const LINK_SLOT = '\u0000';

const styles = create({
  body: {
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
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    lineHeight: 1.5,
    margin: 0,
    paddingInlineStart: spacing.s6,
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
});

function Open() {
  const posthog = usePostHog();
  const [sponsorBefore, sponsorAfter] = m.open_sponsor_body({ write: LINK_SLOT }).split(LINK_SLOT);

  return (
    <BlogPage below={<p {...props(styles.lead)}>{m.open_lead()}</p>} heading={m.open_title()}>
      <section {...props(styles.section)}>
        <h2 {...props(styles.sectionTitle)}>{m.open_numbers_title()}</h2>
        <p {...props(styles.body)}>{m.open_numbers_body()}</p>
        <OpenNumbers />
      </section>

      <section {...props(styles.section)}>
        <h2 {...props(styles.sectionTitle)}>{m.open_track_title()}</h2>
        <ul {...props(styles.list)}>
          <li>{m.open_track_posthog()}</li>
          <li>{m.open_track_cookie()}</li>
          <li>{m.open_track_builder()}</li>
          <li>{m.open_track_openpanel()}</li>
          <li>{m.open_track_iphone()}</li>
          <li>{m.open_track_mac()}</li>
        </ul>
      </section>

      <section {...props(styles.section)}>
        <h2 {...props(styles.sectionTitle)}>{m.open_sponsor_title()}</h2>
        <p {...props(styles.body)}>
          {sponsorBefore}
          <a
            href={SPONSOR_MAILTO}
            onClick={() => posthog.capture('sponsor_clicked', { placement: 'open' })}
          >
            {m.open_sponsor_link()}
          </a>
          {sponsorAfter}
        </p>
      </section>
    </BlogPage>
  );
}
