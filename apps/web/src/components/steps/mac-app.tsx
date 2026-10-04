import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { BrandMark } from '../brand-mark.tsx';
import { SCREEN } from './laptop.tsx';
import { AppGlyph, AppSquare, FEEDS, FeedIcon, type Glyph, ICON } from './phone.tsx';

/**
 * The app's window fills the laptop's screen: the bar along its top and the
 * three buttons at its left, then the column every step of the app stands
 * in, this far in from the window's sides.
 */
const TITLE_BAR = 9;
const LIGHTS = { left: 5, pitch: 5, radius: 1.5 };
const INSET = 7;
/** The mark and the step's title beside it, as the length of a bar. */
const MARK = 8;
const HEAD_Y = TITLE_BAR + 4 + MARK / 2;
const HEAD = 40;
const HEAD_X = INSET + MARK + 4;
/** Where the step's own content starts under its title. */
const BODY_Y = HEAD_Y + MARK / 2 + 4;
/** The app's one filled button, at the foot of the column, and the word on it as a bar. */
const BUTTON = { height: 8, width: 28, x: INSET, y: SCREEN.height - 14 };
const BUTTON_WORD = 16;
/**
 * The hero's Mac is read at a glance, so its screen holds two things, each
 * large enough to read there: the mark, and under it the one button.
 */
const BIG_MARK = 18;
const BIG_BUTTON = { height: 14, width: 52, x: (SCREEN.width - 52) / 2, y: 41 };
/** How far the button gives under the press, and the ring the press sends out. */
const DIP = 0.06;
const RING_GROW = 0.5;
const RING_OPACITY = 0.5;
/** The button's orange wash at rest, and once it is pressed. */
const WASH = 0.12;
const WASH_PRESSED = 0.4;

/** The list of apps: one row a pitch, an app's square at this share of a home screen's. */
const ROW_PITCH = 8;
const ROW_ICON = 0.5;
const ROW_NAME_X = INSET + ICON * ROW_ICON + 4;
/** Each row: a feed, ticked, or an app the reader keeps, left as it is, and its name as a bar. */
const ROWS: ReadonlyArray<{ feed: string; name: number } | { glyph: Glyph; name: number }> = [
  { feed: FEEDS[0], name: 30 },
  { glyph: 'messages', name: 24 },
  { feed: FEEDS[1], name: 36 },
];
/** The box at a row's end, and the tick drawn in it. */
const BOX = { radius: 1.2, size: 5 };
const TICK = 'M-1.3 0.1 L-0.3 1.1 L1.4 -1';

/** The iPhone on the cable, as the app shows it: a card with its glyph, its name and a quiet line. */
const CARD = { height: 16, radius: 3, y: BODY_Y + 2 };
const CARD_PHONE = { height: 9, radius: 1.5, width: 5 };
const CARD_NAME = 30;
const CARD_META = 20;

/** The bar a run fills as it goes, and the quiet line under it. */
const PROGRESS_Y = BODY_Y + 6;
const PROGRESS_LINE = 30;

const styles = create({
  button: {
    fill: accent.base,
    stroke: accent.base,
    strokeWidth: 1,
  },
  // The window's buttons, its bar's edge and the quiet lines, a step fainter
  // than the window.
  faint: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1,
  },
  // The loud lines in the window: the step's title, and the name on the
  // iPhone's card.
  head: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 2,
  },
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  progress: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 2,
  },
  ring: {
    fill: 'none',
    stroke: accent.base,
    strokeWidth: 1,
  },
  tick: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  ticked: {
    fill: accent.base,
    fillOpacity: WASH,
    stroke: accent.base,
    strokeWidth: 1,
  },
  // The word on the button, as a bar in the button's orange.
  word: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  // A bar standing for words, as thick as a line of small type.
  words: {
    strokeWidth: 1.5,
  },
});

/** Which of the app's steps is on the screen, or `press`, the hero's mark and button alone. */
export type MacAppScreen = 'apps' | 'connect' | 'press' | 'sending';

/**
 * The app's one button, at `box`, orange at rest. `pressed` deepens its wash
 * from `WASH` to `WASH_PRESSED`; it sinks `dip` of the way under the press
 * and sends out a ring as `ring` goes from 0 to 1. `word` is the length of
 * the bar that stands for the word on it; the hero's large button has none.
 */
function PrimaryButton({
  box = BUTTON,
  dip,
  pressed,
  ring,
  word = BUTTON_WORD,
}: {
  box?: { height: number; width: number; x: number; y: number };
  dip: number;
  pressed: number;
  ring: number;
  word?: number;
}) {
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const shape = {
    height: box.height,
    rx: box.height / 2,
    width: box.width,
    x: -box.width / 2,
    y: -box.height / 2,
  };
  return (
    <>
      <g transform={`translate(${middle.x} ${middle.y}) scale(${1 - DIP * dip})`}>
        <rect
          fillOpacity={WASH + (WASH_PRESSED - WASH) * pressed}
          {...shape}
          {...props(styles.button)}
        />
        {word > 0 ? <path d={`M${-word / 2} 0 h${word}`} {...props(styles.word)} /> : null}
      </g>
      {ring > 0 && ring < 1 ? (
        <rect
          opacity={RING_OPACITY * (1 - ring)}
          transform={`translate(${middle.x} ${middle.y}) scale(${1 + RING_GROW * ring})`}
          {...shape}
          {...props(styles.ring)}
        />
      ) : null}
    </>
  );
}

/** The feeds on the list, ticked, among an app the reader keeps. */
function AppRows() {
  const boxX = SCREEN.width - INSET - BOX.size / 2;
  return ROWS.map((row, index) => {
    const y = BODY_Y + ROW_PITCH * (index + 0.5);
    const ticked = 'feed' in row;
    return (
      <g key={index}>
        <g transform={`translate(${INSET + (ICON * ROW_ICON) / 2} ${y}) scale(${ROW_ICON})`}>
          {ticked ? (
            <FeedIcon bundleId={row.feed} />
          ) : (
            <>
              <AppSquare />
              <AppGlyph glyph={row.glyph} />
            </>
          )}
        </g>
        <path d={`M${ROW_NAME_X} ${y} h${row.name}`} {...props(styles.faint, styles.words)} />
        <g transform={`translate(${boxX} ${y})`}>
          <rect
            height={BOX.size}
            rx={BOX.radius}
            width={BOX.size}
            x={-BOX.size / 2}
            y={-BOX.size / 2}
            {...props(ticked ? styles.ticked : styles.line)}
          />
          {ticked ? <path d={TICK} {...props(styles.tick)} /> : null}
        </g>
      </g>
    );
  });
}

/** The iPhone on the cable, once the app has `found` it. */
function PhoneCard({ found }: { found: number }) {
  const width = SCREEN.width - 2 * INSET;
  const middle = CARD.y + CARD.height / 2;
  const textX = INSET + 5 + CARD_PHONE.width + 5;
  return (
    <g opacity={found}>
      <rect
        height={CARD.height}
        rx={CARD.radius}
        width={width}
        x={INSET}
        y={CARD.y}
        {...props(styles.line)}
      />
      <rect
        height={CARD_PHONE.height}
        rx={CARD_PHONE.radius}
        width={CARD_PHONE.width}
        x={INSET + 5}
        y={middle - CARD_PHONE.height / 2}
        {...props(styles.line)}
      />
      <path d={`M${textX} ${middle - 2} h${CARD_NAME}`} {...props(styles.head, styles.words)} />
      <path d={`M${textX} ${middle + 3} h${CARD_META}`} {...props(styles.faint)} />
    </g>
  );
}

/** The run's bar, filled `progress` of the way, and the quiet line saying what it does. */
function Progress({ progress }: { progress: number }) {
  const width = SCREEN.width - 2 * INSET;
  return (
    <>
      <path d={`M${INSET} ${PROGRESS_Y} h${width}`} {...props(styles.faint, styles.words)} />
      {progress > 0 ? (
        <path d={`M${INSET} ${PROGRESS_Y} h${width * progress}`} {...props(styles.progress)} />
      ) : null}
      <path d={`M${INSET} ${PROGRESS_Y + 7} h${PROGRESS_LINE}`} {...props(styles.faint)} />
    </>
  );
}

/**
 * The attention awareness Mac app, small, on the laptop's screen and in its
 * units: its window with the mark and the step's title at the top of its
 * column, and under them the step on `screen`. `connect` waits for the
 * iPhone and shows its card as far as `found`; `apps` is the list with the
 * feeds ticked. Both end in the button, `pressed`, given `dip` and sending
 * out `ring` as the press lands. `sending` fills its bar as far as `progress`
 * in the button's place. Lines stand for the words, which no screen this
 * small could hold. `press` is the hero's: the mark and the button, large,
 * and nothing else.
 */
export function MacApp({
  dip = 0,
  found = 1,
  pressed = 0,
  progress = 0,
  ring = 0,
  screen,
}: {
  dip?: number;
  found?: number;
  pressed?: number;
  progress?: number;
  ring?: number;
  screen: MacAppScreen;
}) {
  if (screen === 'press') {
    return (
      <>
        <g transform={`translate(${(SCREEN.width - BIG_MARK) / 2} 12)`}>
          <BrandMark size={BIG_MARK} />
        </g>
        <PrimaryButton box={BIG_BUTTON} dip={dip} pressed={pressed} ring={ring} word={0} />
      </>
    );
  }
  return (
    <>
      <path d={`M0 ${TITLE_BAR} H${SCREEN.width}`} {...props(styles.faint)} />
      {[0, 1, 2].map((light) => (
        <circle
          cx={LIGHTS.left + light * LIGHTS.pitch}
          cy={TITLE_BAR / 2}
          key={light}
          r={LIGHTS.radius}
          {...props(styles.faint)}
        />
      ))}
      <g transform={`translate(${INSET} ${HEAD_Y - MARK / 2})`}>
        <BrandMark size={MARK} />
      </g>
      <path d={`M${HEAD_X} ${HEAD_Y} h${HEAD}`} {...props(styles.head)} />
      {screen === 'connect' ? <PhoneCard found={found} /> : null}
      {screen === 'apps' ? <AppRows /> : null}
      {screen === 'sending' ? <Progress progress={progress} /> : null}
      {screen === 'sending' ? null : <PrimaryButton dip={dip} pressed={pressed} ring={ring} />}
    </>
  );
}
