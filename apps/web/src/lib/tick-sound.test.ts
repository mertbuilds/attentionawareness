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
  it('opens no device where the browser has no Web Audio', async () => {
    const { primeTickSound, tickDevice } = await loadTickSound();

    expect(() => primeTickSound()).not.toThrow();
    expect(tickDevice()).toBeNull();
  });

  it('reports no device to unlock where the browser has no Web Audio', async () => {
    const { unlockTickSound } = await loadTickSound();

    expect(unlockTickSound()).toBe(false);
  });

  it('opens one device, and hands the same one to every later sound', async () => {
    const context = { destination: {}, resume: vi.fn(() => Promise.resolve()), state: 'running' };
    const open = vi.fn(() => context);
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: function AudioContextStub() {
        return open();
      },
    });
    const { primeTickSound, tickDevice } = await loadTickSound();

    primeTickSound();

    expect(tickDevice()).toBe(context);
    expect(open).toHaveBeenCalledTimes(1);
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
});
