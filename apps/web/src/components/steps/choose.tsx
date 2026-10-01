import { accent } from '@attentionawareness/ui/accent.stylex';
import { create, props } from '@stylexjs/stylex';
import { drawing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';
import { APPS, AppSquare, ICON, PhoneFrame } from './phone.tsx';
import { stretch, usePlayhead } from './playhead.ts';

/** The apps chosen, by their place on the home screen, in the order they are picked. */
const PICKS = [2, 4, 11, 13];
/** When the first is picked, and how long after it each next one is. */
const FIRST = 0.06;
const NEXT = 0.22;
/** A chosen app steps back to this, under its cross. */
const CHOSEN_OPACITY = 0.3;
/** How far the cross reaches past the square's corners. */
const OVER = 2;
/** The ring a pick sends out, from the square's edge to this far out. */
const TAP_FROM = ICON / 2;
const TAP_TO = ICON + 1;
const TAP_OPACITY = 0.5;

const REACH = ICON / 2 + OVER;
const STROKES = [
  `M${-REACH} ${-REACH} L${REACH} ${REACH}`,
  `M${REACH} ${-REACH} L${-REACH} ${REACH}`,
];

const styles = create({
  cross: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 280,
    overflow: 'visible',
    width: '100%',
  },
  tap: {
    fill: 'none',
    stroke: accent.base,
    strokeWidth: 1,
  },
});

/** Where pick `order` is in its turn: the tap, each stroke of the cross, and the square stepping back. */
function pickAt(at: number, order: number) {
  const start = FIRST + order * NEXT;
  return {
    chosen: stretch(at, start + 0.06, start + 0.2),
    strokes: [stretch(at, start + 0.05, start + 0.17), stretch(at, start + 0.11, start + 0.23)],
    tap: stretch(at, start, start + 0.14),
  };
}

/**
 * An iPhone's home screen, and a few of its apps crossed out in orange one
 * after another, a tap and then a cross the way a hand would, while the rest
 * stay as they are. It plays once each time `play` turns on and stands with
 * nothing chosen while it is off. With less motion it stands chosen.
 */
export function ChooseGraphic({ play }: { play: boolean }) {
  const at = usePlayhead(play, drawing.stepChoose);
  const picks = new Map(PICKS.map((app, order) => [app, pickAt(at, order)]));

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      <PhoneFrame />
      {APPS.map((app, index) => {
        const pick = picks.get(index);
        return (
          <g
            key={index}
            opacity={pick === undefined ? 1 : 1 - (1 - CHOSEN_OPACITY) * pick.chosen}
            transform={`translate(${app.x} ${app.y})`}
          >
            <AppSquare />
          </g>
        );
      })}
      {PICKS.map((index) => {
        const app = APPS[index];
        const pick = picks.get(index);
        if (app === undefined || pick === undefined) {
          return null;
        }
        return (
          <g key={index} transform={`translate(${app.x} ${app.y})`}>
            {pick.tap > 0 && pick.tap < 1 ? (
              <circle
                opacity={TAP_OPACITY * (1 - pick.tap)}
                r={TAP_FROM + (TAP_TO - TAP_FROM) * pick.tap}
                {...props(styles.tap)}
              />
            ) : null}
            {STROKES.map((stroke, order) => {
              const drawn = pick.strokes[order] ?? 0;
              return drawn > 0 ? (
                <path
                  d={stroke}
                  key={order}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - drawn}
                  {...props(styles.cross)}
                />
              ) : null;
            })}
          </g>
        );
      })}
    </svg>
  );
}
