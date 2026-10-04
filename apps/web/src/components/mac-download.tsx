import { Button } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { posthog } from '../lib/analytics.ts';
import { announceDownload } from '../lib/download-started.ts';
import { parseRelease } from '../lib/mac-release.ts';
import type { Release } from '../lib/mac-release.ts';
import { isMobileAgent } from '../lib/mobile.ts';
import { SECTION } from '../lib/sections.ts';
import { shareUrl } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';

/**
 * What a release writes beside the dmg. It does not exist before the first one,
 * so the page reads it rather than carrying a version of its own: no file, no
 * download.
 */
const LATEST_URL = '/mac/latest.json';
/** The link a phone sends on to a Mac: the site, open where the download stands on the home page. */
const SEND_URL = shareUrl('phone', SECTION.wayOut);

/** Where on the site a download stands, which its event carries. */
type Placement = 'blog' | 'closing' | 'download' | 'header' | 'hero';

/**
 * What a download does: nothing before the first release, nothing yet while
 * `latest.json` is read, send the link on to a Mac from a phone or a tablet,
 * and on a computer start the file.
 */
type Download =
  | { kind: 'unreleased' }
  | { kind: 'reading' }
  | { kind: 'send' }
  | {
      /** The name the browser saves the file under. */
      filename: string;
      kind: 'file';
      start: (event: MouseEvent<HTMLElement>) => void;
      url: string;
    };

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
  // What a phone is told in place of the download it cannot run.
  note: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
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
 * What a phone's button says: share, where the phone has a share sheet, else
 * copy, and once copied, that it is.
 */
function sendLabel(copied: boolean): string {
  if ('share' in navigator) {
    return m.mac_download_share();
  }
  return copied ? m.mac_download_copied() : m.mac_download_copy();
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
 * and the first client render answer `false` and the page corrects itself
 * once it is up.
 */
function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeNever, isMobile, () => false);
}

/**
 * What the download at `placement` does, the same wherever it stands. The
 * file is only offered once `latest.json` has been read, which happens after
 * the page is up, and by then a phone or a tablet has been told apart: the
 * server's page and a click before it comes alive carry no link to start.
 */
export function useMacDownload(placement: Placement): Download {
  const release = useLatestRelease();
  const mobile = useIsMobile();

  if (release === null) {
    return { kind: 'unreleased' };
  }
  if (mobile) {
    return { kind: 'send' };
  }
  if (release === undefined) {
    return { kind: 'reading' };
  }
  return {
    filename: release.filename,
    kind: 'file',
    // The click goes on to the file untouched. The page is only told that it
    // has started, and by which button.
    start: (event) => {
      posthog.capture('mac_download_started', { placement });
      announceDownload({ button: event.currentTarget, placement });
    },
    url: release.url,
  };
}

/**
 * Sends the download on from a phone, which cannot run it, to a Mac. The
 * share sheet reaches a Mac by AirDrop or a message; without one, the link
 * goes to the clipboard, and `copied` says it is there. Every download on the
 * site sends the same link.
 */
export function useSendToMac(): { copied: boolean; send: () => Promise<void> } {
  const [copied, setCopied] = useState(false);

  async function send() {
    const canShare = 'share' in navigator;
    if (canShare) {
      try {
        await navigator.share({ url: SEND_URL });
        posthog.capture('mac_download_link_shared', { share_method: 'share_sheet' });
      } catch {
        // The sheet was closed. Nothing to say.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(SEND_URL);
      setCopied(true);
      posthog.capture('mac_download_link_shared', { share_method: 'clipboard' });
    } catch {
      // The clipboard refused. The button keeps offering it.
    }
  }

  return { copied, send };
}

/**
 * The download on a phone: where to open the page instead, and the button
 * that sends the link there.
 */
function SendToMac() {
  const { copied, send } = useSendToMac();
  const label = sendLabel(copied);

  return (
    <>
      <p {...props(styles.note)}>{m.mac_download_on_mac()}</p>
      <Button onClick={() => void send()}>{label}</Button>
    </>
  );
}

/**
 * The download, wherever the page asks for it. While `latest.json` is being
 * read the button stands as it will, only off. Before the first release there
 * is no file to read, so the button says so and does nothing. On a phone, the
 * page says where to open it instead.
 */
export function MacDownload({ placement, style }: { placement: Placement; style?: StyleXStyles }) {
  const download = useMacDownload(placement);

  const cta = <MacCta label={m.mac_download_cta()} />;

  let action: ReactNode;
  if (download.kind === 'unreleased') {
    action = <Button disabled>{m.mac_download_unreleased()}</Button>;
  } else if (download.kind === 'send') {
    action = <SendToMac />;
  } else if (download.kind === 'reading') {
    action = <Button disabled>{cta}</Button>;
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
