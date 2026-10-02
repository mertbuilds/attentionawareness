import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/**
 * One real Screen Time card: a screenshot cropped to the card itself, so no
 * name, device, status bar or app list is in the picture. Another one is a
 * file in `public/media/` and a line in the story's list.
 */
export type Shot = {
  alt: string;
  height: number;
  src: string;
  width: number;
};

const styles = create({
  caption: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    textAlign: 'center',
    textWrap: 'balance',
  },
  figure: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    margin: 0,
  },
  // Side by side once two fit, one under the other before. Cards of
  // different heights stand on the same top line.
  row: {
    alignItems: 'start',
    display: 'grid',
    gap: spacing.s3,
    gridTemplateColumns: {
      '@media (min-width: 560px)': 'repeat(2, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
  },
  // The phone's own card corners, clipped round so a light card's square
  // corners do not show on a dark page, and the other way around.
  shot: {
    borderColor: colors.border,
    borderRadius: 16,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'block',
    height: 'auto',
    width: '100%',
  },
});

/**
 * A row of Screen Time cards in the story, with an optional line under them.
 * Loaded lazily, and sized up front so the prose does not jump when they land.
 */
export function ScreenShots({ caption, shots }: { caption?: string; shots: ReadonlyArray<Shot> }) {
  return (
    <figure {...props(styles.figure)}>
      <div {...props(styles.row)}>
        {shots.map((shot) => (
          <img
            alt={shot.alt}
            decoding="async"
            height={shot.height}
            key={shot.src}
            loading="lazy"
            src={shot.src}
            width={shot.width}
            {...props(styles.shot)}
          />
        ))}
      </div>
      {caption === undefined ? null : <figcaption {...props(styles.caption)}>{caption}</figcaption>}
    </figure>
  );
}
