import {
  Label,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@keepyourattention/ui';
import { colors, font, radius, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { SiteFooter } from '../components/site-footer.tsx';
import { accent } from '../lib/accent.stylex.ts';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/supervise')({
  component: SuperviseGuide,
  head: () => ({ meta: [{ title: m.sup_head_title() }] }),
});

const CHECKLIST_KEY = 'kya:supervise-checklist';
const HOME_URL = '/';
const TECH_LOCKDOWN_URL = 'https://www.techlockdown.com';
const STOPA_URL = 'https://stopa.io/post/297';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const styles = create({
  body: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  bulletItem: {
    marginBlockEnd: spacing.s2,
    textWrap: 'pretty',
  },
  bullets: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    paddingInlineStart: spacing.s4,
  },
  checkbox: {
    accentColor: accent.base,
    flexShrink: 0,
    height: 16,
    // Sits on the first line of a wrapping label instead of its top edge.
    marginBlockStart: 4,
    width: 16,
  },
  checkItem: {
    marginBlockEnd: spacing.s2,
  },
  // The registry Label centres a single line; a checklist row wraps.
  checkLabel: {
    alignItems: 'flex-start',
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    textWrap: 'pretty',
  },
  checklist: {
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    maxWidth: 760,
    width: '100%',
  },
  defDesc: {
    color: colors.muted,
    lineHeight: 1.5,
    marginBlockEnd: spacing.s3,
    marginInlineStart: 0,
    textWrap: 'pretty',
  },
  defList: {
    margin: 0,
  },
  defTerm: {
    fontWeight: font.weightMedium,
    lineHeight: 1.5,
    textWrap: 'pretty',
  },
  // Same column as `content`, so the hero and every section share a left edge.
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 760,
    width: '100%',
  },
  heroTitle: {
    fontSize: 'clamp(36px, 6.4vw, 54px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.035em',
    lineHeight: 1.04,
    margin: 0,
    textWrap: 'balance',
  },
  lead: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  // Reserved space for a screenshot or a clip that is not shot yet.
  media: {
    alignItems: 'center',
    aspectRatio: '16 / 9',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'dashed',
    borderWidth: '1px',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    justifyContent: 'center',
    maxWidth: '100%',
    width: '100%',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
  },
  pre: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
    margin: 0,
    overflowX: 'auto',
    padding: spacing.s3,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  sectionTitle: {
    fontSize: 'clamp(22px, 3.2vw, 28px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  subTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightBold,
    letterSpacing: '-0.01em',
    margin: 0,
  },
  twoCol: {
    display: 'grid',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    gridTemplateColumns: {
      '@media (min-width: 640px)': '1fr 1fr',
      default: '1fr',
    },
  },
});

/** Ticked boxes survive a reload; private mode and a full quota must not throw. */
function readChecked(): Array<string> {
  try {
    const raw = globalThis.localStorage.getItem(CHECKLIST_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeChecked(ids: ReadonlyArray<string>): void {
  try {
    globalThis.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(ids));
  } catch {
    // The guide still works with nothing remembered.
  }
}

function MediaPlaceholder() {
  return <div {...props(styles.media)}>{m.sup_media_placeholder()}</div>;
}

function SuperviseGuide() {
  // Server and first client render agree on an empty list; the stored one
  // arrives after mount, so hydration never sees a different checkbox.
  const [checked, setChecked] = useState<ReadonlyArray<string>>([]);

  // Reading localStorage during render would desync the SSR HTML from the first
  // client render. Adopting what it holds IS synchronizing with an external
  // system, the one case the rule leaves to an effect, and it runs once.
  /* oxlint-disable react/set-state-in-effect -- one-shot restore from browser-only storage */
  useEffect(() => {
    const stored = readChecked();
    if (stored.length > 0) {
      setChecked(stored);
    }
  }, []);
  /* oxlint-enable react/set-state-in-effect */

  const toggle = (id: string): void => {
    const next = checked.includes(id) ? checked.filter((value) => value !== id) : [...checked, id];
    setChecked(next);
    writeChecked(next);
  };

  const checklist = [
    { id: 'passcode', text: m.sup_checklist_passcode() },
    { id: 'stolen-device-protection', text: m.sup_checklist_stolen() },
    { id: 'find-my', text: m.sup_checklist_findmy() },
    { id: 'icloud-backup', text: m.sup_checklist_backup() },
    { id: 'full-disk-access', text: m.sup_checklist_fulldisk() },
  ];

  const troubles = [
    { desc: m.sup_trouble_permission_desc(), term: m.sup_trouble_permission_term() },
    { desc: m.sup_trouble_encrypted_desc(), term: m.sup_trouble_encrypted_term() },
    { desc: m.sup_trouble_unsupervised_desc(), term: m.sup_trouble_unsupervised_term() },
    { desc: m.sup_trouble_undo_desc(), term: m.sup_trouble_undo_term() },
  ];

  return (
    <main {...props(styles.page)}>
      <header {...props(styles.hero)}>
        <h1 {...props(styles.heroTitle)}>{m.sup_title()}</h1>
        <p {...props(styles.lead)}>{m.sup_lead()}</p>
      </header>

      <div {...props(styles.content)}>
        <section {...props(styles.section)}>
          <div {...props(styles.twoCol)}>
            <div {...props(styles.column)}>
              <h2 {...props(styles.sectionTitle)}>{m.sup_get_title()}</h2>
              <ul {...props(styles.bullets)}>
                <li {...props(styles.bulletItem)}>{m.sup_get_apps()}</li>
                <li {...props(styles.bulletItem)}>{m.sup_get_profile()}</li>
                <li {...props(styles.bulletItem)}>{m.sup_get_store()}</li>
                <li {...props(styles.bulletItem)}>{m.sup_get_rest()}</li>
              </ul>
            </div>
            <div {...props(styles.column)}>
              <h2 {...props(styles.sectionTitle)}>{m.sup_cost_title()}</h2>
              <ul {...props(styles.bullets)}>
                <li {...props(styles.bulletItem)}>{m.sup_cost_time()}</li>
                <li {...props(styles.bulletItem)}>{m.sup_cost_mac()}</li>
                <li {...props(styles.bulletItem)}>{m.sup_cost_redownload()}</li>
                <li {...props(styles.bulletItem)}>{m.sup_cost_findmy()}</li>
              </ul>
            </div>
          </div>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_checklist_title()}</h2>
          <ul {...props(styles.checklist)}>
            {checklist.map((item) => (
              <li key={item.id} {...props(styles.checkItem)}>
                <Label style={styles.checkLabel}>
                  <input
                    checked={checked.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    type="checkbox"
                    {...props(styles.checkbox)}
                  />
                  {item.text}
                </Label>
              </li>
            ))}
          </ul>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_step1_title()}</h2>
          <ul {...props(styles.bullets)}>
            <li {...props(styles.bulletItem)}>{m.sup_step1_plug()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step1_finder()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step1_encrypt()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step1_run()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step1_why()}</li>
          </ul>
          <MediaPlaceholder />
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_step2_title()}</h2>
          <p {...props(styles.body)}>{m.sup_step2_body()}</p>
          <ul {...props(styles.bullets)}>
            <li {...props(styles.bulletItem)}>{m.sup_step2_download()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step2_check()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step2_patch()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step2_unpatch()}</li>
          </ul>
          <pre {...props(styles.pre)}>{m.sup_step2_commands()}</pre>
          <h3 {...props(styles.subTitle)}>{m.sup_step2_output_title()}</h3>
          <pre {...props(styles.pre)}>{m.sup_step2_output()}</pre>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_step3_title()}</h2>
          <ul {...props(styles.bullets)}>
            <li {...props(styles.bulletItem)}>{m.sup_step3_restore()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step3_reboot()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step3_settings()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step3_verify()}</li>
          </ul>
          <pre {...props(styles.pre)}>{m.sup_step3_verify_command()}</pre>
          <MediaPlaceholder />
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_step4_title()}</h2>
          <ul {...props(styles.bullets)}>
            <li {...props(styles.bulletItem)}>{m.sup_step4_findmy()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step4_faceid()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step4_apps()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_step4_profile()}</li>
          </ul>
          <MediaPlaceholder />
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_verified_title()}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.sup_verified_device()}</TableHead>
                <TableHead>{m.sup_verified_ios()}</TableHead>
                <TableHead>{m.sup_verified_date()}</TableHead>
                <TableHead>{m.sup_verified_result()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>{m.sup_verified_row_device()}</TableCell>
                <TableCell>{m.sup_verified_row_ios()}</TableCell>
                <TableCell>{m.sup_verified_row_date()}</TableCell>
                <TableCell>{m.sup_verified_row_result()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p {...props(layout.muted)}>{m.sup_verified_earlier()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_trouble_title()}</h2>
          <dl {...props(styles.defList)}>
            {troubles.map((trouble) => (
              <div key={trouble.term}>
                <dt {...props(styles.defTerm)}>{trouble.term}</dt>
                <dd {...props(styles.defDesc)}>{trouble.desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_notes_title()}</h2>
          <ul {...props(styles.bullets)}>
            <li {...props(styles.bulletItem)}>{m.sup_notes_unsupported()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_notes_organization()}</li>
            <li {...props(styles.bulletItem)}>{m.sup_notes_roadmap()}</li>
          </ul>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.sup_alt_title()}</h2>
          <ul {...props(styles.bullets)}>
            <li {...props(styles.bulletItem)}>
              {m.sup_alt_nomac()}{' '}
              <a href={TECH_LOCKDOWN_URL} rel="noreferrer" target="_blank">
                {m.sup_alt_nomac_link()}
              </a>
            </li>
            <li {...props(styles.bulletItem)}>
              {m.sup_alt_nosupervision()} <a href={HOME_URL}>{m.sup_alt_nosupervision_link()}</a>
            </li>
            <li {...props(styles.bulletItem)}>
              {m.sup_alt_erase()}{' '}
              <a href={STOPA_URL} rel="noreferrer" target="_blank">
                {m.sup_alt_erase_link()}
              </a>
            </li>
          </ul>
        </section>

        <Separator />

        <SiteFooter>
          <p {...props(layout.muted)}>
            <a href={HOME_URL}>{m.sup_footer_back()}</a>
          </p>
        </SiteFooter>
      </div>
    </main>
  );
}
