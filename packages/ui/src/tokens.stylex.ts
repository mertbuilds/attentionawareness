import { defineConsts, defineVars } from '@stylexjs/stylex';

/**
 * Raw palette: white, for what stays white in both themes. Do not use it for
 * anything that should follow the theme: use the semantic `colors` below so
 * dark mode keeps working.
 */
export const palette = defineVars({
  white: '#ffffff',
});

/**
 * Semantic colors. Each wraps a CSS custom property defined in `src/theme.css`,
 * the same way the component tokens in `src/lib/tokens.stylex.ts` do: the theme
 * is switched by a `data-theme` attribute on `<html>` (absent = follow the
 * system), which StyleX variables cannot key on.
 */
export const colors = defineConsts({
  bg: 'var(--kya-bg)',
  border: 'var(--kya-border)',
  error: 'var(--kya-error)',
  fg: 'var(--kya-fg)',
  muted: 'var(--kya-muted)',
});

/** Single radius token. 4px everywhere. */
export const radius = defineVars({
  base: '4px',
});

/** 4px spacing scale. */
export const spacing = defineVars({
  s1: '4px',
  s12: '48px',
  s16: '64px',
  s2: '8px',
  s3: '12px',
  s4: '16px',
  s6: '24px',
  s8: '32px',
});

export const font = defineVars({
  family: "'Suisse Intl', 'Suisse Intl Fallback', 'Inter Variable', system-ui, sans-serif",
  sizeLg: '20px',
  sizeMd: '16px',
  sizeSm: '14px',
  weightMedium: '500',
  weightRegular: '400',
});
