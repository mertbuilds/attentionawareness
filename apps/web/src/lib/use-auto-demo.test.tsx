import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutoDemo } from './use-auto-demo.ts';

/** The keys the demonstration presses, as the page hands them over: once. */
const KEYS = ['4', '1', '5'];

/** An observer that reports its target on screen the moment it is watched. */
function stubObserver(): void {
  vi.stubGlobal(
    'IntersectionObserver',
    function observer(watch: (entries: Array<{ intersectionRatio: number }>) => void) {
      return {
        disconnect() {},
        observe() {
          watch([{ intersectionRatio: 1 }]);
        },
        unobserve() {},
      };
    },
  );
}

/** What the reader asked the browser for, which jsdom has no opinion about. */
function stubMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (media: string) => ({
    addEventListener() {},
    matches: reduce && media === '(prefers-reduced-motion: reduce)',
    media,
    removeEventListener() {},
  }));
}

/** A section the demonstration can watch, with the one control that calls it off. */
function Register({ onClear, onKey }: { onClear: () => void; onKey: (key: string) => void }) {
  const { cancel, ref } = useAutoDemo({ keys: KEYS, onClear, onKey });
  return (
    <section ref={ref}>
      <button onClick={cancel} type="button">
        stop
      </button>
    </section>
  );
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAutoDemo', () => {
  it('empties the register, then keys it in one press at a time', () => {
    stubObserver();
    stubMotion(false);
    vi.useFakeTimers();
    const cleared = vi.fn();
    const pressed = vi.fn<(key: string) => void>();

    render(<Register onClear={cleared} onKey={pressed} />);

    expect(cleared).toHaveBeenCalledTimes(1);
    expect(pressed).not.toHaveBeenCalled();

    advance(450);
    expect(pressed.mock.calls.flat()).toEqual(['4']);

    advance(900);
    expect(pressed.mock.calls.flat()).toEqual(['4', '1', '5']);

    // The last key is where it rests: there is no fourth press to wait for.
    advance(1350);
    expect(pressed.mock.calls.flat()).toEqual(['4', '1', '5']);
  });

  it('leaves the register alone where there is no observer to ask', () => {
    vi.useFakeTimers();
    const cleared = vi.fn();
    const pressed = vi.fn<(key: string) => void>();

    render(<Register onClear={cleared} onKey={pressed} />);
    advance(2250);

    expect(cleared).not.toHaveBeenCalled();
    expect(pressed).not.toHaveBeenCalled();
  });

  it('leaves the register alone for a reader who asked for less motion', () => {
    stubObserver();
    stubMotion(true);
    vi.useFakeTimers();
    const cleared = vi.fn();
    const pressed = vi.fn<(key: string) => void>();

    render(<Register onClear={cleared} onKey={pressed} />);
    advance(2250);

    expect(cleared).not.toHaveBeenCalled();
    expect(pressed).not.toHaveBeenCalled();
  });

  it('stops where it stands once it is called off', () => {
    stubObserver();
    stubMotion(false);
    vi.useFakeTimers();
    const pressed = vi.fn<(key: string) => void>();
    render(<Register onClear={() => {}} onKey={pressed} />);

    advance(450);
    fireEvent.click(screen.getByRole('button'));
    advance(2250);

    expect(pressed.mock.calls.flat()).toEqual(['4']);
  });
});
