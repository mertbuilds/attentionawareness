import { PEAK_GAIN, SILENCE, TICK_HZ, TICK_SECONDS, tickDevice } from './tick-sound.ts';

/** Where the climb ends: the pitch the last hour of a full show lands on. */
const FLOOR_HZ = 180;
/** And how long it holds. The first hour is the detent's own 12 ms. */
const LONGEST_SECONDS = 0.22;
/** How far the second oscillator sits off the first, so the two beat. */
const DETUNE_HZ = 7;
/** The sub under the tone, and the burst of noise over it. */
const SUB_HZ = 55;
const NOISE_SECONDS = 0.06;
/**
 * Where each layer joins, as a fraction of the climb. They are written as the
 * steps of a twelve-hour show because that is the show they were tuned on: a
 * shorter one runs the same fractions in fewer, bigger jumps, so three hours
 * escalate as surely as twelve.
 */
const DETUNE_FROM = 2 / 11;
const SUB_FROM = 5 / 11;
const NOISE_FROM = 8 / 11;
/** A layer is audible the step it joins on, not a step and a half later. */
const LAYER_FLOOR = 0.25;
/** What each layer is worth against the tone once it is all the way in. */
const DETUNE_SHARE = 0.6;
const SUB_SHARE = 0.5;
const NOISE_SHARE = 0.35;

/** The register's two bells: E6, then A6 a breath later. */
const BELL_ONE_HZ = 1318.51;
const BELL_TWO_HZ = 1760;
const BELL_SECONDS = 0.06;
const BELL_GAP = 0.08;
/** The bell's own second harmonic, faint enough to be metal and not a chord. */
const HARMONIC_SHARE = 0.18;
const BELL_GAIN = PEAK_GAIN * 0.7;
/** The drawer landing: noise with everything but the body filtered off it. */
const CLUNK_AT = 0.24;
const CLUNK_SECONDS = 0.04;
const CLUNK_CUTOFF_HZ = 400;
const CLUNK_GAIN = PEAK_GAIN * 0.5;

/** One oscillator of a sound: what it plays, how loud, and for how long. */
export type Voice = {
  frequency: number;
  gain: number;
  seconds: number;
  type: OscillatorType;
};

/** A burst of noise, which has no pitch to name. */
export type NoiseVoice = { gain: number; seconds: number };

/**
 * One hour of the show, as the oscillators that say it. The tone is always
 * there; the rest join as the day gets worse, and are absent before that.
 */
export type StepVoices = {
  beat: Voice | undefined;
  noise: NoiseVoice | undefined;
  sub: Voice | undefined;
  tone: Voice;
};

/** One of the two bells, and the harmonic that makes it one. */
export type BellVoice = {
  at: number;
  frequency: number;
  gain: number;
  harmonicGain: number;
  seconds: number;
};

/** The drawer under them. */
export type ClunkVoice = { at: number; cutoffHz: number; gain: number; seconds: number };

export type CheckoutVoices = { bells: ReadonlyArray<BellVoice>; clunk: ClunkVoice };

/**
 * How far up the climb one step stands. The first step is the clean detent and
 * the last is the worst of it, whichever show is running.
 */
export function climb(step: number, total: number): number {
  if (total <= 1) {
    return 0;
  }
  return Math.min(Math.max((step - 1) / (total - 1), 0), 1);
}

/** How far past its own threshold a layer has come, and nothing before it. */
function layer(at: number, from: number): number {
  if (at < from) {
    return 0;
  }
  return LAYER_FLOOR + (1 - LAYER_FLOOR) * ((at - from) / (1 - from));
}

/**
 * What one hour of the show sounds like. The pitch falls and the note lengthens
 * across the climb, and three more voices join it on the way down. However many
 * are playing, they add up to one detent: the dread is in what is sounding, not
 * in how hard it is played.
 */
export function stepVoices(step: number, total: number): StepVoices {
  const at = climb(step, total);
  const frequency = TICK_HZ * (FLOOR_HZ / TICK_HZ) ** at;
  const seconds = TICK_SECONDS * (LONGEST_SECONDS / TICK_SECONDS) ** at;
  const beatAt = layer(at, DETUNE_FROM) * DETUNE_SHARE;
  const subAt = layer(at, SUB_FROM) * SUB_SHARE;
  const noiseAt = layer(at, NOISE_FROM) * NOISE_SHARE;
  const share = PEAK_GAIN / (1 + beatAt + subAt + noiseAt);
  return {
    beat:
      beatAt === 0
        ? undefined
        : {
            frequency: frequency + DETUNE_HZ,
            gain: beatAt * share,
            seconds,
            type: 'sawtooth',
          },
    noise: noiseAt === 0 ? undefined : { gain: noiseAt * share, seconds: NOISE_SECONDS },
    sub:
      subAt === 0 ? undefined : { frequency: SUB_HZ, gain: subAt * share, seconds, type: 'sine' },
    tone: { frequency, gain: share, seconds, type: 'sine' },
  };
}

/** The register ringing the total up, and the drawer closing on it. */
export function checkoutVoices(): CheckoutVoices {
  return {
    bells: [BELL_ONE_HZ, BELL_TWO_HZ].map((frequency, index) => ({
      at: index * BELL_GAP,
      frequency,
      gain: BELL_GAIN,
      harmonicGain: BELL_GAIN * HARMONIC_SHARE,
      seconds: BELL_SECONDS,
    })),
    clunk: { at: CLUNK_AT, cutoffHz: CLUNK_CUTOFF_HZ, gain: CLUNK_GAIN, seconds: CLUNK_SECONDS },
  };
}

function tone(device: AudioContext, at: number, voice: Voice): void {
  const oscillator = device.createOscillator();
  const gain = device.createGain();
  oscillator.type = voice.type;
  oscillator.frequency.setValueAtTime(voice.frequency, at);
  gain.gain.setValueAtTime(voice.gain, at);
  gain.gain.exponentialRampToValueAtTime(SILENCE, at + voice.seconds);
  oscillator.connect(gain);
  gain.connect(device.destination);
  oscillator.start(at);
  oscillator.stop(at + voice.seconds);
}

/** White noise, optionally with everything over a cutoff taken off it. */
function burst(device: AudioContext, at: number, voice: NoiseVoice, cutoffHz?: number): void {
  const frames = Math.max(1, Math.round(device.sampleRate * voice.seconds));
  const buffer = device.createBuffer(1, frames, device.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }
  const source = device.createBufferSource();
  source.buffer = buffer;
  const gain = device.createGain();
  gain.gain.setValueAtTime(voice.gain, at);
  gain.gain.exponentialRampToValueAtTime(SILENCE, at + voice.seconds);
  if (cutoffHz === undefined) {
    source.connect(gain);
  } else {
    const filter = device.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, at);
    source.connect(filter);
    filter.connect(gain);
  }
  gain.connect(device.destination);
  source.start(at);
  source.stop(at + voice.seconds);
}

/** One hour of the show. Silent where no gesture has opened a device yet. */
export function playStep(step: number, total: number): void {
  const device = tickDevice();
  if (device === null) {
    return;
  }
  try {
    const now = device.currentTime;
    const { beat, noise, sub, tone: pitch } = stepVoices(step, total);
    tone(device, now, pitch);
    if (beat !== undefined) {
      tone(device, now, beat);
    }
    if (sub !== undefined) {
      tone(device, now, sub);
    }
    if (noise !== undefined) {
      burst(device, now, noise);
    }
  } catch {
    // A device the browser will not run must never hold the show up.
  }
}

/** The till, once the bill is printed. */
export function playCheckout(): void {
  const device = tickDevice();
  if (device === null) {
    return;
  }
  try {
    const now = device.currentTime;
    const { bells, clunk } = checkoutVoices();
    for (const bell of bells) {
      tone(device, now + bell.at, {
        frequency: bell.frequency,
        gain: bell.gain,
        seconds: bell.seconds,
        type: 'sine',
      });
      tone(device, now + bell.at, {
        frequency: bell.frequency * 2,
        gain: bell.harmonicGain,
        seconds: bell.seconds,
        type: 'sine',
      });
    }
    burst(device, now + clunk.at, clunk, clunk.cutoffHz);
  } catch {
    // The same: a bill nobody hears is still a bill.
  }
}
