import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useState } from 'react';
import type { BlockedApp } from '../lib/profile/index.ts';
import { AppArtwork } from './app-artwork.tsx';
import type { MetaCache } from './app-artwork.tsx';
import { Tip } from './tip.tsx';

/** Above every other icon in the fan, whatever the stack order says. */
const POPPED_DEPTH = 99;

const styles = create({
  fan: {
    alignItems: 'center',
    display: 'inline-flex',
    marginInline: '0.3em',
    verticalAlign: 'middle',
  },
  // One size at every width: the fan sits inside a 20px headline whose line
  // box is exactly this tall, and a taller icon would push the sentence around
  // it apart.
  fanArtwork: {
    borderRadius: 9,
    height: 32,
    width: 32,
  },
  // The button reset and everything the pop needs; the static fan takes none
  // of it.
  fanButton: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 3px ${colors.muted}`,
      default: null,
    },
    cursor: 'pointer',
    margin: 0,
    outlineStyle: 'none',
    padding: 0,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '220ms',
    },
    transitionProperty: 'transform',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  fanItem: {
    borderRadius: 9,
    display: 'block',
    lineHeight: 0,
    position: 'relative',
  },
  fanNudgeEnd: {
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateX(4px)',
    },
  },
  fanNudgeStart: {
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateX(-4px)',
    },
  },
  fanOverlap: {
    marginInlineStart: -19,
  },
  fanPop: {
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateY(-8px) scale(1.15)',
    },
  },
  fanStack: (depth: number) => ({
    zIndex: depth,
  }),
  // Rides inside the popped icon, so it keeps its 8px gap through the pop.
});

/**
 * The blocked apps as a stack of cards. Hover pops one icon to the front and
 * eases its neighbours aside; touch, which has no hover, toggles the same pop
 * on tap. The popped icon names itself in a tooltip, so the fan reads without
 * a pointer resting on it. Only one icon pops, so one tooltip id is enough.
 *
 * `interactive={false}` draws the same stack out of plain spans: no focus
 * stop, no pop, no tooltip. The share card wants a picture of the fan, and a
 * focus stop there catches the focus a dialog moves inside on open.
 */
export function AppIconFan({
  apps,
  interactive = true,
  meta,
}: {
  apps: ReadonlyArray<BlockedApp>;
  interactive?: boolean | undefined;
  meta: MetaCache;
}) {
  const [popped, setPopped] = useState<string | null>(null);
  const poppedIndex = apps.findIndex((app) => app.bundleId === popped);
  const hasPop = poppedIndex !== -1;

  if (!interactive) {
    return (
      <span {...props(styles.fan)}>
        {apps.map((app, index) => (
          <span
            key={app.bundleId}
            {...props(
              styles.fanItem,
              index > 0 && styles.fanOverlap,
              styles.fanStack(apps.length - index),
            )}
          >
            <AppArtwork meta={meta[app.bundleId]} name={app.name} style={styles.fanArtwork} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span {...props(styles.fan)}>
      {apps.map((app, index) => (
        <Tip
          key={app.bundleId}
          mobile="none"
          title={app.name}
          trigger={
            <button
              aria-label={app.name}
              onBlur={() => setPopped(null)}
              onFocus={() => setPopped(app.bundleId)}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'touch') {
                  setPopped(app.bundleId);
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== 'touch') {
                  setPopped(null);
                }
              }}
              onPointerUp={(event) => {
                // A touch never hovers, so the tap itself is the toggle.
                if (event.pointerType === 'touch') {
                  setPopped(popped === app.bundleId ? null : app.bundleId);
                }
              }}
              type="button"
              {...props(
                styles.fanItem,
                styles.fanButton,
                index > 0 && styles.fanOverlap,
                // Earlier icons overlap later ones: the first app owns the top of
                // the stack, the last one the bottom.
                styles.fanStack(popped === app.bundleId ? POPPED_DEPTH : apps.length - index),
                popped === app.bundleId && styles.fanPop,
                hasPop && poppedIndex === index + 1 && styles.fanNudgeStart,
                hasPop && poppedIndex === index - 1 && styles.fanNudgeEnd,
              )}
            >
              <AppArtwork meta={meta[app.bundleId]} name={app.name} style={styles.fanArtwork} />
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

export { styles as fanStyles };
