import { usePostHog } from '@posthog/react';
import { props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { OpenNumbers } from '../components/open-numbers.tsx';
import {
  Callout,
  PageColumn,
  PageFoot,
  PageHeader,
  PageRoot,
  Prose,
  page,
} from '../components/page.tsx';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/open')({
  component: Open,
  head: () => ({
    meta: [
      { title: `${m.open_head_title()} · ${SITE_NAME}` },
      { content: m.open_description(), name: 'description' },
      { content: m.open_head_title(), property: 'og:title' },
      { content: m.open_description(), property: 'og:description' },
      { content: m.open_title(), property: 'og:image:alt' },
    ],
  }),
  // Read on the Worker, so the page arrives with its numbers in it. The
  // function is fetched only here: a loader is part of every page's first
  // script, and the code that calls the Worker is not small.
  loader: async () => {
    const { getOpenNumbers } = await import('../lib/open-numbers-fn.ts');
    return getOpenNumbers();
  },
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
/** Where a sponsor writes to. */
const SPONSOR_EMAIL = 'hi@attentionawareness.com';
/** Where the link stands in the sentence, as the footer does it. */
const LINK_SLOT = '\u0000';

function Open() {
  const posthog = usePostHog();
  const answer = Route.useLoaderData();
  const mailto = `mailto:${SPONSOR_EMAIL}?subject=${encodeURIComponent(m.open_sponsor_subject())}`;
  const [sponsorBefore, sponsorAfter] = m.open_sponsor_body({ write: LINK_SLOT }).split(LINK_SLOT);

  return (
    <PageRoot>
      <PageHeader eyebrow={m.page_eyebrow_open()} title={m.open_title()} wide>
        <p {...props(page.flush)}>{m.open_lead()}</p>
      </PageHeader>

      <PageColumn width="wide">
        <section {...props(page.section)}>
          <h2 {...props(page.sectionTitle)}>{m.open_numbers_title()}</h2>
          <p {...props(page.text)}>{m.open_numbers_body()}</p>
          <OpenNumbers answer={answer} />
        </section>

        <section {...props(page.section)}>
          <h2 {...props(page.sectionTitle)}>{m.open_track_title()}</h2>
          <Prose>
            <ul>
              <li>{m.open_track_posthog()}</li>
              <li>{m.open_track_cookie()}</li>
              <li>{m.open_track_builder()}</li>
              <li>{m.open_track_openpanel()}</li>
              <li>{m.open_track_iphone()}</li>
              <li>{m.open_track_mac()}</li>
              <li>{m.open_track_mac_updates()}</li>
            </ul>
          </Prose>
        </section>

        <Callout as="section">
          <h2 {...props(page.sectionTitle)}>{m.open_sponsor_title()}</h2>
          <Prose>
            <p>
              {sponsorBefore}
              <a
                href={mailto}
                onClick={() => posthog.capture('sponsor_clicked', { placement: 'open' })}
              >
                {m.open_sponsor_link()}
              </a>
              {sponsorAfter}
            </p>
          </Prose>
        </Callout>

        <PageFoot />
      </PageColumn>
    </PageRoot>
  );
}
