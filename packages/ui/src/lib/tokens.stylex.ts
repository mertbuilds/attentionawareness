import { defineConsts } from '@stylexjs/stylex';

/**
 * Design tokens for the shadcn-cssinjs component set (src/ui).
 *
 * Each token wraps a CSS custom property defined in `src/theme.css`. Theming
 * is driven by those variables (light defaults, dark via
 * `prefers-color-scheme`), so components reference `colors.primary` /
 * `radius.md` instead of stringly-typed `var(--primary)`.
 *
 * App-level layout tokens (spacing, font, raw palette) live in
 * `src/tokens.stylex.ts` — this file is component-internal.
 */
export const colors = defineConsts({
  accent: 'var(--accent)',
  accentForeground: 'var(--accent-foreground)',
  background: 'var(--background)',
  border: 'var(--border)',
  card: 'var(--card)',
  cardForeground: 'var(--card-foreground)',
  destructive: 'var(--destructive)',
  foreground: 'var(--foreground)',
  input: 'var(--input)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  popover: 'var(--popover)',
  popoverForeground: 'var(--popover-foreground)',
  primary: 'var(--primary)',
  primaryForeground: 'var(--primary-foreground)',
  ring: 'var(--ring)',
  secondary: 'var(--secondary)',
  secondaryForeground: 'var(--secondary-foreground)',
  sidebar: 'var(--sidebar)',
  sidebarAccent: 'var(--sidebar-accent)',
  sidebarAccentForeground: 'var(--sidebar-accent-foreground)',
  sidebarBorder: 'var(--sidebar-border)',
  sidebarForeground: 'var(--sidebar-foreground)',
  sidebarPrimary: 'var(--sidebar-primary)',
  sidebarPrimaryForeground: 'var(--sidebar-primary-foreground)',
  sidebarRing: 'var(--sidebar-ring)',
});

/**
 * Radius scale, pinned: surfaces (cards/dialogs/popovers) use 8px
 * (`--radius: 8px`); controls (buttons/inputs/select triggers) use `full`
 * (pill). sm/md/lg all resolve to the surface radius so registry components
 * render 4px corners regardless of which step they reference; only pill
 * shapes (`full`) diverge.
 */
export const radius = defineConsts({
  '2xl': 'var(--radius)',
  full: '9999px',
  lg: 'var(--radius)',
  md: 'var(--radius)',
  sm: 'var(--radius)',
  xl: 'var(--radius)',
});
