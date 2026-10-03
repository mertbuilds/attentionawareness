import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useInView } from 'motion/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { duration, easing } from '../lib/motion.stylex.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { m } from '../paraglide/messages.js';
import {
  APPS,
  AppGlyph,
  AppSquare,
  FeedIcon,
  type Glyph,
  ICON,
  PHONE,
  PhoneFrame,
} from './steps/phone.tsx';

/**
 * The home screen, a row at a time from the top: the four feeds by their
 * bundle ids, in among the seven apps that stay, each by its glyph. The feeds
 * go in the order they stand.
 */
const HOME: ReadonlyArray<{ feed: string } | { glyph: Glyph }> = [
  { feed: 'com.zhiliaoapp.musically' },
  { glyph: 'camera' },
  { feed: 'com.burbn.instagram' },
  { glyph: 'music' },
  { glyph: 'notes' },
  { feed: 'com.google.ios.youtube' },
  { glyph: 'maps' },
  { glyph: 'messages' },
  { feed: 'com.atebits.Tweetie2' },
  { glyph: 'phone' },
  { glyph: 'bank' },
];
const GOING = HOME.flatMap((app, slot) => ('feed' in app ? [{ bundleId: app.feed, slot }] : []));
const STAYING = HOME.flatMap((app, slot) => ('glyph' in app ? [{ glyph: app.glyph, slot }] : []));

/**
 * The loop, in milliseconds, about six seconds a turn. It tells rather than
 * responds, so like the steps' drawings it keeps its own times rather than the
 * page's motion scale. The full screen stands for `full`. The feeds go one
 * after another, `feedStagger` apart, each over `feedFade`, and the gaps they
 * leave stand open for `gap`. The apps that stay close them over `slide`,
 * `slideStagger` apart, and the clean screen stands for `clean` before the
 * full one crossfades back in over `crossfade`.
 */
const LOOP = {
  clean: 1500,
  crossfade: 400,
  feedFade: 400,
  feedStagger: 150,
  full: 2000,
  gap: 250,
  slide: 700,
  slideStagger: 40,
};
/** How blurred a feed is, and how small, by the time it is gone. */
const GONE_BLUR = '3px';
const GONE_SCALE = 0.85;

/**
 * Where the loop stands. It opens on the full screen, which the server draws
 * too, so the feeds are the first thing seen. Its feeds go, the apps that stay
 * close up, and the clean screen stands a moment before the full one comes
 * back. A reader who asked for less motion sees only the clean screen.
 */
type Phase = 'full' | 'clearing' | 'closing' | 'clean';
const NEXT: Record<Phase, Phase> = {
  clean: 'full',
  clearing: 'closing',
  closing: 'clean',
  full: 'clearing',
};
/** How long each phase stands before the next comes on. */
const LASTS: Record<Phase, number> = {
  clean: LOOP.clean,
  clearing: (GOING.length - 1) * LOOP.feedStagger + LOOP.feedFade + LOOP.gap,
  closing: (STAYING.length - 1) * LOOP.slideStagger + LOOP.slide,
  full: LOOP.crossfade + LOOP.full,
};

/** An app's box, as a share of the phone's width and of its height. */
const SIDE = {
  height: `${(ICON / PHONE.height) * 100}%`,
  width: `${(ICON / PHONE.width) * 100}%`,
};

const styles = create({
  // An app's box, put in place by its transform, and what of it can move.
  app: {
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: 'absolute',
    transitionProperty: 'opacity, filter, transform',
    transitionTimingFunction: easing.smoothOut,
  },
  appAfter: (delay: number) => ({
    transitionDelay: `${delay}ms`,
  }),
  appAt: (width: string, height: string, transform: string) => ({
    height,
    transform,
    width,
  }),
  // Put back at once: while the clean screen stands in for it, and at rest.
  appAtOnce: {
    transitionDuration: '0s',
  },
  // A feed on its way out, blurring and shrinking as it fades.
  appGone: {
    filter: `blur(${GONE_BLUR})`,
    opacity: 0,
    transitionDuration: `${LOOP.feedFade}ms`,
  },
  appSliding: {
    transitionDuration: `${LOOP.slide}ms`,
  },
  caption: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  // The phone's outline, in the flow, so the phone takes its height from its width.
  frame: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    width: '100%',
  },
  icon: {
    display: 'block',
    height: '100%',
    overflow: 'visible',
    width: '100%',
  },
  layer: {
    inset: 0,
    position: 'absolute',
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.smoothOut,
  },
  layerFadeIn: {
    opacity: 1,
    transitionDuration: `${LOOP.crossfade}ms`,
  },
  // The clean screen gives way quicker than the full one comes in, so the two
  // are hardly ever seen one over the other.
  layerFadeOut: {
    opacity: 0,
    transitionDuration: duration.quick,
  },
  layerIn: {
    opacity: 1,
    transitionDuration: '0s',
  },
  layerOut: {
    opacity: 0,
    transitionDuration: '0s',
  },
  // As wide as the column lets it, up to a size that still leaves the words
  // around it room.
  phone: {
    maxWidth: {
      '@media (min-width: 640px)': 272,
      default: 224,
    },
    position: 'relative',
    width: '100%',
  },
  stat: {
    fontSize: font.sizeLg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    lineHeight: 1.3,
    margin: 0,
  },
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    textAlign: 'center',
  },
});

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function tabHidden(): boolean {
  return document.visibilityState === 'hidden';
}

function hiddenOnServer(): boolean {
  return false;
}

/**
 * The transform that stands an app's box on the home screen's `slot`, at
 * `size`. It moves the box by shares of its own side, so the phone can be
 * drawn at any width.
 */
function standOn(slot: number, size = 1): string {
  const app = APPS[slot];
  if (app === undefined) {
    return 'none';
  }
  const left = ((app.x - ICON / 2 - PHONE.x) / ICON) * 100;
  const top = ((app.y - ICON / 2 - PHONE.y) / ICON) * 100;
  return `translate(${left}%, ${top}%) scale(${size})`;
}

/** One app's square, drawn in a box of its own around its middle. */
function AppIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`${-ICON / 2} ${-ICON / 2} ${ICON} ${ICON}`}
      {...props(styles.icon)}
    >
      {children}
    </svg>
  );
}

function KeptIcon({ glyph }: { glyph: Glyph }) {
  return (
    <AppIcon>
      <AppSquare hairline />
      <AppGlyph glyph={glyph} hairline />
    </AppIcon>
  );
}

/**
 * The hero's iPhone and what it took: a home screen whose four feeds blur
 * away one after another, the apps that stay sliding up to close the gaps,
 * the clean screen standing a moment before the full one crossfades back and
 * it plays again. Under it, the daily screen time before and after.
 *
 * The clean screen is drawn over the live one and stands in for it at the
 * loop's end, so the live one can be put back where it started unseen and the
 * full screen crossfades in over the clean one. The loop holds while the
 * phone is off screen or the tab is put away. The server draws the full
 * screen, and with less motion the clean one stands there.
 */
export function HeroPhone() {
  const phone = useRef<HTMLDivElement>(null);
  const seen = useInView(phone);
  const hidden = useSyncExternalStore(subscribeVisibility, tabHidden, hiddenOnServer);
  const reduced = useLessMotion();
  const [phase, setPhase] = useState<Phase>('full');
  const running = seen && !hidden && !reduced;

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setTimeout(() => setPhase(NEXT[phase]), LASTS[phase]);
    return () => clearTimeout(timer);
  }, [phase, running]);

  const still = reduced || phase === 'clean';
  const gone = !still && phase !== 'full';
  const closed = !still && phase === 'closing';

  return (
    <div {...props(styles.hero)}>
      <div aria-label={m.hero_phone_label()} ref={phone} role="img" {...props(styles.phone)}>
        <svg
          aria-hidden="true"
          viewBox={`${PHONE.x} ${PHONE.y} ${PHONE.width} ${PHONE.height}`}
          {...props(styles.frame)}
        >
          <PhoneFrame hairline />
        </svg>
        <div {...props(styles.layer, still ? styles.layerOut : styles.layerFadeIn)}>
          {GOING.map((app, order) => (
            <div
              key={app.bundleId}
              {...props(
                styles.app,
                styles.appAt(SIDE.width, SIDE.height, standOn(app.slot, gone ? GONE_SCALE : 1)),
                gone
                  ? [styles.appGone, styles.appAfter(order * LOOP.feedStagger)]
                  : styles.appAtOnce,
              )}
            >
              <AppIcon>
                <FeedIcon bundleId={app.bundleId} hairline />
              </AppIcon>
            </div>
          ))}
          {STAYING.map((app, place) => (
            <div
              key={app.glyph}
              {...props(
                styles.app,
                styles.appAt(SIDE.width, SIDE.height, standOn(closed ? place : app.slot)),
                closed
                  ? [styles.appSliding, styles.appAfter(place * LOOP.slideStagger)]
                  : styles.appAtOnce,
              )}
            >
              <KeptIcon glyph={app.glyph} />
            </div>
          ))}
        </div>
        <div {...props(styles.layer, still ? styles.layerIn : styles.layerFadeOut)}>
          {STAYING.map((app, place) => (
            <div
              key={app.glyph}
              {...props(styles.app, styles.appAt(SIDE.width, SIDE.height, standOn(place)))}
            >
              <KeptIcon glyph={app.glyph} />
            </div>
          ))}
        </div>
      </div>
      <div {...props(styles.stats)}>
        <p {...props(styles.stat)}>{m.hero_phone_stat()}</p>
        <p {...props(styles.caption)}>{m.hero_phone_stat_caption()}</p>
      </div>
    </div>
  );
}
