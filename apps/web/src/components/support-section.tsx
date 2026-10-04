import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { usePostHog } from '@posthog/react';
import { create, defaultMarker, keyframes, props, when } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useLayoutEffect, useRef, useState } from 'react';
import { Heart } from 'reicon-react';
import { blur, distance, duration, easing } from '../lib/motion.stylex.ts';
import { supportUrl } from '../lib/support.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import { m } from '../paraglide/messages.js';

const SUPPORT_URL = supportUrl('support-section');
/** Where the site's and the extension's code is public. */
const REPO_URL = 'https://github.com/mertbuilds/attentionawareness';
/** The heart on the support button, as tall as the button's letters are set. */
const HEART_SIZE = 14;

/** The panel rising into place, out of a blur, as a tile of the uses does. */
const rise = keyframes({
  from: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});

/** The heart's one beat as the panel arrives: past its size and back. */
const beat = keyframes({
  '0%': { transform: 'scale(1)' },
  '100%': { transform: 'scale(1)' },
  '40%': { transform: 'scale(1.3)' },
});

/**
 * The same beat under the pointer. It is a second animation, a touch smaller,
 * because one that has already played does not play again by its own name.
 */
const beatAgain = keyframes({
  '0%': { transform: 'scale(1)' },
  '100%': { transform: 'scale(1)' },
  '40%': { transform: 'scale(1.25)' },
});

const styles = create({
  // The button stands a step clear of the lines it follows.
  button: {
    marginBlockStart: spacing.s2,
  },
  // What is true of all of it, small and quiet, in a row that wraps on a phone.
  facts: {
    color: colors.muted,
    columnGap: spacing.s6,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    rowGap: spacing.s1,
  },
  // The one place the heart is in the orange. It sits in a wrapper because a
  // browser draws a scaled icon soft where the icon itself is scaled.
  heart: {
    animationDuration: duration.verySlow,
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: null,
      [when.ancestor(':hover')]: beatAgain,
    },
    animationTimingFunction: easing.bounce,
    color: accent.base,
    display: 'flex',
  },
  // Once, after the panel has risen into place.
  heartArrives: {
    animationDelay: {
      default: duration.verySlow,
      [when.ancestor(':hover')]: '0ms',
    },
    animationFillMode: 'backwards',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: beat,
      [when.ancestor(':hover')]: beatAgain,
    },
  },
  // Below the fold once the page has come alive, the panel waits out of sight
  // for its rise.
  hidden: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
  line: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '56ch',
    textWrap: 'pretty',
  },
  // A quiet box of its own, with room around its words, so the section stands
  // apart from the ones it sits between.
  panel: {
    alignItems: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    padding: {
      '@media (min-width: 640px)': spacing.s12,
      default: spacing.s6,
    },
  },
  rise: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: rise,
    animationTimingFunction: easing.smoothOut,
  },
  // The title stands a step clear of the lines under it.
  title: {
    marginBlockEnd: spacing.s2,
  },
});

/**
 * Why everything is free and the way to support the work, in the founder's
 * own words: the reason, what is free, the ask, then three plain facts. Its
 * title is set in the page's display size, which the page hands it. The
 * server draws it finished. Still under the window once the page has come
 * alive, it hides and rises as it comes into view, and the heart on its button
 * beats once after it, and again under the pointer. With less motion it stands
 * still.
 */
export function SupportSection({ titleStyle }: { titleStyle: StyleXStyles }) {
  const posthog = usePostHog();
  const panel = useRef<HTMLDivElement>(null);
  const reduced = useLessMotion();
  const seen = useSeen(panel, { once: true });
  // Whether the panel was under the window as the page came alive.
  const [below, setBelow] = useState(false);

  // Measured once, before the page paints again: only a panel wholly under
  // the window is hidden, where nobody sees it go.
  useLayoutEffect(() => {
    const top = panel.current?.getBoundingClientRect().top;
    setBelow(top !== undefined && top > window.innerHeight);
  }, []);

  const rising = below && !reduced;
  // The heart has had its beat: from then on it beats only under the pointer.
  const [beaten, setBeaten] = useState(false);

  return (
    <div ref={panel} {...props(styles.panel, rising && (seen ? styles.rise : styles.hidden))}>
      <h2 {...props(titleStyle, styles.title)}>{m.home_support_title()}</h2>
      <p {...props(styles.line)}>{m.home_support_free()}</p>
      <p {...props(styles.line)}>{m.home_support_why()}</p>
      <p {...props(styles.line)}>{m.home_support_ask()}</p>
      <Button
        onClick={() => posthog.capture('support_clicked', { placement: 'support_section' })}
        render={<a href={SUPPORT_URL} rel="noreferrer" target="_blank" />}
        style={[styles.button, defaultMarker()]}
      >
        <span
          onAnimationEnd={() => setBeaten(true)}
          {...props(styles.heart, seen && !beaten && styles.heartArrives)}
        >
          <Heart aria-hidden="true" size={HEART_SIZE} weight="Filled" />
        </span>
        {m.home_support_cta()}
      </Button>
      <ul {...props(styles.facts)}>
        <li>
          <a href={REPO_URL} rel="noreferrer" target="_blank">
            {m.home_support_fact_open()}
          </a>
        </li>
        <li>{m.home_support_fact_ads()}</li>
        <li>{m.home_support_fact_tracking()}</li>
      </ul>
    </div>
  );
}
