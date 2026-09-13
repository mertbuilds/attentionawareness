import { describe, expect, it } from 'vitest';
import {
  checkoutVoices,
  climb,
  playCheckout,
  playStep,
  playTick,
  stepVoices,
  tickVoices,
} from './sounds.ts';
import { PEAK_GAIN } from './tick-sound.ts';

/** The show the curves were tuned on: one step per stop of the slider. */
const FULL = 12;

/** Everything one hit plays, added up. */
function loudness(voices: ReturnType<typeof stepVoices>): number {
  const [lower, upper] = voices.partials;
  return (
    lower.gain +
    upper.gain +
    voices.transient.gain +
    (voices.beat?.gain ?? 0) +
    (voices.sub?.gain ?? 0)
  );
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

describe('tickVoices', () => {
  it('strikes two partials over a four-millisecond transient, and nothing else', () => {
    const hit = tickVoices();

    expect(hit.partials.map((partial) => partial.frequency)).toEqual([2400, 3700]);
    expect(hit.partials.every((partial) => partial.type === 'sine')).toBe(true);
    expect(hit.partials.every((partial) => partial.seconds === 0.04)).toBe(true);
    expect(hit.transient.seconds).toBe(0.004);
    expect(hit.beat).toBeUndefined();
    expect(hit.sub).toBeUndefined();
  });

  it('is one detent loud, however many voices it is made of', () => {
    expect(loudness(tickVoices())).toBeCloseTo(PEAK_GAIN, 6);
  });
});

describe('stepVoices', () => {
  it('opens one step under the gate detent, and on nothing else', () => {
    const first = stepVoices(1, FULL);

    expect(first.partials[0].frequency).toBeCloseTo(2400 * 0.85, 6);
    expect(first.partials[1].frequency).toBeCloseTo(3700 * 0.85, 6);
    expect(first.partials[0].seconds).toBeCloseTo(0.04, 6);
    expect(first.transient.seconds).toBe(0.004);
    expect(first.beat).toBeUndefined();
    expect(first.sub).toBeUndefined();
  });

  it('drops the pitch and stretches the note the further it goes', () => {
    const hits = Array.from({ length: FULL }, (_, index) => stepVoices(index + 1, FULL));

    for (let index = 1; index < hits.length; index += 1) {
      expect(hits[index]?.partials[0].frequency).toBeLessThan(
        hits[index - 1]?.partials[0].frequency ?? 0,
      );
      expect(hits[index]?.partials[1].frequency).toBeLessThan(
        hits[index - 1]?.partials[1].frequency ?? 0,
      );
      expect(hits[index]?.partials[0].seconds).toBeGreaterThan(
        hits[index - 1]?.partials[0].seconds ?? 0,
      );
    }
    expect(hits.at(-1)?.partials[0].frequency).toBeCloseTo(2400 * 0.85 ** FULL, 6);
    expect(hits.at(-1)?.partials[1].frequency).toBeCloseTo(3700 * 0.85 ** FULL, 6);
    expect(hits.at(-1)?.partials[0].seconds).toBeCloseTo(0.26, 6);
  });

  it('brings the beating sawtooth in at the third hour', () => {
    expect(stepVoices(2, FULL).beat).toBeUndefined();

    const third = stepVoices(3, FULL);

    expect(third.beat?.type).toBe('sawtooth');
    expect(third.beat?.frequency).toBeCloseTo(third.partials[0].frequency + 7, 6);
  });

  it('brings the sub in at the sixth hour', () => {
    expect(stepVoices(5, FULL).sub).toBeUndefined();
    expect(stepVoices(6, FULL).sub?.frequency).toBe(55);
  });

  it('never plays a step louder than one detent, however many voices it has', () => {
    for (let step = 1; step <= FULL; step += 1) {
      expect(loudness(stepVoices(step, FULL))).toBeCloseTo(PEAK_GAIN, 6);
    }
  });

  it('escalates a three-hour show the same way it escalates a twelve', () => {
    const short = [1, 2, 3].map((step) => stepVoices(step, 3));

    expect(short.at(0)?.beat).toBeUndefined();
    expect(short.at(1)?.beat).toBeDefined();
    expect(short.at(1)?.sub).toBeDefined();
    expect(short.at(-1)?.partials[0].seconds).toBeCloseTo(
      stepVoices(FULL, FULL).partials[0].seconds,
      6,
    );
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
      playTick();
      playStep(1, FULL);
      playCheckout();
    }).not.toThrow();
  });
});
