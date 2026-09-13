import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { controls } from '../lib/controls.ts';
import { keepByDefault, matchApps } from '../lib/known-apps.ts';
import type { ScanMatch, ScannedApp } from '../lib/known-apps.ts';
import { layout } from '../lib/layout.ts';
import { presets } from '../lib/profile/index.ts';
import { readScreenshot } from '../lib/screen-time-ocr.ts';
import type { ScreenTimeEntry } from '../lib/screen-time-ocr.ts';
import { m } from '../paraglide/messages.js';
import { AppArtwork } from './app-artwork.tsx';
import { ScreenTimeDrop } from './screen-time-drop.tsx';

/** One line of the picker: what was read, and what it turned out to be. */
type Row = ScanMatch & { time?: string | undefined };

const styles = create({
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  group: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: font.weightMedium,
    letterSpacing: '0.08em',
    lineHeight: 1.4,
    margin: 0,
    textTransform: 'uppercase',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  // The name is the row, so it keeps its own line: a name too long for the
  // width ends in an ellipsis rather than breaking across two lines.
  name: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // The duration the screenshot showed, and the note on why a row is unticked.
  // It wraps rather than squeezing the app's own name, which is the row.
  note: {
    color: colors.muted,
    fontSize: font.sizeSm,
    marginInlineStart: 'auto',
    paddingInlineStart: spacing.s2,
    textAlign: 'end',
    textWrap: 'pretty',
  },
  // The same quiet text button the rest of the page uses for a way out.
  quiet: {
    alignSelf: 'start',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    font: 'inherit',
    fontSize: font.sizeSm,
    padding: 0,
    textDecorationLine: 'underline',
  },
  // Icon, name and note in one line, until the line runs out: on a phone the
  // note drops under the name rather than squeezing it.
  row: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
    minWidth: 0,
  },
  rowArtwork: {
    borderRadius: 8,
    height: 28,
    width: 28,
  },
  steps: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s1,
    lineHeight: 1.5,
    margin: 0,
    paddingInlineStart: spacing.s4,
  },
  summary: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
});

/**
 * The reader's own Screen Time list, turned into a block list. The screenshot
 * is read on this device and nothing is uploaded: the apps behind the names
 * are the only thing asked of the App Store, and only so their icons and sites
 * can be filled in.
 */
export function WorstApps({
  country,
  onApply,
  onSearch,
  onSkip,
}: {
  country: string;
  onApply: (apps: ReadonlyArray<ScannedApp>) => void;
  onSearch: (name: string) => void;
  onSkip: () => void;
}) {
  const [source, setSource] = useState<ReadonlyArray<ScreenTimeEntry> | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [rows, setRows] = useState<Array<Row> | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [skipped, setSkipped] = useState(false);

  // A screenshot that has been read but whose apps are still being looked up.
  const matching = source !== null && rows === null && !failed;

  // The names are matched against the App Store once per screenshot. A
  // storefront change re-runs it, because that is the store the reader
  // installs from.
  useEffect(() => {
    if (source === null) {
      return;
    }
    const controller = new AbortController();
    void matchApps(
      source.map((entry) => entry.name),
      { country, signal: controller.signal },
    )
      .then((matches) => {
        if (controller.signal.aborted) {
          return;
        }
        setRows(matches.map((match, index) => ({ ...match, time: source[index]?.time })));
        setChecked(defaultChecks(matches));
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setFailed(true);
      });
    return () => controller.abort();
  }, [country, source]);

  if (skipped) {
    return null;
  }

  if (applied !== null) {
    return (
      <p {...props(styles.summary, layout.muted)}>
        {m.gen_worst_summary({ count: applied })}
        <button onClick={rescan} type="button" {...props(styles.quiet)}>
          {m.gen_worst_rescan()}
        </button>
      </p>
    );
  }

  /** The recommended apps the screenshot did not already name. */
  const found = new Set(rows?.flatMap((row) => (row.app === undefined ? [] : [row.app.bundleId])));
  const extra = presets.mert.blockedApps.filter((app) => !found.has(app.bundleId));

  async function read(file: File) {
    setFailed(false);
    setRows(null);
    setSource(null);
    setPercent(0);
    try {
      const screen = await readScreenshot(file, setPercent);
      if (screen.entries.length === 0) {
        setFailed(true);
        return;
      }
      setSource(screen.entries);
    } catch {
      setFailed(true);
    } finally {
      setPercent(null);
    }
  }

  // The picker is one of two answers, and the page below it waits for either:
  // the reader takes what the screenshot found, or says they have no use for it.
  function skip() {
    setSkipped(true);
    onSkip();
  }

  function rescan() {
    setApplied(null);
    setSource(null);
    setRows(null);
    setChecked({});
    setFailed(false);
  }

  function toggle(key: string) {
    setChecked({ ...checked, [key]: checked[key] !== true });
  }

  function apply() {
    const apps: Array<ScannedApp> = [];
    for (const row of rows ?? []) {
      if (row.app !== undefined && checked[rowKey(row)] === true) {
        apps.push(row.app);
      }
    }
    for (const app of extra) {
      if (checked[app.bundleId] === true) {
        apps.push({ bundleId: app.bundleId, iconUrl: '', name: app.name });
      }
    }
    onApply(apps);
    setApplied(apps.length);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.gen_worst_title()}</CardTitle>
      </CardHeader>
      <CardContent style={styles.block}>
        {rows === null ? (
          <>
            <ol {...props(styles.steps)}>
              <li>{m.gen_worst_step_1()}</li>
              <li>{m.gen_worst_step_2()}</li>
              <li>{m.gen_worst_step_3()}</li>
            </ol>
            <ScreenTimeDrop
              busy={percent !== null || matching}
              caption={m.gen_worst_drop()}
              onFile={(file) => void read(file)}
              percent={percent}
            />
            <p {...props(layout.muted)}>{m.gen_worst_privacy()}</p>
            {failed ? (
              <p role="alert" {...props(layout.muted)}>
                {m.gen_worst_failed()}
              </p>
            ) : null}
          </>
        ) : null}
        {rows === null ? null : (
          <>
            <p {...props(styles.group)}>{m.gen_worst_found()}</p>
            <ul {...props(styles.list)}>
              {rows.map((row) => (
                <li key={rowKey(row)}>
                  {row.status === 'unknown' ? (
                    <span {...props(styles.row)}>
                      <span {...props(styles.name)}>{row.name}</span>
                      <button
                        onClick={() => onSearch(row.name)}
                        type="button"
                        {...props(styles.quiet, styles.note)}
                      >
                        {m.gen_worst_unknown()}
                      </button>
                    </span>
                  ) : (
                    <Label style={styles.row}>
                      <input
                        checked={checked[rowKey(row)] === true}
                        disabled={row.status === 'system'}
                        onChange={() => toggle(rowKey(row))}
                        type="checkbox"
                        {...props(controls.base, controls.checkbox)}
                      />
                      <AppArtwork meta={artworkOf(row)} name={row.name} style={styles.rowArtwork} />
                      <span {...props(styles.name)}>{row.name}</span>
                      <span {...props(styles.note)}>{noteFor(row)}</span>
                    </Label>
                  )}
                </li>
              ))}
            </ul>
            {extra.length === 0 ? null : (
              <>
                <p {...props(styles.group)}>{m.gen_worst_recommended()}</p>
                <ul {...props(styles.list)}>
                  {extra.map((app) => (
                    <li key={app.bundleId}>
                      <Label style={styles.row}>
                        <input
                          checked={checked[app.bundleId] === true}
                          onChange={() => toggle(app.bundleId)}
                          type="checkbox"
                          {...props(controls.base, controls.checkbox)}
                        />
                        <span {...props(styles.name)}>{app.name}</span>
                      </Label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Button onClick={apply}>{m.gen_worst_apply()}</Button>
          </>
        )}
        <button onClick={skip} type="button" {...props(styles.quiet)}>
          {m.gen_worst_skip()}
        </button>
      </CardContent>
    </Card>
  );
}

/** What a row is remembered by: its app, or the name nothing was found for. */
function rowKey(row: Row): string {
  return row.app?.bundleId ?? row.name;
}

/** Apple's icon for a row, or nothing, which draws the initials tile instead. */
function artworkOf(row: Row): { developer: string; iconUrl: string } | null {
  return row.app === undefined || row.app.iconUrl === ''
    ? null
    : { developer: '', iconUrl: row.app.iconUrl };
}

/** The duration beside a row, or why the row is not ticked. */
function noteFor(row: Row): string {
  if (row.status === 'system') {
    return m.gen_worst_system();
  }
  if (keepByDefault(row.name)) {
    return m.gen_worst_keep();
  }
  return row.time ?? '';
}

/**
 * What the picker opens with: everything the screenshot named, except Apple's
 * own apps, which cannot be hidden, and the ones a day needs. The recommended
 * list under it is ticked, because that is the profile the site recommends.
 */
function defaultChecks(matches: ReadonlyArray<ScanMatch>): Record<string, boolean> {
  const checks: Record<string, boolean> = {};
  const found = new Set<string>();
  for (const match of matches) {
    if (match.app === undefined) {
      continue;
    }
    found.add(match.app.bundleId);
    checks[match.app.bundleId] = match.status === 'found' && !keepByDefault(match.name);
  }
  for (const app of presets.mert.blockedApps) {
    if (!found.has(app.bundleId)) {
      checks[app.bundleId] = true;
    }
  }
  return checks;
}
