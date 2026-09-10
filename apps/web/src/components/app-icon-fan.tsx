import { colors, font } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useId, useState } from 'react';
import type { BlockedApp } from '../lib/profile/index.ts';
import { AppArtwork } from './app-artwork.tsx';
import type { MetaCache } from './app-artwork.tsx';

/** Above every other icon in the fan, whatever the stack order says. */
const POPPED_DEPTH = 99;

const styles = create({
  fan: {
    alignItems: 'center',
    display: 'inline-flex',
    marginInline: '0.3em',
    verticalAlign: 'middle',
  },
  fanArtwork: {
    borderRadius: 9,
    height: {
      '@media (min-width: 640px)': 40,
      default: 32,
    },
    width: {
      '@media (min-width: 640px)': 40,
      default: 32,
    },
  },
  fanItem: {
    backgroundColor: 'transparent',
    borderRadius: 9,
    borderStyle: 'none',
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 3px ${colors.muted}`,
      default: null,
    },
    cursor: 'pointer',
    display: 'block',
    lineHeight: 0,
    margin: 0,
    outlineStyle: 'none',
    padding: 0,
    position: 'relative',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '220ms',
    },
    transitionProperty: 'transform',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
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
    marginInlineStart: {
      '@media (min-width: 640px)': -24,
      default: -19,
    },
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
  fanTooltip: {
    backgroundColor: colors.fg,
    borderRadius: 999,
    color: colors.bg,
    fontSize: 12,
    fontWeight: font.weightRegular,
    insetBlockEnd: 'calc(100% + 8px)',
    insetInlineStart: '50%',
    lineHeight: 1.4,
    paddingBlock: 4,
    paddingInline: 8,
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    zIndex: 1,
  },
});

/**
 * The blocked apps as a stack of cards. Hover pops one icon to the front and
 * eases its neighbours aside; touch, which has no hover, toggles the same pop
 * on tap. The popped icon names itself in a tooltip, so the fan reads without
 * a pointer resting on it. Only one icon pops, so one tooltip id is enough.
 */
export function AppIconFan({ apps, meta }: { apps: ReadonlyArray<BlockedApp>; meta: MetaCache }) {
  const [popped, setPopped] = useState<string | null>(null);
  const tooltipId = useId();
  const poppedIndex = apps.findIndex((app) => app.bundleId === popped);
  const hasPop = poppedIndex !== -1;

  return (
    <span {...props(styles.fan)}>
      {apps.map((app, index) => (
        <button
          aria-describedby={popped === app.bundleId ? tooltipId : undefined}
          aria-label={app.name}
          key={app.bundleId}
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
          {popped === app.bundleId ? (
            <span id={tooltipId} role="tooltip" {...props(styles.fanTooltip)}>
              {app.name}
            </span>
          ) : null}
        </button>
      ))}
    </span>
  );
}

export { styles as fanStyles };
