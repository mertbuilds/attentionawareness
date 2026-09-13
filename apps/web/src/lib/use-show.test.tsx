import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShow } from './use-show.ts';
import type { Entered } from './use-show.ts';

/** What the reader asked the browser for, which jsdom has no opinion about. */
function stubMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (media: string) => ({
    addEventListener() {},
    matches: reduce && media === '(prefers-reduced-motion: reduce)',
    media,
    removeEventListener() {},
  }));
}

/** A page with one answer in it, and the dial the show turns. */
function Hero({
  answer,
  onSettle,
  onStep,
}: {
  answer: Entered;
  onSettle: (entered: Entered, shown: boolean) => void;
  onStep: (hours: number, total: number) => void;
}) {
  const { running, start } = useShow({ onSettle, onStep });
  return (
    <section>
      <button onClick={() => start(answer)} type="button">
        show me
      </button>
      <p>{running ? 'running' : 'idle'}</p>
    </section>
  );
}

function submit(): void {
  fireEvent.click(screen.getByRole('button'));
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function state(): string {
  return screen.getByText(/running|idle/).textContent ?? '';
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useShow', () => {
  it('prints one hour at a time up to the answer, then settles on it', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const settled = vi.fn<(entered: Entered, shown: boolean) => void>();
    render(<Hero answer={{ hours: 5, minutes: 30 }} onSettle={settled} onStep={steps} />);

    submit();

    expect(steps.mock.calls).toEqual([[1, 5]]);
    expect(state()).toBe('running');

    advance(1600);
    expect(steps.mock.calls.at(-1)).toEqual([2, 5]);

    advance(1600 * 3);
    expect(steps.mock.calls.map(([hours]) => hours)).toEqual([1, 2, 3, 4, 5]);
    expect(settled).not.toHaveBeenCalled();

    advance(600);
    expect(settled).toHaveBeenCalledWith({ hours: 5, minutes: 30 }, true);
    expect(state()).toBe('idle');
  });

  it('gives a day under an hour a single beat', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const settled = vi.fn<(entered: Entered, shown: boolean) => void>();
    render(<Hero answer={{ hours: 0, minutes: 45 }} onSettle={settled} onStep={steps} />);

    submit();
    advance(600);

    expect(steps.mock.calls).toEqual([[1, 1]]);
    expect(settled).toHaveBeenCalledWith({ hours: 0, minutes: 45 }, true);
  });

  it('runs nothing at all for a reader who asked for less motion', () => {
    stubMotion(true);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const settled = vi.fn<(entered: Entered, shown: boolean) => void>();
    render(<Hero answer={{ hours: 7, minutes: 0 }} onSettle={settled} onStep={steps} />);

    submit();
    advance(1600 * 12);

    expect(steps).not.toHaveBeenCalled();
    expect(settled).toHaveBeenCalledWith({ hours: 7, minutes: 0 }, false);
    expect(state()).toBe('idle');
  });

  it('stops where it is when the page goes', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const settled = vi.fn<(entered: Entered, shown: boolean) => void>();
    const view = render(
      <Hero answer={{ hours: 9, minutes: 0 }} onSettle={settled} onStep={steps} />,
    );

    submit();
    advance(1600);
    view.unmount();
    advance(1600 * 12);

    expect(steps.mock.calls.map(([hours]) => hours)).toEqual([1, 2]);
    expect(settled).not.toHaveBeenCalled();
  });
});
