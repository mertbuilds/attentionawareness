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

/** The bill the answers in these tests print: six items and the four after. */
const BILL = { lines: 10, total: 9 };

/** A page with one answer in it, and the show that counts it out. */
function Hero({
  answer,
  onArrive,
  onPrint,
  onSettle,
  onStep,
}: {
  answer: Entered;
  onArrive: (entered: Entered, shown: boolean) => void;
  onPrint?: (line: number, bill: typeof BILL) => void;
  onSettle?: () => void;
  onStep: (hours: number, total: number) => void;
}) {
  const { running, start } = useShow({
    onArrive,
    onPrint: onPrint ?? (() => {}),
    onSettle: onSettle ?? (() => {}),
    onStep,
  });
  return (
    <section>
      <button onClick={() => start(answer, BILL)} type="button">
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
  it('prints one hour at a time up to the answer, then lands on it', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    render(<Hero answer={{ hours: 5 }} onArrive={arrived} onStep={steps} />);

    submit();

    expect(steps.mock.calls).toEqual([[1, 5]]);
    expect(state()).toBe('running');

    advance(2200);
    expect(steps.mock.calls.at(-1)).toEqual([2, 5]);

    advance(2200 * 3);
    expect(steps.mock.calls.map(([hours]) => hours)).toEqual([1, 2, 3, 4, 5]);
    expect(arrived).not.toHaveBeenCalled();

    advance(600);
    expect(arrived).toHaveBeenCalledWith({ hours: 5 }, true);
    expect(state()).toBe('idle');
  });

  it('prints the bill a line at a time once the line has settled', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const lines = vi.fn<(line: number, bill: typeof BILL) => void>();
    render(<Hero answer={{ hours: 1 }} onArrive={() => {}} onPrint={lines} onStep={() => {}} />);

    submit();
    advance(600);

    // The line takes the beat after the climb to settle into place.
    expect(lines).not.toHaveBeenCalled();

    advance(300);
    expect(lines.mock.calls.at(-1)?.[0]).toBe(1);

    advance(240 * 9);
    expect(lines.mock.calls.map(([line]) => line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // The bill ends where it ends: nothing prints past its last line.
    advance(240 * 4);
    expect(lines).toHaveBeenCalledTimes(10);
  });

  it('leaves the total standing for a beat before the pitch', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const settled = vi.fn<() => void>();
    render(<Hero answer={{ hours: 1 }} onArrive={() => {}} onSettle={settled} onStep={() => {}} />);

    submit();
    // The climb, the settle, and every line up to the total.
    advance(600 + 300 + 240 * 8);
    expect(settled).not.toHaveBeenCalled();

    advance(400);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('gives a day under an hour a single beat', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    render(<Hero answer={{ hours: 0 }} onArrive={arrived} onStep={steps} />);

    submit();
    advance(600);

    expect(steps.mock.calls).toEqual([[1, 1]]);
    expect(arrived).toHaveBeenCalledWith({ hours: 0 }, true);
  });

  it('runs nothing at all for a reader who asked for less motion', () => {
    stubMotion(true);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    const lines = vi.fn<(line: number, bill: typeof BILL) => void>();
    const settled = vi.fn<() => void>();
    render(
      <Hero
        answer={{ hours: 7 }}
        onArrive={arrived}
        onPrint={lines}
        onSettle={settled}
        onStep={steps}
      />,
    );

    submit();
    advance(2200 * 12);

    expect(steps).not.toHaveBeenCalled();
    expect(lines).not.toHaveBeenCalled();
    expect(arrived).toHaveBeenCalledWith({ hours: 7 }, false);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(state()).toBe('idle');
  });

  it('stops where it is when the page goes', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const steps = vi.fn<(hours: number, total: number) => void>();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    const view = render(<Hero answer={{ hours: 9 }} onArrive={arrived} onStep={steps} />);

    submit();
    advance(2200);
    view.unmount();
    advance(2200 * 12);

    expect(steps.mock.calls.map(([hours]) => hours)).toEqual([1, 2]);
    expect(arrived).not.toHaveBeenCalled();
  });

  it('drops the pitch with the page, even once the bill is printing', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const settled = vi.fn<() => void>();
    const view = render(
      <Hero answer={{ hours: 1 }} onArrive={() => {}} onSettle={settled} onStep={() => {}} />,
    );

    submit();
    advance(600 + 300 + 240 * 8);
    view.unmount();
    advance(400);

    expect(settled).not.toHaveBeenCalled();
  });
});
