/** The detent click, and the lower thunk at the two ends of the travel. */
const TICK_HZ = 1200;
const END_HZ = 700;
const TICK_SECONDS = 0.012;
const END_SECONDS = 0.04;
/** Loud enough to feel mechanical, quiet enough to drag the slider with. */
const PEAK_GAIN = 0.08;
/** An exponential ramp cannot reach zero, so it lands just under hearing. */
const SILENCE = 0.0001;

/** The one device the page opens, kept for every later click. */
let context: AudioContext | null = null;

/**
 * Opens the audio device. A browser only grants one inside a gesture, so this
 * is called from the pointer that is about to move the slider; where there is
 * no Web Audio at all (a worker, an old browser, jsdom) it does nothing and
 * every later click is silent.
 */
export function primeTickSound(): void {
  if (context === null) {
    const create = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (create === undefined) {
      return;
    }
    try {
      context = new create();
    } catch {
      return;
    }
  }
  if (context.state === 'suspended') {
    context.resume().catch(() => {
      // A device the browser will not open is simply a slider without sound.
    });
  }
}

/** One detent. The ends of the travel get a lower, longer thunk. */
export function playTick({ end = false }: { end?: boolean } = {}): void {
  if (context === null) {
    return;
  }
  try {
    const now = context.currentTime;
    const seconds = end ? END_SECONDS : TICK_SECONDS;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(end ? END_HZ : TICK_HZ, now);
    gain.gain.setValueAtTime(PEAK_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(SILENCE, now + seconds);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + seconds);
  } catch {
    // A closed or busy device must never break the control it belongs to.
  }
}
