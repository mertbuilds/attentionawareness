import { defineVars } from '@stylexjs/stylex';

const DARK = '@media (prefers-color-scheme: dark)';

/**
 * Raw palette. Black, white, and three grays. Do not use these directly in
 * components — use the semantic `colors` vars below so dark mode keeps working.
 */
export const palette = defineVars({
  black: '#000000',
  gray300: '#d4d4d4',
  gray500: '#8a8a8a',
  gray700: '#3f3f3f',
  white: '#ffffff',
});

/** Semantic colors. Flip automatically with the system color scheme. */
export const colors = defineVars({
  bg: { [DARK]: '#000000', default: '#ffffff' },
  border: { [DARK]: '#3f3f3f', default: '#d4d4d4' },
  disabled: { [DARK]: '#8a8a8a', default: '#8a8a8a' },
  error: { [DARK]: '#f87171', default: '#dc2626' },
  fg: { [DARK]: '#ffffff', default: '#000000' },
  muted: { [DARK]: '#8a8a8a', default: '#8a8a8a' },
  warning: { [DARK]: '#fbbf24', default: '#d97706' },
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
  family: "'Suisse Intl', 'Inter Variable', system-ui, sans-serif",
  sizeLg: '20px',
  sizeMd: '16px',
  sizeSm: '14px',
  weightBold: '700',
  weightMedium: '500',
  weightRegular: '400',
});
