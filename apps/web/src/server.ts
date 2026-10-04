import handler from '@tanstack/react-start/server-entry';
import { initWorkersLogger } from 'evlog/workers';
import { canonicalRedirect } from './lib/canonical.ts';
import { macFileEvent, sendMacEvent } from './lib/mac-analytics.ts';
import { macFileResponse } from './lib/mac-files.ts';
import type { MacFilesBucket } from './lib/mac-files.ts';
import { setOpenNumbersKey } from './lib/open-numbers.server.ts';
import { removedPathRedirect } from './lib/redirects.ts';
import { setSigningSecrets } from './lib/signing-secrets.ts';
import { paraglideMiddleware } from './paraglide/server.js';

interface WorkerEnv {
  AXIOM_DATASET?: string;
  AXIOM_TOKEN?: string;
  MAC_FILES: MacFilesBucket;
  OPENPANEL_CLIENT_ID?: string;
  OPENPANEL_CLIENT_SECRET?: string;
  POSTHOG_PERSONAL_API_KEY?: string;
  SIGNING_CERT_PEM?: string;
  SIGNING_CHAIN_PEM?: string;
  SIGNING_KEY_PKCS8_PEM?: string;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

let loggerReady = false;

async function initLoggerOnce(env: WorkerEnv): Promise<void> {
  if (loggerReady) {
    return;
  }
  loggerReady = true;
  if (env.AXIOM_TOKEN && env.AXIOM_DATASET) {
    const { createAxiomDrain } = await import('evlog/axiom');
    initWorkersLogger({
      drain: createAxiomDrain({
        dataset: env.AXIOM_DATASET,
        token: env.AXIOM_TOKEN,
      }),
      env: { service: 'web' },
    });
  } else {
    initWorkersLogger({ env: { service: 'web' } });
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContextLike): Promise<Response> {
    await initLoggerOnce(env);
    // Bindings reach a Worker's fetch and nothing else, so the signing route
    // is handed them here rather than reading an env it cannot see.
    setSigningSecrets(env);
    setOpenNumbersKey(env);
    const { createWorkersLogger } = await import('evlog/workers');
    const log = createWorkersLogger(request, { executionCtx: ctx });
    const url = new URL(request.url);
    log.set({ method: request.method, path: url.pathname });
    try {
      const response =
        canonicalRedirect(url) ??
        removedPathRedirect(url) ??
        (await macFileResponse(request, url, env.MAC_FILES)) ??
        (await paraglideMiddleware(request, () => handler.fetch(request)));
      log.set({ status: response.status });
      const event = macFileEvent(request, url, response);
      if (event !== null) {
        ctx.waitUntil(sendMacEvent(event, request, env));
      }
      return response;
    } catch (error) {
      log.error(error instanceof Error ? error : String(error));
      throw error;
    } finally {
      log.emit();
    }
  },
};
