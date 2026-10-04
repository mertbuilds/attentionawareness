import { createServerFn } from '@tanstack/react-start';
import type { OpenNumbersAnswer } from './open-numbers.ts';

/**
 * The numbers for `/open`, read on the Worker: while the server draws the
 * page, and again when a reader comes to it from another page. The PostHog
 * key stays on the Worker; only totals come back.
 */
export const getOpenNumbers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OpenNumbersAnswer> => {
    const { loadOpenNumbers } = await import('./open-numbers.server.ts');
    return loadOpenNumbers();
  },
);
