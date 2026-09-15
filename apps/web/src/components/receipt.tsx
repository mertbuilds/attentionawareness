import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, props } from '@stylexjs/stylex';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useEffect, useRef } from 'react';
import {
  formatYears,
  heroMetrics,
  HORIZON_YEARS,
  yearsAndMonths,
  WAKING_HOURS,
} from '../lib/attention-math.ts';
import { loadClip, playClip } from '../lib/clips.ts';
import { playTick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { InfoTip } from './info-tip.tsx';
import { HOURS_MAX, HOURS_MIN } from './screen-time-gate.tsx';

const DISPLAY_SIZE = 32;
/** The stamp is a picture: red ink on nothing, tilted as it was pressed. */
const STAMP_URL = '/stamp-cancelled.webp';
const SITE_URL = 'https://attentionawareness.com';

/** The paper itself: a shade off the page in both themes. */
const PAPER = `color-mix(in srgb, ${colors.bg} 92%, ${colors.fg})`;
/** Paper grain: one tile of fractal noise, faint, laid over the ground. */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.16 0'/></filter><rect width='160' height='160' filter='url(%23g)'/></svg>\")";
/**
 * The sheet prints itself: every line under the title rises out of a blur,
 * one after the next, top to bottom. The measures are the motion tokens for
 * a text reveal - a 12px rise, a 3px blur, 500ms a line, 40ms between two.
 */
const LINE_BLUR = 3;
const LINE_DISTANCE = 12;
const LINE_MS = 500;
/** What a printed line sounds like, and what the total sounds like. */
const LINE_CLIP = '/media/bumm.mp3';
const TOTAL_CLIP = '/media/fahh.mp3';
/** Where the newest printed line is kept on the screen: a little under the middle. */
const PRINT_LINE_AT = 0.6;
/** One line every three quarters of a second: the bill prints, it does not flash. */
const LINE_STAGGER_MS = 750;
const SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * A line of the bill, held back until the sheet lands. `printing` takes the
 * line's own delay as its custom value; `printed` is the whole bill at once,
 * for a restored one and for the picture on a share card.
 */
const sheetLine: Variants = {
  held: { filter: `blur(${LINE_BLUR}px)`, opacity: 0, y: LINE_DISTANCE },
  printed: { filter: 'blur(0px)', opacity: 1, transition: { duration: 0 }, y: 0 },
  printing: (delay: number) => ({
    filter: 'blur(0px)',
    opacity: 1,
    transition: { delay, duration: LINE_MS / 1000, ease: SMOOTH_OUT },
    y: 0,
  }),
};

const styles = create({
  // The document's name, the way an invoice prints it: large, top right.
  billKind: {
    fontSize: 20,
    fontWeight: font.weightBold,
    letterSpacing: '-0.01em',
    lineHeight: 1.1,
    margin: 0,
    textAlign: 'center',
  },
  // The site, once, at the very foot.
  billSite: {
    color: colors.muted,
    fontSize: 12,
    margin: 0,
    textAlign: 'center',
  },
  // Bill number, date, due, billed to: label on the left, value on the right.
  // One row per pair, because each of them prints as its own line.
  billMeta: {
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    rowGap: 2,
  },
  billMetaLabel: {
    color: colors.muted,
    margin: 0,
  },
  billMetaRow: {
    columnGap: spacing.s4,
    display: 'flex',
    justifyContent: 'space-between',
  },
  billMetaValue: {
    fontVariantNumeric: 'tabular-nums',
    margin: 0,
    textAlign: 'end',
  },
  // Column heads over the line items, and a solid rule under them.
  billColumns: {
    borderBlockEndColor: colors.fg,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    color: colors.muted,
    display: 'flex',
    fontSize: 11,
    justifyContent: 'space-between',
    letterSpacing: '0.08em',
    margin: 0,
    paddingBlockEnd: spacing.s1,
    textTransform: 'uppercase',
  },
  billSiteLink: {
    color: 'inherit',
    textDecorationLine: 'none',
  },
  paper: {
    maxWidth: 480,
    width: '100%',
  },
  receipt: {
    backgroundColor: PAPER,
    backgroundImage: PAPER_GRAIN,
    // A real border, not a ring: the hero clips the paper's box while it
    // unrolls, and a ring outside the box is the first thing cut.
    borderColor: colors.border,
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontSize: 14,
    gap: spacing.s6,
    lineHeight: 1.4,
    maxWidth: 480,
    paddingBlock: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    paddingInline: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s4,
    },
    textAlign: 'start',
    width: '100%',
  },
  receiptBlock: {
    display: 'flex',
    flexDirection: 'column',
  },
  receiptLabel: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  // The minus and plus on the screen time row: small, borderless, in line.
  qtyButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: {
      ':disabled': colors.muted,
      ':hover': accent.base,
      default: colors.fg,
    },
    cursor: { ':disabled': 'default', default: 'pointer' },
    display: 'inline-flex',
    height: 28,
    justifyContent: 'center',
    opacity: { ':disabled': 0.4, default: 1 },
    padding: 0,
    width: 28,
  },
  qtyGlyph: {
    height: 16,
    width: 16,
  },
  receiptQty: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  // One line item: a hairline under each, so the list reads as a table.
  receiptRow: {
    alignItems: 'baseline',
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
    margin: 0,
    paddingBlock: spacing.s1,
  },
  receiptRule: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
  },
  // The amount due: a solid rule over it, the way a bill sets its total apart.
  receiptTotal: {
    alignItems: 'end',
    borderBlockStartColor: colors.fg,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    margin: 0,
    paddingBlockStart: spacing.s3,
  },
  // The inner total line takes the layout of the block, not its rule.
  receiptTotalBare: {
    borderBlockStartWidth: 0,
    paddingBlockStart: 0,
  },
  receiptTotalHeading: {
    alignItems: 'center',
    display: 'inline-flex',
    fontSize: 11,
    gap: spacing.s1,
    letterSpacing: '0.08em',
    margin: 0,
    textTransform: 'uppercase',
  },
  receiptTotalNote: {
    color: colors.muted,
  },
  receiptTotalValue: {
    color: accent.base,
    fontSize: DISPLAY_SIZE,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  receiptValue: {
    color: accent.base,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'end',
    whiteSpace: 'nowrap',
  },
  // Rubber stamp: slapped across the middle of the bill, tilted a little
  // past the tilt the picture already has.
  stamp: {
    height: 'auto',
    insetBlockStart: '50%',
    insetInlineStart: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translate(-50%, -50%) rotate(-10deg)',
    width: '84%',
  },
  stamped: {
    position: 'relative',
  },
});

/**
 * The bill for a day of scrolling, priced over the horizon. Every figure on it
 * rolls as the hours change. Refunded, it wears the stamp: the same bill, torn
 * up, for the reader to show around.
 */
export function Receipt({
  hours,
  number,
  onChange,
  print = 'printed',
  printedOn,
  refunded = false,
  sound = false,
}: {
  hours: number;
  number: string;
  /** Given, the screen time row carries a minus and a plus for correcting it. */
  onChange?: (hours: number) => void;
  /**
   * How the lines under the title arrive: all of them at once, held back
   * behind the title, or printed one after the next.
   */
  print?: 'held' | 'printed' | 'printing';
  printedOn: string;
  refunded?: boolean;
  sound?: boolean;
}) {
  function step(delta: number) {
    if (onChange === undefined) {
      return;
    }
    const next = Math.min(HOURS_MAX, Math.max(HOURS_MIN, hours + delta));
    if (next === hours) {
      return;
    }
    if (sound) {
      primeTickSound();
      playTick();
    }
    onChange(next);
  }
  const locale = getLocale();
  const span = yearsAndMonths(hours);
  const worth = heroMetrics(hours);
  const tips: Record<string, () => string> = {
    books: m.home_receipt_books_tip,
    degrees: m.home_receipt_degrees_tip,
    earth: m.home_receipt_earth_tip,
    instruments: m.home_receipt_instruments_tip,
    languages: m.home_receipt_languages_tip,
    marathons: m.home_receipt_marathons_tip,
    novels: m.home_receipt_novels_tip,
    skills: m.home_receipt_skills_tip,
    travel: m.home_receipt_travel_tip,
  };
  const labels: Record<string, () => string> = {
    books: m.home_receipt_books_label,
    degrees: m.home_receipt_degrees_label,
    earth: m.home_receipt_earth_label,
    instruments: m.home_receipt_instruments_label,
    languages: m.home_receipt_languages_label,
    marathons: m.home_receipt_marathons_label,
    novels: m.home_receipt_novels_label,
    skills: m.home_receipt_skills_label,
    travel: m.home_receipt_travel_label,
  };
  const reduced = useReducedMotion();
  const paper = useRef<HTMLDivElement>(null);
  // What the bill says, in the order the till prints it: four meta rows, the
  // column heads, the day itself, the items the day bought, and three lines
  // under them. Each line's place in that order is its place in the queue.
  const meta = [
    { label: m.home_bill_no_label(), value: number },
    { label: m.home_bill_date_label(), value: printedOn },
    { label: m.home_bill_due_label(), value: m.home_bill_due_value({ years: HORIZON_YEARS }) },
    { label: m.home_bill_to_label(), value: m.home_bill_to_value() },
  ];
  const rows = worth.filter((row) => row.amount > 0);
  // The head of the bill lands in one go; from the screen time row down,
  // one line a beat.
  const itemsAt = 2;
  const closeAt = itemsAt + rows.length;
  const beat = LINE_STAGGER_MS / 1000;
  // The newest line stays a little under the middle of the screen: when it
  // would print lower than that, the page scrolls up to meet it.
  function keepInView(step: number) {
    const lines = Array.from(
      paper.current?.querySelectorAll<HTMLElement>(`[data-line="${step}"]`) ?? [],
    );
    const line = lines.at(-1);
    if (line === undefined) {
      return;
    }
    const top = line.getBoundingClientRect().top;
    const rest = window.innerHeight * PRINT_LINE_AT;
    if (top > rest) {
      window.scrollBy({ behavior: 'smooth', top: top - rest });
    }
  }
  // Every line that lands makes the sound the feed makes: one for the head,
  // then one a beat down to the total.
  useEffect(() => {
    if (print !== 'printing' || !sound || reduced) {
      return;
    }
    // Every line lands with a thud; the last batch, the total, with the thud
    // and the fahh together.
    void loadClip(LINE_CLIP);
    void loadClip(TOTAL_CLIP);
    const timers = Array.from({ length: closeAt + 1 }, (_, step) =>
      setTimeout(() => {
        playClip(LINE_CLIP);
        if (step === closeAt) {
          playClip(TOTAL_CLIP);
        }
        keepInView(step);
      }, step * LINE_STAGGER_MS),
    );
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
    // The print runs once, and the ticks with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot print
  }, [print]);
  // A reader who asked for less motion is handed the whole bill at once.
  const state = reduced ? 'printed' : print;
  return (
    <div {...props(styles.paper)}>
      <motion.div
        animate={state}
        initial={false}
        ref={paper}
        {...props(styles.receipt, refunded && styles.stamped)}
      >
        <p {...props(styles.billKind)}>{m.home_bill_kind()}</p>
        <dl {...props(styles.billMeta)}>
          {meta.map((row) => (
            <motion.div
              custom={0}
              key={row.label}
              variants={sheetLine}
              {...props(styles.billMetaRow)}
            >
              <dt {...props(styles.billMetaLabel)}>{row.label}</dt>
              <dd {...props(styles.billMetaValue)}>{row.value}</dd>
            </motion.div>
          ))}
        </dl>
        <motion.p custom={0} data-line={0} variants={sheetLine} {...props(styles.billColumns)}>
          <span>{m.home_bill_col_item()}</span>
          <span>{m.home_bill_col_qty()}</span>
        </motion.p>
        {/* The quantity on the bill: the hours a day, and on the live copy
        the minus and plus that correct them. */}
        <motion.p custom={beat} data-line={1} variants={sheetLine} {...props(styles.receiptRow)}>
          <span>{m.home_receipt_screen_label()}</span>
          <span {...props(styles.receiptQty)}>
            {onChange === undefined ? null : (
              <button
                aria-label={m.home_gate_minus()}
                disabled={hours <= HOURS_MIN}
                onClick={() => step(-1)}
                onPointerUp={unlockTickSound}
                type="button"
                {...props(styles.qtyButton)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.qtyGlyph)}>
                  <path
                    d="M5 12h14"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  />
                </svg>
              </button>
            )}
            <span {...props(styles.receiptValue)}>
              <NumberFlow locales={locale} suffix={m.home_receipt_per_day()} value={hours} />
            </span>
            {onChange === undefined ? null : (
              <button
                aria-label={m.home_gate_plus()}
                disabled={hours >= HOURS_MAX}
                onClick={() => step(1)}
                onPointerUp={unlockTickSound}
                type="button"
                {...props(styles.qtyButton)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.qtyGlyph)}>
                  <path
                    d="M5 12h14M12 5v14"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  />
                </svg>
              </button>
            )}
          </span>
        </motion.p>
        {/* What the same hours would have bought, smallest to largest. */}
        <div {...props(styles.receiptBlock)}>
          {rows.map((row, index) => (
            <motion.p
              custom={(itemsAt + index) * beat}
              data-line={itemsAt + index}
              key={row.key}
              variants={sheetLine}
              {...props(styles.receiptRow)}
            >
              <span {...props(styles.receiptLabel)}>
                {labels[row.key]?.() ?? row.key}
                <InfoTip label={m.home_receipt_tip_label()}>{tips[row.key]?.()}</InfoTip>
              </span>
              <span {...props(styles.receiptValue)}>
                <NumberFlow locales={locale} value={row.amount} />
              </span>
            </motion.p>
          ))}
        </div>
        <motion.div custom={closeAt * beat} variants={sheetLine} {...props(styles.receiptTotal)}>
          <p {...props(styles.receiptTotalHeading)}>
            {m.home_receipt_total_label()}
            <InfoTip label={m.home_receipt_tip_label()}>
              {m.home_receipt_total_tip({
                hours,
                percent: Math.round((hours / WAKING_HOURS) * 100),
                years: formatYears(hours),
              })}
            </InfoTip>
          </p>
          <p {...props(styles.receiptTotal, styles.receiptTotalBare)}>
            <span {...props(styles.receiptTotalValue)}>
              <NumberFlow locales={locale} value={span.years} /> {m.home_receipt_years_unit()}
              {span.months > 0 ? (
                <>
                  {' '}
                  <NumberFlow locales={locale} value={span.months} /> {m.home_receipt_months_unit()}
                </>
              ) : null}
            </span>
            <span {...props(styles.receiptTotalNote)}>
              {m.home_receipt_total_note({ years: HORIZON_YEARS })}
            </span>
          </p>
        </motion.div>
        <motion.div
          aria-hidden="true"
          custom={closeAt * beat}
          variants={sheetLine}
          {...props(styles.receiptRule)}
        />
        <motion.p
          custom={closeAt * beat}
          data-line={closeAt}
          variants={sheetLine}
          {...props(styles.billSite)}
        >
          <a data-plain="" href={SITE_URL} {...props(styles.billSiteLink)}>
            {m.home_receipt_store_url()}
          </a>
        </motion.p>
        {refunded ? (
          <img alt={m.home_receipt_refunded()} src={STAMP_URL} {...props(styles.stamp)} />
        ) : null}
      </motion.div>
    </div>
  );
}
