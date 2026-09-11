import { afterEach, describe, expect, it, vi } from 'vitest';

/** Each test gets its own module: the opened device is module state. */
async function loadTickSound() {
  vi.resetModules();
  return import('./tick-sound.ts');
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'AudioContext');
});

describe('tick sound', () => {
  it('stays silent where the browser has no Web Audio', async () => {
    const { playTick, primeTickSound } = await loadTickSound();

    expect(() => {
      primeTickSound();
      playTick();
    }).not.toThrow();
  });

  it('reports no device to unlock where the browser has no Web Audio', async () => {
    const { unlockTickSound } = await loadTickSound();

    expect(unlockTickSound()).toBe(false);
  });

  it('plays one shaped tone per detent once a device is open', async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const ramp = vi.fn();
    const oscillator = {
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      start,
      stop,
      type: '',
    };
    const gain = {
      connect: vi.fn(),
      gain: { exponentialRampToValueAtTime: ramp, setValueAtTime: vi.fn() },
    };
    const context = {
      createGain: () => gain,
      createOscillator: () => oscillator,
      currentTime: 0,
      destination: {},
      state: 'running',
    };
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: function AudioContextStub() {
        return context;
      },
    });
    const { playTick, primeTickSound } = await loadTickSound();

    primeTickSound();
    playTick();

    expect(oscillator.type).toBe('sine');
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 0);
    expect(start).toHaveBeenCalledWith(0);
    expect(stop).toHaveBeenCalledWith(0.012);
  });

  it('wakes a sleeping device and runs one silent sample through it', async () => {
    const resume = vi.fn(() => Promise.resolve());
    const source = { buffer: null, connect: vi.fn(), start: vi.fn() };
    const buffer = {};
    const context = {
      createBuffer: vi.fn(() => buffer),
      createBufferSource: () => source,
      destination: {},
      resume,
      state: 'suspended',
    };
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: function AudioContextStub() {
        return context;
      },
    });
    const { unlockTickSound } = await loadTickSound();

    expect(unlockTickSound()).toBe(true);

    expect(resume).toHaveBeenCalled();
    expect(context.createBuffer).toHaveBeenCalledWith(1, 1, 22_050);
    expect(source.buffer).toBe(buffer);
    expect(source.start).toHaveBeenCalledWith(0);
  });

  it('drops the pitch and holds it longer at the ends of the travel', async () => {
    const oscillator = {
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
      type: '',
    };
    const gain = {
      connect: vi.fn(),
      gain: { exponentialRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
    };
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: function AudioContextStub() {
        return {
          createGain: () => gain,
          createOscillator: () => oscillator,
          currentTime: 0,
          destination: {},
          state: 'running',
        };
      },
    });
    const { playTick, primeTickSound } = await loadTickSound();

    primeTickSound();
    playTick({ end: true });

    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(700, 0);
    expect(oscillator.stop).toHaveBeenCalledWith(0.04);
  });
});
