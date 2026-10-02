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
  // A squircle window onto the card, zoomed past the phone's own margin and
  // corners so only the card itself shows, at the same shape for every shot.
  frame: {
    borderColor: colors.border,
    borderRadius: 32,
    borderStyle: 'solid',
    borderWidth: 1,
    cornerShape: 'squircle',
    overflow: 'hidden',
  },
  shot: {
    display: 'block',
    height: 'auto',
    transform: 'scale(1.06)',
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
          <div key={shot.src} {...props(styles.frame)}>
            <img
              alt={shot.alt}
              decoding="async"
              height={shot.height}
              loading="lazy"
              src={shot.src}
              width={shot.width}
              {...props(styles.shot)}
            />
          </div>
        ))}
      </div>
      {caption === undefined ? null : <figcaption {...props(styles.caption)}>{caption}</figcaption>}
    </figure>
  );
}
