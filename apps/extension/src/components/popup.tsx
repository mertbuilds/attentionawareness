import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useId, useState } from 'react';
import type { SiteId } from '../lib/sites.ts';
import {
  defaultSettings,
  getSettings,
  onSettingsChange,
  setSettings,
  type Settings,
} from '../lib/storage.ts';
import { SITE_ORDER, siteStrings, strings } from '../lib/strings.ts';
import { BrandMark } from './brand-mark.tsx';
import { Switch } from './switch.tsx';

const WEBSITE_URL = 'https://attentionawareness.com';

const styles = create({
  brand: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  brandName: {
    fontSize: 15,
    fontWeight: font.weightMedium,
  },
  divider: {
    backgroundColor: colors.border,
    borderStyle: 'none',
    borderWidth: 0,
    height: '1px',
    margin: 0,
  },
  footer: {
    display: 'flex',
    gap: spacing.s3,
  },
  hides: {
    color: colors.muted,
    fontSize: 12,
  },
  label: {
    fontSize: font.sizeSm,
  },
  popup: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    padding: spacing.s4,
    width: 320,
  },
  // A link that does not want the row: the word, muted, underlined only under
  // the pointer that is about to take it.
  quiet: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: 0,
    textDecorationLine: {
      ':hover': 'underline',
      default: 'none',
    },
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
  },
  // The master switch is off: the rules are gone, so the rows under it are
  // saying what would happen rather than what is.
  rowOff: {
    opacity: 0.5,
  },
  sites: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  siteText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
});

/**
 * The popup: the brand, the master switch, one row per site, and the two ways
 * out. Everything it shows is `chrome.storage.sync`, so a switch flipped in
 * another window arrives here through `onSettingsChange` on its own.
 */
export function Popup() {
  // The defaults render first, before storage has answered. They are what a
  // fresh profile has, so the popup opens showing the truth rather than an
  // empty frame that fills in.
  const [settings, showSettings] = useState<Settings>(defaultSettings);
  const masterLabel = useId();

  useEffect(() => {
    void getSettings().then(showSettings);
    return onSettingsChange(showSettings);
  }, []);

  /**
   * Optimistic on purpose: the switch moves under the finger, and the write
   * follows. A write that fails is corrected by the change listener, and there
   * is no state here worth an hourglass.
   */
  function write(patch: Partial<Settings>): void {
    showSettings((current) => ({ ...current, ...patch }));
    void setSettings(patch);
  }

  return (
    <div {...props(styles.popup)}>
      <div {...props(styles.brand)}>
        <BrandMark />
        <span {...props(styles.brandName)}>{strings.brand}</span>
      </div>

      <div {...props(styles.row)}>
        <span id={masterLabel} {...props(styles.label)}>
          {strings.master}
        </span>
        <Switch
          checked={settings.enabled}
          labelledBy={masterLabel}
          onChange={(next) => write({ enabled: next })}
        />
      </div>

      <hr {...props(styles.divider)} />

      <ul {...props(styles.sites)}>
        {SITE_ORDER.map((site) => (
          <SiteRow
            checked={settings.sites[site]}
            disabled={!settings.enabled}
            key={site}
            onChange={(next) => write({ sites: { ...settings.sites, [site]: next } })}
            site={site}
          />
        ))}
      </ul>

      <div {...props(styles.footer)}>
        <button
          onClick={() => void chrome.runtime.openOptionsPage()}
          type="button"
          {...props(styles.quiet)}
        >
          {strings.customCss}
        </button>
        <button
          onClick={() => void chrome.tabs.create({ url: WEBSITE_URL })}
          type="button"
          {...props(styles.quiet)}
        >
          {strings.website}
        </button>
      </div>
    </div>
  );
}

function SiteRow({
  checked,
  disabled,
  onChange,
  site,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  site: SiteId;
}) {
  const labelId = useId();
  const { hides, name } = siteStrings[site];

  return (
    <li {...props(styles.row, disabled && styles.rowOff)}>
      <span {...props(styles.siteText)}>
        <span id={labelId} {...props(styles.label)}>
          {name}
        </span>
        <span {...props(styles.hides)}>{hides}</span>
      </span>
      <Switch checked={checked} disabled={disabled} labelledBy={labelId} onChange={onChange} />
    </li>
  );
}
