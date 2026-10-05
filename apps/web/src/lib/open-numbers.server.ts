import { DIRECT } from './open-numbers.ts';
import type { OpenDay, OpenNumbers, OpenNumbersAnswer, OpenRow } from './open-numbers.ts';

/** PostHog's query API for the site's project, in the EU cloud. */
const QUERY_URL = 'https://eu.posthog.com/api/projects/245314/query/';
/** How long an answer is served before PostHog is asked again. */
const FRESH_MS = 15 * 60_000;
/** With nothing to serve, how long to wait after a failed ask. */
const RETRY_MS = 60_000;
/** How long PostHog may take. Past it the old answer is served. */
const PATIENCE_MS = 8000;
/** How long the edge keeps an answer, so an old one outlives a PostHog outage. */
const KEPT_SECONDS = 7 * 24 * 60 * 60;
/** The key the answer is kept under in the edge cache. It is never fetched. */
const CACHE_KEY = 'https://attentionawareness.com/__cache/open-numbers';
/** The dashboard's window: the day 30 days ago, from its first second, to now. */
const DAYS_BACK = 30;
const DAY_MS = 24 * 60 * 60_000;
const LIST_LENGTH = 8;
/** Visits from the site itself and from PostHog's own pages are not referrals. */
const NOT_REFERRERS = new Set([
  '',
  'attentionawareness.com',
  'www.attentionawareness.com',
  'eu.posthog.com',
]);

/**
 * Everything the page shows in one query, so one ask costs one request. The
 * filters are the public dashboard's own: page views on the live host, in the
 * dashboard's window, and visitors counted as distinct persons. Visits are
 * PostHog's sessions that hold one of those page views, as its web analytics
 * counts them: one row with the visits and the bounced ones, one with the
 * visits and their seconds added up. `abs` keeps the seconds an unsigned count,
 * as every other row's, since a union needs one type for each column.
 */
const QUERY = `
with views as (
  select person_id, timestamp, $session_id as session, properties.$referring_domain as referrer, properties.$pathname as path, properties.$geoip_country_name as country
  from events
  where event = '$pageview' and properties.$host = 'attentionawareness.com' and timestamp >= toStartOfDay(now() - interval ${DAYS_BACK} day)
),
visits as (
  select $is_bounce as bounced, $session_duration as seconds
  from sessions
  where $start_timestamp >= toStartOfDay(now() - interval ${DAYS_BACK} day) and session_id in (select session from views)
)
select 'total' as kind, '' as label, count(distinct person_id) as visitors, count() as hits from views
union all
select 'day' as kind, toString(toDate(timestamp)) as label, count(distinct person_id) as visitors, count() as hits from views group by label
union all
select kind, label, visitors, hits from (select 'referrer' as kind, ifNull(referrer, '') as label, count(distinct person_id) as visitors, count() as hits from views group by label order by visitors desc, label asc limit 20)
union all
select kind, label, visitors, hits from (select 'page' as kind, ifNull(path, '') as label, count(distinct person_id) as visitors, count() as hits from views group by label order by hits desc, label asc limit ${LIST_LENGTH})
union all
select kind, label, visitors, hits from (select 'country' as kind, ifNull(country, '') as label, count(distinct person_id) as visitors, count() as hits from views group by label order by visitors desc, label asc limit ${LIST_LENGTH + 1})
union all
select 'reads' as kind, '' as label, count(distinct person_id) as visitors, count() as hits from views where match(path, '^/(guide|blog)')
union all
select 'visits' as kind, 'bounced' as label, count() as visitors, countIf(bounced) as hits from visits
union all
select 'visits' as kind, 'seconds' as label, count() as visitors, sum(abs(seconds)) as hits from visits
union all
select 'event' as kind, event as label, count(distinct person_id) as visitors, count() as hits from events
where timestamp >= toStartOfDay(now() - interval ${DAYS_BACK} day)
  and event = 'mac_download_started' and properties.$host = 'attentionawareness.com'
group by label
limit 200`;

/** One row of the query: what it counts, of what, and the two counts. */
export type Row = { hits: number; kind: string; label: string; visitors: number };

/** The rows PostHog last gave, when, and when it was last asked. */
type Held = { fetchedAt: number; rows: Array<Row> | null; triedAt: number };

/** The Worker binding the query reads. Without it the page has no numbers. */
export type OpenNumbersEnv = { POSTHOG_PERSONAL_API_KEY?: string | undefined };

/**
 * A server function never sees the Worker `env`, so `server.ts` hands the key
 * over on the way in, as it does the signing secrets.
 */
let key: string | undefined;
/** The answer this isolate holds, so most requests read no cache at all. */
let held: Held | null = null;
/** The ask under way, shared by every request that arrives while it runs. */
let asking: Promise<Held> | null = null;

export function setOpenNumbersKey(env: OpenNumbersEnv): void {
  key = env.POSTHOG_PERSONAL_API_KEY === '' ? undefined : env.POSTHOG_PERSONAL_API_KEY;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** The query's rows out of a PostHog answer, or `null` if it is not one. */
function readRows(results: unknown): Array<Row> | null {
  if (!Array.isArray(results)) {
    return null;
  }
  const rows: Array<Row> = [];
  for (const result of results) {
    if (!Array.isArray(result)) {
      return null;
    }
    const [kind, label, visitors, hits]: Array<unknown> = result;
    const seen = count(visitors);
    const made = count(hits);
    if (typeof kind !== 'string' || typeof label !== 'string' || seen === null || made === null) {
      return null;
    }
    rows.push({ hits: made, kind, label, visitors: seen });
  }
  return rows;
}

/** What the edge cache held, checked the same way as what PostHog sends. */
function readHeld(body: unknown): Held | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  if (!('fetchedAt' in body) || !('triedAt' in body) || !('rows' in body)) {
    return null;
  }
  const fetchedAt = count(body.fetchedAt);
  const triedAt = count(body.triedAt);
  const rows = body.rows === null ? null : readRows(body.rows);
  if (fetchedAt === null || triedAt === null || (body.rows !== null && rows === null)) {
    return null;
  }
  return { fetchedAt, rows, triedAt };
}

/** Asks PostHog once. `null` for any failure: no key, no answer, a wrong shape. */
async function ask(): Promise<Array<Row> | null> {
  if (key === undefined) {
    return null;
  }
  try {
    const response = await fetch(QUERY_URL, {
      body: JSON.stringify({
        name: 'attentionawareness open numbers',
        query: { kind: 'HogQLQuery', query: QUERY },
      }),
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(PATIENCE_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || !('results' in body)) {
      return null;
    }
    return readRows(body.results);
  } catch {
    return null;
  }
}

async function readEdge(): Promise<Held | null> {
  try {
    const cache = await caches.open('open-numbers');
    const response = await cache.match(CACHE_KEY);
    if (response === undefined) {
      return null;
    }
    const body: unknown = await response.json();
    return readHeld(body);
  } catch {
    return null;
  }
}

async function writeEdge(next: Held): Promise<void> {
  try {
    const cache = await caches.open('open-numbers');
    await cache.put(
      CACHE_KEY,
      new Response(JSON.stringify(next), {
        headers: {
          'cache-control': `public, max-age=${KEPT_SECONDS}`,
          'content-type': 'application/json',
        },
      }),
    );
  } catch {
    // Without the edge cache the isolate's own copy still holds.
  }
}

function fresh(answer: Held | null, now: number): boolean {
  return answer !== null && now - answer.triedAt < (answer.rows === null ? RETRY_MS : FRESH_MS);
}

/** Asks PostHog and keeps the answer. A failed ask keeps the rows from before. */
async function refresh(before: Held | null, now: number): Promise<Held> {
  const rows = await ask();
  const next: Held =
    rows === null
      ? { fetchedAt: before?.fetchedAt ?? 0, rows: before?.rows ?? null, triedAt: now }
      : { fetchedAt: now, rows, triedAt: now };
  held = next;
  await writeEdge(next);
  return next;
}

function top(rows: Array<Row>, kind: string, by: 'hits' | 'visitors'): Array<OpenRow> {
  return rows
    .filter((row) => row.kind === kind && row.label !== '')
    .map((row) => ({ count: row[by], label: row.label }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, LIST_LENGTH);
}

/** Every UTC day of the window, oldest first, with zeros where PostHog has no row. */
function everyDay(rows: Array<Row>, fetchedAt: number): Array<OpenDay> {
  const counted = new Map(rows.filter((row) => row.kind === 'day').map((row) => [row.label, row]));
  const days: Array<OpenDay> = [];
  for (let back = DAYS_BACK; back >= 0; back -= 1) {
    const day = new Date(fetchedAt - back * DAY_MS).toISOString().slice(0, 10);
    const row = counted.get(day);
    days.push({ day, views: row?.hits ?? 0, visitors: row?.visitors ?? 0 });
  }
  return days;
}

/** A part of a whole, and zero when there is no whole. */
function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

/** The numbers out of the query's rows. A row PostHog left out counts as zero. */
export function shape(rows: Array<Row>, fetchedAt: number): OpenNumbers {
  const one = (kind: string, label: string) =>
    rows.find((row) => row.kind === kind && row.label === label);
  const total = one('total', '');
  const bounced = one('visits', 'bounced');
  const seconds = one('visits', 'seconds');
  return {
    bounceRate: Math.round(share(bounced?.hits ?? 0, bounced?.visitors ?? 0) * 100),
    countries: top(rows, 'country', 'visitors'),
    days: everyDay(rows, fetchedAt),
    downloads: one('event', 'mac_download_started')?.hits ?? 0,
    generatedAt: new Date(fetchedAt).toISOString(),
    pages: top(rows, 'page', 'hits'),
    reads: one('reads', '')?.hits ?? 0,
    referrers: top(
      rows.filter((row) => row.label === DIRECT || !NOT_REFERRERS.has(row.label)),
      'referrer',
      'visitors',
    ),
    sessionSeconds: Math.round(share(seconds?.hits ?? 0, seconds?.visitors ?? 0)),
    views: total?.hits ?? 0,
    visitors: total?.visitors ?? 0,
  };
}

/**
 * The numbers for `/open`. PostHog is asked at most once in fifteen minutes:
 * the answer is held by the isolate and in the edge cache of its data centre,
 * and requests that arrive while an ask runs wait for that one. A failed ask
 * serves the answer from before for another fifteen minutes; with none to
 * serve, the page says so and PostHog is asked again after a minute.
 * Why: `docs/adr/0007-open-numbers.md`.
 */
export async function loadOpenNumbers(now: number = Date.now()): Promise<OpenNumbersAnswer> {
  let answer = held;
  if (!fresh(answer, now)) {
    // Another isolate may have asked since this one last looked.
    const edge = await readEdge();
    if (edge !== null && (answer === null || edge.triedAt > answer.triedAt)) {
      answer = edge;
      held = edge;
    }
  }
  if (!fresh(answer, now)) {
    asking ??= refresh(answer, now).finally(() => {
      asking = null;
    });
    answer = await asking;
  }
  if (answer === null || answer.rows === null) {
    return null;
  }
  return {
    ageMinutes: Math.max(0, Math.floor((now - answer.fetchedAt) / 60_000)),
    numbers: shape(answer.rows, answer.fetchedAt),
  };
}
