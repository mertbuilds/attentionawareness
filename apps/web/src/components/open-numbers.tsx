import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { Fragment, useId, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { posthog } from '../lib/analytics.ts';
import { layout } from '../lib/layout.ts';
import { distance, duration, easing } from '../lib/motion.stylex.ts';
import { DASHBOARD_URL, DIRECT, durationParts } from '../lib/open-numbers.ts';
import type { DurationPart, OpenDay, OpenNumbersAnswer, OpenRow } from '../lib/open-numbers.ts';
import { m } from '../paraglide/messages.js';
import { card } from './page.tsx';

const NUMBER = new Intl.NumberFormat('en-US');
const PERCENT = new Intl.NumberFormat('en-US', { style: 'percent' });
/** The space between two units of a length of time. */
const GAP = ' ';
/** A day as the reader says it, in the UTC the days are counted in. */
const DAY = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' });
/** Where the link stands in the sentence, as the footer does it. */
const LINK_SLOT = '\u0000';
/** The plot's own units: the lines are drawn in a square and stretched to fit. */
const PLOT = 100;
const PLOT_HEIGHT = 180;
/** Paths are not words, so they are set in the system's fixed-width face. */
const PATH_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const rise = keyframes({
  from: {
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});

const styles = create({
  bar: {
    backgroundColor: accent.base,
    borderRadius: radius.base,
    display: 'block',
    height: '100%',
  },
  block: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: rise,
    },
    animationTimingFunction: easing.smoothOut,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    marginBlockStart: spacing.s2,
  },
  chart: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  chartEnds: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  chartHead: {
    alignItems: 'baseline',
    columnGap: spacing.s4,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.s1,
  },
  key: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s2,
  },
  keys: {
    display: 'flex',
    gap: spacing.s4,
  },
  keySwatch: {
    height: 2,
    width: 16,
  },
  line: {
    margin: 0,
  },
  lineViews: {
    stroke: colors.muted,
  },
  lineVisitors: {
    stroke: accent.base,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  lists: {
    display: 'grid',
    gap: spacing.s8,
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(3, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
  },
  listTitle: {
    fontSize: font.sizeMd,
    fontWeight: font.weightRegular,
    lineHeight: 1.2,
    margin: 0,
    marginBlockEnd: spacing.s3,
  },
  // The day under the pointer: a rule down the plot.
  mark: {
    backgroundColor: colors.border,
    insetBlock: 0,
    pointerEvents: 'none',
    position: 'absolute',
    width: 1,
  },
  path: {
    fontFamily: PATH_FONT,
    fontSize: 13,
  },
  plot: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    cursor: 'crosshair',
    height: PLOT_HEIGHT,
    position: 'relative',
    touchAction: 'pan-y',
  },
  plotLines: {
    display: 'block',
    height: '100%',
    overflow: 'visible',
    width: '100%',
  },
  quiet: {
    color: colors.muted,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    margin: 0,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  rowCount: {
    color: colors.fg,
    fontVariantNumeric: 'tabular-nums',
  },
  rowLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowWords: {
    color: colors.muted,
    columnGap: spacing.s3,
    display: 'flex',
    fontSize: font.sizeSm,
    justifyContent: 'space-between',
  },
  stat: {
    display: 'flex',
    // The number over its name, though the name comes first for a reader.
    // The name keeps to the foot, so the names line up when a value wraps.
    flexDirection: 'column-reverse',
    gap: spacing.s1,
    justifyContent: 'space-between',
    margin: 0,
  },
  statLabel: {
    color: colors.muted,
    fontSize: font.sizeSm,
  },
  stats: {
    columnGap: spacing.s3,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(3, minmax(0, 1fr))',
      default: 'repeat(2, minmax(0, 1fr))',
    },
    // Every row as tall as the tallest, so all the cards are one height.
    gridAutoRows: '1fr',
    margin: 0,
    rowGap: spacing.s3,
  },
  // The numbers are what the page is for, so they carry the orange.
  // A number and its unit word, kept together on one line.
  statPart: {
    whiteSpace: 'nowrap',
  },
  // Unit words sit on the number's baseline at the label's size.
  statUnit: {
    fontSize: font.sizeSm,
    letterSpacing: 0,
  },
  statValue: {
    color: accent.base,
    fontSize: 32,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    margin: 0,
  },
  swatchViews: {
    backgroundColor: colors.muted,
  },
  swatchVisitors: {
    backgroundColor: accent.base,
  },
  track: {
    backgroundColor: colors.border,
    borderRadius: radius.base,
    display: 'block',
    height: 2,
  },
});

function day(value: string): string {
  return DAY.format(new Date(`${value}T00:00:00Z`));
}

/** How long ago PostHog was asked, in the page's words. */
function updated(minutes: number): string {
  if (minutes < 1) {
    return m.open_numbers_updated_now();
  }
  if (minutes < 60) {
    return minutes === 1
      ? m.open_numbers_updated_minute()
      : m.open_numbers_updated_minutes({ count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  return hours === 1
    ? m.open_numbers_updated_hour()
    : m.open_numbers_updated_hours({ count: hours });
}

/** One unit of a length of time, in the page's words: "1 minute", "42 seconds". */
function durationWords(count: number | string, unit: DurationPart['unit'], one: boolean): string {
  if (unit === 'hour') {
    return one ? m.open_duration_hour({ count }) : m.open_duration_hours({ count });
  }
  if (unit === 'minute') {
    return one ? m.open_duration_minute({ count }) : m.open_duration_minutes({ count });
  }
  return one ? m.open_duration_second({ count }) : m.open_duration_seconds({ count });
}

/**
 * Whole seconds in words, units written out: "4 minutes 52 seconds". The
 * numbers stand at the stat's size and the words beside them are smaller, so
 * on a wide card the value keeps to one line. On a narrow one it breaks
 * between the units, never inside one.
 */
function Duration({ seconds }: { seconds: number }) {
  return durationParts(seconds).map(({ count, unit }, index) => {
    const [before, after] = durationWords(LINK_SLOT, unit, count === 1).split(LINK_SLOT);
    return (
      <Fragment key={unit}>
        {index > 0 && GAP}
        <span {...props(styles.statPart)}>
          {before}
          {NUMBER.format(count)}
          <span {...props(styles.statUnit)}>{after}</span>
        </span>
      </Fragment>
    );
  });
}

/** One line through the days, in the plot's own square. */
function points(days: ReadonlyArray<OpenDay>, pick: (day: OpenDay) => number, top: number): string {
  const last = Math.max(1, days.length - 1);
  return days
    .map((each, index) => `${(index / last) * PLOT},${PLOT - (pick(each) / top) * PLOT}`)
    .join(' ');
}

/**
 * Visitors and page views for each day, as two lines we draw ourselves. The
 * line above the plot names one day's values: the newest until the reader
 * points at another, or moves to it with the arrow keys. A reader who cannot
 * see the plot is given the same values as a table.
 */
function Chart({ days }: { days: ReadonlyArray<OpenDay> }) {
  const title = useId();
  const desc = useId();
  const newest = days.length - 1;
  const [picked, setPicked] = useState(newest);
  const shown = days[Math.min(picked, newest)];
  const first = days[0];
  const last = days[newest];
  if (shown === undefined || first === undefined || last === undefined) {
    return null;
  }
  const top = Math.max(1, ...days.map((each) => each.views));
  const readout = m.open_chart_readout({
    day: day(shown.day),
    views: NUMBER.format(shown.views),
    visitors: NUMBER.format(shown.visitors),
  });

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = box.width === 0 ? 0 : (event.clientX - box.left) / box.width;
    setPicked(Math.min(newest, Math.max(0, Math.round(share * newest))));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: picked - 1,
      ArrowRight: picked + 1,
      End: newest,
      Home: 0,
    };
    const next = steps[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setPicked(Math.min(newest, Math.max(0, next)));
    }
  };

  return (
    <div {...props(card, styles.chart)}>
      <div {...props(styles.chartHead)}>
        <p aria-hidden="true" {...props(styles.quiet)}>
          {readout}
        </p>
        <div aria-hidden="true" {...props(styles.quiet, styles.keys)}>
          <span {...props(styles.key)}>
            <span {...props(styles.keySwatch, styles.swatchVisitors)} />
            {m.open_stat_visitors()}
          </span>
          <span {...props(styles.key)}>
            <span {...props(styles.keySwatch, styles.swatchViews)} />
            {m.open_stat_views()}
          </span>
        </div>
      </div>
      <div
        aria-label={m.open_chart_title()}
        aria-valuemax={newest}
        aria-valuemin={0}
        aria-valuenow={picked}
        aria-valuetext={readout}
        onKeyDown={onKey}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        role="slider"
        tabIndex={0}
        {...props(styles.plot)}
      >
        <svg
          aria-describedby={desc}
          aria-labelledby={title}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${PLOT} ${PLOT}`}
          {...props(styles.plotLines)}
        >
          <title id={title}>{m.open_chart_title()}</title>
          <desc id={desc}>
            {m.open_chart_desc({
              from: day(first.day),
              to: day(last.day),
              top: NUMBER.format(top),
            })}
          </desc>
          <polyline
            fill="none"
            points={points(days, (each) => each.views, top)}
            strokeLinejoin="round"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            {...props(styles.lineViews)}
          />
          <polyline
            fill="none"
            points={points(days, (each) => each.visitors, top)}
            strokeLinejoin="round"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            {...props(styles.lineVisitors)}
          />
        </svg>
        <span
          style={{ insetInlineStart: `${(Math.min(picked, newest) / Math.max(1, newest)) * 100}%` }}
          {...props(styles.mark)}
        />
      </div>
      <div aria-hidden="true" {...props(styles.quiet, styles.chartEnds)}>
        <span>{day(first.day)}</span>
        <span>{day(last.day)}</span>
      </div>
      <table {...props(layout.spoken)}>
        <caption>{m.open_chart_title()}</caption>
        <thead>
          <tr>
            <th scope="col">{m.open_chart_day()}</th>
            <th scope="col">{m.open_stat_visitors()}</th>
            <th scope="col">{m.open_stat_views()}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((each) => (
            <tr key={each.day}>
              <th scope="row">{day(each.day)}</th>
              <td>{NUMBER.format(each.visitors)}</td>
              <td>{NUMBER.format(each.views)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A short list, each row with a thin bar as long as its share of the first row. */
function List({
  empty,
  path = false,
  rows,
  title,
}: {
  empty: string;
  path?: boolean;
  rows: ReadonlyArray<OpenRow>;
  title: string;
}) {
  const top = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section>
      <h3 {...props(styles.listTitle)}>{title}</h3>
      {rows.length === 0 ? (
        <p {...props(styles.quiet)}>{empty}</p>
      ) : (
        <ol {...props(styles.list)}>
          {rows.map((row) => (
            <li key={row.label} {...props(styles.row)}>
              <span {...props(styles.rowWords)}>
                <span {...props(styles.rowLabel, path && styles.path)}>
                  {row.label === DIRECT ? m.open_list_direct() : row.label}
                </span>
                <span {...props(styles.rowCount)}>{NUMBER.format(row.count)}</span>
              </span>
              <span aria-hidden="true" {...props(styles.track)}>
                <span style={{ width: `${(row.count / top) * 100}%` }} {...props(styles.bar)} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** A press on the public dashboard's link, by where the link stands. */
const check = (placement: string) => () => posthog.capture('open_dashboard_clicked', { placement });

/**
 * The numbers themselves, drawn by the site from what the Worker read from
 * PostHog: the totals, the days, and three short lists. Under them, how old
 * they are and the public PostHog dashboard with the same numbers, so anyone
 * can check them. With no numbers to show, the link alone.
 * Why: `docs/adr/0007-open-numbers.md`.
 */
export function OpenNumbers({ answer }: { answer: OpenNumbersAnswer }) {
  if (answer === null) {
    const [before, after] = m.open_numbers_failed({ dashboard: LINK_SLOT }).split(LINK_SLOT);
    return (
      <p {...props(layout.muted, styles.line)}>
        {before}
        <a href={DASHBOARD_URL} onClick={check('failed')} rel="noreferrer" target="_blank">
          {m.open_numbers_failed_link()}
        </a>
        {after}
      </p>
    );
  }

  const { ageMinutes, numbers } = answer;
  const stats = [
    { label: m.open_stat_visitors(), value: NUMBER.format(numbers.visitors) },
    { label: m.open_stat_views(), value: NUMBER.format(numbers.views) },
    { label: m.open_stat_bounce(), value: PERCENT.format(numbers.bounceRate / 100) },
    { label: m.open_stat_session(), value: <Duration seconds={numbers.sessionSeconds} /> },
    { label: m.open_stat_downloads(), value: NUMBER.format(numbers.downloads) },
    { label: m.open_stat_reads(), value: NUMBER.format(numbers.reads) },
  ];
  const [checkBefore, checkAfter] = m.open_numbers_check({ dashboard: LINK_SLOT }).split(LINK_SLOT);

  return (
    <div {...props(styles.block)}>
      <dl {...props(styles.stats)}>
        {stats.map((stat) => (
          <div key={stat.label} {...props(card, styles.stat)}>
            <dt {...props(styles.statLabel)}>{stat.label}</dt>
            <dd {...props(styles.statValue)}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Chart days={numbers.days} />

      <div {...props(card, styles.lists)}>
        <List
          empty={m.open_list_empty()}
          rows={numbers.referrers}
          title={m.open_list_referrers()}
        />
        <List empty={m.open_list_empty()} path rows={numbers.pages} title={m.open_list_pages()} />
        <List
          empty={m.open_list_empty()}
          rows={numbers.countries}
          title={m.open_list_countries()}
        />
      </div>

      <p {...props(layout.muted, styles.line)}>
        <time dateTime={numbers.generatedAt}>{updated(ageMinutes)}</time>
        {checkBefore}
        <a href={DASHBOARD_URL} onClick={check('numbers')} rel="noreferrer" target="_blank">
          {m.open_numbers_check_link()}
        </a>
        {checkAfter}
      </p>
    </div>
  );
}
