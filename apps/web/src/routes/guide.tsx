import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  Callout,
  PageColumn,
  PageFoot,
  PageHeader,
  PageRoot,
  Prose,
  page,
} from '../components/page.tsx';
import { SECTION } from '../lib/sections.ts';
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
const APP_PATH = `/#${SECTION.wayOut}`;
/**
 * Where a link stands inside a sentence, the way the footer does it: the
 * message carries the link as a placeholder and is split on it, so the words
 * around it keep their own order and spacing in every language.
 */
const LINK_SLOT = '\u0000';
/** The round the step's number stands in, in pixels. */
const STEP_BADGE = 36;

const styles = create({
  credit: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
    textWrap: 'pretty',
  },
  // A link's name held on one line, so it never breaks in two.
  nowrap: {
    whiteSpace: 'nowrap',
  },
  // A Mac window brings its own rounded corners and the page shows through
  // them, so the picture needs no frame of its own.
  shotImage: {
    display: 'block',
    height: 'auto',
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
    gap: spacing.s4,
  },
  // The number and the title on one line. Where the window leaves room on
  // the left, the number hangs out in it, so every title starts on the
  // column's edge.
  stepHead: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    marginInlineStart: {
      '@media (min-width: 1024px)': `calc(-1 * (${STEP_BADGE}px + ${spacing.s3}))`,
      default: 0,
    },
  },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: `color-mix(in srgb, ${accent.base} 8%, ${colors.bg})`,
    borderColor: accent.base,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    color: accent.base,
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: font.sizeMd,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    height: STEP_BADGE,
    justifyContent: 'center',
    letterSpacing: 0,
    width: STEP_BADGE,
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
      <h2 {...props(page.sectionTitle, styles.stepHead)}>
        <span aria-hidden="true" {...props(styles.stepNumber)}>
          {number}
        </span>
        <span>{title}</span>
      </h2>
      <Prose>{children}</Prose>
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
    <PageRoot>
      <PageHeader
        eyebrow={m.page_eyebrow_guide()}
        meta={[m.guide_updated()]}
        title={m.guide_title()}
      >
        <p {...props(page.flush)}>{m.guide_lead()}</p>
        <p {...props(styles.credit)}>
          {creditBefore}
          <a href={POST_URL} rel="noreferrer" target="_blank">
            {m.guide_credit_link()}
          </a>
          {creditAfter}
        </p>
      </PageHeader>

      <PageColumn>
        <Callout>
          <h2 {...props(page.sectionTitle)}>{m.guide_erase_title()}</h2>
          <Prose>
            <p>{m.guide_erase_body()}</p>
            <h3>{m.guide_erase_why_title()}</h3>
            <ul>
              <li>{m.guide_erase_why_restore()}</li>
              <li>{m.guide_erase_why_remove()}</li>
              <li>{m.guide_erase_why_apps()}</li>
            </ul>
            <p>{m.guide_erase_icloud()}</p>
            <p>{m.guide_erase_backup()}</p>
            <p>
              {appBefore}
              <a href={APP_PATH} {...props(styles.nowrap)}>
                {m.guide_erase_app_link()}
              </a>
              {appAfter}
            </p>
          </Prose>
        </Callout>

        <section {...props(page.section)}>
          <h2 {...props(page.sectionTitle)}>{m.guide_need_title()}</h2>
          <Prose>
            <ul>
              <li>{m.guide_need_mac()}</li>
              <li>{m.guide_need_passwords()}</li>
            </ul>
          </Prose>
        </section>

        <ol {...props(styles.steps)}>
          <Step number={1} title={m.guide_step_backup_title()}>
            <ul>
              <li>{m.guide_step_backup_icloud()}</li>
              <li>{m.guide_step_backup_finder()}</li>
            </ul>
            <p>{m.guide_step_backup_note()}</p>
            <Shot
              alt={m.guide_shot_backup_finder()}
              height={470}
              name="backup-finder"
              width={800}
            />
          </Step>

          <Step number={2} title={m.guide_step_configurator_title()}>
            <p>
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
            <p>{m.guide_step_erase_body()}</p>
            <p>{m.guide_step_erase_stolen()}</p>
            <p>{m.guide_step_erase_hello()}</p>
            <Shot
              alt={m.guide_shot_erase_iphone()}
              height={569}
              name="erase-iphone"
              phone
              width={320}
            />
          </Step>

          <Step number={4} title={m.guide_step_prepare_title()}>
            <ul>
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
            <p>{m.guide_step_prepare_done()}</p>
          </Step>

          <Step number={5} title={m.guide_step_setup_title()}>
            <p>{m.guide_step_setup_home()}</p>
            <p>{m.guide_step_setup_no_restore()}</p>
            <p>{m.guide_step_setup_account()}</p>
            <p>{m.guide_step_setup_find_my()}</p>
            <p>{m.guide_step_setup_apps()}</p>
            <p>{m.guide_step_setup_check()}</p>
            <p>{m.guide_step_setup_managed()}</p>
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
            <p>
              {builderBefore}
              <a href={BUILD_PATH}>{m.guide_step_build_link()}</a>
              {builderAfter}
            </p>
            <p>{m.guide_step_build_trial()}</p>
            <p>{m.guide_step_build_by_hand()}</p>
          </Step>

          <Step number={7} title={m.guide_step_install_title()}>
            <p>{m.guide_step_install_body()}</p>
            <p>{m.guide_step_install_done()}</p>
            <p>{m.guide_step_install_more()}</p>
            <Shot alt={m.guide_shot_add_profile()} height={502} name="add-profile" width={800} />
          </Step>
        </ol>

        <section {...props(page.section)}>
          <h2 {...props(page.sectionTitle)}>{m.guide_undo_title()}</h2>
          <p {...props(page.text)}>{m.guide_undo_body()}</p>
        </section>

        <PageFoot />
      </PageColumn>
    </PageRoot>
  );
}
