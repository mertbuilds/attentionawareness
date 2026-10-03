import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/** The laptop's lid, and its display a bezel inside it. */
const LID = { height: 74, radius: 5, width: 112, x: 26, y: 34 };
const DISPLAY_INSET = 4;
/** The slab the lid stands on, a little wider than the lid, with the notch a thumb opens it by. */
const BASE =
  'M14 108 H150 V110.5 Q150 113 147.5 113 H16.5 Q14 113 14 110.5 Z M74 108 Q74 110 76 110 H88 Q90 110 90 108';
/** The plug in the side of the laptop, the cable leaving from its outer end. */
export const MAC_PLUG = { height: 3, width: 6, x: 150, y: 109 };

const styles = create({
  // The display, a step fainter than the body.
  faint: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeWidth: 1,
  },
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  // Filled with the page, so a drawing behind the laptop gives way to it.
  solid: {
    fill: colors.bg,
  },
});

/**
 * The Mac the steps draw, a laptop open on the desk, and the plug in its
 * side shown as far as `plugged`. A `solid` laptop hides what is drawn behind it.
 */
export function Laptop({ plugged, solid = false }: { plugged: number; solid?: boolean }) {
  return (
    <>
      <rect
        height={LID.height}
        rx={LID.radius}
        width={LID.width}
        x={LID.x}
        y={LID.y}
        {...props(styles.line, solid && styles.solid)}
      />
      <rect
        height={LID.height - 2 * DISPLAY_INSET}
        rx={LID.radius - DISPLAY_INSET}
        width={LID.width - 2 * DISPLAY_INSET}
        x={LID.x + DISPLAY_INSET}
        y={LID.y + DISPLAY_INSET}
        {...props(styles.faint)}
      />
      <path d={BASE} {...props(styles.line, solid && styles.solid)} />
      <rect
        height={MAC_PLUG.height}
        opacity={plugged}
        rx={1}
        width={MAC_PLUG.width}
        x={MAC_PLUG.x}
        y={MAC_PLUG.y}
        {...props(styles.line)}
      />
    </>
  );
}
