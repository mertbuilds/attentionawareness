import { colors, font } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';

/**
 * What the App Store knows about one blocked app. The config stores only a
 * bundle id and a name, so artwork and developer are fetched and cached here:
 * `undefined` is still loading, `null` is a storefront that has no such app.
 */
export type AppMeta = { developer: string; iconUrl: string };
export type MetaCache = Record<string, AppMeta | null>;

const styles = create({
  artwork: {
    borderColor: colors.border,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'block',
    flexShrink: 0,
    objectFit: 'cover',
  },
  artworkInitials: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    justifyContent: 'center',
    letterSpacing: '0.02em',
    lineHeight: 1,
  },
  artworkPending: {
    backgroundColor: colors.border,
  },
});

/** Stand-in artwork for an app the App Store did not answer for. */
function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

/** Apple's own icon, a neutral tile while it loads, initials when it never comes. */
export function AppArtwork({
  meta,
  name,
  style,
}: {
  meta: AppMeta | null | undefined;
  name: string;
  style: StyleXStyles;
}) {
  if (meta === undefined) {
    return <span {...props(styles.artwork, styles.artworkPending, style)} />;
  }
  if (meta === null || meta.iconUrl === '') {
    return <span {...props(styles.artwork, styles.artworkInitials, style)}>{initials(name)}</span>;
  }
  return <img alt={name} src={meta.iconUrl} {...props(styles.artwork, style)} />;
}

export { styles as artworkStyles };
