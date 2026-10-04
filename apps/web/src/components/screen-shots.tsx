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
  /**
   * The picture is what is on the card, with room around it in the card's own
   * colour right to its edges (`scripts/pad-proof-shots.sh`), so the frame
   * shows all of it.
   */
  padded?: boolean;
  src: string;
  width: number;
};

/**
 * No shot stands taller than this, in pixels, side by side or one under the
 * other, so one shot alone stays a picture in the prose rather than a wall.
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
  // A squircle window onto the card, at the same shape for every shot.
  frame: {
    borderColor: colors.border,
    borderRadius: 32,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    cornerShape: 'squircle',
    overflow: 'hidden',
  },
  // No wider than the shot is at `MAX_HEIGHT`, so one under the other it
  // stops growing at that height and stands in the middle of the column. Side
  // by side its column is never wider, so the row is unchanged.
  frameFit: (maxWidth: number) => ({
    justifySelf: 'center',
    maxWidth,
    width: '100%',
  }),
  shot: {
    display: 'block',
    height: 'auto',
    width: '100%',
  },
  // A picture that still has the phone's margin and the card's corners in it
  // is zoomed past them.
  shotZoomed: {
    transform: 'scale(1.06)',
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
          <div
            key={shot.src}
            {...props(styles.frame, styles.frameFit((MAX_HEIGHT * shot.width) / shot.height))}
          >
            <img
              alt={shot.alt}
              decoding="async"
              height={shot.height}
              loading="lazy"
              src={shot.src}
              width={shot.width}
              {...props(styles.shot, shot.padded !== true && styles.shotZoomed)}
            />
          </div>
        ))}
      </div>
      {caption === undefined ? null : <figcaption {...props(styles.caption)}>{caption}</figcaption>}
    </figure>
  );
}
