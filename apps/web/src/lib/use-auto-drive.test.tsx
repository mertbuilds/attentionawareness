import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutoDrive } from './use-auto-drive.ts';

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

/** A section the drive can watch, with the one control that calls it off. */
function Dial({ onStep }: { onStep: (hours: number) => void }) {
  const { cancel, ref } = useAutoDrive({ from: 1, onStep, to: 4 });
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

describe('useAutoDrive', () => {
  it('turns the dial one step at a time once the section is on screen', () => {
    stubObserver();
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number) => void>();

    render(<Dial onStep={steps} />);

    expect(steps.mock.calls.flat()).toEqual([1]);

    advance(700);
    expect(steps.mock.calls.flat()).toEqual([1, 2]);

    advance(1400);
    expect(steps.mock.calls.flat()).toEqual([1, 2, 3, 4]);

    // Four is where it rests: there is no fifth step to wait for.
    advance(2100);
    expect(steps.mock.calls.flat()).toEqual([1, 2, 3, 4]);
  });

  it('leaves the dial alone where there is no observer to ask', () => {
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number) => void>();

    render(<Dial onStep={steps} />);
    advance(3500);

    expect(steps).not.toHaveBeenCalled();
  });

  it('leaves the dial alone for a reader who asked for less motion', () => {
    stubObserver();
    stubMotion(true);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number) => void>();

    render(<Dial onStep={steps} />);
    advance(3500);

    expect(steps).not.toHaveBeenCalled();
  });

  it('stops where it stands once it is called off', () => {
    stubObserver();
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number) => void>();
    render(<Dial onStep={steps} />);

    advance(700);
    fireEvent.click(screen.getByRole('button'));
    advance(3500);

    expect(steps.mock.calls.flat()).toEqual([1, 2]);
  });
});
