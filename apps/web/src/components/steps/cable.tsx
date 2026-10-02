import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/**
 * The pulse, as shares of the cable: a short bright head and the fainter
 * trail behind it.
 */
const PULSE_HEAD = 0.02;
const PULSE_TRAIL = 0.18;

const styles = create({
  cable: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1.2,
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
});

/**
 * The cable from the Mac to the iPhone along `d`, drawn from the Mac's end as
 * far as `drawn`, and a small orange pulse that runs its length as `travel`
 * goes from 0 to 1.
 */
export function Cable({ d, drawn, travel }: { d: string; drawn: number; travel: number }) {
  const head = travel * (1 + PULSE_TRAIL);
  return (
    <>
      {drawn > 0 ? (
        <path
          d={d}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - drawn}
          {...props(styles.cable)}
        />
      ) : null}
      {travel > 0 && travel < 1 ? (
        <>
          <path
            d={d}
            pathLength={1}
            strokeDasharray={`${PULSE_TRAIL} 2`}
            strokeDashoffset={PULSE_TRAIL - head}
            {...props(styles.pulse, styles.pulseTrail)}
          />
          <path
            d={d}
            pathLength={1}
            strokeDasharray={`${PULSE_HEAD} 2`}
            strokeDashoffset={PULSE_HEAD - head}
            {...props(styles.pulse, styles.pulseHead)}
          />
        </>
      ) : null}
    </>
  );
}
