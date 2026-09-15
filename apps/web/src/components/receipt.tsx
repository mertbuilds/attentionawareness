import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, props } from '@stylexjs/stylex';
import {
  formatYears,
  heroMetrics,
  HORIZON_YEARS,
  yearsAndMonths,
  WAKING_HOURS,
} from '../lib/attention-math.ts';
import { playTick } from '../lib/sounds.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { InfoTip } from './info-tip.tsx';
import { HOURS_MAX, HOURS_MIN } from './screen-time-gate.tsx';

const DISPLAY_SIZE = 32;
/** The stamp is a picture: red ink on nothing, tilted as it was pressed. */
const STAMP_URL = '/stamp-cancelled.webp';

/** The paper itself: a shade off the page in both themes. */
const PAPER = `color-mix(in srgb, ${colors.bg} 92%, ${colors.fg})`;
/** Paper grain: one tile of fractal noise, faint, laid over the ground. */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.16 0'/></filter><rect width='160' height='160' filter='url(%23g)'/></svg>\")";
const styles = create({
  billHead: {
    alignItems: 'start',
    display: 'flex',
    gap: spacing.s4,
    justifyContent: 'space-between',
  },
  billIssuer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  billIssuerName: {
    fontWeight: font.weightMedium,
    margin: 0,
  },
  billIssuerUrl: {
    color: colors.muted,
    fontSize: 12,
    margin: 0,
  },
  // The document's name, the way an invoice prints it: large, top right.
  billKind: {
    fontSize: 24,
    fontWeight: font.weightBold,
    letterSpacing: '0.06em',
    lineHeight: 1,
    margin: 0,
    textTransform: 'uppercase',
  },
  // Bill number, date, due, billed to: label on the left, value on the right.
  billMeta: {
    columnGap: spacing.s4,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    margin: 0,
    rowGap: 2,
  },
  billMetaLabel: {
    color: colors.muted,
    margin: 0,
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
  billTerms: {
    color: colors.muted,
    fontSize: 12,
    margin: 0,
  },
  paper: {
    maxWidth: 480,
    width: '100%',
  },
  receipt: {
    backgroundColor: PAPER,
    backgroundImage: PAPER_GRAIN,
    borderRadius: 4,
    boxShadow: `0 0 0 1px ${colors.border}`,
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
  receiptThanks: {
    fontWeight: font.weightMedium,
    margin: 0,
  },
  // The amount due: a heavy rule over it, the way a bill sets its total apart.
  receiptTotal: {
    alignItems: 'end',
    borderBlockStartColor: colors.fg,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 2,
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
  // Rubber stamp: slapped on over the total. The tilt is in the picture.
  stamp: {
    height: 'auto',
    insetBlockStart: '78%',
    insetInlineStart: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    width: '80%',
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
  printedOn,
  refunded = false,
  sound = false,
}: {
  hours: number;
  number: string;
  /** Given, the screen time row carries a minus and a plus for correcting it. */
  onChange?: (hours: number) => void;
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
  return (
    <div {...props(styles.paper)}>
      <div {...props(styles.receipt, refunded && styles.stamped)}>
        <div {...props(styles.billHead)}>
          <div {...props(styles.billIssuer)}>
            <p {...props(styles.billIssuerName)}>{m.home_receipt_store()}</p>
            <p {...props(styles.billIssuerUrl)}>{m.home_receipt_store_url()}</p>
          </div>
          <p {...props(styles.billKind)}>{m.home_bill_kind()}</p>
        </div>
        <dl {...props(styles.billMeta)}>
          <dt {...props(styles.billMetaLabel)}>{m.home_bill_no_label()}</dt>
          <dd {...props(styles.billMetaValue)}>{number}</dd>
          <dt {...props(styles.billMetaLabel)}>{m.home_bill_date_label()}</dt>
          <dd {...props(styles.billMetaValue)}>{printedOn}</dd>
          <dt {...props(styles.billMetaLabel)}>{m.home_bill_due_label()}</dt>
          <dd {...props(styles.billMetaValue)}>
            {m.home_bill_due_value({ years: HORIZON_YEARS })}
          </dd>
          <dt {...props(styles.billMetaLabel)}>{m.home_bill_to_label()}</dt>
          <dd {...props(styles.billMetaValue)}>{m.home_bill_to_value()}</dd>
        </dl>
        <p {...props(styles.billColumns)}>
          <span>{m.home_bill_col_item()}</span>
          <span>{m.home_bill_col_qty()}</span>
        </p>
        {/* The quantity on the bill: the hours a day, and on the live copy
        the minus and plus that correct them. */}
        <p {...props(styles.receiptRow)}>
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
        </p>
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
        <div {...props(styles.receiptTotal)}>
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
        </div>
        <div aria-hidden="true" {...props(styles.receiptRule)} />
        <div {...props(styles.receiptBlock)}>
          <p {...props(styles.billTerms)}>{m.home_bill_terms_label()}</p>
          <p {...props(styles.receiptThanks)}>{m.home_receipt_thanks()}</p>
        </div>
        {refunded ? (
          <img alt={m.home_receipt_refunded()} src={STAMP_URL} {...props(styles.stamp)} />
        ) : null}
      </div>
    </div>
  );
}
