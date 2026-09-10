'use client';

import type { Button as ButtonPrimitive } from '@base-ui/react/button';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  base: {
    // Single size: 28px pill. The ::before pseudo-element extends the hit
    // area to ~40px (make-interfaces-feel-better minimum) without visual bulk.
    '::before': {
      content: '',
      inset: '-6px',
      position: 'absolute',
    },
    ':is(svg)': {
      flexShrink: 0,
      height: '1rem',
      pointerEvents: 'none',
      width: '1rem',
    },
    alignItems: 'center',
    backgroundClip: 'padding-box',
    borderRadius: radius.full,
    borderStyle: 'none',
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 3px color-mix(in oklab, ${colors.ring} 50%, transparent)`,
      default: null,
    },
    cursor: {
      ':disabled': 'not-allowed',
      default: 'pointer',
    },
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: '0.8rem',
    fontWeight: 500,
    gap: '0.25rem',
    height: '1.75rem',
    justifyContent: 'center',
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    outline: 'none',
    paddingInline: '0.875rem',
    pointerEvents: {
      ':disabled': 'none',
      default: null,
    },
    position: 'relative',
    // Buttons often render as <a> via the `render` prop — kill the anchor underline.
    textDecorationLine: 'none',
    // Tactile press feedback: 0.96 per interface-polish rules; CSS transition
    // stays interruptible mid-animation.
    scale: {
      ':active': '0.96',
      default: '1',
    },
    transitionDuration: '150ms',
    // Never `all` — list only what actually animates.
    transitionProperty: 'scale, background-color, border-color, color, box-shadow, opacity',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  default: {
    backgroundColor: {
      ':hover': `color-mix(in oklab, ${colors.primary} 80%, transparent)`,
      default: colors.primary,
    },
    color: colors.primaryForeground,
  },
  destructive: {
    backgroundColor: {
      ':hover': `color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
      ':is(.dark, .dark *)': `color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
      ':is(.dark, .dark *):hover': `color-mix(in oklab, ${colors.destructive} 30%, transparent)`,
      default: `color-mix(in oklab, ${colors.destructive} 10%, transparent)`,
    },
    boxShadow: {
      ':focus-visible': `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
      ':is(.dark, .dark *):focus-visible': `0 0 0 3px color-mix(in oklab, ${colors.destructive} 40%, transparent)`,
      default: null,
    },
    color: colors.destructive,
  },
  ghost: {
    backgroundColor: {
      ':hover': colors.muted,
      ':is(.dark, .dark *):hover': `color-mix(in oklab, ${colors.muted} 50%, transparent)`,
      default: 'transparent',
    },
    color: {
      ':hover': colors.foreground,
      default: 'inherit',
    },
  },
  link: {
    backgroundColor: 'transparent',
    color: colors.primary,
    textDecorationLine: {
      ':hover': 'underline',
      default: 'none',
    },
    textUnderlineOffset: '4px',
  },
  outline: {
    backgroundColor: {
      ':hover': colors.muted,
      ':is(.dark, .dark *)': `color-mix(in oklab, ${colors.input} 30%, transparent)`,
      ':is(.dark, .dark *):hover': `color-mix(in oklab, ${colors.input} 50%, transparent)`,
      default: colors.background,
    },
    borderColor: {
      ':is(.dark, .dark *)': colors.input,
      default: colors.border,
    },
    borderStyle: 'solid',
    borderWidth: '1px',
    color: {
      ':hover': colors.foreground,
      default: 'inherit',
    },
  },
  secondary: {
    backgroundColor: {
      ':hover': `color-mix(in oklch, ${colors.secondary}, ${colors.foreground} 5%)`,
      default: colors.secondary,
    },
    color: colors.secondaryForeground,
  },
});

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

const variantStyles: Record<ButtonVariant, StyleXStyles> = {
  default: styles.default,
  destructive: styles.destructive,
  ghost: styles.ghost,
  link: styles.link,
  outline: styles.outline,
  secondary: styles.secondary,
};

export type ButtonProps = Omit<ButtonPrimitive.Props, 'style'> & {
  className?: string;
  style?: StyleXStyles;
  variant?: ButtonVariant;
};

const Button = ({ className, render, style, variant = 'default', ...restProps }: ButtonProps) => {
  const styleProps = stylexProps(
    styles.base,
    variantStyles[variant],
    customClassName(className),
    style,
  );

  return useRender({
    defaultTagName: 'button',
    props: mergeProps(
      {
        className: styleProps.className,
        'data-slot': 'button',
        'data-variant': variant,
        style: styleProps.style,
      },
      restProps,
    ),
    render,
    state: {
      disabled: restProps.disabled ?? false,
      slot: 'button' as const,
      variant,
    },
  });
};

export { Button, styles as buttonStyles };
