import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/**
 * One real screenshot, cropped to the card itself, so no name, device, status
 * bar or app list is in the picture. Another one is a file in `public/media/`
 * and a line in the list it stands in. One that is not in yet takes a `todo`
 * note instead of its `src`, and a marked box its size stands in for it.
 */
export type Shot = {
  alt: string;
  height: number;
  width: number;
} & ({ src: string } | { todo: string });

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
  // The odd card out on a row of two stands in the middle of it, at the width
  // of one, over the line under the row.
  lone: {
    gridColumn: {
      '@media (min-width: 560px)': '1 / -1',
      default: null,
    },
    justifySelf: {
      '@media (min-width: 560px)': 'center',
      default: null,
    },
    width: {
      '@media (min-width: 560px)': `calc((100% - ${spacing.s3}) / 2)`,
      default: null,
    },
  },
  // A shot that is not in yet: the frame's shape, dashed, at the shot's own
  // size, with what goes there and the note that it is missing.
  placeholder: {
    alignItems: 'center',
    borderColor: colors.muted,
    borderRadius: 32,
    borderStyle: 'dashed',
    borderWidth: 1,
    boxSizing: 'border-box',
    cornerShape: 'squircle',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    justifyContent: 'center',
    lineHeight: 1.5,
    padding: spacing.s6,
    textAlign: 'center',
    textWrap: 'balance',
  },
  placeholderSize: (width: number, height: number) => ({
    aspectRatio: `${width} / ${height}`,
  }),
  placeholderTodo: {
    color: colors.muted,
    fontSize: font.sizeSm,
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
  return (
    <figure {...props(styles.figure)}>
      <div {...props(styles.row)}>
        {shots.map((shot, index) => {
          const lone = shots.length % 2 === 1 && index === shots.length - 1;
          return 'src' in shot ? (
            <div key={shot.src} {...props(styles.frame, lone && styles.lone)}>
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
          ) : (
            <div
              key={shot.alt}
              {...props(
                styles.placeholder,
                styles.placeholderSize(shot.width, shot.height),
                lone && styles.lone,
              )}
            >
              <span>{shot.alt}</span>
              <span {...props(styles.placeholderTodo)}>{shot.todo}</span>
            </div>
          );
        })}
      </div>
      {caption === undefined ? null : <figcaption {...props(styles.caption)}>{caption}</figcaption>}
    </figure>
  );
}
