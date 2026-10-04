import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { easeInOut } from 'motion/react';
import type { Ref } from 'react';
import { drawing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';
import { Cable } from './cable.tsx';
import { Laptop } from './laptop.tsx';
import { MacApp } from './mac-app.tsx';
import { stretch, usePlayhead } from './playhead.ts';

/** The phone beside the laptop, its screen and island, and the plug in the port under it. */
const PHONE = { height: 80, radius: 8, width: 40, x: 186, y: 42 };
const SCREEN_INSET = 2.5;
const ISLAND = { height: 3, top: 3.5, width: 10 };
const PHONE_PLUG = { height: 6, width: 5 };
/** The cable: out of the laptop's side, sagging under the phone, and up into its port. */
const CABLE = 'M156 110.5 C174 110.5 170 152 188 152 C202 152 206 144 206 129';
/** The lit screen's glow, faint enough that the island still reads on it. */
const GLOW = 0.12;

/** Once the phone is lit, its glow breathes, and nothing else moves. */
const breathe = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0.5 },
});

const styles = create({
  // The screen and the island, a step fainter than the bodies.
  faint: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeWidth: 1,
  },
  glow: {
    fill: accent.base,
  },
  glowIdle: {
    animationDirection: 'alternate',
    animationDuration: '1.8s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: breathe,
    },
    animationTimingFunction: 'ease-in-out',
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 280,
    overflow: 'visible',
    width: '100%',
  },
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  screenLit: {
    fill: 'none',
    stroke: accent.base,
    strokeWidth: 1,
  },
});

/**
 * A laptop and an iPhone side by side, and the cable between them: it draws
 * itself out of the laptop and into the phone, a small orange pulse runs down
 * it, and the phone's screen lights. The Mac app on the laptop waits for the
 * iPhone and shows its card once the phone is lit. It plays once each time `play` turns on
 * and stands unplugged while it is off. With less motion it stands lit.
 */
export function PlugGraphic({
  play,
  ref,
}: {
  play: boolean;
  ref?: Ref<SVGSVGElement> | undefined;
}) {
  const at = usePlayhead(play, drawing.stepPlug);
  const macPlug = stretch(at, 0, 0.08);
  // Whatever runs along the cable eases in as well as out, so it is seen to
  // travel the whole way rather than leap most of it at once.
  const drawn = stretch(at, 0.04, 0.4, easeInOut);
  const phonePlug = stretch(at, 0.34, 0.44);
  const travel = stretch(at, 0.44, 0.76, easeInOut);
  const lit = stretch(at, 0.72, 1);
  const screen = {
    height: PHONE.height - 2 * SCREEN_INSET,
    radius: PHONE.radius - SCREEN_INSET,
    width: PHONE.width - 2 * SCREEN_INSET,
    x: PHONE.x + SCREEN_INSET,
    y: PHONE.y + SCREEN_INSET,
  };
  const port = PHONE.x + PHONE.width / 2;

  return (
    <svg aria-hidden="true" ref={ref} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      <Laptop plugged={macPlug}>
        <MacApp found={lit} screen="connect" />
      </Laptop>
      <rect
        height={PHONE.height}
        rx={PHONE.radius}
        width={PHONE.width}
        x={PHONE.x}
        y={PHONE.y}
        {...props(styles.line)}
      />
      <g opacity={lit} {...props(styles.glow, at >= 1 && styles.glowIdle)}>
        <rect
          fillOpacity={GLOW}
          height={screen.height}
          rx={screen.radius}
          width={screen.width}
          x={screen.x}
          y={screen.y}
        />
      </g>
      <rect
        height={screen.height}
        rx={screen.radius}
        width={screen.width}
        x={screen.x}
        y={screen.y}
        {...props(styles.faint)}
      />
      <rect
        height={screen.height}
        opacity={lit}
        rx={screen.radius}
        width={screen.width}
        x={screen.x}
        y={screen.y}
        {...props(styles.screenLit)}
      />
      <rect
        height={ISLAND.height}
        rx={ISLAND.height / 2}
        width={ISLAND.width}
        x={port - ISLAND.width / 2}
        y={screen.y + ISLAND.top}
        {...props(styles.faint)}
      />
      <rect
        height={PHONE_PLUG.height}
        opacity={phonePlug}
        rx={1}
        width={PHONE_PLUG.width}
        x={port - PHONE_PLUG.width / 2}
        y={PHONE.y + PHONE.height + 1}
        {...props(styles.line)}
      />
      <Cable d={CABLE} drawn={drawn} travel={travel} />
    </svg>
  );
}
