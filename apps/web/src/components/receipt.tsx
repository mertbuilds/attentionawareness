import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import NumberFlow from '@number-flow/react';
import { create, props } from '@stylexjs/stylex';
import {
  adRevenue,
  heroMetrics,
  HORIZON_YEARS,
  screenHours,
  screenYears,
} from '../lib/attention-math.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { InfoTip } from './info-tip.tsx';

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

/** Marks the figures inside the order line, so they alone can take the accent. */
const FIGURE = '\u0000';

/**
 * The order in words, cut around its two figures. The catalog keeps the word
 * order; the figures are put back where the marks were, in the accent.
 */
function orderParts(hours: number): Array<{ figure: boolean; text: string }> {
  const figures = hours === 1 ? [String(HORIZON_YEARS)] : [String(hours), String(HORIZON_YEARS)];
  const line =
    hours === 1
      ? m.home_receipt_order_one({ years: FIGURE })
      : m.home_receipt_order({ hours: FIGURE, years: FIGURE });
  const parts: Array<{ figure: boolean; text: string }> = [];
  line.split(FIGURE).forEach((text, index) => {
    if (index > 0) {
      parts.push({ figure: true, text: figures[index - 1] ?? '' });
    }
    if (text !== '') {
      parts.push({ figure: false, text });
    }
  });
  return parts;
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
    skills: m.home_receipt_skills_tip,
  };
  const labels: Record<string, () => string> = {
    books: m.home_receipt_books_label,
    degrees: m.home_receipt_degrees_label,
    earth: m.home_receipt_earth_label,
    instruments: m.home_receipt_instruments_label,
    languages: m.home_receipt_languages_label,
    skills: m.home_receipt_skills_label,
  };
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
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      {/* The deal, in words, before any number: this many hours a
      day, for this many years. */}
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptHeading)}>{m.home_receipt_order_label()}</p>
        <p {...props(styles.receiptOrder)}>
          {orderParts(hours).map((part, index) =>
            part.figure ? (
              // eslint-disable-next-line react/no-array-index-key -- static split of one sentence
              <span key={index} {...props(styles.receiptValue)}>
                {part.text}
              </span>
            ) : (
              part.text
            ),
          )}
        </p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      {/* What went over the counter. */}
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptHeading)}>{m.home_receipt_gave_label()}</p>
        <p {...props(styles.receiptRow)}>
          <span {...props(styles.receiptLabel)}>
            {m.home_receipt_attention_label()}
            <InfoTip label={m.home_receipt_tip_label()}>
              {m.home_receipt_attention_tip({ years: HORIZON_YEARS })}
            </InfoTip>
          </span>
          <span {...props(styles.receiptValue)}>
            <NumberFlow locales={locale} value={screenHours(hours)} /> {m.home_receipt_hours_unit()}
          </span>
        </p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      {/* What the other side of the counter made on it. */}
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptHeading)}>{m.home_receipt_got_label()}</p>
        <p {...props(styles.receiptRow)}>
          <span {...props(styles.receiptLabel)}>
            {m.home_receipt_ad_revenue_label()}
            <InfoTip label={m.home_receipt_tip_label()}>
              {m.home_receipt_ad_revenue_note({ years: HORIZON_YEARS })}
            </InfoTip>
          </span>
          <span {...props(styles.receiptValue)}>
            <NumberFlow locales={locale} prefix="~$" value={adRevenue()} />
          </span>
        </p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      {/* What the same hours would have bought, smallest to largest. */}
      <div {...props(styles.receiptBlock)}>
        <p {...props(styles.receiptHeading)}>{m.home_receipt_worth_label()}</p>
        {worth.map((row) => (
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
        </p>
      </div>
      <div aria-hidden="true" {...props(styles.receiptRule)} />
      <div {...props(styles.receiptFoot)}>
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
