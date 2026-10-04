/**
 * What the download button reads from `/mac/latest.json`, the file a release
 * writes beside the dmg. The rest of that file is the updater's.
 */
export type Release = {
  /** The name the file is saved under: the version alone, never the build. */
  filename: string;
  url: string;
};

/** A plain file name, safe to hand to the browser as the saved name. */
const SAFE_FILENAME = /^[A-Za-z0-9._-]+\.dmg$/u;
const VERSION = /^\d+(?:\.\d+)*$/u;
/** The saved name when `latest.json` carries neither a name nor a version. */
const PLAIN_NAME = 'attention-awareness.dmg';

/**
 * The release in a parsed `latest.json`, or `null` when it names no file. The
 * dmg's own name carries the build number, which reads like a second version,
 * so the saved name is the file's `filename` when it is a plain name, and else
 * made from `version`. Releases before 0.4.1 wrote no `filename`.
 */
export function parseRelease(payload: unknown): Release | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  if (!('url' in payload) || typeof payload.url !== 'string') {
    return null;
  }
  const { url } = payload;
  if (
    'filename' in payload &&
    typeof payload.filename === 'string' &&
    SAFE_FILENAME.test(payload.filename)
  ) {
    return { filename: payload.filename, url };
  }
  if (
    'version' in payload &&
    typeof payload.version === 'string' &&
    VERSION.test(payload.version)
  ) {
    return { filename: `attention-awareness-${payload.version}.dmg`, url };
  }
  return { filename: PLAIN_NAME, url };
}
