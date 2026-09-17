import { Button, Separator } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { GridTexture } from '../components/grid-texture.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { layout } from '../lib/layout.ts';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/mac')({
  component: MacApp,
  head: () => ({
    meta: [
      { title: `${m.mac_head_title()} · ${SITE_NAME}` },
      { content: m.mac_description(), name: 'description' },
      { content: m.mac_title(), property: 'og:title' },
      { content: m.mac_description(), property: 'og:description' },
      { content: PAGE_URL, property: 'og:url' },
    ],
  }),
});

/** The arrow before a back link: a glyph, not a message. */
const BACK_ARROW = '\u2190';
const HOME_URL = '/';
/** The generator. The profile the Profile step installs is built there. */
const BUILD_URL = '/build';
/** The same procedure by hand, for a reader who would rather type it. */
const SUPERVISE_URL = '/supervise';
/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
const PAGE_URL = 'https://attentionawareness.com/mac';
const REPO_URL = 'https://github.com/mertbuilds/attentionawareness';
/**
 * What a release writes beside the dmg. It does not exist before the first one,
 * so the page reads it rather than carrying a version of its own: no file, no
 * download.
 */
const LATEST_URL = '/mac/latest.json';
/** A download size is quoted in decimal megabytes, the way Finder counts them. */
const BYTES_PER_MB = 1_000_000;
/** How much of a megabyte a download size is worth reading. */
const SIZE_DIGITS = 1;
/**
 * Where a link stands inside a sentence, the way the footer does it: the
 * message carries the link as a placeholder and is split on it, so the words
 * around it keep their own order and spacing in every language.
 */
const LINK_SLOT = '\u0000';

/** The three fields of `latest.json` this page reads. The rest is the updater's. */
type Release = {
  size: number;
  url: string;
  version: string;
};

const styles = create({
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
  // The button and the size line under it, left edge shared with the prose.
  download: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
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
  // The wizard's own order, so the numbers come from the list and not the copy.
  steps: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    paddingInlineStart: spacing.s6,
  },
});

/**
 * Reads `latest.json` once the page is up. A missing, unreadable or incomplete
 * file leaves the state null, which is what turns the download off: the page
 * never names a version it has not read.
 */
function useLatestRelease(): Release | null {
  const [release, setRelease] = useState<Release | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const read = async (): Promise<void> => {
      try {
        const response = await fetch(LATEST_URL, { signal: controller.signal });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as Partial<Release>;
        if (
          typeof payload.size === 'number' &&
          typeof payload.url === 'string' &&
          typeof payload.version === 'string'
        ) {
          setRelease({ size: payload.size, url: payload.url, version: payload.version });
        }
      } catch {
        // No release yet, or the network refused it. The button stays off.
      }
    };

    void read();
    return () => controller.abort();
  }, []);

  return release;
}

function MacApp() {
  const release = useLatestRelease();
  const [profileBefore, profileAfter] = m.mac_step_profile({ builder: LINK_SLOT }).split(LINK_SLOT);
  const [sourceBefore, sourceAfter] = m.mac_honest_source({ repo: LINK_SLOT }).split(LINK_SLOT);
  const [cliBefore, cliAfter] = m.mac_cli_body({ guide: LINK_SLOT }).split(LINK_SLOT);

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <header {...props(styles.hero)}>
        <a data-plain="" href={HOME_URL} {...props(styles.back)}>
          <span aria-hidden="true">{BACK_ARROW}</span>
          {m.nav_back_home()}
        </a>
        <h1 {...props(styles.heroTitle)}>{m.mac_title()}</h1>
        <p {...props(styles.lead)}>{m.mac_lead()}</p>
        <p {...props(styles.body)}>{m.mac_requirements()}</p>
      </header>

      <div {...props(styles.content)}>
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.mac_download_title()}</h2>
          <div {...props(styles.download)}>
            {release === null ? (
              <Button disabled>{m.mac_download_unreleased()}</Button>
            ) : (
              <Button render={<a download href={release.url} />}>{m.mac_download_cta()}</Button>
            )}
            {release === null ? null : (
              <p {...props(layout.muted)}>
                {m.mac_download_build({
                  size: (release.size / BYTES_PER_MB).toFixed(SIZE_DIGITS),
                  version: release.version,
                })}
              </p>
            )}
          </div>
          <p {...props(styles.body)}>{m.mac_download_notarized()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.mac_steps_title()}</h2>
          <ol {...props(styles.steps)}>
            <li {...props(styles.bulletItem)}>{m.mac_step_connect()}</li>
            <li {...props(styles.bulletItem)}>{m.mac_step_checks()}</li>
            <li {...props(styles.bulletItem)}>{m.mac_step_backup()}</li>
            <li {...props(styles.bulletItem)}>{m.mac_step_patch()}</li>
            <li {...props(styles.bulletItem)}>{m.mac_step_restore()}</li>
            <li {...props(styles.bulletItem)}>
              {profileBefore}
              <a href={BUILD_URL}>{m.mac_step_profile_link()}</a>
              {profileAfter}
            </li>
            <li {...props(styles.bulletItem)}>{m.mac_step_done()}</li>
          </ol>
          <p {...props(styles.body)}>{m.mac_steps_reverse()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.mac_honest_title()}</h2>
          <ul {...props(styles.bullets)}>
            <li {...props(styles.bulletItem)}>{m.mac_honest_unsupported()}</li>
            <li {...props(styles.bulletItem)}>{m.mac_honest_no_erase()}</li>
            <li {...props(styles.bulletItem)}>{m.mac_honest_verified()}</li>
            <li {...props(styles.bulletItem)}>
              {sourceBefore}
              <a href={REPO_URL} rel="noreferrer" target="_blank">
                {m.mac_honest_source_link()}
              </a>
              {sourceAfter}
            </li>
          </ul>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.mac_cli_title()}</h2>
          <p {...props(styles.body)}>
            {cliBefore}
            <a href={SUPERVISE_URL}>{m.mac_cli_link()}</a>
            {cliAfter}
          </p>
        </section>

        <Separator />

        <SiteFooter />
      </div>
    </main>
  );
}
