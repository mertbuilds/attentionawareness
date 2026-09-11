import { Button } from '@attentionawareness/ui';
import { font, palette, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useMemo, useState } from 'react';
import { accent } from '../lib/accent.stylex.ts';
import type { BlockedApp } from '../lib/profile/index.ts';
import { encodeShare, shareApps, shareTargets, shareText, SITE_URL } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import type { MetaCache } from './app-artwork.tsx';
import { AppIconFan } from './app-icon-fan.tsx';
import { BrandMark } from './brand-mark.tsx';

/** How long the Copy button holds its "Copied" label before standing down. */
const COPY_FEEDBACK_MS = 2000;
/** The mark in the card's footer, beside the domain it stands for. */
const MARK_SIZE = 20;

const styles = create({
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  // The one surface on the site that ignores the theme: it is a picture of a
  // number, and a screenshot of it has to read the same everywhere. It is also
  // the one surface with a fixed ratio and cropped overflow, so every size
  // inside it is drawn from the card's own width (`cqw`), not the viewport's:
  // the 1200x630 layout then holds in a 560px dialog and on a phone alike.
  card: {
    aspectRatio: '1200 / 630',
    backgroundColor: '#0a0a0a',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 16,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    color: palette.white,
    containerType: 'inline-size',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 'clamp(20px, 4cqw, 40px)',
    position: 'relative',
    width: '100%',
  },
  cardAbove: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 'clamp(11px, 1.5cqw, 18px)',
    lineHeight: 1.3,
    margin: 0,
  },
  cardBadge: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 'clamp(9px, 1cqw, 12px)',
    letterSpacing: '0.08em',
    lineHeight: 1.3,
    textTransform: 'uppercase',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: spacing.s2,
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  cardDomain: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 'clamp(10px, 1.2cqw, 14px)',
    lineHeight: 1.3,
  },
  // A black tile on a black card, so a hairline is what draws its edge.
  cardMark: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'solid',
    borderWidth: '1px',
  },
  // The fan draws 32px icons wherever it is used, and the card wants 36px:
  // `zoom` scales the row itself, so the line below it keeps its own gap.
  cardFan: {
    display: 'flex',
    zoom: 1.125,
  },
  cardFooter: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
  },
  cardFooterLeft: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  cardFrom: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 'clamp(12px, 1.7cqw, 20px)',
    lineHeight: 1.3,
    margin: 0,
    textWrap: 'pretty',
  },
  cardFromBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  // Faded toward the edges so the grid reads as a texture behind the number
  // rather than a table drawn over it.
  cardGrid: {
    backgroundImage:
      'linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    inset: 0,
    maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
    pointerEvents: 'none',
    position: 'absolute',
    WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
  },
  cardYears: {
    fontSize: 'clamp(34px, 9cqw, 112px)',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightBold,
    letterSpacing: '-0.03em',
    lineHeight: 0.95,
    margin: 0,
  },
  cardYearsNumber: {
    color: accent.base,
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
  // The names keep the casing the catalog gives them: "TikTok", not "tiktok".
  const appNames = useMemo(() => apps.map((app) => app.name), [apps]);
  const { apps: named, rest } = shareApps(appNames);
  const targets = shareTargets(shareText({ appNames, locale, url, years }), url);

  // The number wears the accent and the unit stays white, but the catalog keeps
  // the word order ("{years} years", "{years} yıl"): the line is split around
  // the number it interpolated. A catalog that drops the number keeps its line.
  const line = m.share_card_years({ years });
  const at = line.indexOf(years);
  const lead = at === -1 ? '' : line.slice(0, at);
  const unit = at === -1 ? '' : line.slice(at + years.length);
  const number = at === -1 ? line : years;

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
        <div {...props(styles.cardGrid)} />
        <div {...props(styles.cardContent)}>
          <p {...props(styles.cardAbove)}>{m.share_card_above()}</p>
          <p {...props(styles.cardYears)}>
            {lead}
            <span {...props(styles.cardYearsNumber)}>{number}</span>
            {unit}
          </p>
          <div {...props(styles.cardFromBlock)}>
            <p {...props(styles.cardFrom)}>
              {rest > 0
                ? m.share_card_from_more({ apps: named, count: rest })
                : m.share_card_from({ apps: named })}
            </p>
            <span {...props(styles.cardFan)}>
              <AppIconFan apps={apps} interactive={false} meta={meta} />
            </span>
          </div>
          <div {...props(styles.cardFooter)}>
            <span {...props(styles.cardFooterLeft)}>
              <BrandMark size={MARK_SIZE} style={styles.cardMark} />
              <span {...props(styles.cardDomain)}>{m.share_domain()}</span>
            </span>
            <span {...props(styles.cardBadge)}>{m.share_card_badge()}</span>
          </div>
        </div>
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
