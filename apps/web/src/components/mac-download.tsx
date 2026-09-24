import { Button } from '@attentionawareness/ui';
import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { m } from '../paraglide/messages.js';

/**
 * What a release writes beside the dmg. It does not exist before the first one,
 * so the page reads it rather than carrying a version of its own: no file, no
 * download.
 */
const LATEST_URL = '/mac/latest.json';

/** The field of `latest.json` this component reads. The rest is the updater's. */
type Release = {
  url: string;
};

const styles = create({
  // The Apple mark on the download button, sized to the label.
  appleMark: {
    fill: 'currentColor',
    height: '1em',
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
  // The label text, its box hugged to the glyphs so it reads level with the icon.
  label: {
    lineHeight: 1,
  },
});

/**
 * Reads `latest.json` once the page is up. A missing, unreadable or incomplete
 * file leaves the state null, which is what turns the download off: the page
 * never points at a build it has not read.
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
        if (typeof payload.url === 'string') {
          setRelease({ url: payload.url });
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
 * The download, wherever the page asks for it. Before the first release there
 * is no `latest.json` to read, so the button says so and does nothing.
 */
export function MacDownload() {
  const release = useLatestRelease();

  return (
    <div {...props(styles.download)}>
      {release === null ? (
        <Button disabled>{m.mac_download_unreleased()}</Button>
      ) : (
        <Button render={<a download href={release.url} />}>
          <span {...props(styles.cta)}>
            <svg aria-hidden="true" viewBox="0 0 384 512" {...props(styles.appleMark)}>
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            <span {...props(styles.label)}>{m.mac_download_cta()}</span>
          </span>
        </Button>
      )}
    </div>
  );
}
