/** Loud enough to feel mechanical, quiet enough to drag the slider with. */
export const PEAK_GAIN = 0.25;
/** An exponential ramp cannot reach zero, so it lands just under hearing. */
export const SILENCE = 0.0001;
/** One sample at the lowest rate every browser accepts: the unlock buffer. */
const UNLOCK_RATE = 22_050;

/** The one device the page opens, kept for every later click. */
let context: AudioContext | null = null;

/**
 * The device, opened on first ask. Where there is no Web Audio at all (a
 * worker, an old browser, jsdom) there is no device and every click is silent.
 */
function openDevice(): AudioContext | null {
  if (context === null) {
    const create = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (create === undefined) {
      return null;
    }
    try {
      context = new create();
    } catch {
      return null;
    }
  }
  return context;
}

function wake(device: AudioContext): void {
  device.resume().catch(() => {
    // A device the browser will not open is simply a slider without sound.
  });
}

/**
 * Opens the audio device. A browser only grants one inside a gesture, so this
 * is called from the pointer that is about to move the slider.
 */
export function primeTickSound(): void {
  const device = openDevice();
  if (device !== null && device.state === 'suspended') {
    wake(device);
  }
}

/**
 * The same, for iOS Safari, which does not count a pointerdown as a gesture and
 * leaves the device asleep until something has actually run through it: one
 * silent sample is that something. Answers whether the device is open, so the
 * gesture that opened it can be the last one listened for.
 */
export function unlockTickSound(): boolean {
  const device = openDevice();
  if (device === null) {
    return false;
  }
  try {
    wake(device);
    const source = device.createBufferSource();
    source.buffer = device.createBuffer(1, 1, UNLOCK_RATE);
    source.connect(device.destination);
    source.start(0);
  } catch {
    return false;
  }
  return true;
}

/**
 * The open device, for the other sounds the page plays through it. They share
 * this one and its unlock: whatever gesture opened it for the detents opened
 * it for them, and a device nobody has opened yet stays unopened here.
 */
export function tickDevice(): AudioContext | null {
  if (context !== null && context.state === 'suspended') {
    wake(context);
  }
  return context;
}
