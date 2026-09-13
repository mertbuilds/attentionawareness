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

/** A page with one answer in it, and the show that reveals it. */
function Hero({
  answer,
  onArrive,
  onFact,
  onMetrics,
  onSettle,
}: {
  answer: Entered;
  onArrive: (entered: Entered, shown: boolean) => void;
  onFact?: (hours: number) => void;
  onMetrics?: () => void;
  onSettle?: () => void;
}) {
  const { start } = useShow({
    onArrive,
    onFact: onFact ?? (() => {}),
    onMetrics: onMetrics ?? (() => {}),
    onSettle: onSettle ?? (() => {}),
  });
  return (
    <section>
      <button onClick={() => start(answer)} type="button">
        show me
      </button>
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useShow', () => {
  it('leaves the question standing for a beat before the day is totalled', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    render(<Hero answer={{ hours: 5 }} onArrive={arrived} />);

    submit();
    advance(599);

    expect(arrived).not.toHaveBeenCalled();

    advance(1);
    expect(arrived).toHaveBeenCalledWith({ hours: 5 }, true);
  });

  it('itemizes the total, then names the hour, then sells, a beat apart', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const itemized = vi.fn<() => void>();
    const said = vi.fn<(hours: number) => void>();
    const settled = vi.fn<() => void>();
    render(
      <Hero
        answer={{ hours: 5 }}
        onArrive={() => {}}
        onFact={said}
        onMetrics={itemized}
        onSettle={settled}
      />,
    );

    submit();
    // The beat the question holds before it is answered.
    advance(600);
    expect(itemized).not.toHaveBeenCalled();

    advance(400);
    expect(itemized).toHaveBeenCalledTimes(1);
    expect(said).not.toHaveBeenCalled();

    advance(400);
    expect(said).toHaveBeenCalledWith(5);
    expect(settled).not.toHaveBeenCalled();

    advance(400);
    expect(settled).toHaveBeenCalledTimes(1);

    // The script ends on the pitch: nothing fires after it.
    advance(4000);
    expect(itemized).toHaveBeenCalledTimes(1);
    expect(said).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('gives a day under an hour the one line it has', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const said = vi.fn<(hours: number) => void>();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    render(<Hero answer={{ hours: 0 }} onArrive={arrived} onFact={said} />);

    submit();
    advance(600 + 400 + 400);

    expect(said).toHaveBeenCalledWith(1);
    expect(arrived).toHaveBeenCalledWith({ hours: 0 }, true);
  });

  it('runs nothing at all for a reader who asked for less motion', () => {
    stubMotion(true);
    vi.useFakeTimers();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    const itemized = vi.fn<() => void>();
    const said = vi.fn<(hours: number) => void>();
    const settled = vi.fn<() => void>();
    render(
      <Hero
        answer={{ hours: 7 }}
        onArrive={arrived}
        onFact={said}
        onMetrics={itemized}
        onSettle={settled}
      />,
    );

    submit();

    expect(arrived).toHaveBeenCalledWith({ hours: 7 }, false);
    expect(itemized).toHaveBeenCalledTimes(1);
    expect(said).toHaveBeenCalledWith(7);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('stops where it is when the page goes', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const arrived = vi.fn<(entered: Entered, shown: boolean) => void>();
    const view = render(<Hero answer={{ hours: 9 }} onArrive={arrived} />);

    submit();
    advance(400);
    view.unmount();
    advance(4000);

    expect(arrived).not.toHaveBeenCalled();
  });

  it('drops the pitch with the page, even once the total is standing', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const itemized = vi.fn<() => void>();
    const settled = vi.fn<() => void>();
    const view = render(
      <Hero answer={{ hours: 1 }} onArrive={() => {}} onMetrics={itemized} onSettle={settled} />,
    );

    submit();
    advance(600 + 400);
    view.unmount();
    advance(400 + 400);

    expect(itemized).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
  });
});
