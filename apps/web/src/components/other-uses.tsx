import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useLayoutEffect, useRef, useState } from 'react';
import { Briefcase, EyeSlash, Grid, Users } from 'reicon-react';
import type { IconComponent } from 'reicon-react';
import { blur, distance, duration, easing } from '../lib/motion.stylex.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import { m } from '../paraglide/messages.js';

/** A card's icon, in pixels. */
const ICON = 20;
/**
 * How long the second card of a row waits after the first, in milliseconds,
 * the stagger the tiles of the uses keep.
 */
const STAGGER = 80;

/** A card rising into place, out of a blur, as a tile of the uses does. */
const rise = keyframes({
  from: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});

const styles = create({
  // Waits for a delay the card sets, by its place in its row.
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  body: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  // One case in a quiet box: its icon, its name, then what it means.
  card: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    minWidth: 0,
    padding: spacing.s4,
  },
  // Two to a row where both fit, one under the other on a phone.
  grid: {
    display: 'grid',
    gap: spacing.s3,
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(2, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // Below the fold once the page has come alive, a card waits out of sight
  // for its rise.
  hidden: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
  icon: {
    color: colors.muted,
    display: 'block',
    flexShrink: 0,
  },
  // The way to the post, at the foot of its card, level with its neighbour's.
  more: {
    marginBlockStart: 'auto',
  },
  rise: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: rise,
    animationTimingFunction: easing.smoothOut,
  },
  title: {
    fontSize: font.sizeMd,
    fontWeight: font.weightRegular,
    lineHeight: 1.5,
    margin: 0,
  },
});

/**
 * One thing the same setup blocks: its icon, its name and what it means, and
 * the blog post that shows how, by its slug.
 */
type Use = { body: () => string; Icon: IconComponent; post: string; title: () => string };

const USES: ReadonlyArray<Use> = [
  {
    body: m.home_other_adult_body,
    Icon: EyeSlash,
    post: 'block-adult-websites-iphone',
    title: m.home_other_adult_title,
  },
  {
    body: m.home_other_any_body,
    Icon: Grid,
    post: 'block-any-app-iphone',
    title: m.home_other_any_title,
  },
  {
    body: m.home_other_kids_body,
    Icon: Users,
    post: 'iphone-parental-controls-kids-cannot-turn-off',
    title: m.home_other_kids_title,
  },
  {
    body: m.home_other_work_body,
    Icon: Briefcase,
    post: 'work-iphones-without-mdm',
    title: m.home_other_work_title,
  },
];

/**
 * One card. The server draws it finished. Only a card still under the window
 * once the page has come alive hides, and rises once its top has come up the
 * window as far as `SEEN`, the second of a row `STAGGER` after the first. With
 * less motion it stands still.
 */
function UseCard({ place, use }: { place: number; use: Use }) {
  const card = useRef<HTMLLIElement>(null);
  const reduced = useLessMotion();
  const seen = useSeen(card, { once: true });
  // Whether the card was under the window as the page came alive.
  const [below, setBelow] = useState(false);

  // Measured once, before the page paints again: only a card wholly under the
  // window is hidden, where nobody sees it go.
  useLayoutEffect(() => {
    const top = card.current?.getBoundingClientRect().top;
    setBelow(top !== undefined && top > window.innerHeight);
  }, []);

  const rising = below && !reduced;
  const { Icon } = use;

  return (
    <li
      ref={card}
      {...props(
        styles.card,
        rising && (seen ? [styles.rise, styles.after((place % 2) * STAGGER)] : styles.hidden),
      )}
    >
      <Icon aria-hidden="true" size={ICON} {...props(styles.icon)} />
      <h3 {...props(styles.title)}>{use.title()}</h3>
      <p {...props(styles.body)}>{use.body()}</p>
      <p {...props(styles.body, styles.more)}>
        <a
          aria-label={m.home_other_read_how_label({ title: use.title() })}
          href={`/blog/${use.post}`}
        >
          {m.home_other_read_how()}
        </a>
      </p>
    </li>
  );
}

/**
 * What else the same setup blocks, past the feeds: Apple's adult website
 * filter, any app or website, a child's iPhone and a work iPhone, each a
 * quiet card, with a link to the post that shows how.
 */
export function OtherUses() {
  return (
    <ul {...props(styles.grid)}>
      {USES.map((use, place) => (
        <UseCard key={use.title()} place={place} use={use} />
      ))}
    </ul>
  );
}
