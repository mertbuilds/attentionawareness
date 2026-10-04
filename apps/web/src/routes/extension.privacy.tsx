import { props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { PageColumn, PageFoot, PageHeader, PageRoot, Prose, page } from '../components/page.tsx';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/extension/privacy')({
  component: ExtensionPrivacy,
  head: () => ({
    meta: [
      { title: `${m.ext_privacy_head_title()} · ${SITE_NAME}` },
      { content: m.ext_privacy_lead(), name: 'description' },
      { content: m.ext_privacy_head_title(), property: 'og:title' },
      { content: m.ext_privacy_lead(), property: 'og:description' },
    ],
  }),
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
const REPO_URL = 'https://github.com/mertbuilds/attentionawareness';
const ISSUES_URL = 'https://github.com/mertbuilds/attentionawareness/issues';
/**
 * Where a link stands inside a sentence, the way the footer does it: the
 * message carries the link as a placeholder and is split on it, so the words
 * around it keep their own order and spacing in every language.
 */
const LINK_SLOT = '\u0000';

function ExtensionPrivacy() {
  const [sourceBefore, sourceAfter] = m
    .ext_privacy_source_body({ repo: LINK_SLOT })
    .split(LINK_SLOT);
  const [contactBefore, contactAfter] = m
    .ext_privacy_contact_body({ issues: LINK_SLOT })
    .split(LINK_SLOT);

  return (
    <PageRoot>
      <PageHeader
        eyebrow={m.page_eyebrow_privacy()}
        meta={[m.ext_privacy_updated()]}
        title={m.ext_privacy_title()}
      >
        <p {...props(page.flush)}>{m.ext_privacy_lead()}</p>
      </PageHeader>

      <PageColumn>
        <Prose>
          <h2>{m.ext_privacy_stores_title()}</h2>
          <p>{m.ext_privacy_stores_body()}</p>
          <p>{m.ext_privacy_stores_sync()}</p>

          <h2>{m.ext_privacy_sends_title()}</h2>
          <p>{m.ext_privacy_sends_body()}</p>

          <h2>{m.ext_privacy_sees_title()}</h2>
          <p>{m.ext_privacy_sees_body()}</p>
          <p>{m.ext_privacy_sees_custom()}</p>

          <h2>{m.ext_privacy_source_title()}</h2>
          <p>
            {sourceBefore}
            <a href={REPO_URL} rel="noreferrer" target="_blank">
              {m.ext_privacy_source_link()}
            </a>
            {sourceAfter}
          </p>

          <h2>{m.ext_privacy_contact_title()}</h2>
          <p>
            {contactBefore}
            <a href={ISSUES_URL} rel="noreferrer" target="_blank">
              {m.ext_privacy_contact_link()}
            </a>
            {contactAfter}
          </p>
        </Prose>

        <PageFoot />
      </PageColumn>
    </PageRoot>
  );
}
