import type { PostHog, PostHogConfig } from 'posthog-js';
import { isLiveHost } from './canonical.ts';
import { whenIdle } from './idle.ts';

type Call = (client: PostHog) => void;

let client: PostHog | undefined;
let started = false;
const queue: Array<Call> = [];

function run(call: Call): void {
  if (client !== undefined) {
    call(client);
  } else if (started) {
    queue.push(call);
  }
}

/** How many calls wait for PostHog to load. */
export function queuedCalls(): number {
  return queue.length;
}

/**
 * Loads PostHog after the page is in and alive, so it is not part of what a
 * visitor waits for. Events sent before then wait in a queue and go after it
 * loads, in order. Off the live site, and without a call to this, nothing
 * loads, nothing is sent and nothing waits.
 */
export function startAnalytics(
  hostname: string,
  apiKey: string,
  options: Partial<PostHogConfig>,
): void {
  if (!isLiveHost(hostname)) {
    return;
  }
  started = true;
  whenIdle(() => {
    void import('posthog-js').then(
      ({ posthog: ready }) => {
        ready.init(apiKey, options);
        client = ready;
        for (const call of queue.splice(0)) {
          call(ready);
        }
      },
      () => {
        // PostHog did not load: nothing more waits for it.
        started = false;
        queue.length = 0;
      },
    );
  });
}

/** The site's PostHog calls. They wait while PostHog loads, and do nothing without it. */
export const posthog = {
  capture(...args: Parameters<PostHog['capture']>): void {
    run((ready) => {
      ready.capture(...args);
    });
  },
  logger: {
    info(...args: Parameters<PostHog['logger']['info']>): void {
      run((ready) => {
        ready.logger.info(...args);
      });
    },
  },
};
