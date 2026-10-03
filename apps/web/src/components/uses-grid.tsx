import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { inView } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { Bed, PlayCircle, Sofa, Users } from 'reicon-react';
import type { IconComponent } from 'reicon-react';
import { blur, distance, drawing, duration, easing } from '../lib/motion.stylex.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { m } from '../paraglide/messages.js';

/**
 * A tile comes in once its top is this far up the window, so the tiles of a
 * row, whatever their height, come in together.
 */
const SEEN = '0px 0px -10% 0px';
/**
 * The grid's times, in milliseconds. Tiles that come on screen together rise
 * one after another, `stagger` apart, the motion scale's large stagger, and a
 * tile's strike or bar starts `lead` into its rise.
 */
const TIMES = { lead: 250, stagger: 80 };
/** Where the loss goes in "No more …", so the words around it keep their own order. */
const LOSS_SLOT = '\u0000';
/** A loss's icon, in pixels, at the icons' own 1.5px line. */
const ICON = 20;
/** The orange line a loss is struck through with. */
const STRIKE = '1.5px';
/** How full the side project's bar is before it fills. */
const BAR_FROM = 0.2;
/**
 * Each drawing's box, in the units it is drawn in: the part of a 160 by 100
 * sheet it stands on, with a little air around it.
 */
const VIEWS = {
  book: '14 2 132 90',
  call: '40 2 80 96',
  outside: '2 8 156 82',
  project: '4 4 152 92',
};
/**
 * The drawings are drawn larger or smaller with their tile, so their lines
 * keep the page's own width, as the hero's phone does, rather than growing
 * and shrinking with them.
 */
const HAIRLINE = 'non-scaling-stroke';

/** A tile rising into place, out of a blur. */
const rise = keyframes({
  from: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});
/** The strike drawn through a loss, line after line. */
const strike = keyframes({
  from: { backgroundSize: `0% ${STRIKE}` },
});
/** The side project's bar filling to its end. */
const fill = keyframes({
  from: { transform: `scaleX(${BAR_FROM})` },
});

const styles = create({
  // Waits for a delay the tile sets, by when it came on screen.
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  // A tile's place in the grid, by name.
  area: (name: string) => ({
    gridArea: name,
  }),
  // The drawing over a gain, in the middle of the room its words leave.
  art: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
  },
  bar: {
    fill: colors.muted,
    transformBox: 'fill-box',
    transformOrigin: 'left center',
  },
  barHidden: {
    transform: `scaleX(${BAR_FROM})`,
  },
  barPlay: {
    animationDuration: `${drawing.progress}s`,
    animationFillMode: 'backwards',
    animationName: fill,
    animationTimingFunction: easing.smoothOut,
  },
  // Each drawing at its tile's width, never past its own size.
  drawing: {
    display: 'block',
    height: 'auto',
    maxHeight: 168,
    maxWidth: 168,
    overflow: 'visible',
    width: '100%',
  },
  drawingBig: {
    maxWidth: 288,
  },
  // The drawings' faint parts: a display, a page's lines, the far arcs.
  faint: {
    opacity: 0.5,
  },
  // What the phone is for again: its drawing over its words, in the page's ink.
  gain: {
    borderStyle: 'solid',
    gap: spacing.s4,
    padding: {
      '@media (min-width: 768px)': spacing.s6,
      default: spacing.s4,
    },
  },
  gainText: {
    fontSize: {
      '@media (min-width: 768px)': font.sizeLg,
      default: font.sizeMd,
    },
    lineHeight: 1.3,
    textWrap: 'balance',
  },
  // Big tiles and small, in two bands that mirror each other: a big gain, two
  // losses stacked and a tall gain, then the other way round. Two to a row on
  // a phone, the big gains across both.
  grid: {
    display: 'grid',
    gap: spacing.s3,
    gridAutoRows: {
      '@media (min-width: 768px)': 'minmax(128px, auto)',
      default: 'auto',
    },
    gridTemplateAreas: {
      '@media (min-width: 768px)':
        '"project project couch book" "project project bed book" "mom strangers outside outside" "mom sundays outside outside"',
      default: '"project project" "bed couch" "book mom" "sundays strangers" "outside outside"',
    },
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'repeat(4, minmax(0, 1fr))',
      default: 'repeat(2, minmax(0, 1fr))',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  icon: {
    display: 'block',
  },
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  // What the feeds took: quieter than a gain, its edge dashed where something
  // was, its words struck through.
  loss: {
    borderStyle: 'dashed',
    color: colors.muted,
    fontSize: font.sizeSm,
    gap: spacing.s3,
    justifyContent: 'space-between',
    lineHeight: 1.5,
    padding: {
      '@media (min-width: 768px)': spacing.s4,
      default: spacing.s3,
    },
  },
  // The slash over a loss's icon, a gap of the page around it so it reads
  // across the icon's own lines.
  slash: {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  slashGap: {
    stroke: colors.bg,
    strokeWidth: 4.5,
  },
  slashMarks: {
    height: ICON,
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: 'absolute',
    width: ICON,
  },
  // A loss's icon and the slash over it.
  stage: {
    display: 'block',
    flexShrink: 0,
    height: ICON,
    position: 'relative',
    width: ICON,
  },
  // The loss itself, struck through in orange; the words around it are not.
  struck: {
    backgroundImage: `linear-gradient(${accent.base}, ${accent.base})`,
    backgroundPosition: '0 58%',
    backgroundRepeat: 'no-repeat',
    backgroundSize: `100% ${STRIKE}`,
  },
  struckDraw: {
    animationDuration: `${drawing.strike}s`,
    animationFillMode: 'backwards',
    animationName: strike,
    animationTimingFunction: easing.smoothOut,
  },
  struckHidden: {
    backgroundSize: `0% ${STRIKE}`,
  },
  // A tile in the grid. A pointer on it brings its edge up a step and lifts it
  // a little.
  tile: {
    borderColor: {
      ':hover': {
        '@media (hover: hover)': `color-mix(in srgb, ${colors.fg} 15%, ${colors.border})`,
        default: null,
      },
      default: colors.border,
    },
    borderRadius: radius.base,
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    textWrap: 'pretty',
    transitionDuration: duration.fast,
    // The lift moves the tile by `translate`, so it never meets the rise,
    // which moves it by `transform`.
    transitionProperty: 'border-color, translate',
    transitionTimingFunction: easing.smoothOut,
    translate: {
      ':hover': {
        '@media (hover: hover) and (prefers-reduced-motion: no-preference)': '0 -2px',
        default: null,
      },
      default: null,
    },
  },
  // Below the fold once the page has come alive, a tile waits out of sight
  // for its rise.
  tileHidden: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
  tileRise: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: rise,
    animationTimingFunction: easing.smoothOut,
  },
});

/**
 * Where a tile is in its rise: `hidden` while it waits under the fold, then
 * `wait`, how long its rise waits once it is on screen. Neither for a tile
 * that stands still.
 */
type Rise = { hidden: boolean; wait: number | null };

/** The tile's own rise: out of sight while it waits, then up into place. */
function riseStyle({ hidden, wait }: Rise) {
  return hidden ? styles.tileHidden : wait === null ? null : [styles.tileRise, styles.after(wait)];
}

/** Lines of code on the laptop's display, each `[x, y, length]`. */
const CODE = [
  [38, 28, 46],
  [46, 35, 30],
  [46, 42, 52],
  [54, 49, 24],
  [38, 56, 18],
];
const BAR = { height: 4, width: 84, x: 38, y: 66 };

/**
 * A laptop open on the desk, drawn like the Mac in the steps, code on its
 * display and a bar under it that fills to its end as the tile rises.
 */
function ProjectArt({ hidden, wait }: Rise) {
  return (
    <>
      <rect
        height={72}
        rx={5}
        vectorEffect={HAIRLINE}
        width={112}
        x={24}
        y={12}
        {...props(styles.line)}
      />
      <rect
        height={64}
        rx={1}
        vectorEffect={HAIRLINE}
        width={104}
        x={28}
        y={16}
        {...props(styles.line, styles.faint)}
      />
      <path
        d="M12 84H148V86.5Q148 89 145.5 89H14.5Q12 89 12 86.5Z M72 84Q72 86 74 86H86Q88 86 88 84"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      {CODE.map(([x, y, length]) => (
        <path
          d={`M${x} ${y}h${length}`}
          key={`${x} ${y}`}
          vectorEffect={HAIRLINE}
          {...props(styles.line, styles.faint)}
        />
      ))}
      <rect
        height={BAR.height}
        rx={BAR.height / 2}
        vectorEffect={HAIRLINE}
        width={BAR.width}
        x={BAR.x}
        y={BAR.y}
        {...props(styles.line, styles.faint)}
      />
      <rect
        height={BAR.height}
        rx={BAR.height / 2}
        width={BAR.width}
        x={BAR.x}
        y={BAR.y}
        {...props(
          styles.bar,
          hidden && styles.barHidden,
          wait !== null && [styles.barPlay, styles.after(wait + TIMES.lead)],
        )}
      />
    </>
  );
}

/** The lines of text on each page of the book, by where each ends. */
const LEFT_LINES = [72, 68, 72, 64, 70];
const RIGHT_LINES = [118, 114, 118, 110, 104];
const LINE_TOP = 42;
const LINE_PITCH = 7;

/** An open book on its cover, a line of text across each page, and the moon over it. */
function BookArt() {
  return (
    <>
      <path
        d="M34 34L30 35V85C52 81 70 82 80 88C90 82 108 81 130 85V35L126 34"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      <path
        d="M80 36C70 29 52 27 34 31V80C52 76 70 78 80 84Z M80 36C90 29 108 27 126 31V80C108 76 90 78 80 84Z"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      {LEFT_LINES.map((end, index) => (
        <path
          d={`M42 ${LINE_TOP + index * LINE_PITCH}H${end}`}
          key={`left ${index}`}
          vectorEffect={HAIRLINE}
          {...props(styles.line, styles.faint)}
        />
      ))}
      {RIGHT_LINES.map((end, index) => (
        <path
          d={`M88 ${LINE_TOP + index * LINE_PITCH}H${end}`}
          key={`right ${index}`}
          vectorEffect={HAIRLINE}
          {...props(styles.line, styles.faint)}
        />
      ))}
      <path
        d="M142 7.07A8 8 0 1 0 144.93 18A6.5 6.5 0 0 1 142 7.07Z"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      <path
        d="M122 9V15M119 12H125"
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.faint)}
      />
    </>
  );
}

/** A phone on a call: the face it calls, the name and the time under it, its buttons, and the voice going out of it. */
function CallArt() {
  return (
    <>
      <rect
        height={90}
        rx={8}
        vectorEffect={HAIRLINE}
        width={44}
        x={58}
        y={5}
        {...props(styles.line)}
      />
      <rect
        height={85}
        rx={5.5}
        vectorEffect={HAIRLINE}
        width={39}
        x={60.5}
        y={7.5}
        {...props(styles.line, styles.faint)}
      />
      <rect
        height={4}
        rx={2}
        vectorEffect={HAIRLINE}
        width={14}
        x={73}
        y={11}
        {...props(styles.line, styles.faint)}
      />
      <circle cx={80} cy={32} r={9} vectorEffect={HAIRLINE} {...props(styles.line)} />
      <circle cx={80} cy={29.5} r={2.8} vectorEffect={HAIRLINE} {...props(styles.line)} />
      <path
        d="M75 38C75.8 34.9 77.6 33.8 80 33.8C82.4 33.8 84.2 34.9 85 38"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      <path d="M72 48H88" vectorEffect={HAIRLINE} {...props(styles.line)} />
      <path d="M75 54H85" vectorEffect={HAIRLINE} {...props(styles.line, styles.faint)} />
      {[70, 80, 90].map((cx) => (
        <circle
          cx={cx}
          cy={68}
          key={cx}
          r={3.2}
          vectorEffect={HAIRLINE}
          {...props(styles.line, styles.faint)}
        />
      ))}
      <circle cx={80} cy={82} r={4.5} vectorEffect={HAIRLINE} {...props(styles.line)} />
      <path
        d="M108.95 25.05A7 7 0 0 1 108.95 34.95 M51.05 25.05A7 7 0 0 0 51.05 34.95"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      <path
        d="M113.19 20.81A13 13 0 0 1 113.19 39.19 M46.81 20.81A13 13 0 0 0 46.81 39.19"
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.faint)}
      />
    </>
  );
}

/** The sun's rays, around it. */
const RAYS =
  'M136 26H139 M133.07 33.07L135.19 35.19 M126 36V39 M118.93 33.07L116.81 35.19 M116 26H113 M118.93 18.93L116.81 16.81 M126 16V13 M133.07 18.93L135.19 16.81';

/** Someone out for a walk on the ground, past two trees, hills behind and the sun over them. */
function OutsideArt() {
  return (
    <>
      <path
        d="M70 86C88 70 108 66 128 72C138 75 146 80 154 82"
        vectorEffect={HAIRLINE}
        {...props(styles.line, styles.faint)}
      />
      <circle cx={126} cy={26} r={7} vectorEffect={HAIRLINE} {...props(styles.line)} />
      <path d={RAYS} vectorEffect={HAIRLINE} {...props(styles.line, styles.faint)} />
      <circle cx={34} cy={50} r={13} vectorEffect={HAIRLINE} {...props(styles.line)} />
      <path d="M34 63V86" vectorEffect={HAIRLINE} {...props(styles.line)} />
      <circle cx={56} cy={64} r={8} vectorEffect={HAIRLINE} {...props(styles.line)} />
      <path d="M56 72V86" vectorEffect={HAIRLINE} {...props(styles.line)} />
      <circle cx={92} cy={41} r={4.5} vectorEffect={HAIRLINE} {...props(styles.line)} />
      <path
        d="M91.5 46L89 64 M91 49.5L85.5 58.5 M91 49.5L97 57 M89 64L83.5 86 M89 64L94.5 74L97 86"
        vectorEffect={HAIRLINE}
        {...props(styles.line)}
      />
      <path d="M6 86H154" vectorEffect={HAIRLINE} {...props(styles.line)} />
    </>
  );
}

/** A tile: its place in the grid, its words, and its drawing or its icon. */
type Tile = { area: string; text: () => string } & (
  | { Art: ComponentType<Rise>; big?: boolean; view: string }
  | { Icon: IconComponent }
);

/** The tiles in reading order, each loss next to the gain it makes room for. */
const TILES: ReadonlyArray<Tile> = [
  { area: 'project', Art: ProjectArt, big: true, text: m.home_uses_project, view: VIEWS.project },
  { area: 'couch', Icon: Sofa, text: m.home_uses_project_loss },
  { area: 'bed', Icon: Bed, text: m.home_uses_book_loss },
  { area: 'book', Art: BookArt, text: m.home_uses_book, view: VIEWS.book },
  { area: 'mom', Art: CallArt, text: m.home_uses_mom, view: VIEWS.call },
  { area: 'strangers', Icon: Users, text: m.home_uses_mom_loss },
  { area: 'sundays', Icon: PlayCircle, text: m.home_uses_outside_loss },
  { area: 'outside', Art: OutsideArt, big: true, text: m.home_uses_outside, view: VIEWS.outside },
];

/** Something the phone is for again, its drawing over its words. */
function Gain({
  area,
  Art,
  big = false,
  rise,
  text,
  view,
}: {
  area: string;
  Art: ComponentType<Rise>;
  big?: boolean | undefined;
  rise: Rise;
  text: string;
  view: string;
}) {
  return (
    <li {...props(styles.tile, styles.gain, styles.area(area), riseStyle(rise))}>
      <span {...props(styles.art)}>
        <svg aria-hidden="true" viewBox={view} {...props(styles.drawing, big && styles.drawingBig)}>
          <Art {...rise} />
        </svg>
      </span>
      <span {...props(styles.gainText)}>{text}</span>
    </li>
  );
}

/** Something the feeds took, its icon slashed and the thing itself struck through. */
function Loss({
  area,
  Icon,
  rise,
  text,
}: {
  area: string;
  Icon: IconComponent;
  rise: Rise;
  text: string;
}) {
  const [before, after] = m.home_uses_no_more({ loss: LOSS_SLOT }).split(LOSS_SLOT);
  return (
    <li {...props(styles.tile, styles.loss, styles.area(area), riseStyle(rise))}>
      <span {...props(styles.stage)}>
        <Icon aria-hidden="true" size={ICON} {...props(styles.icon)} />
        <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.slashMarks)}>
          <path d="M3.5 3.5L20.5 20.5" {...props(styles.slash, styles.slashGap)} />
          <path d="M3.5 3.5L20.5 20.5" {...props(styles.slash)} />
        </svg>
      </span>
      <span>
        {before}
        <span
          {...props(
            styles.struck,
            rise.hidden && styles.struckHidden,
            rise.wait !== null && [styles.struckDraw, styles.after(rise.wait + TIMES.lead)],
          )}
        >
          {text}
        </span>
        {after}
      </span>
    </li>
  );
}

/**
 * What the feeds take and what the phone is for once they are off it, mixed
 * in one grid: each gain a tile with a small drawing, each loss a quieter
 * tile beside it, struck through in orange.
 *
 * The server draws every tile in place, so none waits on the script. Only a
 * tile still under the window once the page has come alive hides, and rises
 * once its top comes up the window, `stagger` after the one before it when
 * they come up together, as a row does. A loss's strike then draws, and the
 * side project's bar fills. A tile already on screen stays as it is, and with
 * less motion every tile stands still.
 */
export function UsesGrid() {
  const grid = useRef<HTMLUListElement>(null);
  const reduced = useLessMotion();
  // Which tiles were under the window as the page came alive, by place.
  const [below, setBelow] = useState<ReadonlyArray<boolean>>([]);
  // How long each tile's rise waits, by place, once it has come up the window.
  const [waits, setWaits] = useState<ReadonlyMap<number, number>>(new Map());

  // Measured once, as the page comes alive and before it paints again: only a
  // tile wholly under the window is hidden, where nobody sees it go.
  useLayoutEffect(() => {
    const tiles = grid.current?.children;
    if (tiles !== undefined) {
      setBelow(Array.from(tiles, (tile) => tile.getBoundingClientRect().top > window.innerHeight));
    }
  }, []);

  const rising = !reduced && below.includes(true);

  // One watch over every hidden tile, so tiles that come up together are told
  // in the grid's order. Each starts no sooner than `stagger` after the last.
  useEffect(() => {
    const list = grid.current;
    if (!rising || list === null) {
      return;
    }
    const tiles = [...list.children];
    let last = Number.NEGATIVE_INFINITY;
    return inView(
      tiles.filter((_, index) => below[index] === true),
      (tile) => {
        const now = performance.now();
        last = Math.max(now, last + TIMES.stagger);
        const place = tiles.indexOf(tile);
        const wait = last - now;
        setWaits((was) => new Map(was).set(place, wait));
      },
      { margin: SEEN },
    );
  }, [below, rising]);

  return (
    <ul ref={grid} {...props(styles.grid)}>
      {TILES.map((tile, place) => {
        const hides = rising && below[place] === true;
        const wait = waits.get(place);
        const rise = {
          hidden: hides && wait === undefined,
          wait: hides && wait !== undefined ? wait : null,
        };
        return 'Art' in tile ? (
          <Gain
            area={tile.area}
            Art={tile.Art}
            big={tile.big}
            key={tile.area}
            rise={rise}
            text={tile.text()}
            view={tile.view}
          />
        ) : (
          <Loss area={tile.area} Icon={tile.Icon} key={tile.area} rise={rise} text={tile.text()} />
        );
      })}
    </ul>
  );
}
