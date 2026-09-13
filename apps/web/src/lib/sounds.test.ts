import { describe, expect, it } from 'vitest';
import { checkoutVoices, climb, playCheckout, playStep, stepVoices } from './sounds.ts';
import { PEAK_GAIN, TICK_HZ, TICK_SECONDS } from './tick-sound.ts';

/** The show the curves were tuned on: one step per stop of the dial. */
const FULL = 12;

/** Everything one step plays, added up. */
function loudness(step: number, total: number): number {
  const { beat, noise, sub, tone } = stepVoices(step, total);
  return tone.gain + (beat?.gain ?? 0) + (sub?.gain ?? 0) + (noise?.gain ?? 0);
}

describe('climb', () => {
  it('runs from nothing to everything across the show it is given', () => {
    expect(climb(1, FULL)).toBe(0);
    expect(climb(FULL, FULL)).toBe(1);
    expect(climb(1, 3)).toBe(0);
    expect(climb(3, 3)).toBe(1);
  });

  it('leaves a single beat at the bottom of the climb', () => {
    expect(climb(1, 1)).toBe(0);
  });
});

describe('stepVoices', () => {
  it('opens on the detent itself, and on nothing else', () => {
    const first = stepVoices(1, FULL);

    expect(first.tone).toEqual({
      frequency: TICK_HZ,
      gain: PEAK_GAIN,
      seconds: TICK_SECONDS,
      type: 'sine',
    });
    expect(first.beat).toBeUndefined();
    expect(first.sub).toBeUndefined();
    expect(first.noise).toBeUndefined();
  });

  it('drops the pitch and stretches the note the further it goes', () => {
    const pitches = Array.from({ length: FULL }, (_, index) => stepVoices(index + 1, FULL));

    for (let index = 1; index < pitches.length; index += 1) {
      expect(pitches[index]?.tone.frequency).toBeLessThan(pitches[index - 1]?.tone.frequency ?? 0);
      expect(pitches[index]?.tone.seconds).toBeGreaterThan(pitches[index - 1]?.tone.seconds ?? 0);
    }
    expect(pitches.at(-1)?.tone.frequency).toBeCloseTo(180, 6);
    expect(pitches.at(-1)?.tone.seconds).toBeCloseTo(0.22, 6);
  });

  it('brings the beating sawtooth in at the third hour', () => {
    expect(stepVoices(2, FULL).beat).toBeUndefined();

    const beat = stepVoices(3, FULL).beat;

    expect(beat?.type).toBe('sawtooth');
    expect(beat?.frequency).toBeCloseTo(stepVoices(3, FULL).tone.frequency + 7, 6);
  });

  it('brings the sub in at the sixth hour, and the noise at the ninth', () => {
    expect(stepVoices(5, FULL).sub).toBeUndefined();
    expect(stepVoices(6, FULL).sub?.frequency).toBe(55);
    expect(stepVoices(8, FULL).noise).toBeUndefined();
    expect(stepVoices(9, FULL).noise?.gain).toBeGreaterThan(0);
  });

  it('never plays a step louder than one detent, however many voices it has', () => {
    for (let step = 1; step <= FULL; step += 1) {
      expect(loudness(step, FULL)).toBeLessThanOrEqual(PEAK_GAIN + Number.EPSILON);
    }
    expect(loudness(FULL, FULL)).toBeCloseTo(PEAK_GAIN, 6);
  });

  it('escalates a three-hour show the same way it escalates a twelve', () => {
    const short = [1, 2, 3].map((step) => stepVoices(step, 3));

    expect(short.at(0)?.beat).toBeUndefined();
    expect(short.at(1)?.beat).toBeDefined();
    expect(short.at(2)?.noise).toBeDefined();
    expect(short.at(-1)?.tone.frequency).toBeCloseTo(stepVoices(FULL, FULL).tone.frequency, 6);
  });
});

describe('checkoutVoices', () => {
  it('rings E6 and A6 a breath apart, each with a faint harmonic over it', () => {
    const { bells } = checkoutVoices();

    expect(bells.map((bell) => bell.frequency)).toEqual([1318.51, 1760]);
    expect(bells.map((bell) => bell.at)).toEqual([0, 0.08]);
    expect(bells.every((bell) => bell.seconds === 0.06)).toBe(true);
    for (const bell of bells) {
      expect(bell.harmonicGain).toBeLessThan(bell.gain);
      expect(bell.gain + bell.harmonicGain).toBeLessThanOrEqual(PEAK_GAIN);
    }
  });

  it('lands the drawer after them, filtered down to its body', () => {
    const { bells, clunk } = checkoutVoices();

    expect(clunk.cutoffHz).toBe(400);
    expect(clunk.seconds).toBe(0.04);
    expect(clunk.at).toBeGreaterThan((bells.at(-1)?.at ?? 0) + (bells.at(-1)?.seconds ?? 0));
    // The whole till, start to finish, is about a third of a second.
    expect(clunk.at + clunk.seconds).toBeLessThanOrEqual(0.3);
  });
});

describe('the sounds without a device', () => {
  it('stays silent where no gesture has opened one', () => {
    expect(() => {
      playStep(1, FULL);
      playCheckout();
    }).not.toThrow();
  });
});
