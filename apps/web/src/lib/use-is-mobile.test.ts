import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useIsMobile } from './use-is-mobile.ts';

const MOBILE_QUERY = '(max-width: 639px)';
const realMatchMedia = window.matchMedia;

/**
 * jsdom evaluates no media query of its own, so the window is stubbed with one
 * that answers the breakpoint and can change its mind about it later.
 */
function stubViewport(phone: boolean) {
  const listeners = new Set<() => void>();
  let matches = phone;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      get matches() {
        return media === MOBILE_QUERY && matches;
      },
      media,
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }),
  });
  return function resize(next: boolean) {
    matches = next;
    for (const listener of listeners) {
      listener();
    }
  };
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: realMatchMedia });
});

describe('useIsMobile', () => {
  it('says no on a window wider than the breakpoint', () => {
    stubViewport(false);

    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('says yes on a phone-sized window', () => {
    stubViewport(true);

    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it('follows the window across the breakpoint', () => {
    const resize = stubViewport(false);
    const { result } = renderHook(() => useIsMobile());

    act(() => resize(true));
    expect(result.current).toBe(true);

    act(() => resize(false));
    expect(result.current).toBe(false);
  });

  it('says no where the browser answers no media query at all', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });

    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });
});
