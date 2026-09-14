import { Button } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, keyframes, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { GridTexture } from '../components/grid-texture.tsx';
import { Receipt } from '../components/receipt.tsx';
import { clampHours, HourSlider, HOURS_DEFAULT } from '../components/screen-time-gate.tsx';
import { ScreenTimeHelp } from '../components/screen-time-help.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { formatYears } from '../lib/attention-math.ts';
import { decodeShare } from '../lib/share.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/**
 * Every heading on the page, the hero's own included. It is not a token
 * because the scale holds three weights and this is the fourth: Suisse Intl
 * ships 400, 500 and 700, so a 600 lands on its bold face and on a true
 * semibold in the Inter Variable fallback.
 */
const HEADING_WEIGHT = 600;
/**
 * The air between two sections, wider than anything inside one. The 4px scale
 * stops at 64px, and one idea per screen needs more than that between two of
 * them, so the page's widest gap is the one measure written out here.
 */
const SECTION_GAP = '96px';
/**
 * How wide a line on the first screen is allowed to get. The column itself is
 * the page's, so every left edge lines up; this is how much of it a sentence
 * takes, which is less, because these are read rather than scanned.
 */
const HERO_MEASURE = 640;
/** The places on the page that can be linked to, and the ids they use. */
const STORY_ID = 'story';
const HOW_ID = 'how';
const SUPERVISE_URL = '/supervise';
/** The report the average day is taken from. */
const SOURCE_URL = 'https://datareportal.com/global-digital-overview';
/** The post this started from, linked out of the paragraph that tells it. */
const STORY_URL = 'https://stopa.io/post/297';
/**
 * Where a link or a figure stands inside a sentence. The message is written
 * with it as a placeholder and split on it, so the words around it keep their
 * own order and spacing in every language instead of being stitched from
 * pieces.
 */
const LINK_SLOT = '\u0000';
/** A till pads its receipt numbers. */
const RECEIPT_DIGITS = 6;
/** How long the receipt takes to unroll, and the hero to drift up over it. */
const EXPAND_MS = '500ms';

/**
 * Each beat of the answer arriving: nothing is on the page until the question
 * is answered, and every beat comes in the same way after it.
 */
const revealEnter = keyframes({
  from: { filter: 'blur(2px)', opacity: 0, transform: 'translateY(4px)' },
  to: { filter: 'blur(0)', opacity: 1, transform: 'translateY(0)' },
});

const styles = create({
  // A section the hero links down to. The scroll stops short of its heading
  // instead of pinning it to the top edge of the window.
  anchor: {
    scrollMarginBlockStart: spacing.s8,
  },
  banner: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    maxWidth: 760,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s4,
    textWrap: 'pretty',
    width: '100%',
  },
  bannerDismiss: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 18,
    lineHeight: 1,
    marginInlineStart: 'auto',
    padding: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    // Nothing is drawn between the sections any more, so the gap carries the
    // rhythm on its own at every width.
    gap: SECTION_GAP,
    maxWidth: 760,
    width: '100%',
  },
  defDesc: {
    color: colors.muted,
    lineHeight: 1.5,
    marginBlockEnd: spacing.s3,
    marginInlineStart: 0,
    textWrap: 'pretty',
  },
  defList: {
    margin: 0,
  },
  defTerm: {
    fontWeight: font.weightMedium,
    lineHeight: 1.5,
    textWrap: 'pretty',
  },
  // The line the icon fan is set into. It is the section's picture, not its
  // heading, so it sits one step under the h2 above it; the line box is tall
  // enough for a 32px icon, which is what keeps the sentence around it even.
  expand: {
    display: 'grid',
    gridTemplateRows: '0fr',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: EXPAND_MS,
    },
    transitionProperty: 'grid-template-rows',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    width: '100%',
  },
  expandInner: {
    minHeight: 0,
    opacity: 0,
    overflow: 'hidden',
    transitionDelay: '150ms',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: EXPAND_MS,
    },
    transitionProperty: 'opacity',
  },
  expandInnerOpen: {
    opacity: 1,
  },
  expandOpen: {
    gridTemplateRows: '1fr',
  },
  // The first screen, whole, and one thing at a time down it: the question,
  // then the lines the answer earns, then the total they come to, then what to
  // do about it. One column at every width, because the order is the argument.
  // The same box as `content`, so the whole page keeps one left edge; what
  // stands in it is narrower, because a line this size is read, not scanned.
  gateNote: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    marginBlockStart: `calc(-1 * ${spacing.s4})`,
    textWrap: 'pretty',
  },
  gateSource: {
    color: colors.muted,
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  hero: {
    alignItems: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    justifyContent: 'center',
    maxWidth: 760,
    minHeight: firstThatWorks('100svh', '100vh'),
    paddingBlockEnd: '18vh',
    textAlign: 'center',
    width: '100%',
  },
  // What the reader does next, and the one sentence that says what it is.
  heroActions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
    justifyContent: 'center',
  },
  heroPitch: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    marginInline: 'auto',
    maxWidth: HERO_MEASURE,
    textAlign: 'center',
  },
  heroProduct: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '46ch',
    textWrap: 'pretty',
  },
  // The way past the button, for a reader who wants the price in time first.
  heroSecondary: {
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    fontSize: font.sizeSm,
    textDecorationLine: {
      ':hover': 'underline',
      default: 'none',
    },
  },
  heroTitle: {
    fontSize: {
      '@media (min-width: 640px)': 32,
      default: 28,
    },
    fontWeight: HEADING_WEIGHT,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    margin: 0,
    maxWidth: HERO_MEASURE,
    textWrap: 'balance',
  },
  howBody: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '60ch',
    textWrap: 'pretty',
  },
  // Four steps, one under the other, with nothing drawn around any of them:
  // the order is what makes them steps.
  howList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  howStep: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  howTitle: {
    fontSize: 18,
    fontWeight: HEADING_WEIGHT,
    lineHeight: 1.3,
    margin: 0,
    textWrap: 'pretty',
  },
  // The page's one caption: the small line that names the group under it.
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: font.weightMedium,
    letterSpacing: '0.08em',
    lineHeight: 1.4,
    margin: 0,
    textTransform: 'uppercase',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: SECTION_GAP,
    // The stacking context that keeps the grid layer above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s6,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
  },
  // One cited line inside the research box, and the whole line is the source.
  receiptAfter: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  receiptSlot: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  receiptWrap: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    maxWidth: HERO_MEASURE,
    width: '100%',
  },
  // What the answer buys, arriving: the total, the list under it, the line
  // under that and the pitch. One fade for all of them, so every beat reads
  // the same way.
  reveal: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    animationName: revealEnter,
    animationTimingFunction: 'ease-in-out',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  // The sentence under a section heading: the reason, not the claim.
  sectionBody: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '60ch',
    textWrap: 'pretty',
  },
  sectionTitle: {
    fontSize: font.sizeLg,
    fontWeight: HEADING_WEIGHT,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // The speaker is a hint, not a headline: it only colours up on hover, and it
  // sits in the quiet row under the way on, at the size of the text beside it.
  soundButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: 40,
    insetBlockStart: spacing.s4,
    insetInlineEnd: spacing.s4,
    justifyContent: 'center',
    padding: 0,
    position: 'fixed',
    width: 40,
    zIndex: 30,
  },
  soundGlyph: {
    display: 'block',
    height: 24,
    width: 24,
  },
  stepLink: {
    display: 'inline-block',
    marginBlockStart: spacing.s2,
  },
  story: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 640,
  },
  storyLine: {
    fontSize: 18,
    lineHeight: 1.7,
    margin: 0,
    textWrap: 'pretty',
  },
  // Who wrote it, and from where. It is a signature, so it is the quietest
  // line in the section.
  storySign: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
});

/**
 * Whether the show may click. Reduced motion silences the default, because a
 * click is one more thing happening at the reader; a reader who turned the
 * speaker on themselves has answered that question already.
 */
function tickAllowed(on: boolean, chosen: boolean): boolean {
  if (!on) {
    return false;
  }
  if (chosen) {
    return true;
  }
  const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
  return query === undefined || !query('(prefers-reduced-motion: reduce)').matches;
}

function HomePage() {
  const [hours, setHours] = useState(HOURS_DEFAULT);
  // Whether the reader has touched the dial: the receipt is empty until then.
  const [touched, setTouched] = useState(false);
  // The date on the bill: when the page was opened, not when it was rung up.
  const [printedAt] = useState(() => new Date());
  const [sound, setSound] = useState(true);
  const [soundChosen, setSoundChosen] = useState(false);
  const [friendYears, setFriendYears] = useState<string | null>(null);

  /* oxlint-disable react/set-state-in-effect -- one-shot read of browser-only state */
  useEffect(() => {
    const shared = decodeShare(globalThis.location.search);
    if (shared.hours !== undefined) {
      // A friend already answered the question, so the page opens on their
      // number, printed.
      setHours(shared.hours);
      setTouched(true);
      setFriendYears(formatYears(shared.hours));
    }
  }, []);
  /* oxlint-enable react/set-state-in-effect */

  // The first screen is the whole page until the dial is touched: nothing
  // under it can be scrolled to before the receipt exists.
  useEffect(() => {
    document.documentElement.style.overflow = touched ? '' : 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [touched]);

  // iOS Safari opens an audio device inside a gesture and nowhere else, so the
  // first gesture it accepts anywhere on the page opens one. Once that works
  // there is nothing left to listen for.
  useEffect(() => {
    const gestures = ['touchend', 'pointerup', 'click'] as const;
    function stop() {
      for (const gesture of gestures) {
        document.removeEventListener(gesture, unlock);
      }
    }
    function unlock() {
      if (unlockTickSound()) {
        stop();
      }
    }
    for (const gesture of gestures) {
      document.addEventListener(gesture, unlock, { once: true, passive: true });
    }
    return stop;
  }, []);

  function onHoursChange(value: number) {
    setHours(clampHours(value));
    if (!touched) {
      // iOS opens an audio device inside a gesture and nowhere else.
      unlockTickSound();
      setTouched(true);
    }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundChosen(true);
    if (next) {
      primeTickSound();
    }
  }

  const wholeHours = clampHours(hours);
  const locale = getLocale();
  // The bill's own number and date: one number per visit, the second of the
  // day the page was opened, and the date it was opened on.
  const receiptNo = String(
    printedAt.getHours() * 3600 + printedAt.getMinutes() * 60 + printedAt.getSeconds(),
  ).padStart(RECEIPT_DIGITS, '0');
  const printedOn = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(printedAt);
  // The post the story links out to, in the middle of the sentence that tells
  // it, so the words around it keep their own order in every language.
  const [storyBefore, storyAfter] = m.home_story_1({ post: LINK_SLOT }).split(LINK_SLOT);

  // Supervision leads: it is the step the other three stand on.
  const howItWorks = [
    { body: m.home_how_supervision_body(), guide: true, title: m.home_how_supervision_title() },
    { body: m.home_how_profile_body(), guide: false, title: m.home_how_profile_title() },
  ];

  const objections = [
    { desc: m.home_faq_data_desc(), term: m.home_faq_data_term() },
    { desc: m.home_faq_undo_desc(), term: m.home_faq_undo_term() },
    { desc: m.home_faq_change_desc(), term: m.home_faq_change_term() },
    { desc: m.home_faq_updates_desc(), term: m.home_faq_updates_term() },
    { desc: m.home_faq_keep_desc(), term: m.home_faq_keep_term() },
    { desc: m.home_faq_apple_desc(), term: m.home_faq_apple_term() },
    { desc: m.home_faq_mac_desc(), term: m.home_faq_mac_term() },
    { desc: m.home_faq_android_desc(), term: m.home_faq_android_term() },
    { desc: m.home_faq_windows_desc(), term: m.home_faq_windows_term() },
    { desc: m.home_faq_who_desc(), term: m.home_faq_who_term() },
  ];

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      {friendYears === null ? null : (
        <div {...props(styles.banner)}>
          <span>{m.share_banner({ years: friendYears })}</span>
          <button
            aria-label={m.share_banner_dismiss()}
            onClick={() => setFriendYears(null)}
            type="button"
            {...props(styles.bannerDismiss)}
          >
            ×
          </button>
        </div>
      )}
      <header {...props(styles.hero)}>
        <button
          aria-label={m.home_math_sound_label()}
          aria-pressed={sound}
          onClick={toggleSound}
          type="button"
          {...props(styles.soundButton)}
        >
          <svg aria-hidden="true" viewBox="0 0 18 18" {...props(styles.soundGlyph)}>
            <path d="M4 7H2v4h2l3.5 3V4L4 7Z" fill="currentColor" />
            {sound ? (
              <path
                d="M10.5 6.5a3.4 3.4 0 0 1 0 5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.4"
              />
            ) : (
              <path
                d="m10.5 6.5 4 5m0-5-4 5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.4"
              />
            )}
          </svg>
        </button>
        {touched ? null : (
          <>
            <h1 {...props(styles.heroTitle)}>
              {m.home_hero_title()}
              <ScreenTimeHelp />
            </h1>
            <HourSlider onPick={onHoursChange} sound={tickAllowed(sound, soundChosen)} />
          </>
        )}
        {/* The figure the question is asked against, and where it comes from.
        It goes the moment the reader gives their own. */}
        {touched ? null : (
          <p {...props(styles.gateNote)}>
            {m.home_gate_average()}{' '}
            <a href={SOURCE_URL} rel="noreferrer" target="_blank" {...props(styles.gateSource)}>
              {m.home_gate_source()}
            </a>
          </p>
        )}
        {/* The receipt: empty until the reader touches the dial, then priced
        live against it. Every figure on it rolls as the hours change. */}
        <section aria-live="polite" {...props(styles.receiptWrap)}>
          <div {...props(styles.expand, touched && styles.expandOpen)}>
            <div
              {...props(styles.expandInner, touched && styles.expandInnerOpen, styles.receiptSlot)}
            >
              <Receipt
                hours={wholeHours}
                number={receiptNo}
                onChange={onHoursChange}
                printedOn={printedOn}
                sound={tickAllowed(sound, soundChosen)}
              />
              <div {...props(styles.receiptAfter)}></div>
            </div>
          </div>
        </section>
        <div {...props(styles.expand, touched && styles.expandOpen)}>
          <div {...props(styles.expandInner, touched && styles.expandInnerOpen, styles.heroPitch)}>
            <p {...props(styles.heroProduct)}>{m.home_hero_product()}</p>
            <div {...props(styles.heroActions)}>
              <Button render={<a href={`#${HOW_ID}`} />}>{m.home_hero_cta()}</Button>
              <a href={`#${STORY_ID}`} {...props(styles.heroSecondary)}>
                {m.home_hero_secondary()}
              </a>
            </div>
          </div>
        </div>
      </header>

      <div {...props(styles.content)}>
        {/* Who made this and why, told rather than argued. It is the only
        place on the page that speaks in the first person. */}
        <section {...props(styles.section, styles.anchor)} id={STORY_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_story_title()}</h2>
          <div {...props(styles.story)}>
            <p {...props(styles.storyLine)}>
              {storyBefore}
              <a href={STORY_URL} rel="noreferrer" target="_blank">
                {m.home_story_2_link()}
              </a>
              {storyAfter}
            </p>
            <p {...props(styles.storyLine)}>{m.home_story_2()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_3()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_4()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_5()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_6()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_7()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_8()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_9()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_10()}</p>
            <p {...props(styles.storySign)}>{m.home_story_sign()}</p>
          </div>
        </section>

        <section {...props(styles.section, styles.anchor)} id={HOW_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <ol {...props(styles.howList)}>
            {howItWorks.map((step, index) => (
              <li key={step.title} {...props(styles.howStep)}>
                <h3 {...props(styles.howTitle)}>
                  {m.home_how_step({ n: index + 1, title: step.title })}
                </h3>
                <p {...props(styles.howBody)}>{step.body}</p>
                {step.guide ? (
                  <a href={SUPERVISE_URL} {...props(styles.stepLink)}>
                    {m.gen_supervise_link()}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_faq_title()}</h2>
          <dl {...props(styles.defList)}>
            {objections.map((objection) => (
              <div key={objection.term}>
                <dt {...props(styles.defTerm)}>{objection.term}</dt>
                <dd {...props(styles.defDesc)}>{objection.desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
