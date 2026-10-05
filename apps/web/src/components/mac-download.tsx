import { Button } from '@attentionawareness/ui';
import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { posthog } from '../lib/analytics.ts';
import { downloadFor } from '../lib/download-press.ts';
import type { Download, Placement } from '../lib/download-press.ts';
import { parseRelease } from '../lib/mac-release.ts';
import type { Release } from '../lib/mac-release.ts';
import { isMobileAgent } from '../lib/mobile.ts';
import { m } from '../paraglide/messages.js';

/**
 * What a release writes beside the dmg. It does not exist before the first one,
 * so the page reads it rather than carrying a version of its own: no file, no
 * download.
 */
const LATEST_URL = '/mac/latest.json';

const styles = create({
  // The Apple mark on the download button, sized to the label.
  appleMark: {
    fill: 'currentColor',
    height: '1em',
    transform: 'translateY(-1px)',
    width: '1em',
  },
  // Icon and label as one row, centered against each other.
  cta: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  // The download button, left edge shared with the prose.
  download: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  // The label text. Its line box carries descender room the caps-only label
  // never uses, so it is nudged down to sit optically centered in the button.
  label: {
    lineHeight: 1,
    transform: 'translateY(1px)',
  },
});

/**
 * A download's label after the Apple mark, the two centered against each
 * other in the button.
 */
export function MacCta({ label }: { label: string }) {
  return (
    <span {...props(styles.cta)}>
      <svg aria-hidden="true" viewBox="0 0 384 512" {...props(styles.appleMark)}>
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      <span {...props(styles.label)}>{label}</span>
    </span>
  );
}

/**
 * The one read of `latest.json` every download on the page shares, so two
 * buttons cost one request. A read that finds nothing is not kept, so a page
 * opened later tries again.
 */
let latestRead: Promise<Release | null> | undefined;

function readLatest(): Promise<Release | null> {
  latestRead ??= (async () => {
    try {
      const response = await fetch(LATEST_URL);
      if (!response.ok) {
        return null;
      }
      const payload: unknown = await response.json();
      return parseRelease(payload);
    } catch {
      // No release yet, or the network refused it. The button stays off.
      return null;
    }
  })().then((release) => {
    if (release === null) {
      latestRead = undefined;
    }
    return release;
  });
  return latestRead;
}

/**
 * Reads `latest.json` once the page is up. Until the read settles the state is
 * undefined, which the server renders too, so neither a crawler nor the first
 * paint is told there is no release. A missing, unreadable or incomplete file
 * leaves it null, which is what turns the download off: the page never points
 * at a build it has not read.
 */
function useLatestRelease(): Release | null | undefined {
  const [release, setRelease] = useState<Release | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    void readLatest().then((found) => {
      if (mounted) {
        setRelease(found);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return release;
}

/** A phone or a tablet, which cannot run the app. */
function isMobile(): boolean {
  return isMobileAgent(navigator.userAgent, navigator.maxTouchPoints);
}

/** The device does not change under the page, so there is nothing to listen to. */
function subscribeNever() {
  return () => {};
}

/**
 * Whether the reader is on a phone or a tablet. The server cannot tell, so it
 * and the first client render answer `false`. Both draw the same button, off
 * while `latest.json` is read, so nothing on the page changes when the answer
 * comes.
 */
function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeNever, isMobile, () => false);
}

/**
 * What the download at `placement` does, the same wherever it stands. It does
 * nothing until `latest.json` has been read, which happens after the page is
 * up, and by then a phone or a tablet has been told apart: the server's page
 * and a click before it comes alive carry no link to start.
 */
export function useMacDownload(placement: Placement): Download {
  const release = useLatestRelease();
  const mobile = useIsMobile();
  return downloadFor(release, mobile, placement, (event, properties) =>
    posthog.capture(event, properties),
  );
}

/**
 * The download, wherever the page asks for it, the same button on every
 * device. While `latest.json` is being read the button stands as it will, only
 * off. Before the first release there is no file to read, so the button says
 * so and does nothing. On a computer it is a link to the file. On a phone or a
 * tablet it is a button that opens the popup that sends the link on to a Mac
 * (`phone-download-popup.tsx`).
 */
export function MacDownload({ placement, style }: { placement: Placement; style?: StyleXStyles }) {
  const download = useMacDownload(placement);

  const cta = <MacCta label={m.mac_download_cta()} />;

  let action: ReactNode;
  if (download.kind === 'unreleased') {
    action = <Button disabled>{m.mac_download_unreleased()}</Button>;
  } else if (download.kind === 'reading') {
    action = <Button disabled>{cta}</Button>;
  } else if (download.kind === 'phone') {
    action = (
      <Button aria-haspopup="dialog" onClick={download.open}>
        {cta}
      </Button>
    );
  } else {
    action = (
      <Button
        onClick={download.start}
        render={<a download={download.filename} href={download.url} />}
      >
        {cta}
      </Button>
    );
  }

  return <div {...props(styles.download, style)}>{action}</div>;
}
