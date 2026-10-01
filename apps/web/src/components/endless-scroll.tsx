import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { drawing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';

/** The phone in the drawing's own box, the shape of an iPhone 15 Pro: 71.6 by 146.6. */
const BOX_WIDTH = 180;
const BOX_HEIGHT = 368;
const BODY_RADIUS = 28;
const BODY_LINE = 1.5;
/** The island, a pill centred near the top of the screen. */
const ISLAND = { height: 12, width: 44, y: 15 };
/**
 * The screen the feed shows through, concentric with the body: its corner is
 * the body's less the inset. Its top and its foot fade out, this much of it
 * each, so the posts come from and go nowhere in particular.
 */
const SCREEN_INSET = 8;
const SCREEN_TOP = SCREEN_INSET;
const SCREEN_HEIGHT = BOX_HEIGHT - 2 * SCREEN_INSET;
const SCREEN_FADE = 0.16;
/**
 * How tall the phone stands beside the words on a wide screen, and on a wide
 * but short one. Under the words on a narrow one it takes the room it is
 * given: as tall as that is, unless that would make it wider than it is.
 */
const TALL = 430;
const TALL_SHORT = 300;
const TALL_NARROW = `min(100cqh, 100cqw * ${BOX_HEIGHT} / ${BOX_WIDTH})`;
/** A post, in the drawing's units from its own top left: where it starts across the screen and how wide it runs. */
const POST_LEFT = 22;
const POST_WIDTH = BOX_WIDTH - 2 * POST_LEFT;
/** The avatar, and the name and the handle beside it. */
const AVATAR = 7;
const BAR_LEFT = POST_LEFT + 2 * AVATAR + 6;
const NAME = { height: 5, y: 2.5 };
const HANDLE = { height: 4, y: 9.5 };
/** The picture or the lines of text under them. */
const BODY_TOP = 22;
const PICTURE_CORNER = 6;
const LINE_HEIGHT = 4;
const LINE_PITCH = 8;
/** The row of actions under the body, and the air under that before the next post. */
const ACTIONS_GAP = 10;
const POST_GAP = 22;
const DOT = 2.2;
const DOT_PITCH = 12;
const DOTS = [
  POST_LEFT + DOT,
  POST_LEFT + DOT + DOT_PITCH,
  POST_LEFT + DOT + 2 * DOT_PITCH,
  POST_LEFT + POST_WIDTH - DOT,
];
/** The like takes the first action's place. */
const HEART_X = DOTS[0] ?? 0;
const HEART =
  'M0 3.6C-0.8 3 -4.6 0.6 -4.6 -1.6C-4.6 -3.1 -3.5 -4 -2.3 -4C-1.3 -4 -0.5 -3.4 0 -2.6C0.5 -3.4 1.3 -4 2.3 -4C3.5 -4 4.6 -3.1 4.6 -1.6C4.6 0.6 0.8 3 0 3.6Z';
/** A post is liked as its actions go up past this line, and the heart pops: up past its size and back. */
const LIKE_LINE = SCREEN_TOP + SCREEN_HEIGHT * 0.6;
const POP_SECONDS = 0.45;
const POP_OVERSHOOT = 2.4;
/**
 * The thumb. A flick pushes the feed for a moment and lets it glide, its
 * speed falling away by e every `GLIDE` seconds. Over a run the flicks come
 * harder and closer together, from a post at a time to a blur, in the
 * drawing's units a second; then they stop, the feed coasts to rest and
 * stands a moment, and the next run starts slow again.
 */
const GLIDE = 0.4;
const PUSH_SECONDS = 0.08;
const RUN_SECONDS = 10;
const REST_SECONDS = 2.2;
const FLICK = { first: 320, last: 560 };
const BETWEEN = { first: 1.3, last: 0.32 };
/** No two flicks in a row are as hard, the way no thumb's are. */
const FLICK_SWAY = [1, 0.8, 1.15, 0.9, 1.1, 0.85];
/** The longest step a frame takes, so a dropped frame is not a jump. */
const MAX_STEP = 0.05;
/** Where the feed stands before it moves: a little way into it, never at the top. */
const START = 40;

/**
 * A post, and the posts the feed runs through, over and over: how wide its
 * name and handle are, how tall its picture is or, with none, how wide each
 * line of its text, and whether it is liked on the way past.
 */
type Post = {
  handle: number;
  image: number;
  liked: boolean;
  lines: ReadonlyArray<number>;
  name: number;
};

const POSTS: ReadonlyArray<Post> = [
  { handle: 30, image: 92, liked: true, lines: [], name: 54 },
  { handle: 26, image: 0, liked: false, lines: [136, 118, 76], name: 44 },
  { handle: 36, image: 72, liked: false, lines: [], name: 60 },
  { handle: 28, image: 108, liked: true, lines: [], name: 48 },
  { handle: 34, image: 0, liked: false, lines: [128, 92], name: 56 },
  { handle: 30, image: 84, liked: false, lines: [], name: 40 },
];

/** A post laid out in the loop: where it starts, where its actions are, and how much of the loop it takes. */
type Placed = Post & { actions: number; height: number; top: number };

const PLACED: ReadonlyArray<Placed> = POSTS.reduce<Array<Placed>>((placed, post) => {
  const last = placed.at(-1);
  const top = last === undefined ? 0 : last.top + last.height;
  const body = post.image > 0 ? post.image : (post.lines.length - 1) * LINE_PITCH + LINE_HEIGHT;
  const actions = BODY_TOP + body + ACTIONS_GAP;
  placed.push({ ...post, actions, height: actions + POST_GAP, top });
  return placed;
}, []);
/**
 * The loop, every post once, and how far above the screen a post goes before
 * it comes round under it again. The loop is longer than the screen by more
 * than that, so a post is never seen to go round.
 */
const LOOP = PLACED.reduce((sum, post) => sum + post.height, 0);
const LEAD = Math.max(...PLACED.map((post) => post.height));

/** The feed as it runs: how far, how fast, where the thumb is in its run, and when each like popped. */
type Feed = {
  clock: number;
  flicks: number;
  likedAt: Array<number | null>;
  next: number;
  offset: number;
  push: number;
  pushRate: number;
  speed: number;
  time: number;
};

const styles = create({
  // The phone, drawn in a line, and the island, which the feed runs under.
  body: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: BODY_LINE,
  },
  // A post's avatar, its bars, its text and its actions: the gray a page
  // shows before it has loaded.
  bone: {
    fill: colors.border,
  },
  boneFaint: {
    opacity: 0.6,
  },
  // A like, the one orange in the feed.
  heart: {
    fill: accent.base,
  },
  island: {
    fill: colors.bg,
  },
  // A fixed height beside the words on a wide screen, and the room under
  // them on a narrow one, so all of it is on the first screen.
  phone: {
    aspectRatio: `${BOX_WIDTH} / ${BOX_HEIGHT}`,
    display: 'block',
    flexShrink: 0,
    height: {
      '@media (max-width: 767px)': TALL_NARROW,
      '@media (min-width: 768px) and (max-height: 720px)': TALL_SHORT,
      default: TALL,
    },
    overflow: 'visible',
    width: 'auto',
  },
  // A picture, a step fainter than the rest, with its edge drawn.
  picture: {
    fill: colors.border,
    fillOpacity: 0.45,
    stroke: colors.border,
    strokeWidth: 1,
  },
});

/** Whether the tab is the one in front: a hidden tab plays nothing. */
function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function tabVisible(): boolean {
  return document.visibilityState === 'visible';
}

function tabVisibleOnServer(): boolean {
  return false;
}

/**
 * Where a post's top stands once the feed has run `offset`: it goes up with
 * the feed, and once it is a whole post above the screen it goes round to the
 * foot of the loop, under the screen, and comes up again from there.
 */
function place(post: Placed, offset: number): number {
  const up = (post.top - offset + LEAD) % LOOP;
  return SCREEN_TOP + (up < 0 ? up + LOOP : up) - LEAD;
}

/** Whether a post's like has popped by the time the feed has run `offset`. */
function likedBy(post: Placed, offset: number): boolean {
  return post.liked && place(post, offset) + post.actions < LIKE_LINE;
}

/** The heart over a post's first action, as big as its pop has grown. */
function heartAt(post: Placed, scale: number): string {
  return `translate(${HEART_X} ${post.actions}) scale(${scale.toFixed(3)})`;
}

/** How big a like is `since` seconds after it popped: nothing before, past its size, then its size. */
function popScale(since: number | null): number {
  if (since === null) {
    return 0;
  }
  const t = Math.min(1, since / POP_SECONDS) - 1;
  return 1 + (POP_OVERSHOOT + 1) * t ** 3 + POP_OVERSHOOT * t ** 2;
}

/** The feed where it stands before it moves, with the likes already past the line standing popped. */
function startFeed(): Feed {
  return {
    clock: 0,
    flicks: 0,
    likedAt: PLACED.map((post) => (likedBy(post, START) ? Number.NEGATIVE_INFINITY : null)),
    next: drawing.delay,
    offset: START,
    push: 0,
    pushRate: 0,
    speed: 0,
    time: 0,
  };
}

/** The feed `seconds` on: a flick when one is due, its push, and the glide that eases off after it. */
function advance(feed: Feed, seconds: number) {
  feed.time += seconds;
  feed.clock += seconds;
  if (feed.clock >= RUN_SECONDS + REST_SECONDS) {
    feed.clock -= RUN_SECONDS + REST_SECONDS;
    feed.next = 0;
  }
  if (feed.clock < RUN_SECONDS && feed.clock >= feed.next) {
    const urge = (feed.clock / RUN_SECONDS) ** 2;
    const sway = FLICK_SWAY[feed.flicks % FLICK_SWAY.length] ?? 1;
    feed.push = PUSH_SECONDS;
    feed.pushRate = ((FLICK.first + (FLICK.last - FLICK.first) * urge) * sway) / PUSH_SECONDS;
    feed.next = feed.clock + BETWEEN.first + (BETWEEN.last - BETWEEN.first) * urge;
    feed.flicks += 1;
  }
  const pushing = Math.min(seconds, feed.push);
  feed.push -= pushing;
  feed.speed += feed.pushRate * pushing;
  const kept = Math.exp(-seconds / GLIDE);
  feed.offset += feed.speed * GLIDE * (1 - kept);
  feed.speed *= kept;
}

/** One post in gray: avatar, name and handle, a picture or lines of text, and a row of actions. */
function PostBones({ post }: { post: Placed }) {
  return (
    <>
      <circle cx={POST_LEFT + AVATAR} cy={AVATAR} r={AVATAR} {...props(styles.bone)} />
      <rect
        height={NAME.height}
        rx={NAME.height / 2}
        width={post.name}
        x={BAR_LEFT}
        y={NAME.y}
        {...props(styles.bone)}
      />
      <rect
        height={HANDLE.height}
        rx={HANDLE.height / 2}
        width={post.handle}
        x={BAR_LEFT}
        y={HANDLE.y}
        {...props(styles.bone, styles.boneFaint)}
      />
      {post.image > 0 ? (
        <rect
          height={post.image}
          rx={PICTURE_CORNER}
          width={POST_WIDTH}
          x={POST_LEFT}
          y={BODY_TOP}
          {...props(styles.picture)}
        />
      ) : (
        post.lines.map((width, line) => (
          <rect
            height={LINE_HEIGHT}
            key={line}
            rx={LINE_HEIGHT / 2}
            width={width}
            x={POST_LEFT}
            y={BODY_TOP + line * LINE_PITCH}
            {...props(styles.bone)}
          />
        ))
      )}
      {DOTS.map((x) => (
        <circle cx={x} cy={post.actions} key={x} r={DOT} {...props(styles.bone)} />
      ))}
    </>
  );
}

/**
 * The feed the page opens on, abstracted: a phone drawn in a line, and gray
 * posts going up it without end, a thumb's flicks pushing them on harder and
 * faster until it lets the feed coast to rest and starts slow again. Now and
 * then a post is liked on its way past, in orange. It runs only while it is
 * `shown`, on screen, in a tab in front; for a reader who asked for less
 * motion it is the posts standing still.
 */
export function EndlessScroll({ shown }: { shown: boolean }) {
  const id = useId();
  const fade = `${id}-fade`;
  const screen = `${id}-screen`;
  const reduced = useReducedMotion();
  const tabShown = useSyncExternalStore(subscribeVisibility, tabVisible, tabVisibleOnServer);
  const phone = useRef<SVGSVGElement>(null);
  const onScreen = useInView(phone);
  const posts = useRef<Array<SVGGElement | null>>([]);
  const hearts = useRef<Array<SVGPathElement | null>>([]);
  // The feed as it ran last, so it goes on from there when it runs again.
  const feed = useRef<Feed | null>(null);
  const running = shown && onScreen && tabShown && reduced !== true;

  // A frame at a time while it runs, the posts and the likes moved in place
  // rather than drawn again.
  useEffect(() => {
    if (!running) {
      return;
    }
    const state = (feed.current ??= startFeed());
    let last: number | null = null;
    let frame = 0;
    function paint() {
      PLACED.forEach((post, index) => {
        const top = place(post, state.offset);
        posts.current[index]?.setAttribute('transform', `translate(0 ${top.toFixed(2)})`);
        if (!post.liked) {
          return;
        }
        if (top + post.actions < LIKE_LINE) {
          state.likedAt[index] ??= state.time;
        } else {
          state.likedAt[index] = null;
        }
        const likedAt = state.likedAt[index] ?? null;
        hearts.current[index]?.setAttribute(
          'transform',
          heartAt(post, popScale(likedAt === null ? null : state.time - likedAt)),
        );
      });
    }
    function tick(now: number) {
      advance(state, last === null ? 0 : Math.min(MAX_STEP, (now - last) / 1000));
      last = now;
      paint();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  return (
    <svg
      aria-label={m.home_feed_label()}
      ref={phone}
      role="img"
      viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
      {...props(styles.phone)}
    >
      <defs>
        <linearGradient id={fade} x1={0} x2={0} y1={0} y2={1}>
          <stop offset={0} stopColor="black" />
          <stop offset={SCREEN_FADE} stopColor="white" />
          <stop offset={1 - SCREEN_FADE} stopColor="white" />
          <stop offset={1} stopColor="black" />
        </linearGradient>
        <mask
          height={BOX_HEIGHT}
          id={screen}
          maskUnits="userSpaceOnUse"
          width={BOX_WIDTH}
          x={0}
          y={0}
        >
          <rect
            fill={`url(#${fade})`}
            height={SCREEN_HEIGHT}
            rx={BODY_RADIUS - SCREEN_INSET}
            width={BOX_WIDTH - 2 * SCREEN_INSET}
            x={SCREEN_INSET}
            y={SCREEN_TOP}
          />
        </mask>
      </defs>
      <g mask={`url(#${screen})`}>
        {PLACED.map((post, index) => (
          <g
            key={index}
            ref={(element) => {
              posts.current[index] = element;
            }}
            transform={`translate(0 ${place(post, START).toFixed(2)})`}
          >
            <PostBones post={post} />
            {post.liked ? (
              <path
                d={HEART}
                ref={(element) => {
                  hearts.current[index] = element;
                }}
                transform={heartAt(post, likedBy(post, START) ? 1 : 0)}
                {...props(styles.heart)}
              />
            ) : null}
          </g>
        ))}
      </g>
      <rect
        height={BOX_HEIGHT - BODY_LINE}
        rx={BODY_RADIUS}
        width={BOX_WIDTH - BODY_LINE}
        x={BODY_LINE / 2}
        y={BODY_LINE / 2}
        {...props(styles.body)}
      />
      <rect
        height={ISLAND.height}
        rx={ISLAND.height / 2}
        width={ISLAND.width}
        x={(BOX_WIDTH - ISLAND.width) / 2}
        y={ISLAND.y}
        {...props(styles.body, styles.island)}
      />
    </svg>
  );
}
