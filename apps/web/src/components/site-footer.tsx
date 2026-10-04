import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { usePostHog } from '@posthog/react';
import { create, defaultMarker, firstThatWorks, keyframes, props, when } from '@stylexjs/stylex';
import { useLocation } from '@tanstack/react-router';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Heart, Star } from 'reicon-react';
import { posts } from '../lib/blog.ts';
import { layout } from '../lib/layout.ts';
import { blur, distance, duration, easing } from '../lib/motion.stylex.ts';
import { SECTION } from '../lib/sections.ts';
import { supportUrl } from '../lib/support.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import { m } from '../paraglide/messages.js';
import { BrandMark } from './brand-mark.tsx';
import { GridTexture } from './grid-texture.tsx';
import { ThemeSwitch } from './preferences.tsx';

const BLOG_PATH = '/blog';
const GUIDE_PATH = '/guide';
const BUILD_PATH = '/build';
/** The one privacy page the site has: the browser extension's. */
const PRIVACY_PATH = '/extension/privacy';
/** Every link to one of Mert's own sites carries utm tags, so the visit is traced to this site. */
const BUILDER_URL =
  'https://mertbuilds.com/?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=footer';
/** Every link off this site carries utm tags, so the visit is traced to the footer. */
const STORE_URL =
  'https://chromewebstore.google.com/detail/attention-awareness/lgcijcijcndmggjiioibfcmppndfakee?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=footer';
const SUPPORT_URL = supportUrl('footer');
/** Where the site's and the extension's code is public. */
const REPO_URL = 'https://github.com/mertbuilds/attentionawareness';
/** What GitHub tells anyone about the repo, its stars among it. */
const REPO_API = 'https://api.github.com/repos/mertbuilds/attentionawareness';
/** Where the star count is kept for the rest of a tab's session. */
const STARS_KEY = 'aa-github-stars';
/** How far under the window the footer is when the star count is asked for. */
const STARS_MARGIN = '400px';
const STAR_COUNT = new Intl.NumberFormat('en-US');
/** The mark on the brand's line, as large as the header draws it. */
const MARK_SIZE = 24;
/** An icon before a link, as tall as the link's letters are set. */
const ICON_SIZE = 14;
/** A line as heavy as the letters beside it, in the icon's own 24-unit grid. */
const ICON_STROKE = 2.25;
/** GitHub's mark, as the one path it is drawn in, on its own 16-unit grid. */
const GITHUB_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z';
/**
 * Where a link stands inside a sentence. The message is written with the link
 * as a placeholder and split on it, so the words around it keep their own
 * order and spacing in every language instead of being stitched from pieces.
 */
const LINK_SLOT = '\u0000';
/**
 * The posts the footer names, each by a short name of its own. A post is
 * listed only once its file is in `content/blog/`, so a name written here
 * ahead of its post is left out instead of linking to a page that is not there.
 */
const POSTS = [
  { label: m.footer_post_dumbphone, slug: 'turn-iphone-into-dumbphone' },
  { label: m.footer_post_screen_time, slug: 'why-screen-time-does-not-work' },
  { label: m.footer_post_any_app, slug: 'block-any-app-iphone' },
  { label: m.footer_post_adult, slug: 'block-adult-websites-iphone' },
  { label: m.footer_post_parental, slug: 'iphone-parental-controls-kids-cannot-turn-off' },
  { label: m.footer_post_work, slug: 'work-iphones-without-mdm' },
] as const;
/**
 * The name set large across the foot of the page, in Suisse Intl Regular,
 * measured from the font's own outlines. `NAME_TRACKING` pulls its letters
 * together. At that tracking its ink is `NAME_WIDTH` ems wide from the first
 * letter's edge to the last's, and the first letter stands `NAME_BEARING` ems
 * inside its own box. The type size is the row's width over `NAME_WIDTH`, so
 * the name fills the row at every width.
 */
const NAME_TRACKING = -0.04;
const NAME_WIDTH = 8.663;
const NAME_BEARING = 0.038;
/**
 * How much of the name's line stands above the page's bottom edge, in ems.
 * The line is one em tall and its letters sit on a line 0.809 em down it,
 * 0.538 em tall, so this shows a little under six tenths of them and the
 * edge cuts the rest.
 */
const NAME_SHOWN = 0.58;
/**
 * The name's ink: a quiet share of the page's own, so it reads as a watermark
 * under the links and not as a title. It thins toward the page's edge, which
 * cuts it.
 */
const NAME_INK = `color-mix(in srgb, ${colors.fg} 28%, transparent)`;
const NAME_THINS = 'linear-gradient(to bottom, black 15%, rgb(0 0 0 / 0.3))';
/** The room the page shells leave under the footer, which the footer takes back. */
const PAGE_FOOT = spacing.s16;
/**
 * Ruled at the window's sides and clear in the middle, where the footer's words
 * stand. On a phone the words run nearly edge to edge, so the sides stay faint.
 */
const PAPER_SIDES = 'linear-gradient(to right, black, transparent 35%, transparent 65%, black)';
const PAPER_SIDES_NARROW =
  'linear-gradient(to right, rgb(0 0 0 / 0.4), transparent 25%, transparent 75%, rgb(0 0 0 / 0.4))';
/** The strip of paper at the foot of the page: six squares tall. */
const PAPER_HEIGHT = '240px';
/** No hard line where the paper starts: it comes in out of nothing at its top. */
const PAPER_TOP = 'linear-gradient(to bottom, transparent, black 144px)';

/** The name rising into place, out of a blur, as a tile of the uses does. */
const rise = keyframes({
  from: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});

const styles = create({
  // The mark, the name and what this is, then the way to the code.
  brand: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  // The mark and the name, the way home, as the header sets them.
  brandLink: {
    alignItems: 'center',
    color: colors.fg,
    display: 'inline-flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    gap: spacing.s2,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
  },
  // Four columns where the page's column is at its full width, two on a
  // tablet and one on a phone. The posts' names are the longest, so their
  // column is the widest.
  columns: {
    columnGap: spacing.s6,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 640px) and (max-width: 899px)': 'repeat(2, minmax(0, 1fr))',
      '@media (min-width: 900px)':
        'minmax(0, 1.25fr) minmax(0, 0.9fr) minmax(0, 1.35fr) minmax(0, 0.75fr)',
      default: 'minmax(0, 1fr)',
    },
    rowGap: spacing.s8,
  },
  // The star count after the ask, in figures that keep one width.
  count: {
    fontVariantNumeric: 'tabular-nums',
  },
  // Who made this. It gives way to the controls beside it and wraps, and on a
  // phone takes the row to itself.
  credit: {
    flexBasis: 280,
    flexGrow: 1,
    lineHeight: 1.5,
  },
  // The privacy page and the theme control, together at the row's far end.
  end: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: spacing.s4,
  },
  // The footer runs down to the page's own bottom edge: it takes back the
  // room every page shell leaves under it, and keeps the room the name stands
  // in instead, as tall as the name is shown, and a step of air over it.
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    marginBlockEnd: `calc(-1 * ${PAGE_FOOT})`,
    paddingBlockEnd: `calc((100vw - 2 * ${spacing.s4}) / ${NAME_WIDTH} * ${NAME_SHOWN} + ${spacing.s4})`,
  },
  // A column's name: in the ink, over links that are a step quieter. As tall
  // as the mark beside it, so the four columns start on one line.
  heading: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    lineHeight: `${MARK_SIZE}px`,
    margin: 0,
  },
  // Waits out of sight for its rise.
  hidden: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
  // The star before its link, and the box its filled twin is laid over. It
  // keeps its size where the words wrap.
  icon: {
    display: 'flex',
    flexShrink: 0,
    position: 'relative',
  },
  // The last line, the privacy page and the theme control share a row under a
  // hairline, centred on each other. A phone wraps the controls under the line.
  last: {
    alignItems: 'center',
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
    justifyContent: 'space-between',
    paddingBlockStart: spacing.s6,
  },
  line: {
    margin: 0,
  },
  // A link of the footer: quiet until it is pointed at, as the header's are.
  // A row is tall enough for a thumb on a phone.
  link: {
    alignItems: 'center',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    display: 'inline-flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    gap: spacing.s2,
    lineHeight: '20px',
    minHeight: {
      '@media (max-width: 639px)': 44,
      default: 32,
    },
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
    transitionDuration: duration.quick,
    transitionProperty: 'color',
    transitionTimingFunction: easing.out,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // GitHub's mark before its link. It keeps its size where the words wrap.
  mark: {
    flexShrink: 0,
  },
  // The name, as large as the row is wide. Its line starts at the top of the
  // stage and runs out under it, so the stage's edge cuts the letters. The
  // type size is read off the stage's own width, or off the window's where a
  // browser has no container units.
  name: {
    color: NAME_INK,
    display: 'block',
    fontSize: firstThatWorks(
      `calc((100cqi - 2 * ${spacing.s4}) / ${NAME_WIDTH})`,
      `calc((100vw - 2 * ${spacing.s4}) / ${NAME_WIDTH})`,
    ),
    fontWeight: font.weightRegular,
    height: `${NAME_SHOWN}em`,
    letterSpacing: `${NAME_TRACKING}em`,
    lineHeight: 1,
    // The first letter's ink, not its box, stands on the page's left edge.
    marginInlineStart: `calc(${spacing.s4} - ${NAME_BEARING}em)`,
    maskImage: NAME_THINS,
    WebkitMaskImage: NAME_THINS,
    whiteSpace: 'nowrap',
  },
  // The graph paper, under the foot of the page. The footer is not
  // positioned, so the paper hangs from the page root every page positions:
  // the window's whole width without pushing it sideways, standing on the
  // page's bottom edge. The two masks are both applied, the sides and the top.
  paper: {
    height: PAPER_HEIGHT,
    insetBlockEnd: 0,
    insetBlockStart: 'auto',
    maskComposite: 'intersect',
    maskImage: {
      '@media (min-width: 640px)': `${PAPER_SIDES}, ${PAPER_TOP}`,
      default: `${PAPER_SIDES_NARROW}, ${PAPER_TOP}`,
    },
    WebkitMaskComposite: 'source-in',
    WebkitMaskImage: {
      '@media (min-width: 640px)': `${PAPER_SIDES}, ${PAPER_TOP}`,
      default: `${PAPER_SIDES_NARROW}, ${PAPER_TOP}`,
    },
  },
  rise: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: rise,
    animationTimingFunction: easing.smoothOut,
  },
  // Where the name stands: on the page's bottom edge, the window's whole
  // width, hung from the page root as the paper is. It cuts what runs past it,
  // so the name never pushes the page sideways or makes it longer, and it is
  // under everything the page draws.
  stage: {
    containerType: 'inline-size',
    insetBlockEnd: 0,
    insetInline: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    userSelect: 'none',
    zIndex: -1,
  },
  // The star filled in, over its outline, while the link is pointed at.
  starFilled: {
    inset: 0,
    opacity: {
      default: 0,
      [when.ancestor(':hover')]: 1,
    },
    position: 'absolute',
    transitionDuration: duration.quick,
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.out,
  },
  // What this is, held to a short measure under the name.
  tagline: {
    lineHeight: 1.5,
    maxWidth: '32ch',
  },
});

/** One link of the footer. */
type FooterLink = {
  /** Whether it leaves the site, in a tab of its own. */
  external?: boolean;
  /** Whether the heart stands before it. */
  heart?: boolean;
  href: string;
  label: string;
  onClick?: () => void;
};

/**
 * The repo's star count, asked of GitHub once a page and kept for the tab's
 * session. Only a count GitHub gave is kept: an answer that failed is not, so
 * the next page asks again.
 */
let starsAsked: Promise<number> | undefined;

async function askStars(): Promise<number> {
  try {
    const kept = sessionStorage.getItem(STARS_KEY);
    if (kept !== null) {
      return Number(kept) || 0;
    }
  } catch {
    // No storage to read: GitHub is asked.
  }
  let count: number | undefined;
  try {
    const response = await fetch(REPO_API);
    const repo: unknown = response.ok ? await response.json() : undefined;
    if (
      typeof repo === 'object' &&
      repo !== null &&
      'stargazers_count' in repo &&
      typeof repo.stargazers_count === 'number'
    ) {
      count = repo.stargazers_count;
    }
  } catch {
    // GitHub did not answer. The count stays off the page.
  }
  if (count === undefined) {
    starsAsked = undefined;
    return 0;
  }
  try {
    sessionStorage.setItem(STARS_KEY, String(count));
  } catch {
    // A private window keeps nothing. The next page asks again.
  }
  return count;
}

/**
 * How many stars the repo has, or zero until GitHub has answered and for good
 * where it does not. GitHub is asked only once the element in `near` is close
 * to the window, so a reader who never reaches the footer sends it nothing.
 */
function useStars(near: RefObject<Element | null>): number {
  const [stars, setStars] = useState(0);

  useEffect(() => {
    const element = near.current;
    if (element === null) {
      return;
    }
    let live = true;
    const watch = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        watch.disconnect();
        starsAsked ??= askStars();
        const count = await starsAsked;
        if (live) {
          setStars(count);
        }
      },
      { rootMargin: STARS_MARGIN },
    );
    watch.observe(element);
    return () => {
      live = false;
      watch.disconnect();
    };
  }, [near]);

  return stars;
}

/** A column of links under its name. */
function Column({ links, title }: { links: ReadonlyArray<FooterLink>; title: string }) {
  const heading = useId();

  return (
    <nav aria-labelledby={heading}>
      <h2 id={heading} {...props(styles.heading)}>
        {title}
      </h2>
      <ul {...props(styles.list)}>
        {links.map((link) => (
          <li key={link.href}>
            <a
              data-plain=""
              href={link.href}
              onClick={link.onClick}
              rel={link.external ? 'noreferrer' : undefined}
              target={link.external ? '_blank' : undefined}
              {...props(styles.link)}
            >
              {link.heart && (
                <Heart aria-hidden="true" size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              )}
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The same footer on every page, and the whole site in it: the name and what
 * this is, the way to the code and the ask for a star, the product, the blog's
 * posts and the project in three columns of links, then who made it, the
 * privacy page and the theme control in a last row. Under all of it the name
 * is set as large as the window is wide, cut by the page's bottom edge. The
 * server draws the name in place. Still under the window once the page has
 * come alive, it hides and rises as the reader reaches the page's end. With
 * less motion it stands still. A page with one more line of its own passes it
 * in, and it sits above the last row.
 */
export function SiteFooter({ children }: { children?: ReactNode | undefined }) {
  const posthog = usePostHog();
  const footer = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const stars = useStars(footer);
  const reduced = useLessMotion();
  const seen = useSeen(stage, { once: true });
  // Whether the name was under the window as the page came alive.
  const [below, setBelow] = useState(false);
  const home = useLocation({ select: (location) => location.pathname === '/' });
  // On the home page a bare hash scrolls in place; with the path in front the
  // browser would load the page again and drop its query.
  const page = home ? '' : '/';
  const [appleBefore, appleAfter] = m.gen_footer_not_apple({ builder: LINK_SLOT }).split(LINK_SLOT);

  // Measured once, before the page paints again: only a name wholly under the
  // window is hidden, where nobody sees it go.
  useLayoutEffect(() => {
    const top = stage.current?.getBoundingClientRect().top;
    setBelow(top !== undefined && top > window.innerHeight);
  }, []);

  const rising = below && !reduced;
  const onGitHub = () => posthog.capture('github_clicked', { placement: 'footer' });

  const product: ReadonlyArray<FooterLink> = [
    { href: `${page}#${SECTION.pricing}`, label: m.footer_product_download() },
    { href: `${page}#${SECTION.wayOut}`, label: m.footer_product_how() },
    { href: GUIDE_PATH, label: m.footer_product_guide() },
    { href: BUILD_PATH, label: m.footer_product_build() },
    { href: `${page}#${SECTION.extension}`, label: m.footer_product_extension() },
    { external: true, href: STORE_URL, label: m.footer_product_store() },
  ];
  const blog: ReadonlyArray<FooterLink> = [
    ...POSTS.filter(({ slug }) => posts.some((post) => post.slug === slug)).map(
      ({ label, slug }) => ({ href: `${BLOG_PATH}/${slug}`, label: label() }),
    ),
    { href: BLOG_PATH, label: m.footer_post_all() },
  ];
  const project: ReadonlyArray<FooterLink> = [
    {
      external: true,
      heart: true,
      href: SUPPORT_URL,
      label: m.footer_project_support(),
      onClick: () => posthog.capture('support_clicked', { placement: 'footer' }),
    },
    { href: `${page}#${SECTION.story}`, label: m.footer_project_why() },
    { href: `${page}#${SECTION.faq}`, label: m.footer_project_faq() },
  ];

  return (
    <footer ref={footer} {...props(styles.footer)}>
      <GridTexture style={styles.paper} />
      <div {...props(styles.columns)}>
        <div {...props(styles.brand)}>
          <a data-plain="" href="/" {...props(styles.brandLink)}>
            <BrandMark size={MARK_SIZE} />
            {m.site_name()}
          </a>
          <p {...props(layout.muted, styles.line, styles.tagline)}>{m.footer_tagline()}</p>
          <ul {...props(styles.list)}>
            <li>
              <a
                data-plain=""
                href={REPO_URL}
                onClick={onGitHub}
                rel="noreferrer"
                target="_blank"
                {...props(styles.link)}
              >
                <svg
                  aria-hidden="true"
                  fill="currentColor"
                  height={ICON_SIZE}
                  viewBox="0 0 16 16"
                  width={ICON_SIZE}
                  {...props(styles.mark)}
                >
                  <path d={GITHUB_MARK} />
                </svg>
                {m.footer_github()}
              </a>
            </li>
            <li>
              <a
                data-plain=""
                href={REPO_URL}
                onClick={onGitHub}
                rel="noreferrer"
                target="_blank"
                {...props(styles.link, defaultMarker())}
              >
                <span {...props(styles.icon)}>
                  <Star aria-hidden="true" size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                  <Star
                    aria-hidden="true"
                    size={ICON_SIZE}
                    weight="Filled"
                    {...props(styles.starFilled)}
                  />
                </span>
                {m.footer_star()}
                {stars > 0 && <span {...props(styles.count)}>{STAR_COUNT.format(stars)}</span>}
              </a>
            </li>
          </ul>
        </div>
        <Column links={product} title={m.footer_product()} />
        <Column links={blog} title={m.gen_footer_blog()} />
        <Column links={project} title={m.footer_project()} />
      </div>
      {children}
      <div {...props(styles.last)}>
        <p {...props(layout.muted, styles.line, styles.credit)}>
          {appleBefore}
          <a href={BUILDER_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_builder()}
          </a>
          {appleAfter}
        </p>
        <div {...props(styles.end)}>
          <a data-plain="" href={PRIVACY_PATH} {...props(styles.link)}>
            {m.footer_privacy()}
          </a>
          <ThemeSwitch />
        </div>
      </div>
      {/* The name is read out in the brand's line above, so this one is for the eye only. */}
      <div aria-hidden="true" ref={stage} {...props(styles.stage)}>
        <span {...props(styles.name, rising && (seen ? styles.rise : styles.hidden))}>
          {m.site_name()}
        </span>
      </div>
    </footer>
  );
}
