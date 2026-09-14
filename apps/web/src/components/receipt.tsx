import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, props } from '@stylexjs/stylex';
import { heroMetrics, HORIZON_YEARS, screenYears } from '../lib/attention-math.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { InfoTip } from './info-tip.tsx';

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const DISPLAY_SIZE = 40;

/** The paper itself: a shade off the page in both themes. */
const PAPER = `color-mix(in srgb, ${colors.bg} 92%, ${colors.fg})`;
/** Paper grain: one tile of fractal noise, faint, laid over the ground. */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.16 0'/></filter><rect width='160' height='160' filter='url(%23g)'/></svg>\")";
/**
 * The torn top and bottom, as one polygon the paper is cut to: 28 teeth of
 * up to 7px, with a little wobble. Written out because StyleX reads it at
 * build time.
 */
const TORN_EDGE =
  'polygon(0.00% 0px, 3.57% 8px, 7.14% 2px, 10.71% 7px, 14.29% 1px, 17.86% 9px, 21.43% 0px, 25.00% 8px, 28.57% 2px, 32.14% 7px, 35.71% 1px, 39.29% 9px, 42.86% 0px, 46.43% 8px, 50.00% 2px, 53.57% 7px, 57.14% 1px, 60.71% 9px, 64.29% 0px, 67.86% 8px, 71.43% 2px, 75.00% 7px, 78.57% 1px, 82.14% 9px, 85.71% 0px, 89.29% 8px, 92.86% 2px, 96.43% 7px, 100.00% 1px, 100.00% calc(100% - 0px), 96.43% calc(100% - 8px), 92.86% calc(100% - 2px), 89.29% calc(100% - 7px), 85.71% calc(100% - 1px), 82.14% calc(100% - 9px), 78.57% calc(100% - 0px), 75.00% calc(100% - 8px), 71.43% calc(100% - 2px), 67.86% calc(100% - 7px), 64.29% calc(100% - 1px), 60.71% calc(100% - 9px), 57.14% calc(100% - 0px), 53.57% calc(100% - 8px), 50.00% calc(100% - 2px), 46.43% calc(100% - 7px), 42.86% calc(100% - 1px), 39.29% calc(100% - 9px), 35.71% calc(100% - 0px), 32.14% calc(100% - 8px), 28.57% calc(100% - 2px), 25.00% calc(100% - 7px), 21.43% calc(100% - 1px), 17.86% calc(100% - 9px), 14.29% calc(100% - 0px), 10.71% calc(100% - 8px), 7.14% calc(100% - 2px), 3.57% calc(100% - 7px), 0.00% calc(100% - 1px))';

const styles = create({
  barcode: {
    color: colors.fg,
    display: 'block',
    height: 44,
    marginInline: 'auto',
    width: '70%',
  },
  paper: {
    maxWidth: 420,
    width: '100%',
  },
  receipt: {
    backgroundColor: PAPER,
    backgroundImage: PAPER_GRAIN,
    boxSizing: 'border-box',
    clipPath: TORN_EDGE,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: MONOSPACE,
    fontSize: 13,
    gap: spacing.s3,
    maxWidth: 420,
    paddingBlock: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    paddingInline: {
      '@media (min-width: 640px)': spacing.s4,
      default: spacing.s3,
    },
    textAlign: 'start',
    textTransform: 'uppercase',
    width: '100%',
  },
  receiptBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  receiptFoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  receiptHead: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    textAlign: 'center',
  },
  receiptHeading: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: '0.12em',
    margin: 0,
    marginBlockEnd: spacing.s1,
  },
  receiptLabel: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  receiptMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  receiptMetaLine: {
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
    margin: 0,
  },
  receiptRow: {
    alignItems: 'baseline',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
    lineHeight: 1.6,
    margin: 0,
  },
  receiptRule: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'dashed',
    borderBlockStartWidth: 1,
  },
  receiptStore: {
    fontWeight: font.weightBold,
    letterSpacing: '0.2em',
    margin: 0,
  },
  receiptStoreUrl: {
    color: colors.muted,
    margin: 0,
    textAlign: 'center',
    textTransform: 'none',
  },
  receiptThanks: {
    margin: 0,
    textAlign: 'center',
  },
  receiptTotal: {
    alignItems: 'end',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    margin: 0,
  },
  receiptTotalNote: {
    color: colors.muted,
    textTransform: 'none',
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
  stamp: {
    borderColor: colors.error,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 4,
    color: colors.error,
    fontSize: 44,
    fontWeight: font.weightBold,
    insetBlockStart: '58%',
    insetInlineStart: '50%',
    letterSpacing: '0.2em',
    opacity: 0.85,
    paddingBlock: spacing.s1,
    paddingInline: spacing.s3,
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translate(-50%, -50%) rotate(-14deg)',
    whiteSpace: 'nowrap',
  },
  stamped: {
    position: 'relative',
  },
});

/** Bar widths in modules, the way Code 128 spaces them: narrow to wide. */
const BAR_WIDTHS = [1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 4, 1, 2, 2, 1, 1, 3, 2, 1, 1];
/** Bars in the stripe, with a quiet zone either side. */
const BAR_COUNT = 46;

/**
 * The stripe a printed receipt ends on. Nothing scans it, but it is drawn the
 * way a scanner would want it: bars of one to four modules, spaced the same,
 * in an order the receipt number decides, so the same bill prints the same
 * stripe.
 */
function Barcode({ seed }: { seed: string }) {
  const bars: Array<{ width: number; x: number }> = [];
  let x = 0;
  for (let index = 0; index < BAR_COUNT; index += 1) {
    const digit = Number(seed[index % seed.length] ?? 0);
    const width = BAR_WIDTHS[(index + digit) % BAR_WIDTHS.length] ?? 1;
    const gap = BAR_WIDTHS[(index * 7 + digit) % BAR_WIDTHS.length] ?? 1;
    bars.push({ width, x });
    x += width + gap;
  }
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      viewBox={`0 0 ${x} 40`}
      {...props(styles.barcode)}
    >
      {bars.map((bar) => (
        <rect fill="currentColor" height="40" key={bar.x} width={bar.width} x={bar.x} y="0" />
      ))}
    </svg>
  );
}

/**
 * The bill for a day of scrolling, priced over the horizon. Every figure on it
 * rolls as the hours change. Refunded, it wears the stamp: the same bill, torn
 * up, for the reader to show around.
 */
export function Receipt({
  hours,
  number,
  printedOn,
  refunded = false,
}: {
  hours: number;
  number: string;
  printedOn: string;
  refunded?: boolean;
}) {
  const locale = getLocale();
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
  return (
    <div {...props(styles.paper)}>
      <div {...props(styles.receipt, refunded && styles.stamped)}>
        <div {...props(styles.receiptHead)}>
          <p {...props(styles.receiptStore)}>{m.home_receipt_store()}</p>
        </div>
        <div aria-hidden="true" {...props(styles.receiptRule)} />
        <div {...props(styles.receiptMeta)}>
          <p {...props(styles.receiptMetaLine)}>
            <span>{m.home_receipt_no({ number })}</span>
            <span>{printedOn}</span>
          </p>
        </div>
        <div aria-hidden="true" {...props(styles.receiptRule)} />
        {/* What the same hours would have bought, smallest to largest. */}
        <div {...props(styles.receiptBlock)}>
          {worth
            .filter((row) => row.amount > 0)
            .map((row) => (
              <p key={row.key} {...props(styles.receiptRow)}>
                <span {...props(styles.receiptLabel)}>
                  {labels[row.key]?.() ?? row.key}
                  <InfoTip label={m.home_receipt_tip_label()}>{tips[row.key]?.()}</InfoTip>
                </span>
                <span {...props(styles.receiptValue)}>
                  <NumberFlow locales={locale} value={row.amount} />
                </span>
              </p>
            ))}
        </div>
        <div aria-hidden="true" {...props(styles.receiptRule)} />
        <div {...props(styles.receiptBlock)}>
          <p {...props(styles.receiptHeading, styles.receiptLabel)}>
            {m.home_receipt_total_label()}
            <InfoTip label={m.home_receipt_tip_label()}>{m.home_receipt_total_tip()}</InfoTip>
          </p>
          <p {...props(styles.receiptTotal)}>
            <span {...props(styles.receiptTotalValue)}>
              <NumberFlow
                format={{ maximumFractionDigits: 2 }}
                locales={locale}
                value={screenYears(hours)}
              />{' '}
              {m.home_receipt_years_unit()}
            </span>
            <span {...props(styles.receiptTotalNote)}>
              {m.home_receipt_total_note({ years: HORIZON_YEARS })}
            </span>
          </p>
        </div>
        <div aria-hidden="true" {...props(styles.receiptRule)} />
        <div {...props(styles.receiptFoot)}>
          <Barcode seed={number} />
          <p {...props(styles.receiptThanks)}>{m.home_receipt_thanks()}</p>
          <p {...props(styles.receiptStoreUrl)}>{m.home_receipt_store_url()}</p>
        </div>
        {refunded ? (
          <span aria-label={m.home_receipt_refunded()} role="img" {...props(styles.stamp)}>
            {m.home_receipt_refunded()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
