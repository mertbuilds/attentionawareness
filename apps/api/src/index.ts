import { init as initSentry } from '@sentry/node';
import { createDb } from '@web-starter/db';
import { parseServerEnv } from '@web-starter/env/server';
import { initLogger } from 'evlog';
import { buildServer } from './server.ts';

const env = parseServerEnv();

if (env.SENTRY_DSN) {
  initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

initLogger({
  env: { service: 'api' },
});

const db = createDb(env.DATABASE_URL);
const app = await buildServer({ db, env });

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down.`);
  await app.close();
  await db.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

const port = env.PORT ?? env.API_PORT;
await app.listen({ host: '0.0.0.0', port });
// eslint-disable-next-line no-console
console.log(`api listening on :${port}`);
