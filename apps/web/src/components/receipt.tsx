import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, props } from '@stylexjs/stylex';
import { heroMetrics, HORIZON_YEARS, screenHours, screenYears } from '../lib/attention-math.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const DISPLAY_SIZE = 40;
/** The stripe a printed receipt ends on. Nothing scans it. */
const RECEIPT_BARCODE = '▌▐▌▌▐▌▐▐▌▌▐▌▐▌▌▐▌▐▐▌▌▐▌▐▌';

const styles = create({
  receipt: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: MONOSPACE,
    fontSize: 13,
    gap: spacing.s3,
    maxWidth: 420,
    padding: {
      '@media (min-width: 640px)': spacing.s4,
      default: spacing.s3,
    },
    textAlign: 'start',
    textTransform: 'uppercase',
    width: '100%',
  },
  receiptBarcode: {
    color: colors.muted,
    letterSpacing: '-0.05em',
    margin: 0,
    overflow: 'hidden',
    textAlign: 'center',
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
  receiptFootLine: {
    margin: 0,
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
  receiptOrder: {
    fontWeight: font.weightBold,
    lineHeight: 1.5,
    margin: 0,
    textTransform: 'none',
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
  const [books, workouts, dinners, money] = heroMetrics(hours, locale);
  return (
    <div {...props(styles.receipt, refunded && styles.stamped)}>
      <div {...props(styles.receiptHead)}>
        <p {...props(styles.receiptStore)}>{m.home_receipt_store()}</p>
        <p {...props(styles.receiptStoreUrl)}>{m.home_receipt_store_url()}</p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      <div {...props(styles.receiptMeta)}>
        <p {...props(styles.receiptMetaLine)}>
          <span>{m.home_receipt_no({ number })}</span>
          <span>{printedOn}</span>
        </p>
        <p {...props(styles.receiptMetaLine)}>{m.home_receipt_cashier()}</p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      {/* The deal, in words, before any number: this many hours a
      day, for this many years. */}
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptHeading)}>{m.home_receipt_order_label()}</p>
        <p {...props(styles.receiptOrder)}>
          {hours === 1
            ? m.home_receipt_order_one({ years: HORIZON_YEARS })
            : m.home_receipt_order({ hours, years: HORIZON_YEARS })}
        </p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptRow)}>
          <span>{m.home_receipt_scrolling_label({ hours, years: HORIZON_YEARS })}</span>
          <span {...props(styles.receiptValue)}>
            <NumberFlow locales={locale} value={screenHours(hours)} /> {m.home_receipt_hours_unit()}
          </span>
        </p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      {/* What the same hours were worth: the four things they would
      have bought, under one heading that says they were not bought. */}
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptHeading)}>{m.home_receipt_worth_label()}</p>
        {[
          { item: books, label: m.home_receipt_books_label() },
          { item: workouts, label: m.home_receipt_workouts_label() },
          { item: dinners, label: m.home_receipt_dinners_label() },
          { item: money, label: m.home_receipt_money_label() },
        ].map((row) =>
          row.item === undefined ? null : (
            <p key={row.item.key} {...props(styles.receiptRow)}>
              <span>{row.label}</span>
              <span {...props(styles.receiptValue)}>
                <NumberFlow locales={locale} prefix={row.item.prefix} value={row.item.amount} />
              </span>
            </p>
          ),
        )}
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptHeading)}>
          {m.home_receipt_total_label({ years: HORIZON_YEARS })}
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
          <span {...props(styles.receiptTotalNote)}>{m.home_receipt_total_note()}</span>
        </p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      <div {...props(styles.receiptFoot)}>
        <p {...props(styles.receiptFootLine)}>{m.home_receipt_paid()}</p>
        <p {...props(styles.receiptFootLine)}>{m.home_receipt_no_refunds()}</p>
        <p aria-hidden="true" {...props(styles.receiptBarcode)}>
          {RECEIPT_BARCODE}
        </p>
        <p {...props(styles.receiptThanks)}>{m.home_receipt_thanks()}</p>
      </div>
      {refunded ? (
        <span aria-label={m.home_receipt_refunded()} role="img" {...props(styles.stamp)}>
          {m.home_receipt_refunded()}
        </span>
      ) : null}
    </div>
  );
}
