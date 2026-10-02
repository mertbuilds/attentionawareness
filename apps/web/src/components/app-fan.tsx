import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, props } from '@stylexjs/stylex';
import { duration, easing } from '../lib/motion.stylex.ts';
import type { BlockedApp } from '../lib/profile/index.ts';
import { AppArtwork } from './app-artwork.tsx';
import { Tip } from './tip.tsx';

/**
 * The feeds the most time goes to, each with its App Store icon in
 * `public/media/apps`, under its bundle id.
 */
const FEED_APPS: ReadonlyArray<BlockedApp> = [
  { bundleId: 'com.zhiliaoapp.musically', name: 'TikTok' },
  { bundleId: 'com.google.ios.youtube', name: 'YouTube' },
  { bundleId: 'com.burbn.instagram', name: 'Instagram' },
  { bundleId: 'com.atebits.Tweetie2', name: 'X' },
  { bundleId: 'com.facebook.Facebook', name: 'Facebook' },
  { bundleId: 'com.toyopagroup.picaboo', name: 'Snapchat' },
  { bundleId: 'com.reddit.Reddit', name: 'Reddit' },
];
/** The rounding of an iPhone's icon, as a share of its side. */
const ICON_RADIUS = '22.5%';

const styles = create({
  // The icons in a row, standing on the sentence's baseline like a word.
  fan: {
    display: 'inline-flex',
    verticalAlign: 'baseline',
  },
  // One app, a little over the one before it. Pointed at or reached from the
  // keyboard, it lifts out of the row and names itself.
  app: {
    backgroundColor: 'transparent',
    borderRadius: ICON_RADIUS,
    borderStyle: 'none',
    borderWidth: 0,
    cursor: 'default',
    display: 'block',
    // A button sets a font of its own; the icon is sized off the sentence's.
    fontFamily: 'inherit',
    fontSize: 'inherit',
    margin: 0,
    outlineColor: accent.base,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: 0,
    position: 'relative',
    transform: {
      ':focus-visible': 'translateY(-0.1em) scale(1.1)',
      ':hover': 'translateY(-0.1em) scale(1.1)',
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'none',
    },
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.quick,
    },
    transitionProperty: 'transform',
    transitionTimingFunction: easing.smoothOut,
    zIndex: {
      ':focus-visible': 1,
      ':hover': 1,
      default: 'auto',
    },
  },
  appOverlap: {
    marginInlineStart: '-0.14em',
  },
  // As tall as the line's capitals, so the row reads at the size of the
  // words. A ring of the page's own colour parts it from the icon it overlaps.
  // Off the stage it waits a touch low and unseen, put there once the beat
  // has faded out.
  artwork: {
    borderRadius: ICON_RADIUS,
    boxShadow: `0 0 0 0.04em ${colors.bg}`,
    height: firstThatWorks('1cap', '0.72em'),
    opacity: {
      '@media (prefers-reduced-motion: reduce)': 1,
      default: 0,
    },
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateY(0.12em) scale(0.85)',
    },
    transitionDelay: duration.quick,
    transitionDuration: '0s',
    transitionProperty: 'opacity, transform',
    width: firstThatWorks('1cap', '0.72em'),
  },
  // On the stage the icons come in one after another, once the line they
  // stand in has started to rise.
  artworkOn: {
    opacity: 1,
    transform: 'none',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.slow,
    },
    transitionTimingFunction: easing.smoothOut,
  },
  artworkStagger: (index: number) => ({
    transitionDelay: `calc(${duration.verySlow} + ${duration.quick} + ${index} * ${duration.stagger})`,
  }),
});

/**
 * The feed apps in a sentence, in place of the word for them: their icons in
 * a row, each a little over the one before it. The row is named with `label`,
 * so the sentence still reads as words. On the stage, with `on`, the icons
 * come in one after another.
 */
export function AppFan({ label, on }: { label: string; on: boolean }) {
  return (
    <span aria-label={label} role="group" {...props(styles.fan)}>
      {FEED_APPS.map((app, index) => (
        <Tip
          key={app.bundleId}
          mobile="none"
          side="top"
          title={app.name}
          trigger={
            <button
              aria-label={app.name}
              type="button"
              {...props(styles.app, index > 0 && styles.appOverlap)}
            >
              <AppArtwork
                meta={{ developer: '', iconUrl: `/media/apps/${app.bundleId}.webp` }}
                name={app.name}
                style={[styles.artwork, on && styles.artworkOn, on && styles.artworkStagger(index)]}
              />
            </button>
          }
          variant="label"
        >
          {null}
        </Tip>
      ))}
    </span>
  );
}
