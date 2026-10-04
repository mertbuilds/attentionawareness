import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, defaultMarker, props, when } from '@stylexjs/stylex';
import { postDay } from '../lib/blog.ts';
import type { PostMeta } from '../lib/blog.ts';
import { duration, easing } from '../lib/motion.stylex.ts';
import { ink } from '../lib/reading.stylex.ts';
import { m } from '../paraglide/messages.js';
import { card } from './page.tsx';

const styles = create({
  arrow: {
    color: accent.base,
    flexShrink: 0,
    transform: {
      default: null,
      [when.ancestor(':hover')]: {
        '@media (hover: hover)': 'translateX(3px)',
        default: null,
      },
    },
    transitionDuration: duration.quick,
    transitionProperty: 'transform',
    transitionTimingFunction: easing.smoothOut,
  },
  description: {
    color: ink.lead,
    fontSize: font.sizeMd,
    lineHeight: 1.55,
    margin: 0,
    textWrap: 'pretty',
  },
  foot: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    gap: spacing.s2,
    justifyContent: 'space-between',
    marginBlockStart: 'auto',
    paddingBlockStart: spacing.s2,
  },
  // The whole card is the link, so a thumb anywhere on it opens the post.
  link: {
    borderColor: {
      ':hover': {
        '@media (hover: hover)': `color-mix(in srgb, ${colors.fg} 35%, ${colors.bg})`,
        default: null,
      },
      default: colors.border,
    },
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    height: '100%',
    outlineColor: accent.soft,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    textDecoration: 'none',
    transitionDuration: duration.quick,
    transitionProperty: 'border-color',
    transitionTimingFunction: easing.smoothOut,
  },
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
    margin: 0,
    textWrap: 'balance',
  },
});

/**
 * One post as a card: its title, what it is about, its day and how long it
 * takes to read. It names the post in the heading level the list asks for.
 */
export function PostCard({
  heading: Heading = 'h2',
  post,
}: {
  heading?: 'h2' | 'h3';
  post: PostMeta;
}) {
  return (
    <a data-plain="" href={`/blog/${post.slug}`} {...props(card, styles.link, defaultMarker())}>
      <Heading {...props(styles.title)}>{post.heading}</Heading>
      <p {...props(styles.description)}>{post.description}</p>
      <span {...props(styles.foot)}>
        <span>
          <time dateTime={post.date}>{postDay(post.date)}</time>
          {' · '}
          {m.blog_minutes({ minutes: post.minutes })}
        </span>
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          viewBox="0 0 16 16"
          width="16"
          {...props(styles.arrow)}
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </span>
    </a>
  );
}
