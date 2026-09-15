import { tickDevice } from './tick-sound.ts';

/** Decoded once, then played from memory as often as the page asks. */
const decoded = new Map<string, Promise<AudioBuffer | null>>();

/**
 * Fetches and decodes a clip through the page's one audio device, the same
 * one the ticks use, so it obeys the same unlock. A clip that cannot load
 * or decode stays silent; nothing waits on it.
 */
export function loadClip(url: string): Promise<AudioBuffer | null> {
  const known = decoded.get(url);
  if (known !== undefined) {
    return known;
  }
  const device = tickDevice();
  if (device === null) {
    return Promise.resolve(null);
  }
  const loading = fetch(url)
    .then((response) => response.arrayBuffer())
    .then((bytes) => device.decodeAudioData(bytes))
    .catch(() => null);
  decoded.set(url, loading);
  return loading;
}

/** Plays a clip now, from the start. Loads it first if it never has. */
export function playClip(url: string): void {
  const device = tickDevice();
  if (device === null) {
    return;
  }
  void loadClip(url).then((buffer) => {
    if (buffer === null) {
      return;
    }
    const source = device.createBufferSource();
    source.buffer = buffer;
    source.connect(device.destination);
    source.start();
  });
}
