import { Button } from '@keepyourattention/ui';
import { font, palette, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useMemo, useState } from 'react';
import type { BlockedApp } from '../lib/profile/index.ts';
import { encodeShare, shareApps, shareTargets, shareText, SITE_URL } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import type { MetaCache } from './app-artwork.tsx';
import { AppIconFan } from './app-icon-fan.tsx';

/** How long the Copy button holds its "Copied" label before standing down. */
const COPY_FEEDBACK_MS = 2000;

const styles = create({
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  // The one surface on the site that ignores the theme: it is a picture of a
  // number, and a screenshot of it has to read the same everywhere.
  card: {
    aspectRatio: '1200 / 630',
    backgroundColor: palette.black,
    borderRadius: 16,
    boxSizing: 'border-box',
    color: palette.white,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    justifyContent: 'center',
    maxWidth: '100%',
    // No `overflow: hidden`: a box with a ratio and visible overflow grows to
    // fit its content instead of cropping it, so a long app list on a narrow
    // phone makes the card taller rather than cutting a line off.
    padding: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s4,
    },
    position: 'relative',
    width: '100%',
  },
  cardAbove: {
    color: palette.gray300,
    fontSize: 'clamp(13px, 1.8vw, 18px)',
    lineHeight: 1.3,
    margin: 0,
  },
  cardFrom: {
    fontSize: 'clamp(13px, 1.8vw, 18px)',
    lineHeight: 1.3,
    margin: 0,
    textWrap: 'pretty',
  },
  cardYears: {
    fontSize: 'clamp(48px, 9vw, 96px)',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightBold,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    margin: 0,
  },
  domain: {
    color: palette.gray500,
    fontSize: 12,
    insetBlockEnd: spacing.s4,
    insetInlineEnd: spacing.s4,
    position: 'absolute',
  },
  share: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
});

/**
 * The receipt for the years the reader just took back: a card they can
 * screenshot, and the three places they can post it. The card is DOM and not
 * an image, so it always shows the list the generator is holding right now.
 * The heading belongs to whatever opens it, so this renders none.
 */
export function ShareCard({
  apps,
  hours,
  meta,
  years,
}: {
  apps: ReadonlyArray<BlockedApp>;
  hours: number;
  meta: MetaCache;
  years: string;
}) {
  const [copied, setCopied] = useState(false);
  const locale = getLocale();

  const url = useMemo(
    () => `${SITE_URL}/?${encodeShare({ bundleIds: apps.map((app) => app.bundleId), hours })}`,
    [apps, hours],
  );
  // Lowercased with no locale: Turkish would turn Instagram's I into an ı.
  const appNames = useMemo(() => apps.map((app) => app.name.toLowerCase()), [apps]);
  const { apps: named, rest } = shareApps(appNames);
  const targets = shareTargets(shareText({ appNames, locale, url, years }), url);

  // "Copied" is the whole receipt for a copy, so it goes back on its own.
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  // No clipboard at all (insecure origin) and a denied one both land here: the
  // three intent links next to the button still carry the same url out.
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div {...props(styles.share)}>
      <div {...props(styles.card)}>
        <p {...props(styles.cardAbove)}>{m.share_card_above()}</p>
        <p {...props(styles.cardYears)}>{m.share_card_years({ years })}</p>
        <p {...props(styles.cardFrom)}>
          {rest > 0
            ? m.share_card_from_more({ apps: named, count: rest })
            : m.share_card_from({ apps: named })}
        </p>
        <AppIconFan apps={apps} meta={meta} />
        <span {...props(styles.domain)}>{m.share_domain()}</span>
      </div>
      <div {...props(styles.actions)}>
        <Button render={<a href={targets.x} rel="noreferrer" target="_blank" />} variant="outline">
          {m.share_x()}
        </Button>
        <Button
          render={<a href={targets.whatsapp} rel="noreferrer" target="_blank" />}
          variant="outline"
        >
          {m.share_whatsapp()}
        </Button>
        <Button
          render={<a href={targets.linkedin} rel="noreferrer" target="_blank" />}
          variant="outline"
        >
          {m.share_linkedin()}
        </Button>
        <Button onClick={() => void copyLink()} variant="outline">
          {copied ? m.share_copied() : m.share_copy()}
        </Button>
      </div>
    </div>
  );
}
