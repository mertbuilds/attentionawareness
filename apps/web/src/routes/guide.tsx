import { Separator } from '@attentionawareness/ui';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { GridTexture } from '../components/grid-texture.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { layout } from '../lib/layout.ts';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/guide')({
  component: Guide,
  head: () => ({
    meta: [
      { title: `${m.guide_head_title()} · ${SITE_NAME}` },
      { content: m.guide_description(), name: 'description' },
      { content: m.guide_head_title(), property: 'og:title' },
      { content: m.guide_description(), property: 'og:description' },
    ],
  }),
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
/** The post this guide is adapted from. */
const POST_URL = 'https://stopa.io/post/297';
const CONFIGURATOR_URL = 'https://apps.apple.com/app/apple-configurator/id1037126344?mt=12';
/** The free profile builder. */
const BUILD_PATH = '/build';
/** The Mac app is offered on the home page. */
const APP_PATH = '/#way-out';
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
  credit: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
    textWrap: 'pretty',
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
    fontSize: {
      '@media (min-width: 640px)': 36,
      default: 28,
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
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
  list: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    lineHeight: 1.5,
    margin: 0,
    paddingInlineStart: spacing.s6,
  },
  // The one thing to know before the first step. The box carries the weight,
  // so its title is set like any other.
  notice: {
    borderColor: colors.fg,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    padding: spacing.s4,
  },
  // The why inside the box: in the ink, where the lines around it are muted,
  // with a little more air above it than between them.
  noticeSubtitle: {
    fontSize: font.sizeMd,
    fontWeight: font.weightRegular,
    lineHeight: 1.5,
    margin: 0,
    marginBlockStart: spacing.s2,
    textWrap: 'balance',
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
    // The header strip stands over the top of the page, so the first line
    // starts clear of it.
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: `calc(${brandBar.height} + ${spacing.s6})`,
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
    fontSize: font.sizeLg,
    fontWeight: font.weightRegular,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // A Mac window brings its own rounded corners and the page shows through
  // them, so the picture needs no frame of its own.
  shotImage: {
    display: 'block',
    height: 'auto',
    marginBlockStart: spacing.s2,
    marginInline: 'auto',
    maxWidth: '100%',
  },
  // An iPhone screen, cut to a phone's rounded corners.
  shotPhone: {
    borderColor: colors.border,
    borderRadius: 24,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    cornerShape: 'squircle',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  stepNumber: {
    color: colors.muted,
    display: 'inline-block',
    fontVariantNumeric: 'tabular-nums',
    marginInlineEnd: spacing.s3,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
});

/**
 * One numbered step: its heading, then whatever the step says. The list
 * already carries the order for a screen reader, so the numeral is drawn only.
 */
function Step({ children, number, title }: { children: ReactNode; number: number; title: string }) {
  return (
    <li {...props(styles.step)}>
      <h2 {...props(styles.sectionTitle)}>
        <span aria-hidden="true" {...props(styles.stepNumber)}>
          {number}
        </span>
        {title}
      </h2>
      {children}
    </li>
  );
}

/**
 * A screenshot from `public/media/guide/<name>.webp`. `width` and `height` are
 * its size on the page, for a Mac window half its pixels since it was taken on
 * a retina screen; a narrower column scales it down. `phone` is for an iPhone
 * screen.
 */
function Shot({
  alt,
  height,
  name,
  phone = false,
  width,
}: {
  alt: string;
  height: number;
  name: string;
  phone?: boolean;
  width: number;
}) {
  return (
    <img
      alt={alt}
      decoding="async"
      height={height}
      loading="lazy"
      src={`/media/guide/${name}.webp`}
      width={width}
      {...props(styles.shotImage, phone && styles.shotPhone)}
    />
  );
}

function Guide() {
  const [creditBefore, creditAfter] = m.guide_credit({ post: LINK_SLOT }).split(LINK_SLOT);
  const [appBefore, appAfter] = m.guide_erase_app({ app: LINK_SLOT }).split(LINK_SLOT);
  const [configuratorBefore, configuratorAfter] = m
    .guide_step_configurator_body({ configurator: LINK_SLOT })
    .split(LINK_SLOT);
  const [builderBefore, builderAfter] = m
    .guide_step_build_body({ builder: LINK_SLOT })
    .split(LINK_SLOT);

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <header {...props(styles.hero)}>
        <h1 {...props(styles.heroTitle)}>{m.guide_title()}</h1>
        <p {...props(styles.lead)}>{m.guide_lead()}</p>
        <p {...props(styles.credit)}>
          {creditBefore}
          <a href={POST_URL} rel="noreferrer" target="_blank">
            {m.guide_credit_link()}
          </a>
          {creditAfter}
        </p>
      </header>

      <div {...props(styles.content)}>
        <aside {...props(styles.notice)}>
          <h2 {...props(styles.sectionTitle)}>{m.guide_erase_title()}</h2>
          <p {...props(styles.body)}>{m.guide_erase_body()}</p>
          <h3 {...props(styles.noticeSubtitle)}>{m.guide_erase_why_title()}</h3>
          <ul {...props(styles.list)}>
            <li>{m.guide_erase_why_restore()}</li>
            <li>{m.guide_erase_why_remove()}</li>
            <li>{m.guide_erase_why_apps()}</li>
          </ul>
          <p {...props(styles.body)}>{m.guide_erase_icloud()}</p>
          <p {...props(styles.body)}>{m.guide_erase_backup()}</p>
          <p {...props(styles.body)}>
            {appBefore}
            <a href={APP_PATH}>{m.guide_erase_app_link()}</a>
            {appAfter}
          </p>
        </aside>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.guide_need_title()}</h2>
          <ul {...props(styles.list)}>
            <li>{m.guide_need_mac()}</li>
            <li>{m.guide_need_passwords()}</li>
          </ul>
        </section>

        <ol {...props(styles.steps)}>
          <Step number={1} title={m.guide_step_backup_title()}>
            <ul {...props(styles.list)}>
              <li>{m.guide_step_backup_icloud()}</li>
              <li>{m.guide_step_backup_finder()}</li>
            </ul>
            <p {...props(styles.body)}>{m.guide_step_backup_note()}</p>
            <Shot
              alt={m.guide_shot_backup_finder()}
              height={600}
              name="backup-finder"
              width={779}
            />
          </Step>

          <Step number={2} title={m.guide_step_configurator_title()}>
            <p {...props(styles.body)}>
              {configuratorBefore}
              <a href={CONFIGURATOR_URL} rel="noreferrer" target="_blank">
                {m.guide_step_configurator_link()}
              </a>
              {configuratorAfter}
            </p>
            <Shot
              alt={m.guide_shot_configurator_open()}
              height={466}
              name="configurator-open"
              width={800}
            />
          </Step>

          <Step number={3} title={m.guide_step_erase_title()}>
            <p {...props(styles.body)}>{m.guide_step_erase_body()}</p>
            <p {...props(styles.body)}>{m.guide_step_erase_stolen()}</p>
            <p {...props(styles.body)}>{m.guide_step_erase_hello()}</p>
            <Shot
              alt={m.guide_shot_erase_iphone()}
              height={569}
              name="erase-iphone"
              phone
              width={320}
            />
          </Step>

          <Step number={4} title={m.guide_step_prepare_title()}>
            <ul {...props(styles.list)}>
              <li>{m.guide_step_prepare_connect()}</li>
              <li>{m.guide_step_prepare_manual()}</li>
              <li>{m.guide_step_prepare_skip()}</li>
              <li>{m.guide_step_prepare_org()}</li>
              <li>{m.guide_step_prepare_setup()}</li>
            </ul>
            <Shot
              alt={m.guide_shot_prepare_manual()}
              height={413}
              name="prepare-manual"
              width={550}
            />
            <Shot
              alt={m.guide_shot_prepare_setup_assistant()}
              height={691}
              name="prepare-setup-assistant"
              width={624}
            />
            <p {...props(styles.body)}>{m.guide_step_prepare_done()}</p>
          </Step>

          <Step number={5} title={m.guide_step_setup_title()}>
            <p {...props(styles.body)}>{m.guide_step_setup_home()}</p>
            <p {...props(styles.body)}>{m.guide_step_setup_no_restore()}</p>
            <p {...props(styles.body)}>{m.guide_step_setup_account()}</p>
            <p {...props(styles.body)}>{m.guide_step_setup_find_my()}</p>
            <p {...props(styles.body)}>{m.guide_step_setup_apps()}</p>
            <p {...props(styles.body)}>{m.guide_step_setup_check()}</p>
            <p {...props(styles.body)}>{m.guide_step_setup_managed()}</p>
            {/* iPhone Settings, the supervised line under the name. */}
            <Shot
              alt={m.guide_shot_settings_supervised()}
              height={149}
              name="settings-supervised"
              phone
              width={320}
            />
          </Step>

          <Step number={6} title={m.guide_step_build_title()}>
            <p {...props(styles.body)}>
              {builderBefore}
              <a href={BUILD_PATH}>{m.guide_step_build_link()}</a>
              {builderAfter}
            </p>
            <p {...props(styles.body)}>{m.guide_step_build_trial()}</p>
            <p {...props(styles.body)}>{m.guide_step_build_by_hand()}</p>
          </Step>

          <Step number={7} title={m.guide_step_install_title()}>
            <p {...props(styles.body)}>{m.guide_step_install_body()}</p>
            <p {...props(styles.body)}>{m.guide_step_install_done()}</p>
            <p {...props(styles.body)}>{m.guide_step_install_more()}</p>
            <Shot alt={m.guide_shot_add_profile()} height={502} name="add-profile" width={800} />
          </Step>
        </ol>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.guide_undo_title()}</h2>
          <p {...props(styles.body)}>{m.guide_undo_body()}</p>
        </section>

        <p {...props(layout.muted)}>{m.guide_updated()}</p>

        <Separator />

        <SiteFooter />
      </div>
    </main>
  );
}
