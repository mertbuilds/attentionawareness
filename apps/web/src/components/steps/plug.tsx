import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { easeInOut } from 'motion/react';
import { drawing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';
import { stretch, usePlayhead } from './playhead.ts';

/** The laptop's lid, and its display a bezel inside it. */
const LID = { height: 74, radius: 5, width: 112, x: 26, y: 34 };
const DISPLAY_INSET = 4;
/** The slab the lid stands on, a little wider than the lid, with the notch a thumb opens it by. */
const BASE =
  'M14 108 H150 V110.5 Q150 113 147.5 113 H16.5 Q14 113 14 110.5 Z M74 108 Q74 110 76 110 H88 Q90 110 90 108';
/** The phone beside it, its screen and island, and the plug in the port under it. */
const PHONE = { height: 80, radius: 8, width: 40, x: 186, y: 42 };
const SCREEN_INSET = 2.5;
const ISLAND = { height: 3, top: 3.5, width: 10 };
const PHONE_PLUG = { height: 6, width: 5 };
/** The plug in the side of the laptop. */
const MAC_PLUG = { height: 3, width: 6, x: 150, y: 109 };
/** The cable: out of the laptop's side, sagging under the phone, and up into its port. */
const CABLE = 'M156 110.5 C174 110.5 170 152 188 152 C202 152 206 144 206 129';
/**
 * The pulse, as shares of the cable: a short bright head and the fainter
 * trail behind it.
 */
const PULSE_HEAD = 0.02;
const PULSE_TRAIL = 0.18;
/** The lit screen's glow, faint enough that the island still reads on it. */
const GLOW = 0.12;

/** Once the phone is lit, its glow breathes, and nothing else moves. */
const breathe = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0.5 },
});

const styles = create({
  cable: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1.2,
  },
  // The display, the screen and the island, a step fainter than the bodies.
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
  pulse: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
  },
  pulseHead: {
    strokeWidth: 3.2,
  },
  pulseTrail: {
    strokeOpacity: 0.5,
    strokeWidth: 1.6,
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
 * it, and the phone's screen lights. It plays once each time `play` turns on
 * and stands unplugged while it is off. With less motion it stands lit.
 */
export function PlugGraphic({ play }: { play: boolean }) {
  const at = usePlayhead(play, drawing.stepPlug);
  const macPlug = stretch(at, 0, 0.08);
  // Whatever runs along the cable eases in as well as out, so it is seen to
  // travel the whole way rather than leap most of it at once.
  const drawn = stretch(at, 0.04, 0.4, easeInOut);
  const phonePlug = stretch(at, 0.34, 0.44);
  const travel = stretch(at, 0.44, 0.76, easeInOut);
  const head = travel * (1 + PULSE_TRAIL);
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
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      <rect
        height={LID.height}
        rx={LID.radius}
        width={LID.width}
        x={LID.x}
        y={LID.y}
        {...props(styles.line)}
      />
      <rect
        height={LID.height - 2 * DISPLAY_INSET}
        rx={LID.radius - DISPLAY_INSET}
        width={LID.width - 2 * DISPLAY_INSET}
        x={LID.x + DISPLAY_INSET}
        y={LID.y + DISPLAY_INSET}
        {...props(styles.faint)}
      />
      <path d={BASE} {...props(styles.line)} />
      <rect
        height={MAC_PLUG.height}
        opacity={macPlug}
        rx={1}
        width={MAC_PLUG.width}
        x={MAC_PLUG.x}
        y={MAC_PLUG.y}
        {...props(styles.line)}
      />
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
      {drawn > 0 ? (
        <path
          d={CABLE}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - drawn}
          {...props(styles.cable)}
        />
      ) : null}
      {travel > 0 && travel < 1 ? (
        <>
          <path
            d={CABLE}
            pathLength={1}
            strokeDasharray={`${PULSE_TRAIL} 2`}
            strokeDashoffset={PULSE_TRAIL - head}
            {...props(styles.pulse, styles.pulseTrail)}
          />
          <path
            d={CABLE}
            pathLength={1}
            strokeDasharray={`${PULSE_HEAD} 2`}
            strokeDashoffset={PULSE_HEAD - head}
            {...props(styles.pulse, styles.pulseHead)}
          />
        </>
      ) : null}
    </svg>
  );
}
