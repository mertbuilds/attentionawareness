import { Button } from '@attentionawareness/ui';
import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';

/**
 * What a release writes beside the dmg. It does not exist before the first one,
 * so the page reads it rather than carrying a version of its own: no file, no
 * download.
 */
const LATEST_URL = '/mac/latest.json';
/** A download size is quoted in decimal megabytes, the way Finder counts them. */
const BYTES_PER_MB = 1_000_000;
/** How much of a megabyte a download size is worth reading. */
const SIZE_DIGITS = 1;

/** The three fields of `latest.json` this component reads. The rest is the updater's. */
type Release = {
  size: number;
  url: string;
  version: string;
};

const styles = create({
  // The button and the size line under it, left edge shared with the prose.
  download: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
});

/**
 * Reads `latest.json` once the page is up. A missing, unreadable or incomplete
 * file leaves the state null, which is what turns the download off: the page
 * never names a version it has not read.
 */
function useLatestRelease(): Release | null {
  const [release, setRelease] = useState<Release | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const read = async (): Promise<void> => {
      try {
        const response = await fetch(LATEST_URL, { signal: controller.signal });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as Partial<Release>;
        if (
          typeof payload.size === 'number' &&
          typeof payload.url === 'string' &&
          typeof payload.version === 'string'
        ) {
          setRelease({ size: payload.size, url: payload.url, version: payload.version });
        }
      } catch {
        // No release yet, or the network refused it. The button stays off.
      }
    };

    void read();
    return () => controller.abort();
  }, []);

  return release;
}

/**
 * The download, wherever the page asks for it: the button, and under it the
 * version and the size of the build it points at. Before the first release
 * there is no `latest.json` to read, so the button says so and does nothing.
 */
export function MacDownload() {
  const release = useLatestRelease();

  return (
    <div {...props(styles.download)}>
      {release === null ? (
        <Button disabled>{m.mac_download_unreleased()}</Button>
      ) : (
        <Button render={<a download href={release.url} />}>{m.mac_download_cta()}</Button>
      )}
      {release === null ? null : (
        <p {...props(layout.muted)}>
          {m.mac_download_build({
            size: (release.size / BYTES_PER_MB).toFixed(SIZE_DIGITS),
            version: release.version,
          })}
        </p>
      )}
    </div>
  );
}
