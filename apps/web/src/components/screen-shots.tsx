import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/**
 * One real screenshot, cropped to the card itself, so no name, device, status
 * bar or app list is in the picture. Another one is a file in `public/media/`
 * and a line in the list it stands in.
 */
export type Shot = {
  alt: string;
  height: number;
  src: string;
  width: number;
};

/**
 * No row of shots stands taller than this, in pixels, so one shot alone stays
 * a picture in the prose rather than a wall.
 */
const MAX_HEIGHT = 320;
/** The gap between two shots, in pixels: `spacing.s3`. */
const GAP = 12;

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
  // Side by side once there is room, one under the other before. Side by
  // side, each column is as wide as its shot is for its height, so every
  // frame in the row stands exactly as tall as the others: none is cropped,
  // stretched or padded out.
  row: {
    alignItems: 'start',
    display: 'grid',
    gap: spacing.s3,
    marginInline: 'auto',
    width: '100%',
  },
  rowFit: (columns: string, maxWidth: number) => ({
    gridTemplateColumns: {
      '@media (min-width: 560px)': columns,
      default: 'minmax(0, 1fr)',
    },
    maxWidth,
  }),
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
 * A row of screenshots, with an optional line under them. Loaded lazily, and
 * sized up front so the prose does not jump when they land.
 */
export function ScreenShots({ caption, shots }: { caption?: string; shots: ReadonlyArray<Shot> }) {
  // Each shot's width for its height, the share of the row it takes.
  const ratios = shots.map((shot) => shot.width / shot.height);
  const columns = ratios.map((ratio) => `minmax(0, ${ratio}fr)`).join(' ');
  const widest = MAX_HEIGHT * ratios.reduce((sum, ratio) => sum + ratio, 0);
  return (
    <figure {...props(styles.figure)}>
      <div {...props(styles.row, styles.rowFit(columns, widest + GAP * (shots.length - 1)))}>
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
