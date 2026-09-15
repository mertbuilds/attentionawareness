import { PEAK_GAIN, SILENCE, tickDevice } from './tick-sound.ts';

/**
 * The hit itself: two sine partials struck together, which is what makes a
 * small piece of metal sound like one rather than like a beep.
 */
const PARTIAL_ONE_HZ = 2400;
const PARTIAL_TWO_HZ = 3700;
/** What the upper partial is worth against the lower one. */
const PARTIAL_TWO_SHARE = 0.7;
/** The scrape of the strike, ahead of the tone, and what it is worth. */
const TRANSIENT_SECONDS = 0.004;
const TRANSIENT_SHARE = 0.5;
/** How long the hit rings: the gate's own, and the last hour of a full show. */
const HIT_SECONDS = 0.04;
const LONGEST_SECONDS = 0.26;
/**
 * How far one hour of the show pitches the hit under the one before it. The
 * gate's own detent is the hit at its written pitch; every hour is below it.
 */
const STEP_FALL = 0.85;
/** How far the second oscillator sits off the first, so the two beat. */
const DETUNE_HZ = 7;
/** The sub under the tone. */
const SUB_HZ = 55;
/**
 * Where each layer joins, as a fraction of the climb. They are written as the
 * steps of a twelve-hour show because that is the show they were tuned on: a
 * shorter one runs the same fractions in fewer, bigger jumps, so three hours
 * escalate as surely as twelve.
 */
const DETUNE_FROM = 2 / 11;
const SUB_FROM = 5 / 11;
/** A layer is audible the step it joins on, not a step and a half later. */
const LAYER_FLOOR = 0.25;
/** What each layer is worth against the hit once it is all the way in. */
const DETUNE_SHARE = 0.6;
const SUB_SHARE = 0.5;

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
 * One metallic hit, as the oscillators that say it. The two partials and the
 * transient are always there; the rest join as the day gets worse, and are
 * absent before that.
 */
export type StepVoices = {
  beat: Voice | undefined;
  partials: readonly [Voice, Voice];
  sub: Voice | undefined;
  transient: NoiseVoice;
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
 * One hit, struck at whatever pitch and length it was handed, with whatever
 * layers the climb has earned it. However many are playing, they add up to one
 * detent: the dread is in what is sounding, not in how hard it is played.
 */
function strike(fall: number, seconds: number, beatAt: number, subAt: number): StepVoices {
  const share = PEAK_GAIN / (1 + PARTIAL_TWO_SHARE + TRANSIENT_SHARE + beatAt + subAt);
  const lower = PARTIAL_ONE_HZ * fall;
  return {
    beat:
      beatAt === 0
        ? undefined
        : { frequency: lower + DETUNE_HZ, gain: beatAt * share, seconds, type: 'sawtooth' },
    partials: [
      { frequency: lower, gain: share, seconds, type: 'sine' },
      {
        frequency: PARTIAL_TWO_HZ * fall,
        gain: PARTIAL_TWO_SHARE * share,
        seconds,
        type: 'sine',
      },
    ],
    sub:
      subAt === 0 ? undefined : { frequency: SUB_HZ, gain: subAt * share, seconds, type: 'sine' },
    transient: { gain: TRANSIENT_SHARE * share, seconds: TRANSIENT_SECONDS },
  };
}

/** The detent under the slider: the hit at its written pitch, and nothing else. */
export function tickVoices(): StepVoices {
  return strike(1, HIT_SECONDS, 0, 0);
}

/** How far under the detent the bill's plus and minus click: a third of the pitch. */
const CLICK_FALL = 0.33;
const CLICK_SECONDS = 0.05;

/** The click of the bill's plus and minus: the same hit, an octave and more down. */
export function clickVoices(): StepVoices {
  return strike(CLICK_FALL, CLICK_SECONDS, 0, 0.6);
}

/**
 * What one hour of the show sounds like. It is the gate's own detent, pitched
 * a step lower for every hour it stands above, with the note lengthening
 * across the climb and two more voices joining it on the way down.
 */
export function stepVoices(step: number, total: number): StepVoices {
  const at = climb(step, total);
  return strike(
    STEP_FALL ** step,
    HIT_SECONDS * (LONGEST_SECONDS / HIT_SECONDS) ** at,
    layer(at, DETUNE_FROM) * DETUNE_SHARE,
    layer(at, SUB_FROM) * SUB_SHARE,
  );
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

/** One hit, played. Silent where no gesture has opened a device yet. */
function play(voices: StepVoices): void {
  const device = tickDevice();
  if (device === null) {
    return;
  }
  try {
    const now = device.currentTime;
    for (const partial of voices.partials) {
      tone(device, now, partial);
    }
    burst(device, now, voices.transient);
    if (voices.beat !== undefined) {
      tone(device, now, voices.beat);
    }
    if (voices.sub !== undefined) {
      tone(device, now, voices.sub);
    }
  } catch {
    // A device the browser will not run must never hold the control up.
  }
}

/** One detent of the slider the question is answered on. */
export function playTick(): void {
  play(tickVoices());
}

/** One press of the bill's plus or minus. */
export function playClick(): void {
  play(clickVoices());
}

/** One hour of the show. */
export function playStep(step: number, total: number): void {
  play(stepVoices(step, total));
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
